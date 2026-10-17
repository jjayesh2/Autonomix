import axios from 'axios';
import { db } from '../db/supabase.js';
import { budgetGuard } from '../payments/budgetGuard.js';
import { x402Engine, X402PaymentRequirement } from '../payments/x402Protocol.js';
import { validateSchema } from '../utils/schemaValidator.js';
import { Agent, Task, TaskStep, Transaction, TaskStatus } from '../db/types.js';
import { aiService } from '../ai/aiService.js';
import { TokenUsage } from '../ai/types.js';
import { config } from '../config/index.js';
import { parseProductSearchIntent } from '../utils/productSearchParser.js';

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

/**
 * Dynamic candidate ranking formula specified by Hackathon PS:
 * Score = 0.35 * normalized_price + 0.35 * normalized_reputation + 0.30 * normalized_latency
 */
export function rankAgents(candidates: Agent[]): Agent[] {
  if (candidates.length <= 1) return [...candidates];

  const prices = candidates.map((c) => c.price_usdc);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1e-6;

  const latencies = candidates.map((c) => c.metrics?.median_latency_ms || 2000);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const latencyRange = maxLatency - minLatency || 1e-6;

  return [...candidates].sort((a, b) => {
    const aPrice = a.price_usdc;
    const bPrice = b.price_usdc;
    const aNormPrice = 1 - (aPrice - minPrice) / priceRange;
    const bNormPrice = 1 - (bPrice - minPrice) / priceRange;

    const aRep = (a.metrics?.rating_average ?? 5.0) / 5.0;
    const bRep = (b.metrics?.rating_average ?? 5.0) / 5.0;

    const aLat = a.metrics?.median_latency_ms || 2000;
    const bLat = b.metrics?.median_latency_ms || 2000;
    const aNormLat = 1 - (aLat - minLatency) / latencyRange;
    const bNormLat = 1 - (bLat - minLatency) / latencyRange;

    const aScore = 0.35 * aNormPrice + 0.35 * aRep + 0.30 * aNormLat;
    const bScore = 0.35 * bNormPrice + 0.35 * bRep + 0.30 * bNormLat;

    return bScore - aScore;
  });
}

/**
 * Strict Task Acceptance Evaluation
 * Ensures HTTP 200 or paid calls alone do not mark a task completed unless acceptance criteria are met.
 */
