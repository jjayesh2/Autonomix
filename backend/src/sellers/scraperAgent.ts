import { Request, Response } from 'express';
import { x402Engine } from '../payments/x402Protocol.js';

export const SCRAPER_AGENT_CONFIG = {
  id: 'a0000000-0000-0000-0000-000000000002',
  name: 'WebExtract Sandbox Crawler',
  priceUsdc: 0.03,
  recipient: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
};

// Permitted demonstration scraping catalog (sandbox products and articles)
const SANDBOX_CATALOG = [
  { id: 'prod_1', title: 'NVIDIA RTX 5090 AI Accelerator', price: '$1,999.00', category: 'hardware', in_stock: true, rating: 4.9, url: 'https://sandbox.autonomix.network/catalog/rtx-5090' },
  { id: 'prod_2', title: 'Apple M4 Ultra Developer Station', price: '$3,499.00', category: 'hardware', in_stock: true, rating: 4.8, url: 'https://sandbox.autonomix.network/catalog/m4-station' },
  { id: 'prod_3', title: 'Base Sepolia Node Hardware Validator', price: '$850.00', category: 'infrastructure', in_stock: false, rating: 4.7, url: 'https://sandbox.autonomix.network/catalog/base-node' },
  { id: 'prod_4', title: 'Autonomous Agent Framework Pro License', price: '$299.00', category: 'software', in_stock: true, rating: 5.0, url: 'https://sandbox.autonomix.network/catalog/agent-license' },
  { id: 'prod_5', title: 'High-Frequency Vector Database Cluster', price: '$450.00/mo', category: 'cloud', in_stock: true, rating: 4.6, url: 'https://sandbox.autonomix.network/catalog/vector-cluster' },
  { id: 'prod_6', title: 'Open-Source LLM Fine-Tuning Server', price: '$1,400.00', category: 'hardware', in_stock: true, rating: 4.85, url: 'https://sandbox.autonomix.network/catalog/fine-tuning-server' },
];

export async function handleScraperAgentService(req: Request, res: Response): Promise<void> {
  const paymentHeader = req.headers['authorization'] || req.headers['x-payment'] || req.body?.paymentAuth;

  // 1. Challenge with HTTP 402 if unpaid
  if (!paymentHeader) {
    const challenge = x402Engine.createChallenge(
      SCRAPER_AGENT_CONFIG.recipient,
      SCRAPER_AGENT_CONFIG.priceUsdc,
      SCRAPER_AGENT_CONFIG.name
    );

    res.set({
      'WWW-Authenticate': 'x402',
      'X-Payment-Required': JSON.stringify(challenge),
    });

    res.status(402).json({
      status: 402,
      error: 'Payment Required',
      message: 'This scraping service requires a verified HTTP 402 (x402 v2) micropayment on Base Sepolia.',
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
    SCRAPER_AGENT_CONFIG.recipient,
    SCRAPER_AGENT_CONFIG.priceUsdc
  );

  if (!verification.verified) {
    res.status(402).json({
      status: 402,
      error: 'Payment Verification Failed',
      reason: verification.error,
    });
    return;
  }

  // 4. Perform sandboxed extraction
  const target = (req.body?.target || req.query?.target || 'hardware').toString().toLowerCase();
  const matchedItems = SANDBOX_CATALOG.filter(
    (item) => item.title.toLowerCase().includes(target) || item.category.toLowerCase().includes(target)
  );

  const finalItems = matchedItems.length > 0 ? matchedItems : SANDBOX_CATALOG.slice(0, 3);

  const serviceOutput = {
    url: `https://sandbox.autonomix.network/search?q=${encodeURIComponent(target)}`,
    items_found: finalItems.length,
    items: finalItems,
    scraped_at: new Date().toISOString(),
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
}
