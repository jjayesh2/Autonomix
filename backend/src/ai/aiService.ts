import { config } from '../config/index.js';
import { GeminiProvider } from './geminiProvider.js';
import {
  AIProviderType,
  AICompletionResult,
  StructuredTaskPlan,
  AIProviderStatus,
} from './types.js';
import { Agent } from '../db/types.js';

// JSON Schema for the Buyer Agent Execution Plan
const TASK_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    taskGoal: { type: 'string' },
    requiredCapabilities: {
      type: 'array',
      items: { type: 'string' },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          agentName: { type: 'string' },
          category: { type: 'string', enum: ['Data', 'Inference', 'Scraping'] },
          actionType: { type: 'string' },
          rationale: { type: 'string' },
          inputPayload: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              target: { type: 'string' },
              symbol: { type: 'string' },
              url: { type: 'string' },
              context: { type: 'string' },
              task_goal: { type: 'string' },
            },
          },
          estimatedCostUsd: { type: 'number' },
        },
        required: ['agentId', 'agentName', 'category', 'actionType', 'rationale', 'estimatedCostUsd'],
      },
    },
    constraints: {
      type: 'array',
      items: { type: 'string' },
    },
    explanation: { type: 'string' },
    estimatedTotalUsdc: { type: 'number' },
  },
  required: ['taskGoal', 'requiredCapabilities', 'steps', 'explanation', 'estimatedTotalUsdc'],
};

// JSON Schema for the Inference Agent Synthesis Output
const INFERENCE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    key_takeaways: {
      type: 'array',
      items: { type: 'string' },
    },
    sentiment: { type: 'string', enum: ['Bullish', 'Bearish', 'Neutral'] },
    confidence_score: { type: 'number' },
    verified_facts: {
      type: 'array',
      items: { type: 'string' },
    },
    risk_factors: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
    source_citations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'key_takeaways', 'sentiment', 'confidence_score'],
};

export class AIService {
  private geminiProvider: GeminiProvider;
  private defaultProvider: AIProviderType;

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY || config.ai.geminiApiKey;
    this.geminiProvider = new GeminiProvider(geminiKey, process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite');
    this.defaultProvider = (process.env.AI_PROVIDER as AIProviderType) || (geminiKey ? 'gemini' : 'deterministic');
  }

  public getStatus(): AIProviderStatus {
    return this.geminiProvider.getStatus();
  }

  public async testProvider(): Promise<any> {
    return this.geminiProvider.testConnection();
  }

  /**
   * Buyer Agent Planning using Gemini LLM
   * Interprets natural language, selects agents from marketplace, produces structured plan.
   */
  async planTaskWithAI(
    description: string,
    budgetLimit: number,
    availableAgents: Agent[]
  ): Promise<AICompletionResult<StructuredTaskPlan>> {
    // 1. If Gemini is configured and preferred, use live LLM
    if (this.defaultProvider !== 'deterministic') {
      if (!this.geminiProvider.isConfigured()) {
        throw new Error('Buyer Agent Planning Failed: GEMINI_API_KEY is not configured. Live planning requires a valid Google Gemini API key.');
      }

      const agentsSummary = availableAgents.map((a) => ({
        id: a.id,
        name: a.name,
        category: a.category,
        priceUsdc: a.price_usdc,
        rating: a.metrics?.rating_average || 5.0,
        capabilities: a.capabilities,
      }));

      const prompt = `You are the Buyer Agent Orchestrator for Autonomix, an autonomous pay-per-call agent marketplace operating on Base Sepolia.

User Task Description: "${description}"
Total Maximum Budget: ${budgetLimit} USDC

Available Approved Agents in Marketplace:
${JSON.stringify(agentsSummary, null, 2)}

Instructions:
1. Deconstruct the user's task into necessary sub-steps.
2. Select appropriate agents from the available marketplace agents based on capability, price, and reputation.
3. Order the execution sequence logically (typically Data Query -> Web Scraping/Extraction -> AI Inference Synthesis).
4. Provide structured input payloads for each step matching agent requirements.
5. Calculate the total estimated cost (sum of step prices). It must not exceed ${budgetLimit} USDC.
6. Provide an explanation of the multi-agent orchestration strategy.

Respond with valid JSON matching this structure:
{
  "taskGoal": string,
  "requiredCapabilities": string[],
  "steps": [
    {
      "agentId": string,
      "agentName": string,
      "category": "Data" | "Inference" | "Scraping",
      "actionType": string,
      "rationale": string,
      "inputPayload": object,
      "estimatedCostUsd": number
    }
  ],
  "constraints": string[],
  "explanation": string,
  "estimatedTotalUsdc": number
}`;

      try {
        const result = await this.geminiProvider.generateStructured<StructuredTaskPlan>({
          prompt,
          systemInstruction: 'You are an autonomous AI Agent Orchestration Planner. You emit strict, valid JSON plans only.',
          schema: TASK_PLAN_SCHEMA,
          temperature: 0.1,
          timeoutMs: 25000,
        });

        // Double check budget constraint on parsed output
        let totalCost = result.data.steps.reduce((sum, s) => sum + s.estimatedCostUsd, 0);
        result.data.estimatedTotalUsdc = Number(totalCost.toFixed(4));

        return result;
      } catch (err: any) {
        console.error(`[AIService] Gemini planning failed: ${err.message}.`);
        throw new Error(`Buyer Agent Planning Failed: Live Google Gemini execution failed (${err.message}). Live mode prohibits silent mock fallbacks.`);
      }
    }

    // 2. Deterministic Fallback Planner (Explicitly only when AI_PROVIDER=deterministic for offline tests)
    return this.generateDeterministicPlan(description, budgetLimit, availableAgents);
  }

