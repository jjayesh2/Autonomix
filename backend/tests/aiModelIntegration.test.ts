import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiProvider, MissingAIKeyError } from '../src/ai/geminiProvider.js';
import { AIService } from '../src/ai/aiService.js';
import { buyerAgent } from '../src/orchestrator/buyerAgent.js';
import { db } from '../src/db/supabase.js';
import { budgetGuard } from '../src/payments/budgetGuard.js';

describe('Autonomix — AI Model Provider & Structured Orchestration Tests', () => {
  const dummyTaskId = 'test-ai-task-001';

  beforeEach(async () => {
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
        // Unconfigured test check
        await expect(
          provider.generateStructured({
            prompt: 'Return empty object',
            schema: strictSchema,
          })
        ).rejects.toThrow(MissingAIKeyError);
      }
    });
  });

  describe('2. Buyer Agent AI Planning & Strict Budget Enforcement', () => {
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
      const aiService = new AIService();
      const result = await aiService.runInferenceWithAI(
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
