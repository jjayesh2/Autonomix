/**
 * AI Provider Types & Schemas for Autonomix
 * Separates AI model providers (Google Gemini, OpenAI, etc.) from the seller-agent and x402 settlement layers.
 */

export type AIProviderType = 'gemini' | 'openai' | 'deterministic';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AICostEstimate {
  promptCostUsd: number;
  completionCostUsd: number;
  totalCostUsd: number;
}

export interface AICompletionResult<T = any> {
  data: T;
  rawText: string;
  model: string;
  provider: AIProviderType;
  usage: TokenUsage;
  costUsd: number;
  latencyMs: number;
}

export interface StructuredOutputOptions {
  prompt: string;
  systemInstruction?: string;
  schema?: object;
  temperature?: number;
  timeoutMs?: number;
}

export interface AIProviderStatus {
  provider: AIProviderType;
  configured: boolean;
  model: string;
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  errorCount: number;
  lastLatencyMs?: number;
  missingKeyWarning?: string;
  rateLimit: {
    maxRpm: number;
    currentRpm: number;
  };
}

export interface PlannedAgentSelection {
  agentId: string;
  agentName: string;
  category: 'Data' | 'Inference' | 'Scraping';
  actionType: string;
  rationale: string;
  inputPayload: Record<string, any>;
  estimatedCostUsd: number;
}

export interface StructuredTaskPlan {
  taskGoal: string;
  requiredCapabilities: string[];
  steps: PlannedAgentSelection[];
  constraints: string[];
  explanation: string;
  estimatedTotalUsdc: number;
}
