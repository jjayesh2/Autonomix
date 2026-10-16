import axios from 'axios';
import { db } from '../db/supabase.js';
import { budgetGuard } from '../payments/budgetGuard.js';
import { x402Engine, X402PaymentRequirement } from '../payments/x402Protocol.js';
import { validateSchema } from '../utils/schemaValidator.js';
import { Agent, Task, TaskStep, Transaction } from '../db/types.js';
import { aiService } from '../ai/aiService.js';
import { TokenUsage } from '../ai/types.js';

export interface PlannedStep {
  stepNumber: number;
  agent: Agent;
  actionType: string;
  rationale: string;
  estimatedCost: number;
  inputPayload: any;
}

export interface OrchestrationPlan {
  steps: PlannedStep[];
  totalEstimatedCost: number;
  budgetLimit: number;
  canExecute: boolean;
  explanation: string;
  aiMetadata?: {
    model: string;
    provider: string;
    usage?: TokenUsage;
    costUsd: number;
    latencyMs: number;
  };
}

export class BuyerAgentOrchestrator {
  /**
   * Analyzes user task description using Google Gemini / AI Service,
   * matches approved marketplace agents, and plans the minimal cost-effective execution path.
   */
  async planTask(description: string, budgetLimit: number): Promise<OrchestrationPlan> {
    const approvedAgents = await db.getApprovedAgents();
    if (approvedAgents.length === 0) {
      return {
        steps: [],
        totalEstimatedCost: 0,
        budgetLimit,
        canExecute: false,
        explanation: 'No approved agents currently available in the marketplace.',
      };
    }

    // Call the server-side AI Service to plan the task using Gemini or fallback
    const aiPlanResult = await aiService.planTaskWithAI(description, budgetLimit, approvedAgents);
    const structuredPlan = aiPlanResult.data;

    const plannedSteps: PlannedStep[] = [];
    let runningServiceCost = 0;

    for (let i = 0; i < structuredPlan.steps.length; i++) {
      const stepItem = structuredPlan.steps[i];
      // Match agent by ID or by category
      let matchedAgent = approvedAgents.find((a) => a.id === stepItem.agentId);
      if (!matchedAgent) {
        matchedAgent = approvedAgents.find((a) => a.category === stepItem.category) || approvedAgents[0];
      }

      const cost = matchedAgent.price_usdc;
      runningServiceCost += cost;

      plannedSteps.push({
        stepNumber: i + 1,
        agent: matchedAgent,
        actionType: stepItem.actionType || `${matchedAgent.category} Service Execution`,
        rationale: stepItem.rationale || `Selected ${matchedAgent.name} based on capability matching.`,
        estimatedCost: cost,
        inputPayload: stepItem.inputPayload || {},
      });
    }

    // Enforce total budget limit: sum of seller service costs + model provider costs
    const totalEstimatedCost = Number((runningServiceCost + (aiPlanResult.costUsd || 0)).toFixed(4));
    const canExecute = totalEstimatedCost <= budgetLimit && plannedSteps.length > 0;

    const explanation = canExecute
      ? `Task plan verified within budget. Selected ${plannedSteps.length} specialized service agents totaling ${totalEstimatedCost} USDC against ${budgetLimit} USDC budget (Planned by ${aiPlanResult.model}).`
      : `Budget Insufficient: Planned multi-agent execution requires ${totalEstimatedCost} USDC, but budget limit is capped at ${budgetLimit} USDC.`;

    return {
      steps: plannedSteps,
      totalEstimatedCost,
      budgetLimit,
      canExecute,
      explanation,
      aiMetadata: {
        model: aiPlanResult.model,
        provider: aiPlanResult.provider,
        usage: aiPlanResult.usage,
        costUsd: aiPlanResult.costUsd,
        latencyMs: aiPlanResult.latencyMs,
      },
    };
  }

