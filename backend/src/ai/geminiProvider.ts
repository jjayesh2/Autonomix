import { GoogleGenAI } from '@google/genai';
import {
  AIProviderType,
  AICompletionResult,
  StructuredOutputOptions,
  TokenUsage,
  AIProviderStatus,
} from './types.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new (Ajv as any)({ allErrors: true, coerceTypes: true });
(addFormats as any)(ajv);

export class MissingAIKeyError extends Error {
  constructor(provider: string) {
    super(
      `Missing ${provider} API Key. Set GEMINI_API_KEY in backend/.env to enable live AI orchestration. See documentation for setup.`
    );
    this.name = 'MissingAIKeyError';
  }
}

export class AIQuotaExhaustedError extends Error {
  public readonly status = 429;
  public readonly retryable = true;
  public readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'AIQuotaExhaustedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AITransientError extends Error {
  public readonly retryable = true;
  constructor(message: string) {
    super(message);
    this.name = 'AITransientError';
  }
}

/**
 * Checks if an error represents HTTP 429 / RESOURCE_EXHAUSTED / quota limit.
 */
export function isRateLimitOrQuotaError(err: any): { isQuota: boolean; retryAfterSec?: number } {
  const status = err?.status || err?.statusCode || err?.code || (err?.response && err.response.status);
  const msg = String(err?.message || '').toLowerCase();
  const isQuota =
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit');

  if (!isQuota) return { isQuota: false };

  let retryAfterSec: number | undefined;
  const match = msg.match(/retry\s+(?:in|after)\s+(\d+(?:\.\d+)?)\s*s/i);
  if (match) {
    retryAfterSec = Math.ceil(parseFloat(match[1]));
  }
  return { isQuota: true, retryAfterSec };
}

/**
 * Calculates exponential backoff delay with jitter.
 */
export function calculateBackoffDelay(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec && retryAfterSec > 0 && retryAfterSec <= 15) {
    return retryAfterSec * 1000 + Math.floor(Math.random() * 500);
  }
  const base = 1000;
  const maxDelay = 8000;
  const exp = Math.min(maxDelay, base * Math.pow(2, attempt));
  // Jitter ±25%
  const jitter = exp * (0.75 + Math.random() * 0.5);
  return Math.floor(jitter);
}

export class GeminiProvider {
  public readonly provider: AIProviderType = 'gemini';
  private client: GoogleGenAI | null = null;
  private modelName: string;
  private apiKey: string | null = null;

  // Rate Limiting & Usage Tracking
  private requestTimestamps: number[] = [];
  private readonly maxRpm: number = 60;
  private totalRequests: number = 0;
  private totalTokens: number = 0;
  private totalCostUsd: number = 0;
  private errorCount: number = 0;
  private lastLatencyMs: number = 0;

  // Pricing constants (per 1,000,000 tokens for Gemini 3.5 Flash / Flash-Lite)
  // Input: $0.075 / 1M tokens ($0.000000075 / token)
  // Output: $0.30 / 1M tokens ($0.00000030 / token)
  private readonly inputTokenCost = 0.000000075;
  private readonly outputTokenCost = 0.00000030;

