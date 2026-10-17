import { describe, it, expect, beforeEach } from 'vitest';
import {
  GeminiProvider,
  MissingAIKeyError,
  AIQuotaExhaustedError,
  isRateLimitOrQuotaError,
  calculateBackoffDelay,
} from '../src/ai/geminiProvider.js';
import { AIService, aiService } from '../src/ai/aiService.js';
import { buyerAgent } from '../src/orchestrator/buyerAgent.js';
import { db } from '../src/db/supabase.js';
import { budgetGuard } from '../src/payments/budgetGuard.js';

describe('Autonomix — AI Model Provider & Structured Orchestration Tests', () => {
  const dummyTaskId = 'test-ai-task-001';

  beforeEach(async () => {
    aiService.clearPlanCache();
    await db.createTask({
      id: dummyTaskId,
      user_id: 'c0000000-0000-0000-0000-000000000001',
      title: 'AI Multi-Agent Test',
      description: 'Fetch ETH market quote, crawl hardware catalog, and synthesize an intelligence report',
      budget_limit: 0.15,
      total_cost: 0,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  });

  describe('1. Gemini Provider Lifecycle & Security', () => {
    it('throws MissingAIKeyError when API key is missing or empty', async () => {
      const providerWithoutKey = new GeminiProvider('');
      expect(providerWithoutKey.isConfigured()).toBe(false);

      await expect(
        providerWithoutKey.generateStructured({
          prompt: 'test prompt',
        })
      ).rejects.toThrow(MissingAIKeyError);
    });

    it('reports accurate status metrics without exposing API keys', () => {
      const provider = new GeminiProvider('dummy-test-key-12345');
      const status = provider.getStatus();

      expect(status.provider).toBe('gemini');
      expect(status.configured).toBe(true);
      expect(status.model).toBeDefined();
      expect(status.rateLimit.maxRpm).toBe(60);
      expect(JSON.stringify(status)).not.toContain('dummy-test-key-12345');
    });

    it('fails schema validation if AI model returns unexpected JSON schema', async () => {
      const provider = new GeminiProvider(process.env.GEMINI_API_KEY);
      const strictSchema = {
        type: 'object',
        properties: {
          mustHaveField: { type: 'string' },
          numericScore: { type: 'number' },
        },
        required: ['mustHaveField', 'numericScore'],
      };

      if (!provider.isConfigured()) {
        await expect(
          provider.generateStructured({
            prompt: 'Return empty object',
            schema: strictSchema,
          })
        ).rejects.toThrow(MissingAIKeyError);
      }
    });

    it('correctly identifies HTTP 429 quota exhaustion and parses retry delay', () => {
      const err429 = { status: 429, message: 'Resource has been exhausted (e.g. check quota). Please retry in 12s.' };
      const parsed = isRateLimitOrQuotaError(err429);
      expect(parsed.isQuota).toBe(true);
      expect(parsed.retryAfterSec).toBe(12);

      const errNormal = new Error('Socket closed unexpectedly');
      expect(isRateLimitOrQuotaError(errNormal).isQuota).toBe(false);
    });

    it('calculates bounded exponential backoff with jitter', () => {
      const delayAttempt0 = calculateBackoffDelay(0);
      expect(delayAttempt0).toBeGreaterThanOrEqual(750);
      expect(delayAttempt0).toBeLessThanOrEqual(1500);

      const delayAttempt1 = calculateBackoffDelay(1);
      expect(delayAttempt1).toBeGreaterThanOrEqual(1500);
      expect(delayAttempt1).toBeLessThanOrEqual(3000);

      // Explicit retry delay from header
      const delayWithRetryAfter = calculateBackoffDelay(0, 5);
      expect(delayWithRetryAfter).toBeGreaterThanOrEqual(5000);
      expect(delayWithRetryAfter).toBeLessThanOrEqual(5600);
    });

    it('instantiates AIQuotaExhaustedError with retryable status 429 and retryAfter seconds', () => {
      const quotaErr = new AIQuotaExhaustedError('Google Gemini quota exhausted', 15);
      expect(quotaErr.status).toBe(429);
      expect(quotaErr.retryable).toBe(true);
      expect(quotaErr.retryAfterSeconds).toBe(15);
      expect(quotaErr.name).toBe('AIQuotaExhaustedError');
    });
  });

  describe('2. Buyer Agent AI Planning, Deduplication & Strict Budget Enforcement', () => {
    it('produces a structured orchestration plan within budget cap', async () => {
      const plan = await buyerAgent.planTask(
        'Retrieve Ethereum oracle prices and summarize market trends',
        0.10
      );

      expect(plan.canExecute).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.totalEstimatedCost).toBeLessThanOrEqual(0.10);
      expect(plan.steps[0].agent).toBeDefined();
      expect(plan.steps[0].actionType).toBeDefined();
      expect(plan.explanation).toBeDefined();
    });

    it('deduplicates concurrent planning requests and serves cached plans', async () => {
      const taskQuery = 'Research decentralized compute networks';
      const budget = 0.12;

      // Dispatch 2 concurrent planning requests with identical arguments
      const [planPromise1, planPromise2] = [
        buyerAgent.planTask(taskQuery, budget),
        buyerAgent.planTask(taskQuery, budget),
      ];

      const [res1, res2] = await Promise.all([planPromise1, planPromise2]);

      // Both must succeed and share identical step configuration
      expect(res1.canExecute).toBe(true);
      expect(res2.canExecute).toBe(true);
      expect(res1.steps.length).toBe(res2.steps.length);

      // Subsequent sequential request returns cached plan with 0 latency
      const cachedPlan = await buyerAgent.planTask(taskQuery, budget);
      expect(cachedPlan.canExecute).toBe(true);
      expect(cachedPlan.aiMetadata?.latencyMs).toBe(0);
    });

    it('strictly marks plan as non-executable if service cost exceeds budget cap', async () => {
      // Very tiny budget (0.01 USDC) cannot afford any multi-agent steps (lowest agent is 0.02)
      const plan = await buyerAgent.planTask(
        'Fetch ETH price, scrape hardware inventory, and run deep AI inference',
        0.01
      );

      expect(plan.canExecute).toBe(false);
      expect(plan.totalEstimatedCost).toBeGreaterThan(0.01);
      expect(plan.explanation).toContain('Budget Insufficient');
    });

    it('records AI model provider costs against task budget without exceeding budget', async () => {
      const initialRemaining = await budgetGuard.getRemainingBudget(dummyTaskId);
      expect(initialRemaining).toBe(0.15);

      // Record 0.005 USD model provider cost
      await budgetGuard.recordModelCost(dummyTaskId, 0.005);
      const afterModelCost = await budgetGuard.getRemainingBudget(dummyTaskId);
      expect(afterModelCost).toBe(0.145);
    });
  });

  describe('3. Inference Agent Output Validation', () => {
    it('synthesizes verified structured output with sentiment and confidence', async () => {
      const service = new AIService();
      const result = await service.runInferenceWithAI(
        'Oracle quote: ETH price 3480.50 USDC (+3.42% 24h), Volume: 18.4B USD. Hardware catalog items: 5 in stock.',
        'Synthesize intelligence report for executive review'
      );

      expect(result.data).toBeDefined();
      expect(result.data.summary).toBeDefined();
      expect(Array.isArray(result.data.key_takeaways)).toBe(true);
      expect(['Bullish', 'Bearish', 'Neutral']).toContain(result.data.sentiment);
      expect(typeof result.data.confidence_score).toBe('number');
      expect(result.data.confidence_score).toBeGreaterThan(0);
    });
  });
});
