import { describe, it, expect, beforeEach } from 'vitest';
import { budgetGuard } from '../src/payments/budgetGuard.js';
import { x402Engine } from '../src/payments/x402Protocol.js';
import { validateSchema } from '../src/utils/schemaValidator.js';
import { buyerAgent } from '../src/orchestrator/buyerAgent.js';
import { db } from '../src/db/supabase.js';

describe('Autonomix — Core Agent Economy & Security Tests', () => {
  const dummyTaskId = 'test-task-123';
  const dummyAgentId = 'a0000000-0000-0000-0000-000000000001';
  const dummyRecipient = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

  beforeEach(async () => {
    // Reset test task in DB
    await db.createTask({
      id: dummyTaskId,
      user_id: 'c0000000-0000-0000-0000-000000000001',
      title: 'Unit Test Task',
      description: 'Find market rate for ETH and extract hardware products',
      budget_limit: 0.10,
      total_cost: 0,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  });

  describe('1. Atomic Budget Guard & Concurrency Safety', () => {
    it('allows reservation within budget limit', async () => {
      const res = await budgetGuard.reserveBudget(dummyTaskId, dummyAgentId, 0.04);
      expect(res.success).toBe(true);
      expect(res.reservationId).toBeDefined();
      expect(res.remainingBudget).toBe(0.06);

      // Commit reservation
      await budgetGuard.commitReservation(res.reservationId!);
      const task = await db.getTaskById(dummyTaskId);
      expect(task?.total_cost).toBe(0.04);
    });

    it('strictly rejects concurrent or excessive reservations that exceed budget', async () => {
      // First reservation uses 0.08
      const res1 = await budgetGuard.reserveBudget(dummyTaskId, dummyAgentId, 0.08);
      expect(res1.success).toBe(true);

      // Second concurrent reservation attempts to use 0.05 (0.08 + 0.05 = 0.13 > 0.10)
      const res2 = await budgetGuard.reserveBudget(dummyTaskId, dummyAgentId, 0.05);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('Insufficient task budget');

      // Release first reservation
      budgetGuard.releaseReservation(res1.reservationId!);
      const remaining = await budgetGuard.getRemainingBudget(dummyTaskId);
      expect(remaining).toBe(0.10);
    });
  });

  describe('2. x402 v2 Protocol Challenge, Signing & Replay Protection', () => {
    it('creates a compliant x402 v2 challenge', () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      expect(challenge.x402Version).toBe('2.0');
      expect(challenge.network).toBe('eip155:84532');
      expect(challenge.chainId).toBe(84532);
      expect(challenge.token).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
      expect(challenge.tokenSymbol).toBe('USDC');
      expect(challenge.amount).toBe('0.020000');
      expect(challenge.nonce).toContain('x402_');
    });

    it('authorizes and verifies payment successfully', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      expect(auth.x402Version).toBe('2.0');
      expect(auth.signature).toBeDefined();
      expect(auth.buyerAddress).toBeDefined();

      const verification = await x402Engine.verifyPayment(auth, dummyRecipient, 0.02);
      expect(verification.verified).toBe(true);
      expect(verification.txHash).toBeDefined();
      expect(verification.explorerUrl).toContain('https://sepolia.basescan.org/tx/');
      expect(verification.amountPaid).toBe(0.02);
    });

    it('blocks replay attack when same nonce is submitted twice', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      // First verification succeeds
      const first = await x402Engine.verifyPayment(auth, dummyRecipient, 0.02);
      expect(first.verified).toBe(true);

      // Second replay attempt must be rejected
      const second = await x402Engine.verifyPayment(auth, dummyRecipient, 0.02);
      expect(second.verified).toBe(false);
      expect(second.error).toContain('Replay detected');
    });

    it('rejects unauthorized recipient address mismatch', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      const attackerRecipient = '0x000000000000000000000000000000000000dead';
      const result = await x402Engine.verifyPayment(auth, attackerRecipient, 0.02);
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Unauthorized recipient');
    });
  });

  describe('3. JSON Schema Validation', () => {
    it('validates compliant agent output payloads', () => {
      const schema = {
        type: 'object',
        properties: {
          asset: { type: 'string' },
          price_usd: { type: 'number' },
        },
        required: ['asset', 'price_usd'],
      };

      const validPayload = { asset: 'ETH', price_usd: 3480.50 };
      const invalidPayload = { asset: 'ETH' }; // missing price_usd

      expect(validateSchema(schema, validPayload).isValid).toBe(true);
      expect(validateSchema(schema, invalidPayload).isValid).toBe(false);
    });
  });

  describe('4. Buyer Agent Planning & Discovery', () => {
    it('plans multi-agent execution within budget', async () => {
      const taskDesc = 'Fetch latest ETH market price and synthesize findings';
      const plan = await buyerAgent.planTask(taskDesc, 0.10);

      expect(plan.canExecute).toBe(true);
      expect(plan.steps.length).toBeGreaterThanOrEqual(1);
      expect(plan.totalEstimatedCost).toBeLessThanOrEqual(0.10);
    });

    it('flags insufficient budget when limit is lower than agent price', async () => {
      const taskDesc = 'Fetch market oracle data';
      const plan = await buyerAgent.planTask(taskDesc, 0.01); // 0.01 is less than 0.02 Data agent price

      expect(plan.canExecute).toBe(false);
      expect(plan.explanation).toContain('Budget Insufficient');
    });
  });
});
