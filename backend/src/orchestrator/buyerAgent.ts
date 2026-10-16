import axios from 'axios';
import { db } from '../db/supabase.js';
import { budgetGuard } from '../payments/budgetGuard.js';
import { x402Engine, X402PaymentRequirement } from '../payments/x402Protocol.js';
import { validateSchema } from '../utils/schemaValidator.js';
import { Agent, Task, TaskStep, Transaction } from '../db/types.js';

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
}

export class BuyerAgentOrchestrator {
  /**
   * Analyzes user task description, matches approved marketplace agents,
   * evaluates quality metrics, and plans the minimal cost-effective execution path.
   */
  async planTask(description: string, budgetLimit: number): Promise<OrchestrationPlan> {
    const lower = description.toLowerCase();
    const approvedAgents = await db.getApprovedAgents();

    const selectedAgents: Agent[] = [];

    // Match Data Agent capability
    const needsData = lower.includes('data') || lower.includes('market') || lower.includes('price') ||
      lower.includes('crypto') || lower.includes('eth') || lower.includes('btc') || lower.includes('oracle') ||
      lower.includes('financial') || lower.includes('multi-agent') || lower.includes('all three');

    // Match Scraping Agent capability
    const needsScraper = lower.includes('scrap') || lower.includes('extract') || lower.includes('web') ||
      lower.includes('product') || lower.includes('catalog') || lower.includes('hardware') ||
      lower.includes('crawl') || lower.includes('multi-agent') || lower.includes('all three');

    // Match Inference Agent capability
    const needsInference = lower.includes('summar') || lower.includes('synthes') || lower.includes('analyz') ||
      lower.includes('report') || lower.includes('sentiment') || lower.includes('brief') ||
      lower.includes('multi-agent') || lower.includes('all three') || (needsData && needsScraper);

    // If query didn't match specific keywords, default to multi-agent comprehensive workflow
    const isGeneric = !needsData && !needsScraper && !needsInference;

    const dataAgent = approvedAgents.find((a) => a.category === 'Data');
    const scraperAgent = approvedAgents.find((a) => a.category === 'Scraping');
    const inferenceAgent = approvedAgents.find((a) => a.category === 'Inference');

    if ((needsData || isGeneric) && dataAgent) selectedAgents.push(dataAgent);
    if ((needsScraper || isGeneric) && scraperAgent) selectedAgents.push(scraperAgent);
    if ((needsInference || isGeneric) && inferenceAgent) selectedAgents.push(inferenceAgent);

    // Fallback: If still empty, pick the lowest price approved agent
    if (selectedAgents.length === 0 && approvedAgents.length > 0) {
      selectedAgents.push(approvedAgents[0]);
    }

    // Sort steps logically: Data -> Scraping -> Inference
    const categoryOrder: Record<string, number> = { Data: 1, Scraping: 2, Inference: 3 };
    selectedAgents.sort((a, b) => (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99));

    const steps: PlannedStep[] = [];
    let runningCost = 0;

    for (let i = 0; i < selectedAgents.length; i++) {
      const agent = selectedAgents[i];
      runningCost += agent.price_usdc;

      let action = 'Data Query';
      let payload: any = { query: 'ETH' };
      let rationale = `Selected ${agent.name} for high reliability (${agent.metrics?.rating_average || 5.0}★) and lowest price in ${agent.category} category.`;

      if (agent.category === 'Data') {
        action = 'Oracle Price Feed Retrieval';
        payload = { query: lower.includes('btc') ? 'BTC' : lower.includes('base') ? 'BASE' : 'ETH' };
      } else if (agent.category === 'Scraping') {
        action = 'Sandbox Catalog Extraction';
        payload = { target: 'hardware', extract_fields: ['title', 'price', 'url'] };
        rationale = `Selected ${agent.name} to retrieve sandboxed public product catalog items without unauthorized scraping.`;
      } else if (agent.category === 'Inference') {
        action = 'AI Multi-Agent Synthesis';
        payload = { task_goal: description, format: 'executive_summary' };
        rationale = `Selected ${agent.name} to synthesize preceding agent outputs into a verified final briefing.`;
      }

      steps.push({
        stepNumber: i + 1,
        agent,
        actionType: action,
        rationale,
        estimatedCost: agent.price_usdc,
        inputPayload: payload,
      });
    }

    const totalEstimatedCost = Number(runningCost.toFixed(4));
    const canExecute = totalEstimatedCost <= budgetLimit;
    const explanation = canExecute
      ? `Task plan verified within budget. Selected ${steps.length} specialized service agents totaling ${totalEstimatedCost} USDC against ${budgetLimit} USDC max budget.`
      : `Budget Insufficient: Planned execution requires ${totalEstimatedCost} USDC, but budget limit is ${budgetLimit} USDC.`;

    return {
      steps,
      totalEstimatedCost,
      budgetLimit,
      canExecute,
      explanation,
    };
  }

  /**
   * Executes an orchestrated task end-to-end with x402 v2 payment flows and strict budget locking.
   */
  async executeTask(taskId: string): Promise<Task> {
    const task = await db.getTaskById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    await db.updateTask(taskId, { status: 'planning' });

    const plan: OrchestrationPlan = task.orchestration_plan || (await this.planTask(task.description, task.budget_limit));
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

    const accumulatedContexts: string[] = [];
    let successfulCount = 0;

    for (const step of plan.steps) {
      const stepStartTime = Date.now();

      // 1. Concurrency-safe atomic budget reservation
      const reservation = await budgetGuard.reserveBudget(taskId, step.agent.id, step.estimatedCost);
      if (!reservation.success) {
        // Record failed step due to budget
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
          error_message: reservation.error || 'Budget reservation failed',
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

      // Prepare payload (augment inference with previous outputs)
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
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Buffer.from(JSON.stringify(authorization)).toString('base64')}`,
            'X-Payment': JSON.stringify(authorization),
          },
        });

        const latencyMs = Date.now() - stepStartTime;
        const resultData = serviceResponse.data;

        // 6. Validate output against agent output schema
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
        // Release reservation upon failure
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

    // Store synthesized final results
    const lastContext = accumulatedContexts.length > 0
      ? accumulatedContexts[accumulatedContexts.length - 1]
      : 'No outputs generated';

    await db.createTaskResult({
      id: `res_${taskId}`,
      task_id: taskId,
      final_summary: `Autonomix Task Orchestration Completed with ${successfulCount}/${plan.steps.length} successful agent service calls paid via HTTP 402 on Base Sepolia.`,
      structured_output: {
        taskGoal: task.description,
        totalSteps: plan.steps.length,
        successfulSteps: successfulCount,
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