  /**
   * Executes an orchestrated task end-to-end with x402 v2 payment flows, strict budget locking,
   * and live Base Sepolia telemetry.
   */
  async executeTask(taskId: string): Promise<Task> {
    const task = await db.getTaskById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    await db.updateTask(taskId, { status: 'planning' });

    const plan: OrchestrationPlan =
      task.orchestration_plan || (await this.planTask(task.description, task.budget_limit));

    if (!plan.canExecute) {
      await db.updateTask(taskId, {
        status: 'failed',
        rationale: plan.explanation,
        completed_at: new Date().toISOString(),
      });
      throw new Error(plan.explanation);
    }

    await db.updateTask(taskId, {
      status: 'in_progress',
      orchestration_plan: plan,
      rationale: plan.explanation,
    });

    // Record server-side model provider planning cost against total budget
    if (plan.aiMetadata?.costUsd && plan.aiMetadata.costUsd > 0) {
      await budgetGuard.recordModelCost(taskId, plan.aiMetadata.costUsd);
    }

    const accumulatedContexts: string[] = [];
    let successfulCount = 0;

    for (const step of plan.steps) {
      const stepStartTime = Date.now();

      // 1. Concurrency-safe atomic budget reservation
      const reservation = await budgetGuard.reserveBudget(taskId, step.agent.id, step.estimatedCost);
      if (!reservation.success) {
        await db.createTaskStep({
          id: `step_${taskId}_${step.stepNumber}`,
          task_id: taskId,
          step_number: step.stepNumber,
          agent_id: step.agent.id,
          agent_name: step.agent.name,
          action_type: step.actionType,
          status: 'failed',
          latency_ms: 0,
          price_paid: 0,
          error_message: reservation.error || 'Budget reservation limit exceeded',
          created_at: new Date().toISOString(),
        });
        break;
      }

      // 2. Create running task step record
      const stepRecord = await db.createTaskStep({
        id: `step_${taskId}_${step.stepNumber}`,
        task_id: taskId,
        step_number: step.stepNumber,
        agent_id: step.agent.id,
        agent_name: step.agent.name,
        action_type: step.actionType,
        input_payload: step.inputPayload,
        status: 'running',
        latency_ms: 0,
        price_paid: 0,
        created_at: new Date().toISOString(),
      });

      // Prepare request payload (augment inference step with preceding outputs)
      let requestPayload = { ...step.inputPayload };
      if (step.agent.category === 'Inference' && accumulatedContexts.length > 0) {
        requestPayload.context = accumulatedContexts.join('\n---\n');
      }

      try {
        // 3. Request agent service (Expect HTTP 402 Payment Challenge)
        let challenge: X402PaymentRequirement;
        try {
          await axios.post(step.agent.endpoint_url, requestPayload, {
            timeout: 8000,
            headers: { 'Content-Type': 'application/json' },
          });
          throw new Error('Expected HTTP 402 challenge, but service responded without payment requirement.');
        } catch (initialErr: any) {
          if (initialErr.response && initialErr.response.status === 402) {
            challenge = initialErr.response.data?.paymentRequirement;
            if (!challenge) {
              const headerRaw = initialErr.response.headers['x-payment-required'];
              if (headerRaw) challenge = JSON.parse(headerRaw);
            }
          } else {
            throw new Error(`Failed contacting service endpoint: ${initialErr.message}`);
          }
        }

        if (!challenge) {
          throw new Error('Malformed 402 challenge: missing payment requirement structure');
        }

        // 4. Validate challenge terms and generate signed x402 v2 payment authorization
        const authorization = await x402Engine.authorizePayment(
          challenge,
          step.agent.recipient_address,
          step.estimatedCost
        );

        // 5. Send signed payment authorization to fulfill service
        const serviceResponse = await axios.post(step.agent.endpoint_url, requestPayload, {
          timeout: 12000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Buffer.from(JSON.stringify(authorization)).toString('base64')}`,
            'X-Payment': JSON.stringify(authorization),
          },
        });

        const latencyMs = Date.now() - stepStartTime;
        const resultData = serviceResponse.data;

        // 6. Validate output against registered agent output schema (Ajv)
        const schemaValidation = validateSchema(step.agent.output_schema, resultData);
        if (!schemaValidation.isValid) {
          console.warn(`[Orchestrator] Schema warning for ${step.agent.name}:`, schemaValidation.errors);
        }

        // 7. Commit budget reservation & record ledger transaction
        await budgetGuard.commitReservation(reservation.reservationId!);

        const receipt = resultData.paymentReceipt || {};
        const txRecord: Transaction = {
          id: `tx_${taskId}_${step.stepNumber}`,
          task_id: taskId,
          step_id: stepRecord.id,
          buyer_address: authorization.buyerAddress,
          seller_address: step.agent.recipient_address,
          agent_id: step.agent.id,
          token_address: challenge.token,
          chain_id: challenge.chainId,
          amount_usdc: step.estimatedCost,
          platform_fee_usdc: receipt.platformFeeUsdc || 0,
          tx_hash: receipt.txHash,
          explorer_url: receipt.explorerUrl,
          payment_status: 'confirmed',
          service_status: 'success',
          idempotency_key: authorization.nonce,
          nonce: authorization.nonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await db.createTransaction(txRecord);

        // 8. Update step record to completed
        await db.updateTaskStep(stepRecord.id, taskId, {
          status: 'completed',
          output_payload: resultData,
          latency_ms: latencyMs,
          price_paid: step.estimatedCost,
          tx_hash: receipt.txHash,
        });

        // 9. Record live performance metrics
        await db.recordMetrics(step.agent.id, true, latencyMs, step.estimatedCost);

        accumulatedContexts.push(`Agent [${step.agent.name}] output: ${JSON.stringify(resultData)}`);
        successfulCount++;
      } catch (stepErr: any) {
        if (reservation.reservationId) {
          budgetGuard.releaseReservation(reservation.reservationId);
        }

        const latencyMs = Date.now() - stepStartTime;
        await db.updateTaskStep(stepRecord.id, taskId, {
          status: 'failed',
          latency_ms: latencyMs,
          error_message: stepErr.message || 'Service execution error',
        });

        await db.recordMetrics(step.agent.id, false, latencyMs, 0);
        console.error(`[Orchestrator] Step ${step.stepNumber} failed:`, stepErr.message);
      }
    }

    // Determine final task status
    const finalStatus =
      successfulCount === plan.steps.length
        ? 'completed'
        : successfulCount > 0
        ? 'partially_completed'
        : 'failed';

    // Store synthesized final results with real AI model details
    await db.createTaskResult({
      id: `res_${taskId}`,
      task_id: taskId,
      final_summary: `Autonomix Task Orchestration Completed with ${successfulCount}/${plan.steps.length} successful agent service calls paid via HTTP 402 on Base Sepolia.`,
      structured_output: {
        taskGoal: task.description,
        totalSteps: plan.steps.length,
        successfulSteps: successfulCount,
        aiPlanningModel: plan.aiMetadata?.model || 'Gemini 3.5 Flash-Lite',
        aiPlanningCostUsd: plan.aiMetadata?.costUsd || 0,
        aiPlanningTokens: plan.aiMetadata?.usage?.totalTokens || 0,
        contexts: accumulatedContexts,
        completedAt: new Date().toISOString(),
      },
      total_steps: plan.steps.length,
      successful_steps: successfulCount,
      created_at: new Date().toISOString(),
    });

    const updatedTask = await db.updateTask(taskId, {
      status: finalStatus,
      completed_at: new Date().toISOString(),
    });

    return updatedTask!;
  }
}

export const buyerAgent = new BuyerAgentOrchestrator();
