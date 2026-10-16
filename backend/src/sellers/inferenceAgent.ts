import { Request, Response } from 'express';
import { x402Engine } from '../payments/x402Protocol.js';
import { aiService } from '../ai/aiService.js';

export const INFERENCE_AGENT_CONFIG = {
  id: 'a0000000-0000-0000-0000-000000000003',
  name: 'CogniSynthesize LLM',
  priceUsdc: 0.04,
  recipient: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
};

export async function handleInferenceAgentService(req: Request, res: Response): Promise<void> {
  const paymentHeader = req.headers['authorization'] || req.headers['x-payment'] || req.body?.paymentAuth;

  // 1. Challenge with HTTP 402 if unpaid
  if (!paymentHeader) {
    const challenge = x402Engine.createChallenge(
      INFERENCE_AGENT_CONFIG.recipient,
      INFERENCE_AGENT_CONFIG.priceUsdc,
      INFERENCE_AGENT_CONFIG.name
    );

    res.set({
      'WWW-Authenticate': 'x402',
      'X-Payment-Required': JSON.stringify(challenge),
    });

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
    authPayload = typeof paymentHeader === 'string' && paymentHeader.startsWith('{')
      ? JSON.parse(paymentHeader)
      : typeof paymentHeader === 'object'
      ? paymentHeader
      : JSON.parse(Buffer.from(paymentHeader.replace('Bearer ', ''), 'base64').toString('utf8'));
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
  const context = (req.body?.context || 'No context provided').toString();
  const taskGoal = (req.body?.task_goal || 'Summarize and extract key facts').toString();

  try {
    const aiResult = await aiService.runInferenceWithAI(context, taskGoal);

    const serviceOutput = {
      summary: aiResult.data.summary,
      key_takeaways: aiResult.data.key_takeaways,
      sentiment: aiResult.data.sentiment || 'Bullish',
      confidence_score: aiResult.data.confidence_score ?? 0.95,
      risk_factors: aiResult.data.risk_factors || [],
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

    res.status(200).json(serviceOutput);
  } catch (inferenceErr: any) {
    console.error('[Inference Agent] Failed to generate AI inference:', inferenceErr);
    res.status(500).json({
      error: 'Inference Generation Error',
      message: inferenceErr.message,
    });
  }
}
