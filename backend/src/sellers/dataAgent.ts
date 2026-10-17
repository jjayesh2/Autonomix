import { Request, Response } from 'express';
import axios from 'axios';
import { x402Engine } from '../payments/x402Protocol.js';

export const DATA_AGENT_CONFIG = {
  id: 'a0000000-0000-0000-0000-000000000001',
  name: 'AlphaData Market Oracle',
  priceUsdc: 0.02,
  recipient: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
};

// Known cryptocurrency tickers to route to real Binance market oracle
const CRYPTO_TICKERS = new Set(['ETH', 'BTC', 'SOL', 'BNB', 'AVAX', 'MATIC', 'DOGE', 'USDC']);

function safeSetHeaders(res: Response, headers: Record<string, string>) {
  if (typeof res.set === 'function') {
    res.set(headers);
  } else if (typeof (res as any).setHeader === 'function') {
    for (const [k, v] of Object.entries(headers)) {
      (res as any).setHeader(k, v);
    }
  }
}

export async function handleDataAgentService(req: Request, res: Response): Promise<void> {
  const paymentHeader =
    req.headers['payment-signature'] ||
    req.headers['x-payment'] ||
    req.headers['authorization'] ||
    req.body?.paymentAuth;

  // 1. If unpaid, challenge with HTTP 402
  if (!paymentHeader) {
    const challenge = x402Engine.createChallenge(
      DATA_AGENT_CONFIG.recipient,
      DATA_AGENT_CONFIG.priceUsdc,
      DATA_AGENT_CONFIG.name,
      '/api/agents/data'
    );

    safeSetHeaders(res, x402Engine.createPaymentRequiredHeaders(challenge));

    res.status(402).json({
      status: 402,
      error: 'Payment Required',
      message: 'This service requires a valid HTTP 402 (x402 v2) micropayment on Base Sepolia.',
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
    DATA_AGENT_CONFIG.recipient,
    DATA_AGENT_CONFIG.priceUsdc
  );

  if (!verification.verified) {
    res.status(402).json({
      status: 402,
      error: 'Payment Verification Failed',
      reason: verification.error,
    });
    return;
  }

  // 4. Fulfill paid data service using live APIs
  const rawQuery = (req.body?.query || req.query?.query || 'laptop').toString().trim();
  const upperQuery = rawQuery.toUpperCase();
  const timestamp = new Date().toISOString();

  // Route A: Financial / Crypto Market Oracle via Binance Public API
  if (CRYPTO_TICKERS.has(upperQuery)) {
    const symbol = upperQuery === 'USDC' ? 'USDCUSDT' : `${upperQuery}USDT`;
    const sourceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
    try {
      const response = await axios.get(sourceUrl, {
        timeout: 7000,
        headers: { 'User-Agent': 'Autonomix-Market-Oracle/1.0' },
      });

      const ticker = response.data;
      const price = parseFloat(ticker.lastPrice);
      const change24h = parseFloat(ticker.priceChangePercent) || 0.0;
      const volume24h = parseFloat(ticker.quoteVolume) || 0.0;

      if (isNaN(price)) {
        throw new Error(`Binance returned invalid price data for ${upperQuery}`);
      }

      const serviceOutput = {
        asset: upperQuery,
        price_usd: price,
        change_24h_pct: change24h,
        volume_24h_usd: volume24h,
        high_24h_usd: parseFloat(ticker.highPrice) || price,
        low_24h_usd: parseFloat(ticker.lowPrice) || price,
        timestamp,
        source: 'Binance Global Market Feed',
        sourceUrl,
        retrievalTimestamp: timestamp,
        paymentReceipt: {
          protocol: 'x402 v2',
          txHash: verification.txHash,
          voucherDigest: verification.voucherDigest,
          explorerUrl: verification.explorerUrl,
          amountPaidUsdc: verification.amountPaid,
          platformFeeUsdc: verification.platformFee,
          settlementType: verification.settlementType,
          settlementMode: verification.mode,
        },
      };

      safeSetHeaders(res, x402Engine.createPaymentResponseHeader(verification));
      res.status(200).json(serviceOutput);
      return;
    } catch (binanceErr: any) {
      console.error(`[DataAgent] Live Binance fetch failed for ${upperQuery}:`, binanceErr.message);
      // Explicit error reporting — zero hardcoded fake prices in live mode
      res.status(502).json({
        error: 'Crypto Market Oracle Retrieval Failed',
        message: `Failed to query live market data for ${upperQuery} from Binance: ${binanceErr.message}`,
        source: 'Binance Global Market Feed',
        sourceUrl,
        retrievalTimestamp: timestamp,
        asset: upperQuery,
      });
      return;
    }
  }

  // Route B: Real Product Research via DummyJSON Public Product API
  const searchUrl = `https://dummyjson.com/products/search?q=${encodeURIComponent(rawQuery)}`;
  try {
    const response = await axios.get(searchUrl, {
      timeout: 7000,
      headers: { 'User-Agent': 'Autonomix-Product-Oracle/1.0' },
    });
    const productData = response.data;

    const items = (productData.products || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: 'USD',
      brand: p.brand || 'Unbranded',
      category: p.category,
      rating: p.rating,
      stock: p.stock,
      in_stock: p.stock > 0,
      description: p.description,
      sourceUrl: `https://dummyjson.com/products/${p.id}`,
      retrievalTimestamp: timestamp,
    }));

    if (items.length === 0) {
      // Genuine empty result handling — never fabricate random products or a fake price
      const emptyOutput = {
        asset: rawQuery,
        price_usd: 0,
        change_24h_pct: 0,
        volume_24h_usd: 0,
        timestamp,
        source: 'DummyJSON Open Product API',
        sourceUrl: searchUrl,
        retrievalTimestamp: timestamp,
        total_found: 0,
        products: [],
        status: 'no_records_found',
        message: `No live product records found matching query "${rawQuery}" in the catalog.`,
        paymentReceipt: {
          protocol: 'x402 v2',
          txHash: verification.txHash,
          voucherDigest: verification.voucherDigest,
          explorerUrl: verification.explorerUrl,
          amountPaidUsdc: verification.amountPaid,
          platformFeeUsdc: verification.platformFee,
          settlementType: verification.settlementType,
          settlementMode: verification.mode,
        },
      };

      safeSetHeaders(res, x402Engine.createPaymentResponseHeader(verification));
      res.status(200).json(emptyOutput);
      return;
    }

    const primaryProduct = items[0];

    const serviceOutput = {
      asset: rawQuery,
      price_usd: primaryProduct.price,
      change_24h_pct: 0,
      volume_24h_usd: items.length,
      timestamp,
      source: 'DummyJSON Open Product API',
      sourceUrl: searchUrl,
      retrievalTimestamp: timestamp,
      total_found: productData.total ?? items.length,
      products: items,
      paymentReceipt: {
        protocol: 'x402 v2',
        txHash: verification.txHash,
        voucherDigest: verification.voucherDigest,
        explorerUrl: verification.explorerUrl,
        amountPaidUsdc: verification.amountPaid,
        platformFeeUsdc: verification.platformFee,
        settlementType: verification.settlementType,
        settlementMode: verification.mode,
      },
    };

    safeSetHeaders(res, x402Engine.createPaymentResponseHeader(verification));
    res.status(200).json(serviceOutput);
  } catch (productErr: any) {
    console.error(`[DataAgent] Product query failed for ${rawQuery}:`, productErr.message);
    res.status(502).json({
      error: 'Product Data Retrieval Failed',
      message: `Failed to query live product data source: ${productErr.message}`,
      source: 'DummyJSON Open Product API',
      sourceUrl: searchUrl,
      retrievalTimestamp: timestamp,
    });
  }
}