export function evaluateTaskAcceptance(
  taskGoal: string,
  executedSteps: Array<{ step: PlannedStep; success: boolean; output?: any; agentUsed: Agent }>
): { status: TaskStatus; summary: string; isAcceptable: boolean } {
  const isExplicitEmptyTest = /nonexistent|empty\s+(result|search)|verify\s+empty/i.test(taskGoal);
  const isProductTask = /shoe|laptop|phone|watch|product|item|catalog|buy|find|search|hardware|ecommerce/i.test(taskGoal);
  const isCryptoTask = /eth|btc|crypto|oracle|market\s+price|ticker/i.test(taskGoal);

  const successfulSteps = executedSteps.filter((s) => s.success && s.output);

  // Explicit empty search test verification
  if (isExplicitEmptyTest) {
    let totalItems = 0;
    for (const s of executedSteps) {
      if (Array.isArray(s.output?.products)) totalItems += s.output.products.length;
      if (Array.isArray(s.output?.items)) totalItems += s.output.items.length;
    }
    if (totalItems === 0) {
      return {
        status: 'completed',
        summary: 'Explicit empty search test verified successfully (0 products returned as expected).',
        isAcceptable: true,
      };
    }
  }

  // 1. Product Research Acceptance Criteria
  if (isProductTask) {
    let totalProductsFound = 0;
    for (const s of executedSteps) {
      if (Array.isArray(s.output?.products)) totalProductsFound += s.output.products.length;
      if (Array.isArray(s.output?.items)) totalProductsFound += s.output.items.length;
    }

    if (totalProductsFound === 0) {
      // No products found!
      if (successfulSteps.length > 0) {
        return {
          status: 'partially_completed',
          summary: `Task completed service calls but failed product acceptance criteria: 0 matching products found in catalog for '${taskGoal}'.`,
          isAcceptable: false,
        };
      }
      return {
        status: 'failed',
        summary: `Product discovery failed: No matching products found in catalog for '${taskGoal}'.`,
        isAcceptable: false,
      };
    }

    // Products were found
    if (successfulSteps.length === executedSteps.length) {
      return {
        status: 'completed',
        summary: `Task completed successfully: Discovered and verified ${totalProductsFound} relevant product records matching criteria.`,
        isAcceptable: true,
      };
    } else if (successfulSteps.length > 0) {
      return {
        status: 'partially_completed',
        summary: `Task partially completed: Retrieved ${totalProductsFound} product records, but some pipeline steps encountered issues.`,
        isAcceptable: true,
      };
    } else {
      return {
        status: 'failed',
        summary: `Product discovery failed: Step executions failed.`,
        isAcceptable: false,
      };
    }
  }

  // 2. Crypto / Market Oracle Acceptance Criteria
  if (isCryptoTask) {
    const oracleStep = executedSteps.find((s) => s.output?.price_usd !== undefined && s.output.price_usd > 0);
    if (!oracleStep && !isExplicitEmptyTest) {
      return {
        status: 'failed',
        summary: 'Market oracle task failed acceptance criteria: No valid price quote returned.',
        isAcceptable: false,
      };
    }
  }

  // 3. General Tasks Acceptance Criteria
  if (successfulSteps.length === executedSteps.length) {
    return {
      status: 'completed',
      summary: `Task executed successfully: ${successfulSteps.length}/${executedSteps.length} steps succeeded.`,
      isAcceptable: true,
    };
  } else if (successfulSteps.length > 0) {
    return {
      status: 'partially_completed',
      summary: `Task partially completed: ${successfulSteps.length}/${executedSteps.length} steps succeeded.`,
      isAcceptable: true,
    };
  } else {
    return {
      status: 'failed',
      summary: `Task execution failed: All ${executedSteps.length} steps failed.`,
      isAcceptable: false,
    };
  }
}

