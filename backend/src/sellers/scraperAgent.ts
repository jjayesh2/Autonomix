import { Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dns from 'node:dns/promises';
import { x402Engine } from '../payments/x402Protocol.js';
import { parseProductSearchIntent } from '../utils/productSearchParser.js';

export const SCRAPER_AGENT_CONFIG = {
  id: 'a0000000-0000-0000-0000-000000000002',
  name: 'WebExtract Sandbox Crawler',
  priceUsdc: 0.03,
  recipient: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
};

/**
 * Checks if an IP address belongs to private/loopback/cloud-metadata ranges.
 */
export function isPrivateOrBlockedIp(ip: string): boolean {
  if (!ip) return true;
  const trimmed = ip.trim().toLowerCase();
  if (trimmed === '127.0.0.1' || trimmed === '0.0.0.0' || trimmed === '::1' || trimmed === 'localhost') return true;
  if (trimmed === '169.254.169.254' || trimmed === '169.254.169.123') return true;

  // IPv4 CIDR checks:
  const match = trimmed.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (match) {
    const o1 = parseInt(match[1], 10);
    const o2 = parseInt(match[2], 10);
    if (o1 === 10) return true; // 10.0.0.0/8
    if (o1 === 127) return true; // 127.0.0.0/8
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16
    if (o1 === 169 && o2 === 254) return true; // 169.254.0.0/16
    if (o1 === 0) return true;
  }

  // IPv6 private/link-local:
  if (trimmed.startsWith('fe80:') || trimmed.startsWith('fc00:') || trimmed.startsWith('fd00:')) {
    return true;
  }

  return false;
}

/**
 * Strict SSRF Validation: Blocks private IP ranges, link-local addresses,
 * AWS/GCP cloud metadata endpoints, loopbacks, and non-http(s) schemes.
 */
export function isSsrfSafeUrl(rawUrl: string): { isSafe: boolean; reason?: string } {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isSafe: false, reason: 'Protocol must be http: or https:' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Loopback & local
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return { isSafe: false, reason: 'Access to localhost, loopback, or internal domains is prohibited.' };
    }

    // Cloud metadata endpoints
    if (
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal' ||
      hostname === 'metadata.google' ||
      hostname === '169.254.169.123'
    ) {
      return { isSafe: false, reason: 'Access to cloud metadata services is strictly blocked.' };
    }

    // Check if hostname is directly an IP
    if (isPrivateOrBlockedIp(hostname)) {
      return { isSafe: false, reason: 'Direct access to private or loopback IP addresses is prohibited.' };
    }

    return { isSafe: true };
  } catch (err: any) {
    return { isSafe: false, reason: `Malformed URL: ${err.message}` };
  }
}

function safeSetHeaders(res: Response, headers: Record<string, string>) {
  if (typeof res.set === 'function') {
    res.set(headers);
  } else if (typeof (res as any).setHeader === 'function') {
    for (const [k, v] of Object.entries(headers)) {
      (res as any).setHeader(k, v);
    }
  }
}

