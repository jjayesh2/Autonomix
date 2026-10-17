import { Request, Response } from 'express';
import axios from 'axios';
import { x402Engine } from '../payments/x402Protocol.js';
import { parseProductSearchIntent } from '../utils/productSearchParser.js';

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

  // 4. Parse user intent into structured keyword, categories, price ceiling, and currency
  const rawInput = (req.body?.query || req.query?.query || 'laptop').toString().trim();
  const intent = parseProductSearchIntent(rawInput, req.body);
  const timestamp = new Date().toISOString();

  // Route A: Financial / Crypto Market Oracle via Binance Public API
  if (intent.isCrypto) {
    const upperQuery = intent.cleanKeyword;
    const symbol = upperQuery === 'USDC' ? 'USDCUSDT' : `${upperQuery}USDT`;
    const sourceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
    try {
      const response = await axios.get(sourceUrl, {
        timeout: 12000,
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
  try {
    const rawProducts: any[] = [];
    const sourceUrls: string[] = [];

    // Query 1: If mapped to specific category/categories (e.g. shoes -> mens-shoes, womens-shoes)
    if (intent.targetCategories && intent.targetCategories.length > 0) {
      for (const cat of intent.targetCategories.slice(0, 2)) {
        const catUrl = `https://dummyjson.com/products/category/${encodeURIComponent(cat)}`;
        sourceUrls.push(catUrl);
        try {
          const catRes = await axios.get(catUrl, {
            timeout: 12000,
            headers: { 'User-Agent': 'Autonomix-Product-Oracle/1.0' },
          });
          if (Array.isArray(catRes.data?.products)) {
            rawProducts.push(...catRes.data.products);
          }
        } catch (err: any) {
          console.warn(`[DataAgent] Category fetch failed for ${cat}:`, err.message);
        }
      }
    }

    // Query 2: If keyword search or if category fetch yielded few results
    if (rawProducts.length < 5 && intent.cleanKeyword) {
      const searchUrl = `https://dummyjson.com/products/search?q=${encodeURIComponent(intent.cleanKeyword)}`;
      sourceUrls.push(searchUrl);
      try {
        const searchRes = await axios.get(searchUrl, {
          timeout: 12000,
          headers: { 'User-Agent': 'Autonomix-Product-Oracle/1.0' },
        });
        if (Array.isArray(searchRes.data?.products)) {
          rawProducts.push(...searchRes.data.products);
        }
      } catch (err: any) {
        console.warn(`[DataAgent] Keyword search failed for ${intent.cleanKeyword}:`, err.message);
      }
    }

    // Deduplicate products by id
    const uniqueProductsMap = new Map<number, any>();
    for (const p of rawProducts) {
      if (p && p.id && !uniqueProductsMap.has(p.id)) {
        uniqueProductsMap.set(p.id, p);
      }
    }
    const deduplicated = Array.from(uniqueProductsMap.values());

    // Application-Level Filtering:
    // 1. Relevance filter: ensure items match category or clean keyword
    const filteredByRelevance = deduplicated.filter((p) => {
      if (intent.targetCategories.length > 0 && intent.targetCategories.includes(p.category)) {
        return true;
      }
      const titleLower = String(p.title || '').toLowerCase();
      const descLower = String(p.description || '').toLowerCase();
      const keywordLower = intent.cleanKeyword.toLowerCase();
      const rootKeyword = keywordLower.replace(/s$/, '');
      return (
        titleLower.includes(keywordLower) ||
        titleLower.includes(rootKeyword) ||
        descLower.includes(keywordLower) ||
        (Array.isArray(p.tags) && p.tags.some((t: string) => String(t).toLowerCase().includes(rootKeyword)))
      );
    });

    // 2. Numeric price ceiling and floor filter
    const filteredByPrice = filteredByRelevance.filter((p) => {
      const price = typeof p.price === 'number' ? p.price : parseFloat(p.price);
      if (isNaN(price)) return false;
      if (intent.maxPrice !== undefined && price > intent.maxPrice) {
        return false;
      }
      if (intent.minPrice !== undefined && price < intent.minPrice) {
        return false;
      }
      return true;
    });

    const items = filteredByPrice.map((p: any) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: 'USD', // Established by DummyJSON source
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
      // Genuine empty result handling — zero fabricated products or prices
      let emptyMsg = `No live product records found matching query "${intent.cleanKeyword}" in DummyJSON catalog.`;
      if (intent.maxPrice !== undefined) {
        emptyMsg += ` (Price ceiling: <= ${intent.maxPrice} USD; total available before price filter: ${filteredByRelevance.length}).`;
      }
      if (intent.currency && intent.currency !== 'USD') {
        emptyMsg += ` Note: DummyJSON catalog prices are denominated natively in USD, not ${intent.currency}.`;
      }

      const emptyOutput = {
        asset: intent.cleanKeyword,
        price_usd: 0,
        change_24h_pct: 0,
        volume_24h_usd: 0,
        timestamp,
        source: 'DummyJSON Open Product API',
        sourceUrl: sourceUrls[0] || 'https://dummyjson.com/products',
        sourceCurrency: 'USD',
        retrievalTimestamp: timestamp,
        total_found: 0,
        products: [],
        status: 'no_records_found',
        message: emptyMsg,
        searchIntent: intent,
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
      asset: intent.cleanKeyword,
      price_usd: primaryProduct.price,
      change_24h_pct: 0,
      volume_24h_usd: items.length,
      timestamp,
      source: 'DummyJSON Open Product API',
      sourceUrl: sourceUrls[0] || `https://dummyjson.com/products/search?q=${encodeURIComponent(intent.cleanKeyword)}`,
      sourceCurrency: 'USD',
      retrievalTimestamp: timestamp,
      total_found: items.length,
      products: items,
      searchIntent: intent,
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
    console.error(`[DataAgent] Product query failed for ${intent.cleanKeyword}:`, productErr.message);
    res.status(502).json({
      error: 'Product Data Retrieval Failed',
      message: `Failed to query live product data source: ${productErr.message}`,
      source: 'DummyJSON Open Product API',
      sourceUrl: `https://dummyjson.com/products/search?q=${encodeURIComponent(intent.cleanKeyword)}`,
      sourceCurrency: 'USD',
      retrievalTimestamp: timestamp,
    });
  }
}