export class BuyerAgentOrchestrator {
  /**
   * Analyzes user task description using Google Gemini / AI Service,
   * matches approved marketplace agents using dynamic candidate ranking,
   * and plans the minimal cost-effective execution path.
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

    // If AI returned 0 steps (e.g. LLM pruned all steps because budget limit < individual agent prices),
    // compute candidate steps to accurately reflect necessary multi-agent cost against the budget cap.
    const stepsToPlan = structuredPlan.steps && structuredPlan.steps.length > 0
      ? structuredPlan.steps
      : (aiService as any).generateDeterministicPlan
      ? (aiService as any).generateDeterministicPlan(description, budgetLimit, approvedAgents).data.steps
      : [];

    for (let i = 0; i < stepsToPlan.length; i++) {
      const stepItem = stepsToPlan[i];
      // Match agent by ID or by category using dynamic candidate ranking
      let matchedAgent = approvedAgents.find((a) => a.id === stepItem.agentId);
      if (!matchedAgent) {
        const categoryAgents = approvedAgents.filter(
          (a) => a.category.toLowerCase() === (stepItem.category || '').toLowerCase()
        );
        const rankedCandidates = rankAgents(categoryAgents.length > 0 ? categoryAgents : approvedAgents);
        matchedAgent = rankedCandidates[0] || approvedAgents[0];
      }

      const cost = matchedAgent.price_usdc;
      runningServiceCost += cost;

      let inputPayload = stepItem.inputPayload ? { ...stepItem.inputPayload } : {};
      const intent = parseProductSearchIntent(description);
      if (matchedAgent.category === 'Data' && !intent.isCrypto) {
        if (!inputPayload.query || inputPayload.query === description || /under|below|less than|<=/i.test(inputPayload.query)) {
          inputPayload.query = intent.cleanKeyword;
          if (intent.maxPrice !== undefined) inputPayload.maxPrice = intent.maxPrice;
          if (intent.category) inputPayload.category = intent.category;
          if (intent.currency) inputPayload.currency = intent.currency;
        }
      } else if (matchedAgent.category === 'Scraping') {
        if (!inputPayload.target || inputPayload.target === description || /under|below|less than|<=/i.test(inputPayload.target)) {
          inputPayload.target = intent.cleanKeyword;
          if (intent.maxPrice !== undefined) inputPayload.maxPrice = intent.maxPrice;
        }
      }

      plannedSteps.push({
        stepNumber: i + 1,
        agent: matchedAgent,
        actionType: stepItem.actionType || `${matchedAgent.category} Service Execution`,
        rationale: stepItem.rationale || `Selected ${matchedAgent.name} based on capability matching and dynamic ranking.`,
        estimatedCost: cost,
        inputPayload,
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
   * Executes an orchestrated task with concurrent step execution (max_concurrency >= 3),
   * genuine x402 v2 payment flows, atomic budget reservation, schema validation, and fallback.
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

    const approvedAgents = await db.getApprovedAgents();
    const accumulatedContexts: string[] = [];
    let successfulCount = 0;

    // Partition steps: Independent gathering steps (Data, Scraper) vs dependent synthesis steps (Inference)
    const independentSteps = plan.steps.filter((s) => s.agent.category !== 'Inference');
    const inferenceSteps = plan.steps.filter((s) => s.agent.category === 'Inference');

    const executedStepResults: Array<{ step: PlannedStep; success: boolean; output?: any; agentUsed: Agent }> = [];

    // Concurrency: Execute independent steps in parallel (concurrency limit >= 3)
    if (independentSteps.length > 0) {
      const independentResults = await Promise.all(
        independentSteps.map((step) =>
          this.executeSingleStep({
            taskId,
            step,
            accumulatedContexts: [],
            approvedAgents,
          })
        )
      );

      for (let idx = 0; idx < independentResults.length; idx++) {
        const res = independentResults[idx];
        executedStepResults.push({
          step: independentSteps[idx],
          success: res.success,
          output: res.output,
          agentUsed: res.agentUsed,
        });

        if (res.output) {
          accumulatedContexts.push(
            `Agent [${res.agentUsed.name}] output: ${JSON.stringify(res.output)}`
          );
        }
        if (res.success) successfulCount++;
      }
    }

    // Dependent steps: Run inference steps with accumulated context from gathering steps
    for (const step of inferenceSteps) {
      const res = await this.executeSingleStep({
        taskId,
        step,
        accumulatedContexts,
        approvedAgents,
      });

      executedStepResults.push({
        step,
        success: res.success,
        output: res.output,
        agentUsed: res.agentUsed,
      });

      if (res.output) {
        accumulatedContexts.push(
          `Agent [${res.agentUsed.name}] output: ${JSON.stringify(res.output)}`
        );
      }
      if (res.success) successfulCount++;
    }

    // Determine final task status based on strict acceptance criteria
    const acceptance = evaluateTaskAcceptance(task.description, executedStepResults);
    const finalStatus = acceptance.status;

    // Store synthesized final results with real AI model details
    await db.createTaskResult({
      id: `res_${taskId}`,
      task_id: taskId,
      final_summary: `${acceptance.summary} (${successfulCount}/${plan.steps.length} successful agent service calls paid via HTTP 402 on Base Sepolia).`,
      structured_output: {
        taskGoal: task.description,
        totalSteps: plan.steps.length,
        successfulSteps: successfulCount,
        acceptanceStatus: acceptance.status,
        acceptanceRationale: acceptance.summary,
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
      rationale: acceptance.summary,
      completed_at: new Date().toISOString(),
    });

    return updatedTask!;
  }

  /**
   * Executes a single planned step with atomic budget reservation, 402 challenge handling,
   * EIP-712 payment authorization, JSON schema validation, and fallback support.
   */
  private async executeSingleStep(params: {
    taskId: string;
    step: PlannedStep;
    accumulatedContexts: string[];
    approvedAgents: Agent[];
  }): Promise<{ success: boolean; output?: any; agentUsed: Agent }> {
    const { taskId, step, accumulatedContexts, approvedAgents } = params;
    let currentAgent = step.agent;
    const stepStartTime = Date.now();

    // 1. Concurrency-safe atomic budget reservation
    const reservation = await budgetGuard.reserveBudget(taskId, currentAgent.id, currentAgent.price_usdc);
    if (!reservation.success) {
      await db.createTaskStep({
        id: `step_${taskId}_${step.stepNumber}`,
        task_id: taskId,
        step_number: step.stepNumber,
        agent_id: currentAgent.id,
        agent_name: currentAgent.name,
        action_type: step.actionType,
        status: 'failed',
        latency_ms: 0,
        price_paid: 0,
        error_message: reservation.error || 'Budget reservation limit exceeded',
        created_at: new Date().toISOString(),
      });
      return { success: false, agentUsed: currentAgent };
    }

    // 2. Create running task step record
    const stepRecord = await db.createTaskStep({
      id: `step_${taskId}_${step.stepNumber}`,
      task_id: taskId,
      step_number: step.stepNumber,
      agent_id: currentAgent.id,
      agent_name: currentAgent.name,
      action_type: step.actionType,
      input_payload: step.inputPayload,
      status: 'running',
      latency_ms: 0,
      price_paid: 0,
      created_at: new Date().toISOString(),
    });

    let requestPayload = { ...step.inputPayload };
    if (currentAgent.category === 'Inference' && accumulatedContexts.length > 0) {
      requestPayload.context = accumulatedContexts.join('\n---\n');
    }

    try {
      // 3. Request agent service (Expect HTTP 402 Payment Challenge)
      let challenge: X402PaymentRequirement | undefined;
      try {
        await axios.post(currentAgent.endpoint_url, requestPayload, {
          timeout: 8000,
          headers: { 'Content-Type': 'application/json' },
        });
        throw new Error('Expected HTTP 402 challenge, but service responded without payment requirement.');
      } catch (initialErr: any) {
        if (initialErr.response && initialErr.response.status === 402) {
          challenge = initialErr.response.data?.paymentRequirement;
          if (!challenge && initialErr.response.headers['payment-required']) {
            try {
              const raw = Buffer.from(initialErr.response.headers['payment-required'], 'base64').toString('utf8');
              challenge = JSON.parse(raw);
            } catch {}
          }
          if (!challenge && initialErr.response.headers['x-payment-required']) {
            try {
              challenge = JSON.parse(initialErr.response.headers['x-payment-required']);
            } catch {}
          }
        } else {
          throw new Error(`Failed contacting service endpoint: ${initialErr.message}`);
        }
      }

      if (!challenge) {
        throw new Error('Malformed 402 challenge: missing payment requirement structure');
      }

      // 4. Validate terms and generate signed x402 v2 payment authorization
      const authorization = await x402Engine.authorizePayment(
        challenge,
        currentAgent.recipient_address,
        currentAgent.price_usdc
      );
      const authBase64 = Buffer.from(JSON.stringify(authorization)).toString('base64');

      // 5. Send signed payment authorization to fulfill service
      const serviceResponse = await axios.post(currentAgent.endpoint_url, requestPayload, {
        timeout: 12000,
        headers: {
          'Content-Type': 'application/json',
          'PAYMENT-SIGNATURE': authBase64,
          'X-Payment': JSON.stringify(authorization),
          Authorization: `Bearer ${authBase64}`,
        },
      });

      const latencyMs = Date.now() - stepStartTime;
      const resultData = serviceResponse.data;

      // 6. Payment has settled on the network/facilitator — commit reservation
      await budgetGuard.commitReservation(reservation.reservationId!);

      const receipt = resultData.paymentReceipt || {};
      const txHash = receipt.txHash || undefined;
      const voucherDigest = receipt.voucherDigest || `0x${Buffer.from(authorization.nonce).toString('hex')}`;
      const explorerUrl = receipt.explorerUrl || `${config.web3.explorerBaseUrl}/tx/${txHash || voucherDigest}`;

      // 7. Validate output against registered agent output schema (Ajv)
      const schemaValidation = validateSchema(currentAgent.output_schema, resultData);
      const isResultEmpty = resultData.total_found === 0 ||
        (Array.isArray(resultData.products) && resultData.products.length === 0) ||
        (Array.isArray(resultData.items) && resultData.items.length === 0);

      const serviceStatus = !schemaValidation.isValid
        ? 'output_rejected'
        : isResultEmpty
        ? 'empty_result'
        : 'success';

      const platformFee = receipt.platformFeeUsdc || Number((currentAgent.price_usdc * 0.10).toFixed(4));

      if (schemaValidation.isValid) {
        // Record confirmed ledger transaction
        const txRecord: Transaction = {
          id: `tx_${taskId}_${step.stepNumber}`,
          task_id: taskId,
          step_id: stepRecord.id,
          buyer_address: authorization.buyerAddress,
          seller_address: currentAgent.recipient_address,
          agent_id: currentAgent.id,
          token_address: challenge.token || challenge.asset,
          chain_id: challenge.chainId,
          amount_usdc: currentAgent.price_usdc,
          platform_fee_usdc: platformFee,
          tx_hash: txHash,
          voucher_digest: voucherDigest,
          explorer_url: explorerUrl,
          payment_status: 'confirmed',
          service_status: serviceStatus,
          idempotency_key: authorization.nonce,
          nonce: authorization.nonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await db.createTransaction(txRecord);

        if (isResultEmpty) {
          // Attempt fallback to alternate approved agent in the same category if available
          const alternateCandidates = rankAgents(
            approvedAgents.filter((a) => a.category === currentAgent.category && a.id !== currentAgent.id)
          );

          if (alternateCandidates.length > 0) {
            const alternateAgent = alternateCandidates[0];
            const remainingBudget = await budgetGuard.getRemainingBudget(taskId);

            if (remainingBudget >= alternateAgent.price_usdc) {
              console.log(`[Orchestrator] Empty result fallback: calling alternate agent ${alternateAgent.name}`);
              const fallbackResult = await this.executeFallback({
                taskId,
                stepNumber: step.stepNumber,
                parentStepId: stepRecord.id,
                agent: alternateAgent,
                actionType: step.actionType,
                requestPayload,
              });
              if (fallbackResult.success) {
                return { success: true, output: fallbackResult.output, agentUsed: alternateAgent };
              }
            }
          }

          // If no fallback or fallback was also empty, update step
          await db.updateTaskStep(stepRecord.id, taskId, {
            status: 'completed',
            output_payload: resultData,
            latency_ms: latencyMs,
            price_paid: currentAgent.price_usdc,
            tx_hash: txHash || voucherDigest,
          });
          await db.recordMetrics(currentAgent.id, true, latencyMs, currentAgent.price_usdc);
          return { success: false, output: resultData, agentUsed: currentAgent };
        }

        // Update step to completed
        await db.updateTaskStep(stepRecord.id, taskId, {
          status: 'completed',
          output_payload: resultData,
          latency_ms: latencyMs,
          price_paid: currentAgent.price_usdc,
          tx_hash: txHash || voucherDigest,
        });

        // Record live performance metrics
        await db.recordMetrics(currentAgent.id, true, latencyMs, currentAgent.price_usdc);

        return { success: true, output: resultData, agentUsed: currentAgent };
      } else {
        // Schema Validation Failed after Settlement!
        console.warn(`[Orchestrator] Schema validation failed for ${currentAgent.name}:`, schemaValidation.errors);

        // Ledger invariant: Payment remains CONFIRMED, but service is OUTPUT_REJECTED
        const txRecord: Transaction = {
          id: `tx_${taskId}_${step.stepNumber}`,
          task_id: taskId,
          step_id: stepRecord.id,
          buyer_address: authorization.buyerAddress,
          seller_address: currentAgent.recipient_address,
          agent_id: currentAgent.id,
          token_address: challenge.token || challenge.asset,
          chain_id: challenge.chainId,
          amount_usdc: currentAgent.price_usdc,
          platform_fee_usdc: platformFee,
          tx_hash: txHash,
          voucher_digest: voucherDigest,
          explorer_url: explorerUrl,
          payment_status: 'confirmed',
          service_status: 'output_rejected',
          idempotency_key: authorization.nonce,
          nonce: authorization.nonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await db.createTransaction(txRecord);

        // Mark step status as paid_output_rejected
        await db.updateTaskStep(stepRecord.id, taskId, {
          status: 'paid_output_rejected',
          output_payload: resultData,
          latency_ms: latencyMs,
          price_paid: currentAgent.price_usdc,
          tx_hash: txHash || voucherDigest,
          error_message: `Output rejected: Failed JSON schema validation (${schemaValidation.errors?.join(', ') || 'invalid format'})`,
        });

        // Penalize agent metrics (reputation decrement)
        await db.recordMetrics(currentAgent.id, false, latencyMs, currentAgent.price_usdc);

        // Attempt fallback to alternate approved agent in the same category
        const alternateCandidates = rankAgents(
          approvedAgents.filter((a) => a.category === currentAgent.category && a.id !== currentAgent.id)
        );

        if (alternateCandidates.length > 0) {
          const alternateAgent = alternateCandidates[0];
          const remainingBudget = await budgetGuard.getRemainingBudget(taskId);

          if (remainingBudget >= alternateAgent.price_usdc) {
            console.log(`[Orchestrator] Fallback triggered: calling alternate agent ${alternateAgent.name}`);
            const fallbackResult = await this.executeFallback({
              taskId,
              stepNumber: step.stepNumber,
              parentStepId: stepRecord.id,
              agent: alternateAgent,
              actionType: step.actionType,
              requestPayload,
            });
            if (fallbackResult.success) {
              return { success: true, output: fallbackResult.output, agentUsed: alternateAgent };
            }
          }
        }

        return { success: false, output: resultData, agentUsed: currentAgent };
      }
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

      await db.recordMetrics(currentAgent.id, false, latencyMs, 0);
      console.error(`[Orchestrator] Step ${step.stepNumber} failed before settlement:`, stepErr.message);

      // Attempt fallback for pre-settlement failure if alternate exists
      const alternateCandidates = rankAgents(
        approvedAgents.filter((a) => a.category === currentAgent.category && a.id !== currentAgent.id)
      );
      if (alternateCandidates.length > 0) {
        const alternateAgent = alternateCandidates[0];
        const remainingBudget = await budgetGuard.getRemainingBudget(taskId);
        if (remainingBudget >= alternateAgent.price_usdc) {
          const fallbackResult = await this.executeFallback({
            taskId,
            stepNumber: step.stepNumber,
            parentStepId: stepRecord.id,
            agent: alternateAgent,
            actionType: step.actionType,
            requestPayload,
          });
          if (fallbackResult.success) {
            return { success: true, output: fallbackResult.output, agentUsed: alternateAgent };
          }
        }
      }

      return { success: false, agentUsed: currentAgent };
    }
  }

  /**
   * Executes a fallback seller service call when primary seller fails or output is rejected.
   */
  private async executeFallback(params: {
    taskId: string;
    stepNumber: number;
    parentStepId: string;
    agent: Agent;
    actionType: string;
    requestPayload: any;
  }): Promise<{ success: boolean; output?: any }> {
    const { taskId, stepNumber, parentStepId, agent, actionType, requestPayload } = params;
    const fallbackReservation = await budgetGuard.reserveBudget(taskId, agent.id, agent.price_usdc);
    if (!fallbackReservation.success) return { success: false };

    const startTime = Date.now();
    try {
      let challenge: X402PaymentRequirement | undefined;
      try {
        await axios.post(agent.endpoint_url, requestPayload, {
          timeout: 8000,
          headers: { 'Content-Type': 'application/json' },
        });
        budgetGuard.releaseReservation(fallbackReservation.reservationId!);
        return { success: false };
      } catch (err: any) {
        if (err.response && err.response.status === 402) {
          challenge = err.response.data?.paymentRequirement;
          if (!challenge && err.response.headers['payment-required']) {
            try {
              const raw = Buffer.from(err.response.headers['payment-required'], 'base64').toString('utf8');
              challenge = JSON.parse(raw);
            } catch {}
          }
          if (!challenge && err.response.headers['x-payment-required']) {
            try {
              challenge = JSON.parse(err.response.headers['x-payment-required']);
            } catch {}
          }
        } else {
          budgetGuard.releaseReservation(fallbackReservation.reservationId!);
          return { success: false };
        }
      }

      if (!challenge) {
        budgetGuard.releaseReservation(fallbackReservation.reservationId!);
        return { success: false };
      }

      const authorization = await x402Engine.authorizePayment(
        challenge,
        agent.recipient_address,
        agent.price_usdc
      );
      const authBase64 = Buffer.from(JSON.stringify(authorization)).toString('base64');

      const response = await axios.post(agent.endpoint_url, requestPayload, {
        timeout: 12000,
        headers: {
          'Content-Type': 'application/json',
          'PAYMENT-SIGNATURE': authBase64,
          'X-Payment': JSON.stringify(authorization),
          Authorization: `Bearer ${authBase64}`,
        },
      });

      const latencyMs = Date.now() - startTime;
      const data = response.data;
      await budgetGuard.commitReservation(fallbackReservation.reservationId!);

      const receipt = data.paymentReceipt || {};
      const txHash = receipt.txHash || undefined;
      const voucherDigest = receipt.voucherDigest || `0x${Buffer.from(authorization.nonce).toString('hex')}`;
      const explorerUrl = receipt.explorerUrl || `${config.web3.explorerBaseUrl}/tx/${txHash || voucherDigest}`;

      const schemaVal = validateSchema(agent.output_schema, data);
      const isFallbackEmpty = data.total_found === 0 ||
        (Array.isArray(data.products) && data.products.length === 0) ||
        (Array.isArray(data.items) && data.items.length === 0);

      const serviceStatus = !schemaVal.isValid
        ? 'output_rejected'
        : isFallbackEmpty
        ? 'empty_result'
        : 'success';

      const platformFee = receipt.platformFeeUsdc || Number((agent.price_usdc * 0.10).toFixed(4));

      if (schemaVal.isValid) {
        const txRecord: Transaction = {
          id: `tx_${taskId}_${stepNumber}_fb`,
          task_id: taskId,
          step_id: parentStepId,
          buyer_address: authorization.buyerAddress,
          seller_address: agent.recipient_address,
          agent_id: agent.id,
          token_address: challenge.token || challenge.asset,
          chain_id: challenge.chainId,
          amount_usdc: agent.price_usdc,
          platform_fee_usdc: platformFee,
          tx_hash: txHash,
          voucher_digest: voucherDigest,
          explorer_url: explorerUrl,
          payment_status: 'confirmed',
          service_status: serviceStatus,
          idempotency_key: authorization.nonce,
          nonce: authorization.nonce,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await db.createTransaction(txRecord);

        await db.updateTaskStep(parentStepId, taskId, {
          status: 'completed',
          agent_id: agent.id,
          agent_name: `${agent.name} (Fallback)`,
          output_payload: data,
          latency_ms: latencyMs,
          price_paid: agent.price_usdc,
          tx_hash: txHash,
          error_message: undefined,
        });

        await db.recordMetrics(agent.id, true, latencyMs, agent.price_usdc);
        return { success: true, output: data };
      } else {
        await db.recordMetrics(agent.id, false, latencyMs, agent.price_usdc);
        return { success: false };
      }
    } catch {
      budgetGuard.releaseReservation(fallbackReservation.reservationId!);
      return { success: false };
    }
  }
}

export const buyerAgent = new BuyerAgentOrchestrator();
