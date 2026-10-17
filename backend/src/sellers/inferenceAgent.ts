import { Request, Response } from 'express';
import { x402Engine } from '../payments/x402Protocol.js';
import { aiService } from '../ai/aiService.js';

export const INFERENCE_AGENT_CONFIG = {
  id: 'a0000000-0000-0000-0000-000000000003',
  name: 'CogniSynthesize LLM',
  priceUsdc: 0.04,
  recipient: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
};

function safeSetHeaders(res: Response, headers: Record<string, string>) {
  if (typeof res.set === 'function') {
    res.set(headers);
  } else if (typeof (res as any).setHeader === 'function') {
    for (const [k, v] of Object.entries(headers)) {
      (res as any).setHeader(k, v);
    }
  }
}

export async function handleInferenceAgentService(req: Request, res: Response): Promise<void> {
  const paymentHeader =
    req.headers['payment-signature'] ||
    req.headers['x-payment'] ||
    req.headers['authorization'] ||
    req.body?.paymentAuth;

  // 1. Challenge with HTTP 402 if unpaid
  if (!paymentHeader) {
    const challenge = x402Engine.createChallenge(
      INFERENCE_AGENT_CONFIG.recipient,
      INFERENCE_AGENT_CONFIG.priceUsdc,
      INFERENCE_AGENT_CONFIG.name,
      '/api/agents/inference'
    );

    safeSetHeaders(res, x402Engine.createPaymentRequiredHeaders(challenge));

    res.status(402).json({
      status: 402,
      error: 'Payment Required',
      message: 'This AI inference service requires a verified HTTP 402 (x402 v2) micropayment on Base Sepolia.',
      paymentRequirement: challenge,
    });
    return;
  }

  // 2. Parse payment authorization
  let authPayload: any;
  try {
    const rawVal = Array.isArray(paymentHeader) ? paymentHeader[0] : paymentHeader;
    if (typeof rawVal === 'object') {
      authPayload = rawVal;
    } else {
      const cleanStr = rawVal.replace(/^Bearer\s+/i, '').trim();
      if (cleanStr.startsWith('{')) {
        authPayload = JSON.parse(cleanStr);
      } else {
        authPayload = JSON.parse(Buffer.from(cleanStr, 'base64').toString('utf8'));
      }
    }
  } catch (err) {
    res.status(400).json({ error: 'Malformed payment authorization payload' });
    return;
  }

  // 3. Verify payment terms & cryptographic signature
  const verification = await x402Engine.verifyPayment(
    authPayload,
    INFERENCE_AGENT_CONFIG.recipient,
    INFERENCE_AGENT_CONFIG.priceUsdc
  );

  if (!verification.verified) {
    res.status(402).json({
      status: 402,
      error: 'Payment Verification Failed',
      reason: verification.error,
    });
    return;
  }

  // 4. Perform AI inference using modular AI Service (Google Gemini / Reusable provider)
  const rawContext = req.body?.context;
  const context = typeof rawContext === 'object'
    ? JSON.stringify(rawContext, null, 2)
    : (rawContext !== undefined && rawContext !== null ? String(rawContext).trim() : '');

  const taskGoal = (req.body?.task_goal || req.body?.taskGoal || req.body?.goal || 'Synthesize research context and extract key facts').toString().trim();

  if (!context) {
    res.status(400).json({
      error: 'Invalid Request',
      message: 'Inference Agent requires a non-empty "context" field containing real research or upstream agent data.',
    });
    return;
  }

  try {
    const aiResult = await aiService.runInferenceWithAI(context, taskGoal);

    const serviceOutput = {
      summary: aiResult.data.summary,
      key_takeaways: aiResult.data.key_takeaways || [],
      sentiment: aiResult.data.sentiment,
      confidence_score: aiResult.data.confidence_score,
      verified_facts: aiResult.data.verified_facts || [],
      risk_factors: aiResult.data.risk_factors || [],
      recommendations: aiResult.data.recommendations || [],
      source_citations: aiResult.data.source_citations || [],
      model_used: `${aiResult.model} (${aiResult.provider})`,
      ai_telemetry: {
        provider: aiResult.provider,
        model: aiResult.model,
        token_usage: aiResult.usage,
        cost_usd: aiResult.costUsd,
        latency_ms: aiResult.latencyMs,
      },
      synthesized_at: new Date().toISOString(),
      paymentReceipt: {
        protocol: 'x402 v2',
        txHash: verification.txHash,
        explorerUrl: verification.explorerUrl,
        amountPaidUsdc: verification.amountPaid,
        platformFeeUsdc: verification.platformFee,
        settlementMode: verification.mode,
      },
    };

    safeSetHeaders(res, x402Engine.createPaymentResponseHeader(verification));
    res.status(200).json(serviceOutput);
  } catch (inferenceErr: any) {
    console.error('[Inference Agent] Failed to generate AI inference:', inferenceErr);
    res.status(502).json({
      error: 'Inference Generation Error',
      message: inferenceErr.message,
    });
  }
}
