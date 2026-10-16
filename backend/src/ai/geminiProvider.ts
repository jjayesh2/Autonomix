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
      throw new Error(`Rate limit exceeded (${this.maxRpm} RPM). Please slow down agent requests.`);
    }
    this.requestTimestamps.push(now);
  }

  /**
   * Generates structured JSON output strictly validated against a JSON Schema.
   */
  async generateStructured<T>(options: StructuredOutputOptions): Promise<AICompletionResult<T>> {
    if (!this.client || !this.apiKey) {
      this.errorCount++;
      throw new MissingAIKeyError('Google Gemini');
    }

    this.checkRateLimit();
    this.totalRequests++;

    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || 10000;

    const systemPrompt = options.systemInstruction
      ? `${options.systemInstruction}\n\nIMPORTANT: You must return valid JSON only. Do not wrap in markdown quotes if possible, or use standard markdown json blocks.`
      : 'You are a precise autonomous AI agent. Respond with valid JSON only.';

    const fullPrompt = `${systemPrompt}\n\nTask:\n${options.prompt}`;

    try {
      // Execute request with strict timeout guard
      const generatePromise = this.client.models.generateContent({
        model: this.modelName,
        contents: fullPrompt,
        config: {
          temperature: options.temperature ?? 0.2,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini API request timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      const latencyMs = Date.now() - startTime;
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
      this.errorCount++;
      // Sanitize any accidental API keys from error messages
      const safeMessage = err.message
        ? err.message.replace(new RegExp(this.apiKey, 'g'), '[REDACTED_API_KEY]')
        : 'Unknown AI generation error';
      throw new Error(`[GeminiProvider Error]: ${safeMessage}`);
    }
  }

  /**
   * Health check / Diagnostic ping
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
      const safeMessage = err.message
        ? err.message.replace(new RegExp(this.apiKey, 'g'), '[REDACTED_KEY]')
        : 'Connection failed';
      return {
        success: false,
        latencyMs: latency,
        message: safeMessage,
      };
    }
  }
}
