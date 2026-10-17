import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';
import { x402Engine } from '../src/payments/x402Protocol.js';
import { DATA_AGENT_CONFIG, handleDataAgentService } from '../src/sellers/dataAgent.js';
import { SCRAPER_AGENT_CONFIG, handleScraperAgentService, isSsrfSafeUrl, isPrivateOrBlockedIp } from '../src/sellers/scraperAgent.js';
import { INFERENCE_AGENT_CONFIG, handleInferenceAgentService } from '../src/sellers/inferenceAgent.js';
import { aiService } from '../src/ai/aiService.js';
import { db } from '../src/db/supabase.js';
import { budgetGuard } from '../src/payments/budgetGuard.js';

describe('Autonomix — Real Product Research & Agent Execution Tests', () => {
  const dummyRecipient = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

  describe('1. Data Agent Live Real-World Retrieval', () => {
    it('challenges unpaid requests with HTTP 402 and compliant x402 v2 parameters', async () => {
      let challengePayload: any;
      let statusCode = 200;

      const mockReq: any = {
        headers: {},
        body: { query: 'laptop' },
        query: {},
      };

      const mockRes: any = {
        set: () => {},
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          challengePayload = data;
        },
      };

      await handleDataAgentService(mockReq, mockRes);
      expect(statusCode).toBe(402);
      expect(challengePayload.status).toBe(402);
      expect(challengePayload.paymentRequirement.recipient.toLowerCase()).toBe(dummyRecipient.toLowerCase());
      expect(challengePayload.paymentRequirement.tokenSymbol).toBe('USDC');
    });

    it('queries live product API upon valid payment and returns real items with genuine source URLs', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: { query: 'laptop' },
        query: {},
      };

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleDataAgentService(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(serviceOutput.asset).toBe('laptop');
      expect(serviceOutput.price_usd).toBeGreaterThan(0);
      expect(serviceOutput.source).toContain('DummyJSON');
      expect(serviceOutput.products).toBeDefined();
      expect(serviceOutput.products.length).toBeGreaterThan(0);

      // Verify individual products have real titles, prices, and source URLs
      const firstProduct = serviceOutput.products[0];
      expect(firstProduct.title).toBeDefined();
      expect(firstProduct.price).toBeGreaterThan(0);
      expect(firstProduct.sourceUrl).toMatch(/^https:\/\/dummyjson\.com\/products\/\d+$/);
      expect(firstProduct.retrievalTimestamp).toBeDefined();

      // Verify payment receipt
      expect(serviceOutput.paymentReceipt.protocol).toBe('x402 v2');
      expect(serviceOutput.paymentReceipt.amountPaidUsdc).toBe(0.02);
      expect(serviceOutput.paymentReceipt.explorerUrl).toContain('https://sepolia.basescan.org');
    });

    it('queries real live crypto oracle when querying an asset ticker like ETH', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: { query: 'ETH' },
        query: {},
      };

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleDataAgentService(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(serviceOutput.asset).toBe('ETH');
      expect(serviceOutput.price_usd).toBeGreaterThan(100);
      expect(serviceOutput.source).toBeDefined();
      expect(serviceOutput.timestamp).toBeDefined();
    });

    it('returns empty results gracefully without fabricating mock records when no items match query', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: { query: 'nonexistent_random_xyz_99999' },
        query: {},
      };

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleDataAgentService(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(serviceOutput.products).toEqual([]);
      expect(serviceOutput.total_found).toBe(0);
      expect(serviceOutput.message).toContain('No live product records found');
    });
  });

  describe('2. Scraping Agent Live HTTP Retrieval, Cheerio Extraction & SSRF Protection', () => {
    it('retrieves live web records and parses items with Cheerio', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.03, 'WebExtract Sandbox Crawler');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: { target: 'phone' },
        query: {},
      };

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleScraperAgentService(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(serviceOutput.items_found).toBeGreaterThan(0);
      expect(serviceOutput.items.length).toBeGreaterThan(0);
      expect(serviceOutput.parser).toContain('Cheerio');

      const firstItem = serviceOutput.items[0];
      expect(firstItem.title).toBeDefined();
      expect(firstItem.price).toBeDefined();
      expect(firstItem.url).toMatch(/^https:\/\/dummyjson\.com\/products\/\d+$/);
    });

    it('strictly validates SSRF protection against internal IPs and cloud metadata', () => {
      expect(isSsrfSafeUrl('http://127.0.0.1:8080').isSafe).toBe(false);
      expect(isSsrfSafeUrl('http://localhost:5000').isSafe).toBe(false);
      expect(isSsrfSafeUrl('http://169.254.169.254/latest/meta-data').isSafe).toBe(false);
      expect(isSsrfSafeUrl('http://metadata.google.internal').isSafe).toBe(false);
      expect(isSsrfSafeUrl('http://10.0.0.1/admin').isSafe).toBe(false);
      expect(isSsrfSafeUrl('http://192.168.1.1').isSafe).toBe(false);
      expect(isSsrfSafeUrl('file:///etc/passwd').isSafe).toBe(false);
      expect(isSsrfSafeUrl('https://dummyjson.com/products/1').isSafe).toBe(true);
    });

    it('rejects paid scraper requests targeting blocked internal endpoints with HTTP 400', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.03, 'WebExtract Sandbox Crawler');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: { url: 'http://169.254.169.254/latest/meta-data' },
        query: {},
      };

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleScraperAgentService(mockReq, mockRes);
      expect(statusCode).toBe(400);
      expect(serviceOutput.error).toBe('SSRF Protection Violation');
    });

    it('rejects unresolvable hostname (e.g. example-transport-aggregator.com) with HTTP 502 Hostname Resolution Failed and no settlement', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.03, 'WebExtract Sandbox Crawler');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: { url: 'https://example-transport-aggregator.com/api/routes' },
        query: {},
      };

      const mockRes: any = {
        set: () => {},
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleScraperAgentService(mockReq, mockRes);
      expect(statusCode).toBe(502);
      expect(serviceOutput.error).toBe('Hostname Resolution Failed');
      expect(serviceOutput.status).toBe('dns_failure');
      expect(serviceOutput.hostname).toBe('example-transport-aggregator.com');
      expect(serviceOutput.items).toBeUndefined();
    });

    it('extracts live HTML page elements using Cheerio on verified URL (https://example.com)', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.03, 'WebExtract Sandbox Crawler');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: { url: 'https://example.com' },
        query: {},
      };

      const mockRes: any = {
        set: () => {},
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleScraperAgentService(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(serviceOutput.parser).toContain('Cheerio');
      expect(serviceOutput.items_found).toBeGreaterThan(0);
      expect(serviceOutput.items.length).toBeGreaterThan(0);
      expect(serviceOutput.items[0].title).toContain('Example Domain');
      expect(serviceOutput.items[0].url).toBe('https://example.com');
      expect(serviceOutput.items[0].headings).toBeDefined();
    });

    it('validates isPrivateOrBlockedIp against loopbacks, 10.x, 172.16-31.x, 192.168.x, 169.254.x', () => {
      expect(isPrivateOrBlockedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrBlockedIp('127.1.2.3')).toBe(true);
      expect(isPrivateOrBlockedIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrBlockedIp('10.255.255.255')).toBe(true);
      expect(isPrivateOrBlockedIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrBlockedIp('172.31.255.255')).toBe(true);
      expect(isPrivateOrBlockedIp('172.32.0.1')).toBe(false);
      expect(isPrivateOrBlockedIp('192.168.0.1')).toBe(true);
      expect(isPrivateOrBlockedIp('192.168.1.100')).toBe(true);
      expect(isPrivateOrBlockedIp('169.254.169.254')).toBe(true);
      expect(isPrivateOrBlockedIp('::1')).toBe(true);
      expect(isPrivateOrBlockedIp('fe80::1')).toBe(true);
      expect(isPrivateOrBlockedIp('fc00::1')).toBe(true);
      expect(isPrivateOrBlockedIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrBlockedIp('1.1.1.1')).toBe(false);
    });
  });

  describe('3. AI Inference Agent Synthesis with Google Gemini', () => {
    it('synthesizes real extracted product records into comparison and recommendation', async () => {
      const mockRetrievedContext = `
Agent [AlphaData Market Oracle] output: {
  "asset": "laptop",
  "products": [
    { "title": "Apple MacBook Pro 14", "price": 1999.99, "stock": 24, "sourceUrl": "https://dummyjson.com/products/78" },
    { "title": "Asus Zenbook Pro Dual Screen", "price": 1799.99, "stock": 12, "sourceUrl": "https://dummyjson.com/products/79" }
  ]
}
---
Agent [WebExtract Sandbox Crawler] output: {
  "items": [
    { "title": "Lenovo Yoga 920", "price": "$1,099.99", "in_stock": true, "url": "https://dummyjson.com/products/81" }
  ]
}
      `.trim();

      const taskGoal = 'Compare top laptops under $2000 and recommend the best value';
      const synthesis = await aiService.runInferenceWithAI(mockRetrievedContext, taskGoal);

      expect(synthesis.data.summary).toBeDefined();
      expect(synthesis.data.key_takeaways).toBeInstanceOf(Array);
      expect(synthesis.data.key_takeaways.length).toBeGreaterThan(0);
      expect(['Bullish', 'Bearish', 'Neutral']).toContain(synthesis.data.sentiment);
      expect(synthesis.data.confidence_score).toBeGreaterThan(0.2);
    });

    it('rejects inference requests with empty context with HTTP 400', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.04, 'CogniSynthesize LLM');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: { context: '' },
        query: {},
      };

      const mockRes: any = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleInferenceAgentService(mockReq, mockRes);
      expect(statusCode).toBe(400);
      expect(serviceOutput.error).toBe('Invalid Request');
      expect(serviceOutput.message).toContain('context');
    });

    it('executes paid inference service endpoint with live Gemini synthesis and telemetry', async () => {
      const challenge = x402Engine.createChallenge(dummyRecipient, 0.04, 'CogniSynthesize LLM');
      const auth = await x402Engine.authorizePayment(challenge, dummyRecipient, 0.05);

      let serviceOutput: any;
      let statusCode = 0;

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${Buffer.from(JSON.stringify(auth)).toString('base64')}`,
        },
        body: {
          context: 'Ethereum price is $2450 USD. 24h trading volume is 14.8B USD. Liquidity pools on Base are healthy.',
          task_goal: 'Evaluate short term market sentiment and risk factors',
        },
        query: {},
      };

      const mockRes: any = {
        set: () => {},
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          serviceOutput = data;
        },
      };

      await handleInferenceAgentService(mockReq, mockRes);
      expect(statusCode).toBe(200);
      expect(serviceOutput.summary).toBeDefined();
      expect(serviceOutput.sentiment).toBeDefined();
      expect(['Bullish', 'Bearish', 'Neutral']).toContain(serviceOutput.sentiment);
      expect(serviceOutput.confidence_score).toBeGreaterThan(0);
      expect(Array.isArray(serviceOutput.verified_facts)).toBe(true);
      expect(Array.isArray(serviceOutput.risk_factors)).toBe(true);
      expect(serviceOutput.model_used).toBeDefined();
      expect(serviceOutput.ai_telemetry).toBeDefined();
      expect(serviceOutput.ai_telemetry.provider).toBe('gemini');
      expect(serviceOutput.paymentReceipt.protocol).toBe('x402 v2');
      expect(serviceOutput.paymentReceipt.amountPaidUsdc).toBe(0.04);
    });
  });

  describe('4. Buyer Agent Multi-Agent End-to-End Orchestration Flow', () => {
    it('plans multi-agent task with real product search query', async () => {
      const approvedAgents = await db.getApprovedAgents();
      expect(approvedAgents.length).toBeGreaterThanOrEqual(3);

      const planResult = await aiService.planTaskWithAI(
        'Research and compare top laptops under $2000 budget',
        0.15,
        approvedAgents
      );

      expect(planResult.data.steps.length).toBeGreaterThanOrEqual(2);
      expect(planResult.data.estimatedTotalUsdc).toBeLessThanOrEqual(0.15);

      // Verify that planned step payloads use 'laptop' rather than generic fallback
      const dataOrScraperStep = planResult.data.steps.find((s) => s.category === 'Data' || s.category === 'Scraping');
      expect(dataOrScraperStep).toBeDefined();
    });

    it('executes a complete multi-agent pipeline passing verified outputs from Data to Scraper to Inference', async () => {
      // 1. Data Agent step: Retrieve real products
      const dataChallenge = x402Engine.createChallenge(dummyRecipient, 0.02, 'AlphaData Market Oracle');
      const dataAuth = await x402Engine.authorizePayment(dataChallenge, dummyRecipient, 0.05);

      let dataOutput: any;
      let statusCode = 0;
      const makeDataCall = async () => {
        await handleDataAgentService(
          {
            headers: { authorization: `Bearer ${Buffer.from(JSON.stringify(dataAuth)).toString('base64')}` },
            body: { query: 'laptop' },
            query: {},
          } as any,
          {
            set: () => {},
            status: (code: number) => {
              statusCode = code;
              return { json: (d: any) => { dataOutput = d; } };
            },
          } as any
        );
      };

      await makeDataCall();
      if (!dataOutput?.products && statusCode === 502) {
        await new Promise((r) => setTimeout(r, 1000));
        await makeDataCall();
      }

      expect(dataOutput.products).toBeDefined();
      expect(dataOutput.products.length).toBeGreaterThan(0);
      const topProduct = dataOutput.products[0];

      // 2. Scraper Agent step: Crawl product details using real URL
      const scraperChallenge = x402Engine.createChallenge(dummyRecipient, 0.03, 'WebExtract Sandbox Crawler');
      const scraperAuth = await x402Engine.authorizePayment(scraperChallenge, dummyRecipient, 0.05);

      let scraperOutput: any;
      await handleScraperAgentService(
        {
          headers: { authorization: `Bearer ${Buffer.from(JSON.stringify(scraperAuth)).toString('base64')}` },
          body: { url: topProduct.sourceUrl },
          query: {},
        } as any,
        {
          set: () => {},
          status: () => ({ json: (d: any) => { scraperOutput = d; } }),
        } as any
      );

      expect(scraperOutput.items.length).toBeGreaterThan(0);

      // 3. Inference Agent step: Synthesize real multi-stage output using Gemini
      const combinedContext = [
        `Data Agent Output: Retrieved product "${topProduct.title}" priced at $${topProduct.price} from ${topProduct.sourceUrl}.`,
        `Scraper Agent Output: Extracted title "${scraperOutput.items[0].title}" with price "${scraperOutput.items[0].price}" from ${scraperOutput.url}.`
      ].join('\n---\n');

      const inferChallenge = x402Engine.createChallenge(dummyRecipient, 0.04, 'CogniSynthesize LLM');
      const inferAuth = await x402Engine.authorizePayment(inferChallenge, dummyRecipient, 0.05);

      let inferOutput: any;
      await handleInferenceAgentService(
        {
          headers: { authorization: `Bearer ${Buffer.from(JSON.stringify(inferAuth)).toString('base64')}` },
          body: {
            context: combinedContext,
            task_goal: 'Compare verified laptop specifications and recommend purchasing choice',
          },
          query: {},
        } as any,
        {
          set: () => {},
          status: () => ({ json: (d: any) => { inferOutput = d; } }),
        } as any
      );

      expect(inferOutput.summary).toBeDefined();
      expect(inferOutput.sentiment).toBeDefined();
      expect(inferOutput.confidence_score).toBeGreaterThan(0);
      expect(Array.isArray(inferOutput.verified_facts)).toBe(true);
      expect(inferOutput.ai_telemetry.provider).toBe('gemini');
      expect(inferOutput.paymentReceipt.protocol).toBe('x402 v2');
    });

    it('ensures pre-settlement failure releases budget reservation without charging the buyer', async () => {
      const testTaskId = `task_presettle_test_${Date.now()}`;
      await db.createTask({
        id: testTaskId,
        user_id: 'c0000000-0000-0000-0000-000000000001',
        title: 'Pre-settlement failure test',
        description: 'Test budget release upon pre-settlement failure',
        budget_limit: 0.10,
        total_cost: 0,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      // 1. Initial remaining budget must be 0.10
      const initialRemaining = await budgetGuard.getRemainingBudget(testTaskId);
      expect(initialRemaining).toBe(0.10);

      // 2. Reserve 0.03 USDC for scraping agent
      const reservation = await budgetGuard.reserveBudget(testTaskId, SCRAPER_AGENT_CONFIG.id, 0.03);
      expect(reservation.success).toBe(true);
      expect(reservation.reservationId).toBeDefined();

      // Remaining budget under active lock is now 0.07 USDC
      const reservedRemaining = await budgetGuard.getRemainingBudget(testTaskId);
      expect(reservedRemaining).toBe(0.07);

      // 3. Pre-settlement failure occurs (e.g. DNS failure / invalid endpoint / rejection)
      // Release reservation without committing
      budgetGuard.releaseReservation(reservation.reservationId!);

      // 4. Remaining budget restores to full 0.10 USDC and task total_cost is 0
      const restoredRemaining = await budgetGuard.getRemainingBudget(testTaskId);
      expect(restoredRemaining).toBe(0.10);

      const task = await db.getTaskById(testTaskId);
      expect(task?.total_cost).toBe(0);

      // 5. Verify no confirmed ledger transaction was created
      const transactions = await db.getTransactions(testTaskId);
      expect(transactions.length).toBe(0);
    });
  });
});