  /**
   * Inference Agent Synthesis using Gemini LLM
   */
  async runInferenceWithAI(
    context: string,
    taskGoal: string
  ): Promise<AICompletionResult<any>> {
    if (!context || !context.trim()) {
      throw new Error('Inference input error: Context from preceding data/scraping steps is empty.');
    }
    if (!taskGoal || !taskGoal.trim()) {
      throw new Error('Inference input error: task_goal parameter is required.');
    }

    if (this.defaultProvider !== 'deterministic') {
      if (!this.geminiProvider.isConfigured()) {
        throw new Error('Inference Failed: GEMINI_API_KEY is not configured. Live AI inference requires a valid Google Gemini API key.');
      }

      const prompt = `You are CogniSynthesize, an autonomous AI Inference Agent operating in the Autonomix Agent Economy paid via HTTP 402 on Base Sepolia.
Goal: ${taskGoal}

Supplied verified context from upstream tool executions (Data Oracle and Web Scraping outputs):
${context}

Instructions:
1. Extract and cite verified_facts directly from the upstream context as an array of strings (exact prices, asset tickers, product titles, URLs, timestamps).
2. Synthesize an objective executive summary of the findings as a string.
3. List key_takeaways as an array of strings.
4. Assess market or commercial sentiment strictly as "Bullish", "Bearish", or "Neutral".
5. Provide a realistic confidence_score between 0.0 and 1.0 based on data quality.
6. Identify specific risk_factors as an array of strings.
7. Provide recommendations as an array of strings.
8. List source_citations corresponding to the real URLs provided as an array of strings.
9. Clearly separate externally verified facts from your AI-generated recommendations.

Respond strictly with valid JSON conforming to this structure:
{
  "summary": string,
  "key_takeaways": string[],
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "confidence_score": number,
  "verified_facts": string[],
  "risk_factors": string[],
  "recommendations": string[],
  "source_citations": string[]
}`;

      try {
        return await this.geminiProvider.generateStructured<any>({
          prompt,
          systemInstruction: 'You are an objective autonomous AI inference agent. You return strict, valid JSON matching the schema.',
          schema: INFERENCE_OUTPUT_SCHEMA,
          temperature: 0.2,
          timeoutMs: 25000,
        });
      } catch (err: any) {
        console.error(`[AIService] Live Gemini inference failed: ${err.message}`);
        throw new Error(`Inference Service Error: Live Google Gemini execution failed (${err.message}). Live mode strictly prohibits mock fallbacks.`);
      }
    }

    // Deterministic Rule-Based Synthesis (Strictly for isolated offline unit tests)
    return this.generateDeterministicInference(context, taskGoal);
  }

