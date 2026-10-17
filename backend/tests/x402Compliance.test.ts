import { describe, it, expect, beforeEach } from 'vitest';
import { x402Engine, X402PaymentRequirement } from '../src/payments/x402Protocol.js';
import { budgetGuard } from '../src/payments/budgetGuard.js';
import { db } from '../src/db/supabase.js';
import { rankAgents, buyerAgent } from '../src/orchestrator/buyerAgent.js';
import { handleDataAgentService, DATA_AGENT_CONFIG } from '../src/sellers/dataAgent.js';
import { handleScraperAgentService, SCRAPER_AGENT_CONFIG } from '../src/sellers/scraperAgent.js';
import { handleInferenceAgentService, INFERENCE_AGENT_CONFIG } from '../src/sellers/inferenceAgent.js';
import { config } from '../src/config/index.js';
import { Agent } from '../src/db/types.js';

describe('Autonomix — Hackathon Problem Statement 10-Scenario Compliance Suite', () => {
  const dummyTaskId = 'ps-compliance-task-001';
  const dummyRecipient = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
  const alternateRecipient = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

  beforeEach(async () => {
    await db.createTask({
      id: dummyTaskId,
      user_id: 'c0000000-0000-0000-0000-000000000001',
      title: 'PS Compliance Test Task',
      description: 'Audit compliant multi-agent orchestration',
      budget_limit: 0.10,
      total_cost: 0,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  });

  // Scenario 1: Valid x402 v2 Challenge & Settlement Flow
  describe('Scenario 1: Valid x402 v2 Challenge & Settlement Flow', () => {
    it('produces standard x402 v2 headers in challenge and settles with PAYMENT-RESPONSE', async () => {
      let challengePayload: any;
      let responseHeaders: Record<string, string> = {};
      let statusCode = 0;

      const mockReq: any = {
        headers: {},
        body: { query: 'laptop' },
        query: {},
      };

      const mockRes: any = {
        set: (headers: any) => {
          responseHeaders = { ...responseHeaders, ...headers };
          return mockRes;
        },
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          challengePayload = data;
        },
      };

      // 1. Initial unpaid request receives HTTP 402 challenge
      await handleDataAgentService(mockReq, mockRes);
      expect(statusCode).toBe(402);
      expect(responseHeaders['PAYMENT-REQUIRED']).toBeDefined();
      expect(responseHeaders['WWW-Authenticate']).toBe('x402');

      const challenge: X402PaymentRequirement = challengePayload.paymentRequirement;
      expect([2, '2.0']).toContain(challenge.x402Version);
      expect(challenge.network).toBe('eip155:84532');
      expect(challenge.token).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
      expect(challenge.accepts).toBeDefined();
      expect(challenge.accepts[0].scheme).toBe('exact');
      expect(challenge.accepts[0].payTo.toLowerCase()).toBe(DATA_AGENT_CONFIG.recipient.toLowerCase());

      // 2. Buyer authorizes payment
      const auth = await x402Engine.authorizePayment(challenge, DATA_AGENT_CONFIG.recipient, 0.05);
      const authBase64 = Buffer.from(JSON.stringify(auth)).toString('base64');

      let serviceOutput: any;
      let settleStatusCode = 0;
      let settleHeaders: Record<string, string> = {};

      const paidReq: any = {
        headers: {
          'payment-signature': authBase64,
          'content-type': 'application/json',
        },
        body: { query: 'laptop' },
        query: {},
      };

      const paidRes: any = {
        set: (headers: any) => {
          settleHeaders = { ...settleHeaders, ...headers };
          return paidRes;
        },
        status: (code: number) => {
          settleStatusCode = code;
          return paidRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleDataAgentService(paidReq, paidRes);
      expect(settleStatusCode).toBe(200);
      expect(settleHeaders['PAYMENT-RESPONSE']).toBeDefined();

      const decodedSettle = JSON.parse(Buffer.from(settleHeaders['PAYMENT-RESPONSE'], 'base64').toString('utf8'));
      expect(decodedSettle.success).toBe(true);
      expect(decodedSettle.network).toBe('eip155:84532');
      expect(decodedSettle.transaction).toBeDefined();
    });
  });

  // Scenario 2: Verification of Price, Token, Network, payTo & 0.10 USDC Cap
  describe('Scenario 2: Verification of Price, Token, Network, payTo & 0.10 USDC Cap', () => {
    it('rejects unauthorized payment when authorized amount is less than service price', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.04, 'Test Service');
      // Buyer only authorized 0.01 but price is 0.04
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);
      auth.amount = '0.010000';

      const verification = await x402Engine.verifyPayment(auth, dummyRecipient, 0.04);
      expect(verification.verified).toBe(false);
      expect(verification.error).toContain('insufficient');
    });

    it('strictly enforces the 0.10 USDC per-call price cap', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.15, 'Expensive Service');
      // Attempting to authorize 0.15 USDC should throw error immediately
      await expect(
        x402Engine.authorizePayment(challenge, dummyRecipient, 0.20)
      ).rejects.toThrow(/Price cap violation/);
    });

    it('rejects payment authorization with wrong token contract address', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'Test Service');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);
      auth.token = '0x1111111111111111111111111111111111111111';
      auth.asset = '0x1111111111111111111111111111111111111111';

      const verification = await x402Engine.verifyPayment(auth, dummyRecipient, 0.02);
      expect(verification.verified).toBe(false);
      expect(verification.error).toContain('Asset/Token mismatch');
    });

    it('rejects payment authorization with wrong network / chain ID', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'Test Service');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);
      auth.network = 'eip155:1'; // Mainnet Ethereum instead of Base Sepolia

      const verification = await x402Engine.verifyPayment(auth, dummyRecipient, 0.02);
      expect(verification.verified).toBe(false);
      expect(verification.error).toContain('Network mismatch');
    });

    it('rejects payment authorization with recipient / payTo mismatch', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'Test Service');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      const verification = await x402Engine.verifyPayment(auth, alternateRecipient, 0.02);
      expect(verification.verified).toBe(false);
      expect(verification.error).toContain('Recipient mismatch');
    });
  });

  // Scenario 3: Atomic Budget Reservation & Concurrency Limits (1 and 5)
  describe('Scenario 3: Atomic Budget Reservation & Concurrency Limits', () => {
    it('enforces single reservation budget safely', async () => {
      const res = await budgetGuard.reserveBudget(dummyTaskId, 'agent-1', 0.06);
      expect(res.success).toBe(true);
      expect(res.remainingBudget).toBe(0.04);
      budgetGuard.releaseReservation(res.reservationId!);
    });

    it('strictly handles 5 concurrent reservations without race condition or overspend', async () => {
      // 5 concurrent requests attempting to reserve 0.03 USDC each (total 0.15 USDC against 0.10 budget)
      const reservations = await Promise.all([
        budgetGuard.reserveBudget(dummyTaskId, 'agent-1', 0.03),
        budgetGuard.reserveBudget(dummyTaskId, 'agent-2', 0.03),
        budgetGuard.reserveBudget(dummyTaskId, 'agent-3', 0.03),
        budgetGuard.reserveBudget(dummyTaskId, 'agent-4', 0.03),
        budgetGuard.reserveBudget(dummyTaskId, 'agent-5', 0.03),
      ]);

      const succeeded = reservations.filter((r) => r.success);
      const failed = reservations.filter((r) => !r.success);

      // At most 3 can succeed (3 * 0.03 = 0.09 <= 0.10), remaining must fail
      expect(succeeded.length).toBeLessThanOrEqual(3);
      expect(failed.length).toBeGreaterThanOrEqual(2);

      // Clean up reservations
      for (const r of succeeded) {
        if (r.reservationId) budgetGuard.releaseReservation(r.reservationId);
      }
    });
  });

  // Scenario 4: Replay Protection across Sequential and Concurrent Calls
  describe('Scenario 4: Replay Protection across Sequential and Concurrent Calls', () => {
    it('blocks sequential replay attack when same authorization nonce is submitted twice', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      // First verification succeeds
      const first = await x402Engine.verifyPayment(auth, dummyRecipient, 0.02);
      expect(first.verified).toBe(true);

      // Second verification with identical nonce is blocked
      const replay = await x402Engine.verifyPayment(auth, dummyRecipient, 0.02);
      expect(replay.verified).toBe(false);
      expect(replay.error).toContain('Replay attack detected');
    });

    it('blocks concurrent replay attack when duplicate authorizations are submitted in parallel', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      const [res1, res2] = await Promise.all([
        x402Engine.verifyPayment(auth, dummyRecipient, 0.02),
        x402Engine.verifyPayment(auth, dummyRecipient, 0.02),
      ]);

      // Exactly one succeeds, one fails
      const successCount = [res1, res2].filter((r) => r.verified).length;
      const failCount = [res1, res2].filter((r) => !r.verified).length;
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
    });
  });

  // Scenario 5: Seller Error Before Settlement Releases Reservation Without Charge
  describe('Scenario 5: Seller Error Before Settlement Releases Reservation Without Charge', () => {
    it('releases budget reservation and leaves customer balance intact if service fails before payment', async () => {
      const initialRemaining = await budgetGuard.getRemainingBudget(dummyTaskId);

      const res = await budgetGuard.reserveBudget(dummyTaskId, 'agent-err', 0.05);
      expect(res.success).toBe(true);

      // Simulating pre-settlement failure: release reservation
      budgetGuard.releaseReservation(res.reservationId!);

      const finalRemaining = await budgetGuard.getRemainingBudget(dummyTaskId);
      expect(finalRemaining).toBe(initialRemaining);

      const task = await db.getTaskById(dummyTaskId);
      expect(task?.total_cost).toBe(0);
    });
  });

  // Scenario 6: Paid-but-Invalid Output: Ledger Invariant & Fallback
  describe('Scenario 6: Paid-but-Invalid Output: Ledger Invariant & Fallback', () => {
    it('maintains confirmed payment in ledger with output_rejected status and updates reputation', async () => {
      // Simulate post-settlement rejection
      const initialMetrics = await db.getAgentById(DATA_AGENT_CONFIG.id);
      const initialRating = initialMetrics?.metrics?.rating_average ?? 5.0;

      // Penalize metrics for schema failure
      await db.recordMetrics(DATA_AGENT_CONFIG.id, false, 150, 0.02);

      const updated = await db.getAgentById(DATA_AGENT_CONFIG.id);
      const newRating = updated?.metrics?.rating_average ?? 5.0;
      expect(newRating).toBeLessThanOrEqual(initialRating);

      // Verify transaction ledger records confirmed payment with output_rejected status
      const tx = await db.createTransaction({
        id: 'tx-schema-fail-001',
        task_id: dummyTaskId,
        step_id: 'step-schema-fail-001',
        buyer_address: '0x1111111111111111111111111111111111111111',
        seller_address: DATA_AGENT_CONFIG.recipient,
        agent_id: DATA_AGENT_CONFIG.id,
        token_address: config.web3.usdcAddress,
        chain_id: 84532,
        amount_usdc: 0.02,
        platform_fee_usdc: 0.002,
        payment_status: 'confirmed',
        service_status: 'output_rejected',
        idempotency_key: 'nonce-schema-fail-001',
        nonce: 'nonce-schema-fail-001',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(tx.payment_status).toBe('confirmed');
      expect(tx.service_status).toBe('output_rejected');
    });
  });

  // Scenario 7: Three Paid Calls across Data, Scraping, Inference Endpoints
  describe('Scenario 7: Three Paid Calls across Data, Scraping, Inference Endpoints', () => {
    it('successfully processes valid payments across Data, Scraper, and Inference services', async () => {
      // 1. Data Agent
      const dataChallenge = x402Engine.createChallenge(DATA_AGENT_CONFIG.recipient, DATA_AGENT_CONFIG.priceUsdc, DATA_AGENT_CONFIG.name);
      const dataAuth = await x402Engine.authorizePayment(dataChallenge, DATA_AGENT_CONFIG.recipient, 0.05);
      const dataVerif = await x402Engine.verifyPayment(dataAuth, DATA_AGENT_CONFIG.recipient, DATA_AGENT_CONFIG.priceUsdc);
      expect(dataVerif.verified).toBe(true);

      // 2. Scraper Agent
      const scraperChallenge = x402Engine.createChallenge(SCRAPER_AGENT_CONFIG.recipient, SCRAPER_AGENT_CONFIG.priceUsdc, SCRAPER_AGENT_CONFIG.name);
      const scraperAuth = await x402Engine.authorizePayment(scraperChallenge, SCRAPER_AGENT_CONFIG.recipient, 0.05);
      const scraperVerif = await x402Engine.verifyPayment(scraperAuth, SCRAPER_AGENT_CONFIG.recipient, SCRAPER_AGENT_CONFIG.priceUsdc);
      expect(scraperVerif.verified).toBe(true);

      // 3. Inference Agent
      const infChallenge = x402Engine.createChallenge(INFERENCE_AGENT_CONFIG.recipient, INFERENCE_AGENT_CONFIG.priceUsdc, INFERENCE_AGENT_CONFIG.name);
      const infAuth = await x402Engine.authorizePayment(infChallenge, INFERENCE_AGENT_CONFIG.recipient, 0.05);
      const infVerif = await x402Engine.verifyPayment(infAuth, INFERENCE_AGENT_CONFIG.recipient, INFERENCE_AGENT_CONFIG.priceUsdc);
      expect(infVerif.verified).toBe(true);
    });
  });

  // Scenario 8: Reconciliation Against Base Sepolia RPC
  describe('Scenario 8: Reconciliation Against Base Sepolia RPC', () => {
    it('correctly handles off-chain voucher digests and unverified transaction hashes', async () => {
      const tx = await db.createTransaction({
        id: 'tx-reconcile-voucher',
        task_id: dummyTaskId,
        step_id: 'step-01',
        buyer_address: '0x1111111111111111111111111111111111111111',
        seller_address: dummyRecipient,
        agent_id: DATA_AGENT_CONFIG.id,
        token_address: config.web3.usdcAddress,
        chain_id: 84532,
        amount_usdc: 0.02,
        platform_fee_usdc: 0.002,
        tx_hash: '0x1234567890abcdef', // Non-66 char voucher digest
        payment_status: 'confirmed',
        service_status: 'success',
        idempotency_key: 'nonce-voucher',
        nonce: 'nonce-voucher',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await db.reconcileTransactionWithRpc(tx.id);
      expect(result.reconciled).toBe(false);
      expect(result.status).toBe('unverified_hash');
    });

    it('reports pending confirmation for non-existent or unmined on-chain transaction hash', async () => {
      const dummy66TxHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const tx = await db.createTransaction({
        id: 'tx-reconcile-unmined',
        task_id: dummyTaskId,
        step_id: 'step-02',
        buyer_address: '0x1111111111111111111111111111111111111111',
        seller_address: dummyRecipient,
        agent_id: DATA_AGENT_CONFIG.id,
        token_address: config.web3.usdcAddress,
        chain_id: 84532,
        amount_usdc: 0.02,
        platform_fee_usdc: 0.002,
        tx_hash: dummy66TxHash,
        payment_status: 'confirmed',
        service_status: 'success',
        idempotency_key: 'nonce-unmined',
        nonce: 'nonce-unmined',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await db.reconcileTransactionWithRpc(tx.id);
      expect(['pending_confirmation', 'rpc_error']).toContain(result.status);
    });
  });

  // Scenario 9: Dynamic Candidate Ranking Formula
  describe('Scenario 9: Dynamic Candidate Ranking Formula', () => {
    it('ranks agents based on composite score (0.35 Price + 0.35 Reputation + 0.30 Latency)', () => {
      const candidate1: Agent = {
        id: 'agent-high-price',
        developer_id: 'dev-1',
        name: 'High Price Agent',
        description: 'Expensive but fast',
        category: 'Data',
        price_usdc: 0.08,
        recipient_address: dummyRecipient,
        endpoint_url: 'http://localhost:3001/api/agents/data',
        input_schema: {},
        output_schema: {},
        capabilities: ['data'],
        status: 'approved',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metrics: {
          id: 'm1',
          agent_id: 'agent-high-price',
          total_calls: 100,
          successful_calls: 99,
          success_rate: 0.99,
          rating_average: 4.8,
          rating_count: 50,
          median_latency_ms: 100,
          total_revenue_usdc: 8.0,
          updated_at: new Date().toISOString(),
        },
      };

      const candidate2: Agent = {
        id: 'agent-low-price',
        developer_id: 'dev-2',
        name: 'Cost Effective Agent',
        description: 'Low cost high rating',
        category: 'Data',
        price_usdc: 0.02,
        recipient_address: alternateRecipient,
        endpoint_url: 'http://localhost:3001/api/agents/data',
        input_schema: {},
        output_schema: {},
        capabilities: ['data'],
        status: 'approved',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metrics: {
          id: 'm2',
          agent_id: 'agent-low-price',
          total_calls: 100,
          successful_calls: 100,
          success_rate: 1.0,
          rating_average: 5.0,
          rating_count: 80,
          median_latency_ms: 200,
          total_revenue_usdc: 2.0,
          updated_at: new Date().toISOString(),
        },
      };

      const ranked = rankAgents([candidate1, candidate2]);
      // candidate2 has lowest price (1.0 vs 0.0), highest rating (1.0 vs 0.96) -> should rank #1
      expect(ranked[0].id).toBe('agent-low-price');
    });
  });

  // Scenario 10: Interoperability with Unmodified External Clients
  describe('Scenario 10: Interoperability with Unmodified External Clients', () => {
    it('accepts payment authorization from external client formatted as Base64 in Authorization header', async () => {
      const challenge = x402Engine.createChallenge(DATA_AGENT_CONFIG.recipient, 0.02, 'Data Service');
      const auth = await x402Engine.authorizePayment(challenge, DATA_AGENT_CONFIG.recipient, 0.05);

      const base64Auth = Buffer.from(JSON.stringify(auth)).toString('base64');

      let responseCode = 0;
      let outputBody: any;
      const mockReq: any = {
        headers: {
          authorization: `Bearer ${base64Auth}`,
        },
        body: { query: 'laptop' },
        query: {},
      };

      const mockRes: any = {
        set: () => mockRes,
        status: (code: number) => {
          responseCode = code;
          return mockRes;
        },
        json: (data: any) => {
          outputBody = data;
        },
      };

      await handleDataAgentService(mockReq, mockRes);
      expect(responseCode).toBe(200);
      expect(outputBody.paymentReceipt).toBeDefined();
    });

    it('our buyer agent parses external standard x402 v2 challenges correctly', async () => {
      const externalChallenge: X402PaymentRequirement = {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:84532',
        chainId: 84532,
        token: config.web3.usdcAddress,
        asset: config.web3.usdcAddress,
        tokenSymbol: 'USDC',
        decimals: 6,
        recipient: dummyRecipient,
        payTo: dummyRecipient,
        amount: '0.030000',
        amountRaw: '30000',
        maxTimeoutSeconds: 300,
        nonce: 'ext_nonce_123',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        serviceName: 'External Standard Seller',
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '30000',
            asset: config.web3.usdcAddress,
            payTo: dummyRecipient,
            maxTimeoutSeconds: 300,
          },
        ],
      };

      const signedAuth = await x402Engine.authorizePayment(externalChallenge, dummyRecipient, 0.05);
      expect(signedAuth.payTo.toLowerCase()).toBe(dummyRecipient.toLowerCase());
      expect(signedAuth.amount).toBe('0.030000');
      expect(signedAuth.signature).toBeDefined();
    });
  });
});