  // Verified active fallback models if configured model is deprecated or unavailable
  private static readonly VERIFIED_ACTIVE_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  constructor(apiKey?: string, modelName?: string) {
    this.apiKey = apiKey ? apiKey.trim() : null;
    this.modelName = modelName || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

    if (this.apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.error('[GeminiProvider] Failed to initialize GoogleGenAI client:', err);
        this.client = null;
      }
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.client);
  }

  public getModelName(): string {
    return this.modelName;
  }

  public getStatus(): AIProviderStatus {
    const now = Date.now();
    // Prune timestamps older than 60 seconds for RPM calculation
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < 60000);

    return {
      provider: this.provider,
      configured: this.isConfigured(),
      model: this.modelName,
      totalRequests: this.totalRequests,
      totalTokens: this.totalTokens,
      totalCostUsd: Number(this.totalCostUsd.toFixed(6)),
      errorCount: this.errorCount,
      lastLatencyMs: this.lastLatencyMs,
      missingKeyWarning: !this.isConfigured()
        ? 'GEMINI_API_KEY is not set. Configure it in backend environment variables to enable live Google Gemini calls.'
        : undefined,
      rateLimit: {
        maxRpm: this.maxRpm,
        currentRpm: this.requestTimestamps.length,
      },
    };
  }

  /**
   * Enforces Rate Limiting (Leaky Bucket / Sliding Window)
   */
  private checkRateLimit(): void {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < 60000);
    if (this.requestTimestamps.length >= this.maxRpm) {
      throw new AIQuotaExhaustedError(
        `Local client rate limit exceeded (${this.maxRpm} RPM). Please slow down requests.`,
        5
      );
    }
    this.requestTimestamps.push(now);
  }

  /**
   * Sanitizes any accidental API key occurrences from error strings.
   */
  private sanitizeError(rawMessage: string): string {
    if (!this.apiKey) return rawMessage;
    return rawMessage.replace(new RegExp(this.apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED_API_KEY]');
  }

  /**
   * Generates structured JSON output strictly validated against a JSON Schema,
   * with bounded exponential backoff, HTTP 429 quota handling, and timeout safeguards.
   */
  async generateStructured<T>(options: StructuredOutputOptions): Promise<AICompletionResult<T>> {
    if (!this.client || !this.apiKey) {
      this.errorCount++;
      throw new MissingAIKeyError('Google Gemini');
    }

    this.checkRateLimit();
    this.totalRequests++;

    const maxTotalTimeoutMs = options.timeoutMs || Number(process.env.AI_REQUEST_TIMEOUT_MS) || 25000;
    const maxRetries = 2; // Up to 3 attempts total
    const overallStartTime = Date.now();

    const systemPrompt = options.systemInstruction
      ? `${options.systemInstruction}\n\nIMPORTANT: You must return valid JSON only. Do not wrap in markdown quotes if possible, or use standard markdown json blocks.`
      : 'You are a precise autonomous AI agent. Respond with valid JSON only.';

    const fullPrompt = `${systemPrompt}\n\nTask:\n${options.prompt}`;

    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const elapsedOverall = Date.now() - overallStartTime;
      const remainingTimeMs = maxTotalTimeoutMs - elapsedOverall;

      if (remainingTimeMs <= 1000) {
        throw new Error(
          `[GeminiProvider Error]: Overall operation exceeded deadline (${maxTotalTimeoutMs}ms) after attempt ${attempt}.`
        );
      }

      // Per-attempt timeout capped by remaining overall time
      const attemptTimeoutMs = Math.min(18000, remainingTimeMs);
      const attemptStartTime = Date.now();

      try {
        const generateConfig: any = {
          temperature: options.temperature ?? 0.2,
        };

        if (options.schema) {
          generateConfig.responseMimeType = 'application/json';
          generateConfig.responseSchema = options.schema;
        }

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini API request timed out after ${attemptTimeoutMs}ms`)), attemptTimeoutMs)
        );

        let response: any;
        try {
          const generatePromise = this.client.models.generateContent({
            model: this.modelName,
            contents: fullPrompt,
            config: generateConfig,
          });
          response = await Promise.race([generatePromise, timeoutPromise]);
        } catch (genErr: any) {
          // If responseSchema caused a 400 schema error, retry without responseSchema but keep json mime
          if (generateConfig.responseSchema && String(genErr.message).includes('schema')) {
            console.warn('[GeminiProvider] Retrying with plain JSON mime type due to schema issue:', genErr.message);
            const fallbackConfig = {
              temperature: options.temperature ?? 0.2,
              responseMimeType: 'application/json',
            };
            const fallbackPromise = this.client.models.generateContent({
              model: this.modelName,
              contents: fullPrompt,
              config: fallbackConfig,
            });
            response = await Promise.race([fallbackPromise, timeoutPromise]);
          } else if (String(genErr.message).includes('404') && String(genErr.message).includes('NOT_FOUND')) {
            // Model unavailable or deprecated — use verified active fallback
            const verifiedFallback = GeminiProvider.VERIFIED_ACTIVE_MODELS.find((m) => m !== this.modelName) || 'gemini-flash-lite-latest';
            console.warn(`[GeminiProvider] Model ${this.modelName} not found, switching to verified model ${verifiedFallback}`);
            this.modelName = verifiedFallback;
            const modelFallbackPromise = this.client.models.generateContent({
              model: this.modelName,
              contents: fullPrompt,
              config: generateConfig,
            });
            response = await Promise.race([modelFallbackPromise, timeoutPromise]);
          } else {
            throw genErr;
          }
        }

        const latencyMs = Date.now() - attemptStartTime;
        this.lastLatencyMs = latencyMs;

        const rawText: string = response.text || '';
        if (!rawText.trim()) {
          throw new Error('Gemini returned an empty response.');
        }

        // Parse JSON safely from markdown or plain text
        let parsedData: T;
        try {
          const cleaned = rawText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          parsedData = JSON.parse(cleaned);
        } catch (parseErr: any) {
          throw new Error(`Failed to parse Gemini output as JSON: ${parseErr.message}. Output was: ${rawText.slice(0, 120)}...`);
        }

        // Validate with Ajv against schema if provided
        if (options.schema) {
          const validate = ajv.compile(options.schema);
          const valid = validate(parsedData);
          if (!valid) {
            const errors = (validate.errors || []).map((e: any) => `${e.instancePath} ${e.message}`).join(', ');
            throw new Error(`Gemini output failed schema validation: ${errors}`);
          }
        }

        // Extract real token usage
        const usageMetadata = response.usageMetadata || {};
        const usage: TokenUsage = {
          promptTokens: usageMetadata.promptTokenCount || Math.ceil(fullPrompt.length / 4),
          completionTokens: usageMetadata.candidatesTokenCount || Math.ceil(rawText.length / 4),
          totalTokens: usageMetadata.totalTokenCount || (Math.ceil(fullPrompt.length / 4) + Math.ceil(rawText.length / 4)),
        };

        // Calculate actual provider cost
        const costUsd =
          usage.promptTokens * this.inputTokenCost + usage.completionTokens * this.outputTokenCost;

        this.totalTokens += usage.totalTokens;
        this.totalCostUsd += costUsd;

        console.log(`[GeminiProvider Telemetry] Success (attempt ${attempt + 1}) | Model: ${this.modelName} | Tokens: ${usage.totalTokens} | Latency: ${latencyMs}ms | Cost: $${costUsd.toFixed(6)}`);

        return {
          data: parsedData,
          rawText,
          model: this.modelName,
          provider: this.provider,
          usage,
          costUsd: Number(costUsd.toFixed(6)),
          latencyMs,
        };
      } catch (err: any) {
        lastError = err;
        this.errorCount++;

        const { isQuota, retryAfterSec } = isRateLimitOrQuotaError(err);
        const isTimeout = String(err.message).includes('timed out');
        const sanitizedMsg = this.sanitizeError(err.message || 'Unknown error');

        console.warn(
          `[GeminiProvider Telemetry] Attempt ${attempt + 1}/${maxRetries + 1} failed (${isQuota ? 'HTTP 429 Quota' : isTimeout ? 'Timeout' : 'Error'}): ${sanitizedMsg}`
        );

        if (attempt < maxRetries) {
          // If quota exceeded with long delay (> 15s), do not wait endlessly
          if (isQuota && retryAfterSec && retryAfterSec > 15) {
            throw new AIQuotaExhaustedError(
              `Google Gemini quota exhausted (HTTP 429). Retry suggested after ${retryAfterSec}s.`,
              retryAfterSec
            );
          }

          const backoffDelay = calculateBackoffDelay(attempt, retryAfterSec);
          console.log(`[GeminiProvider Backoff] Backing off for ${backoffDelay}ms before retry ${attempt + 2}...`);
          await new Promise((r) => setTimeout(r, backoffDelay));
        } else {
          // All retries exhausted
          if (isQuota) {
            throw new AIQuotaExhaustedError(
              `Google Gemini quota exhausted (HTTP 429) after ${maxRetries + 1} attempts. Please retry after a brief delay.`,
              retryAfterSec || 15
            );
          }
          throw new Error(`[GeminiProvider Error]: ${sanitizedMsg}`);
        }
      }
    }

    throw new Error(`[GeminiProvider Error]: ${this.sanitizeError(lastError?.message || 'Failed after retries')}`);
  }

  /**
   * Diagnostic ping and connection test
   */
  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string; usage?: TokenUsage }> {
    if (!this.client || !this.apiKey) {
      return {
        success: false,
        latencyMs: 0,
        message: 'GEMINI_API_KEY is not configured in backend environment variables.',
      };
    }

    const start = Date.now();
    try {
      const res: any = await this.client.models.generateContent({
        model: this.modelName,
        contents: 'Ping test. Reply with JSON: {"status": "healthy"}',
      });
      const latency = Date.now() - start;
      const usage: TokenUsage = {
        promptTokens: res.usageMetadata?.promptTokenCount || 5,
        completionTokens: res.usageMetadata?.candidatesTokenCount || 5,
        totalTokens: res.usageMetadata?.totalTokenCount || 10,
      };

      return {
        success: true,
        latencyMs: latency,
        message: `Successfully connected to ${this.modelName} via Google Gen AI SDK.`,
        usage,
      };
    } catch (err: any) {
      const latency = Date.now() - start;
      return {
        success: false,
        latencyMs: latency,
        message: this.sanitizeError(err.message || 'Connection failed'),
      };
    }
  }
}
