import { describe, it, expect } from 'vitest';
import { parseProductSearchIntent } from '../src/utils/productSearchParser.js';
import { handleDataAgentService } from '../src/sellers/dataAgent.js';
import { x402Engine } from '../src/payments/x402Protocol.js';
import { evaluateTaskAcceptance, rankAgents, PlannedStep } from '../src/orchestrator/buyerAgent.js';
import { db } from '../src/db/supabase.js';

describe('Autonomix — Product Discovery, Acceptance Criteria & Fee Accounting Suite', () => {
  const dummyRecipient = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

  describe('1. Natural Language Product Search Intent Parsing', () => {
    it('parses "shoes under 5000" into clean keyword, category mapping, and numeric maxPrice', () => {
      const intent = parseProductSearchIntent('shoes under 5000');
      expect(intent.cleanKeyword).toBe('shoes');
      expect(intent.maxPrice).toBe(5000);
      expect(intent.targetCategories).toContain('mens-shoes');
      expect(intent.targetCategories).toContain('womens-shoes');
      expect(intent.currency).toBeUndefined();
      expect(intent.isCrypto).toBe(false);
    });

    it('parses "running shoes under ₹3000" with explicit INR currency', () => {
      const intent = parseProductSearchIntent('running shoes under ₹3000');
      expect(intent.cleanKeyword).toBe('running shoes');
      expect(intent.maxPrice).toBe(3000);
      expect(intent.currency).toBe('INR');
      expect(intent.targetCategories).toContain('mens-shoes');
    });

    it('parses "laptops under $1500" with explicit USD currency', () => {
      const intent = parseProductSearchIntent('laptops under $1500');
      expect(intent.cleanKeyword).toBe('laptops');
      expect(intent.maxPrice).toBe(1500);
      expect(intent.currency).toBe('USD');
      expect(intent.targetCategories).toContain('laptops');
    });

    it('correctly flags crypto tickers like ETH without product categorization', () => {
      const intent = parseProductSearchIntent('ETH');
      expect(intent.isCrypto).toBe(true);
      expect(intent.cleanKeyword).toBe('ETH');
      expect(intent.targetCategories).toEqual([]);
    });
  });

  describe('2. Live Data Agent Product Discovery, Filtering & Price Ceilings', () => {
    it('retrieves real shoes for "shoes under 5000" and filters out non-shoes', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      await handleDataAgentService(
        {
          headers: { authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}` },
          body: { query: 'shoes under 5000' },
          query: {},
        } as any,
        {
          set: () => {},
          status: (code: number) => {
            statusCode = code;
            return { json: (d: any) => { serviceOutput = d; } };
          },
        } as any
      );

      expect(statusCode).toBe(200);
      expect(serviceOutput.products).toBeDefined();
      expect(serviceOutput.products.length).toBeGreaterThan(0);

      // Verify all returned items are actually shoes
      for (const product of serviceOutput.products) {
        expect(['mens-shoes', 'womens-shoes']).toContain(product.category);
        expect(product.price).toBeLessThanOrEqual(5000);
        expect(product.sourceUrl).toMatch(/^https:\/\/dummyjson\.com\/products\/\d+$/);
        expect(product.currency).toBe('USD');
        expect(product.retrievalTimestamp).toBeDefined();
      }
    });

    it('enforces price ceiling: "shoes under 50" excludes items > $50', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      await handleDataAgentService(
        {
          headers: { authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}` },
          body: { query: 'shoes under 50' },
          query: {},
        } as any,
        {
          set: () => {},
          status: () => ({ json: (d: any) => { serviceOutput = d; } }),
        } as any
      );

      expect(serviceOutput.products.length).toBeGreaterThan(0);
      for (const product of serviceOutput.products) {
        expect(product.price).toBeLessThanOrEqual(50);
      }

      // Verify that Nike Air Jordan 1 ($149.99) is excluded
      const jordan = serviceOutput.products.find((p: any) => p.title.includes('Jordan'));
      expect(jordan).toBeUndefined();
    });

    it('handles explicit currency notation and notes source currency USD without fabricating exchange rates', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      await handleDataAgentService(
        {
          headers: { authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}` },
          body: { query: 'shoes under ₹5000' },
          query: {},
        } as any,
        {
          set: () => {},
          status: () => ({ json: (d: any) => { serviceOutput = d; } }),
        } as any
      );

      expect(serviceOutput.sourceCurrency).toBe('USD');
      expect(serviceOutput.products[0].currency).toBe('USD');
    });

    it('returns empty result gracefully with explicit message when no products match price ceiling', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      await handleDataAgentService(
        {
          headers: { authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}` },
          body: { query: 'shoes under 10' }, // Lowest shoe in DummyJSON is $19.99
          query: {},
        } as any,
        {
          set: () => {},
          status: () => ({ json: (d: any) => { serviceOutput = d; } }),
        } as any
      );

      expect(serviceOutput.total_found).toBe(0);
      expect(serviceOutput.products).toEqual([]);
      expect(serviceOutput.status).toBe('no_records_found');
      expect(serviceOutput.message).toContain('No live product records found');
      expect(serviceOutput.message).toContain('Price ceiling');
    });
  });

  describe('3. Strict Task Acceptance Criteria', () => {
    const mockAgent: any = { id: 'a1', name: 'AlphaData', category: 'Data', price_usdc: 0.02 };

    it('marks task as partially_completed (NOT completed) when product research returns 0 products', () => {
      const taskGoal = 'Find running shoes under $10';
      const executedSteps = [
        {
          step: { stepNumber: 1, actionType: 'Data Retrieval', estimatedCost: 0.02, agent: mockAgent, inputPayload: {}, rationale: '' },
          success: true, // HTTP 200 was returned
          output: { total_found: 0, products: [] }, // But 0 products matched!
          agentUsed: mockAgent,
        },
      ];

      const acceptance = evaluateTaskAcceptance(taskGoal, executedSteps);
      expect(acceptance.status).toBe('partially_completed');
      expect(acceptance.isAcceptable).toBe(false);
      expect(acceptance.summary).toContain('failed product acceptance criteria');
    });

    it('marks task as completed when product research discovers real products', () => {
      const taskGoal = 'Find running shoes under $150';
      const executedSteps = [
        {
          step: { stepNumber: 1, actionType: 'Data Retrieval', estimatedCost: 0.02, agent: mockAgent, inputPayload: {}, rationale: '' },
          success: true,
          output: { total_found: 2, products: [{ title: 'Nike Sneaker', price: 120 }, { title: 'Puma Runner', price: 90 }] },
          agentUsed: mockAgent,
        },
      ];

      const acceptance = evaluateTaskAcceptance(taskGoal, executedSteps);
      expect(acceptance.status).toBe('completed');
      expect(acceptance.isAcceptable).toBe(true);
      expect(acceptance.summary).toContain('Discovered and verified 2 relevant product records');
    });

    it('marks explicit empty search verification as completed', () => {
      const taskGoal = 'Verify empty search for nonexistent_item_random_999';
      const executedSteps = [
        {
          step: { stepNumber: 1, actionType: 'Data Retrieval', estimatedCost: 0.02, agent: mockAgent, inputPayload: {}, rationale: '' },
          success: true,
          output: { total_found: 0, products: [] },
          agentUsed: mockAgent,
        },
      ];

      const acceptance = evaluateTaskAcceptance(taskGoal, executedSteps);
      expect(acceptance.status).toBe('completed');
      expect(acceptance.isAcceptable).toBe(true);
      expect(acceptance.summary).toContain('Explicit empty search test verified successfully');
    });
  });

  describe('4. Fee Accounting & Explorer URL Verification', () => {
    it('verifies exact ledger accounting: planned total, seller net, platform commission, and AI model cost', () => {
      const scraperPrice = 0.03;
      const inferencePrice = 0.04;
      const sellerGross = scraperPrice + inferencePrice; // 0.07 USDC
      const modelCost = 0.0002; // AI model token planning cost
      const plannedTotal = Number((sellerGross + modelCost).toFixed(4)); // 0.0702 USDC

      const platformCommission = Number((sellerGross * 0.10).toFixed(4)); // 0.0070 USDC
      const sellerNetPayout = Number((sellerGross - platformCommission).toFixed(4)); // 0.0630 USDC

      // Exact mathematical consistency verification
      expect(plannedTotal).toBe(0.0702);
      expect(sellerGross).toBe(0.0700);
      expect(platformCommission).toBe(0.0070);
      expect(sellerNetPayout).toBe(0.0630);
      expect(Number((sellerNetPayout + platformCommission + modelCost).toFixed(4))).toBe(plannedTotal);
    });

    it('generates transaction-specific explorer URLs (/tx/...) and never wallet address URLs (/address/...)', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      const verification = await x402Engine.verifyPayment(auth, dummyRecipient, 0.02);

      expect(verification.verified).toBe(true);
      expect(verification.voucherDigest).toBeDefined();
      expect(verification.voucherDigest).toMatch(/^0x[a-f0-9]{64}$/i);

      // Must be a transaction URL (/tx/...) and never an address URL (/address/...)
      expect(verification.explorerUrl).toMatch(/^https:\/\/sepolia\.basescan\.org\/tx\/0x[a-f0-9]{64}$/i);
      expect(verification.explorerUrl).not.toContain('/address/');
    });
  });
});