export async function handleScraperAgentService(req: Request, res: Response): Promise<void> {
  const paymentHeader =
    req.headers['payment-signature'] ||
    req.headers['x-payment'] ||
    req.headers['authorization'] ||
    req.body?.paymentAuth;

  // 1. Challenge with HTTP 402 if unpaid
  if (!paymentHeader) {
    const challenge = x402Engine.createChallenge(
      SCRAPER_AGENT_CONFIG.recipient,
      SCRAPER_AGENT_CONFIG.priceUsdc,
      SCRAPER_AGENT_CONFIG.name,
      '/api/agents/scraper'
    );

    safeSetHeaders(res, x402Engine.createPaymentRequiredHeaders(challenge));

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

  // 4. Perform live HTTP retrieval & Cheerio extraction
  const rawTarget = req.body?.target || req.query?.target;
  const isTargetUrl = typeof rawTarget === 'string' && /^(https?|file|ftp):/i.test(rawTarget.trim());
  const explicitUrl = req.body?.url || req.query?.url || (isTargetUrl ? rawTarget.trim() : undefined);
  const target = (rawTarget || (explicitUrl ? '' : 'laptop')).toString().trim();
  const timestamp = new Date().toISOString();

  try {
    let targetUrl: string;
    let extractedItems: any[] = [];

    if (explicitUrl) {
      // Step A: Static syntax & pattern SSRF check
      const ssrfCheck = isSsrfSafeUrl(explicitUrl);
      if (!ssrfCheck.isSafe) {
        res.status(400).json({
          error: 'SSRF Protection Violation',
          message: ssrfCheck.reason,
          url: explicitUrl,
        });
        return;
      }

      const parsed = new URL(explicitUrl);

      // Step B: Live DNS Resolution & DNS Rebinding Protection
      try {
        const lookupResults = await dns.lookup(parsed.hostname, { all: true });
        for (const record of lookupResults) {
          if (isPrivateOrBlockedIp(record.address)) {
            res.status(400).json({
              error: 'SSRF Protection Violation',
              message: `Resolved IP address ${record.address} for host ${parsed.hostname} is a restricted private/loopback address.`,
              url: explicitUrl,
            });
            return;
          }
        }
      } catch (dnsErr: any) {
        // Clear upstream DNS resolution error — strictly DO NOT fabricate data or charge
        console.error(`[Scraper Agent] Hostname resolution failed for ${parsed.hostname}:`, dnsErr.code || dnsErr.message);
        res.status(502).json({
          error: 'Hostname Resolution Failed',
          message: `Cannot resolve host '${parsed.hostname}' (${dnsErr.code || 'ENOTFOUND'}). The target domain does not exist or DNS lookup failed.`,
          hostname: parsed.hostname,
          url: explicitUrl,
          status: 'dns_failure',
        });
        return;
      }

      targetUrl = explicitUrl;
      const pageRes = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Autonomix-Agent-Scraper/1.0 (+https://autonomix.network)',
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        },
        timeout: 10000,
        maxContentLength: 5 * 1024 * 1024, // 5 MB response size limit
        maxRedirects: 3,
      });

      const contentType = String(pageRes.headers['content-type'] || '');

      if (contentType.includes('application/json')) {
        const d = pageRes.data;
        extractedItems.push({
          id: d.id ? `json_${d.id}` : 'json_record_1',
          title: d.title || d.name || 'Structured JSON Record',
          price: d.price ? `$${d.price}` : null,
          category: d.category || 'structured_data',
          in_stock: d.stock !== undefined ? d.stock > 0 : true,
          rating: typeof d.rating === 'number' ? d.rating : null,
          url: targetUrl,
          description: d.description || '',
          source: targetUrl,
        });
      } else {
        const $ = cheerio.load(pageRes.data);

        // Remove non-content tags to prevent noise
        $('script, style, noscript, nav, footer, svg').remove();

        const title =
          $('meta[property="og:title"]').attr('content') ||
          $('title').text().trim() ||
          $('h1').first().text().trim() ||
          'Extracted Web Document';

        const description =
          $('meta[property="og:description"]').attr('content') ||
          $('meta[name="description"]').attr('content') ||
          $('p').first().text().trim() ||
          '';

        const headings = $('h1, h2, h3')
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(Boolean)
          .slice(0, 8);

        // Look for genuine price indicators
        let detectedPrice: string | null = null;
        const priceCandidate = $('[data-price], .price, .product-price, .amount')
          .first()
          .text()
          .trim();
        if (priceCandidate && /\$|USD|EUR|£|\d+\.\d{2}/.test(priceCandidate)) {
          detectedPrice = priceCandidate;
        }

        const links = $('a[href]')
          .map((_, el) => $(el).attr('href'))
          .get()
          .filter((href) => href && href.startsWith('http'))
          .slice(0, 5);

        extractedItems.push({
          id: `item_0_${Date.now()}`,
          title,
          description: description.slice(0, 400),
          headings,
          price: detectedPrice,
          links,
          url: targetUrl,
          source: targetUrl,
        });
      }
    } else {
      // Query permitted live open product repository and parse actual item details
      const intent = parseProductSearchIntent(target, req.body);
      let rawProducts: any[] = [];
      targetUrl = `https://dummyjson.com/products/search?q=${encodeURIComponent(intent.cleanKeyword)}`;

      if (intent.targetCategories && intent.targetCategories.length > 0) {
        for (const cat of intent.targetCategories.slice(0, 2)) {
          const catUrl = `https://dummyjson.com/products/category/${encodeURIComponent(cat)}`;
          try {
            const catRes = await axios.get(catUrl, {
              headers: { 'User-Agent': 'Autonomix-Agent-Scraper/1.0 (+https://autonomix.network)' },
              timeout: 10000,
              maxContentLength: 5 * 1024 * 1024,
            });
            if (Array.isArray(catRes.data?.products)) {
              rawProducts.push(...catRes.data.products);
              targetUrl = catUrl;
            }
          } catch {}
        }
      }

      if (rawProducts.length < 5 && intent.cleanKeyword) {
        try {
          const searchRes = await axios.get(`https://dummyjson.com/products/search?q=${encodeURIComponent(intent.cleanKeyword)}`, {
            headers: { 'User-Agent': 'Autonomix-Agent-Scraper/1.0 (+https://autonomix.network)' },
            timeout: 10000,
            maxContentLength: 5 * 1024 * 1024,
          });
          if (Array.isArray(searchRes.data?.products)) {
            rawProducts.push(...searchRes.data.products);
          }
        } catch {}
      }

      // Deduplicate by ID
      const seenIds = new Set<number>();
      const dedupedProducts: any[] = [];
      for (const p of rawProducts) {
        if (p && p.id && !seenIds.has(p.id)) {
          seenIds.add(p.id);
          dedupedProducts.push(p);
        }
      }

      // Filter by relevance & price
      const filtered = dedupedProducts.filter((p) => {
        if (intent.maxPrice !== undefined && p.price > intent.maxPrice) return false;
        if (intent.targetCategories.length > 0 && intent.targetCategories.includes(p.category)) return true;
        const titleLower = String(p.title || '').toLowerCase();
        const root = intent.cleanKeyword.toLowerCase().replace(/s$/, '');
        return titleLower.includes(root);
      });

      if (filtered.length === 0) {
        // Honest empty result reporting — zero fake items injected
        const emptyOutput = {
          url: targetUrl,
          items_found: 0,
          items: [],
          scraped_at: timestamp,
          parser: 'Cheerio HTML & HTTP Live Extractor',
          extraction_status: 'empty',
          message: `No live catalog items found matching "${target}" (intent: ${intent.cleanKeyword}${intent.maxPrice ? `, price <= ${intent.maxPrice}` : ''}).`,
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

      for (const p of filtered.slice(0, 5)) {
        extractedItems.push({
          id: `prod_${p.id}`,
          title: p.title,
          price: `$${p.price.toFixed(2)}`,
          category: p.category,
          in_stock: p.stock > 0,
          rating: p.rating,
          url: `https://dummyjson.com/products/${p.id}`,
          description: p.description,
          brand: p.brand || 'Unbranded',
        });
      }
    }

    const serviceOutput = {
      url: targetUrl,
      items_found: extractedItems.length,
      items: extractedItems,
      scraped_at: timestamp,
      parser: 'Cheerio HTML & HTTP Live Extractor',
      extraction_status: extractedItems.length > 0 ? 'success' : 'empty',
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
  } catch (scrapingErr: any) {
    console.error(`[Scraper Agent] Failed extraction:`, scrapingErr.message);
    res.status(502).json({
      error: 'Web Scraping Extraction Failed',
      message: `Failed live web retrieval: ${scrapingErr.message}`,
      targetUrl: explicitUrl || `https://dummyjson.com/products/search?q=${encodeURIComponent(target)}`,
      items_found: 0,
      items: [],
      scraped_at: timestamp,
    });
  }
}