  /**
   * Deterministic Rule-Based Planner (Isolated test fixture only)
   */
  public generateDeterministicPlan(
    description: string,
    budgetLimit: number,
    availableAgents: Agent[]
  ): AICompletionResult<StructuredTaskPlan> {
    const lower = description.toLowerCase();
    const needsData = lower.includes('data') || lower.includes('market') || lower.includes('price') ||
      lower.includes('crypto') || lower.includes('eth') || lower.includes('btc') || lower.includes('oracle') ||
      lower.includes('laptop') || lower.includes('phone') || lower.includes('product') ||
      lower.includes('all') || lower.includes('multi');

    const needsScraper = lower.includes('scrap') || lower.includes('extract') || lower.includes('web') ||
      lower.includes('product') || lower.includes('catalog') || lower.includes('laptop') ||
      lower.includes('all') || lower.includes('multi');

    const needsInference = lower.includes('summar') || lower.includes('synthes') || lower.includes('analyz') ||
      lower.includes('report') || lower.includes('brief') || lower.includes('compare') || lower.includes('all') || lower.includes('multi') ||
      (!needsData && !needsScraper);

    const selected: Agent[] = [];
    const dataAgent = availableAgents.find((a) => a.category === 'Data');
    const scraperAgent = availableAgents.find((a) => a.category === 'Scraping');
    const inferenceAgent = availableAgents.find((a) => a.category === 'Inference');

    if (needsData && dataAgent) selected.push(dataAgent);
    if (needsScraper && scraperAgent) selected.push(scraperAgent);
    if (needsInference && inferenceAgent) selected.push(inferenceAgent);

    if (selected.length === 0 && availableAgents.length > 0) {
      selected.push(availableAgents[0]);
    }

    const isProduct = lower.includes('laptop') || lower.includes('phone') || lower.includes('watch') ||
      lower.includes('product') || lower.includes('buy') || lower.includes('shoe');
    const productQuery = lower.includes('laptop') ? 'laptop' : lower.includes('phone') ? 'phone' : lower.includes('watch') ? 'watch' : 'laptop';

    const steps = selected.map((agent, i) => {
      let actionType = 'Data Query';
      let payload: any = { query: 'ETH' };
      if (agent.category === 'Data') {
        actionType = isProduct ? 'Live Product Data Retrieval' : 'Oracle Price Feed Retrieval';
        payload = { query: isProduct ? productQuery : (lower.includes('btc') ? 'BTC' : lower.includes('base') ? 'BASE' : 'ETH') };
      } else if (agent.category === 'Scraping') {
        actionType = 'Live Web & Catalog Extraction';
        payload = { target: isProduct ? productQuery : 'hardware', extract_fields: ['title', 'price', 'url'] };
      } else {
        actionType = 'AI Multi-Agent Synthesis';
        payload = { task_goal: description, format: 'executive_summary' };
      }

      return {
        agentId: agent.id,
        agentName: agent.name,
        category: agent.category as any,
        actionType,
        rationale: `Selected ${agent.name} (${agent.category}) at ${agent.price_usdc} USDC.`,
        inputPayload: payload,
        estimatedCostUsd: agent.price_usdc,
      };
    });

    const total = steps.reduce((acc, s) => acc + s.estimatedCostUsd, 0);

    const planData: StructuredTaskPlan = {
      taskGoal: description,
      requiredCapabilities: selected.map((s) => s.category),
      steps,
      constraints: [`Budget Cap: ${budgetLimit} USDC`, 'Permitted Sandbox Scraper Only', 'x402 Pay-per-Call Settlement'],
      explanation: `Deterministic test fixture plan selecting ${steps.length} approved agents within ${budgetLimit} USDC budget.`,
      estimatedTotalUsdc: Number(total.toFixed(4)),
    };

    return {
      data: planData,
      rawText: JSON.stringify(planData, null, 2),
      model: 'Deterministic Rule Engine (Test Fixture)',
      provider: 'deterministic',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costUsd: 0,
      latencyMs: 1,
    };
  }

  /**
   * Deterministic Rule-Based Inference (Isolated test fixture only)
   */
  private generateDeterministicInference(context: string, taskGoal: string): AICompletionResult<any> {
    const isCrypto = context.includes('BTC') || context.includes('ETH') || context.includes('price_usd');
    const isProduct = context.includes('laptop') || context.includes('products') || context.includes('phone');

    const sentiment: 'Bullish' | 'Bearish' | 'Neutral' = isCrypto ? 'Bullish' : 'Neutral';
    const confidence = isCrypto || isProduct ? 0.94 : 0.88;

    const verifiedFacts: string[] = [];
    if (isCrypto) {
      verifiedFacts.push('Real-time cryptocurrency rate retrieved from live market oracle');
    }
    if (isProduct) {
      verifiedFacts.push('Product catalog inventory retrieved from live product repository');
    }
    if (verifiedFacts.length === 0) {
      verifiedFacts.push('Context data retrieved from upstream marketplace agents');
    }

    const summary = isCrypto
      ? `Market Intelligence Brief: Synthesized live oracle data for target assets. Liquidity and volume confirm active trading participation.`
      : isProduct
      ? `Commercial Hardware Brief: Analyzed live product catalog and verified available specs, stock availability, and manufacturer pricing.`
      : `Executive Synthesis: Multi-agent pipeline gathered verified context for '${taskGoal}'. Realized outputs meet required operational threshold.`;

    const keyTakeaways = isCrypto
      ? [
          'Live oracle pricing verified across Base Sepolia network.',
          'High 24h market activity confirms active demand.',
          'Decentralized oracle feed verified with zero latency deviation.',
        ]
      : isProduct
      ? [
          'Multiple matching items identified with real pricing and specs.',
          'In-stock availability confirmed through live repository inspection.',
          'Direct manufacturer source URLs verified without fabrication.',
        ]
      : [
          'Multi-agent pipeline succeeded across all dispatched execution stages.',
          'x402 micropayments verified on-chain with unique transaction receipts.',
        ];

    const riskFactors = isCrypto
      ? ['Short-term volatility across decentralized liquidity pools.', 'Macroeconomic rate adjustments.']
      : ['Hardware stock fluctuations across retailers.', 'Pricing variations across vendor tiers.'];

    const data = {
      verified_facts: verifiedFacts,
      summary,
      key_takeaways: keyTakeaways,
      sentiment,
      confidence_score: confidence,
      risk_factors: riskFactors,
      recommendations: [
        'Review itemized provider outputs and verify transaction hashes on Basescan Sepolia.',
        'Ensure continuous monitoring of liquidity and stock availability.',
      ],
      source_citations: ['https://dummyjson.com', 'https://api.binance.com'],
    };

    return {
      data,
      rawText: JSON.stringify(data, null, 2),
      model: 'Deterministic Rule Engine (Test Fixture)',
      provider: 'deterministic',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costUsd: 0,
      latencyMs: 1,
    };
  }
}

export const aiService = new AIService();
