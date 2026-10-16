import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';
import { db } from '../db/supabase.js';

export const healthRouter = Router();

// GET /api/health - Diagnostic status for hackathon judges and dashboard
healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    const agents = await db.getApprovedAgents();
    const submissions = await db.getSubmissions();

    res.json({
      status: 'healthy',
      system: 'Autonomix Pay-per-Call Agent Economy',
      timestamp: new Date().toISOString(),
      database: {
        provider: 'Supabase PostgreSQL',
        configured: config.supabase.isConfigured,
        mode: config.supabase.isConfigured ? 'Supabase Persistent PostgreSQL' : 'Local In-Memory Seed (Config Required for Remote Supabase)',
      },
      web3: {
        network: 'Base Sepolia Testnet',
        networkId: config.web3.networkId,
        chainId: config.web3.chainId,
        rpcUrl: config.web3.rpcUrl,
        usdcContract: config.web3.usdcAddress,
        decimals: config.web3.usdcDecimals,
        explorerBaseUrl: config.web3.explorerBaseUrl,
        signingMode: config.web3.isWalletConfigured ? 'Live Base Sepolia Testnet Wallet' : 'Base Sepolia Testnet Sandbox Mode',
        platformCommissionEnabled: config.web3.commissionEnabled,
        platformFeePercent: config.web3.platformFeePercent,
        platformTreasury: config.web3.platformTreasury,
      },
      aiProvider: {
        provider: config.ai.provider,
        hasGeminiKey: Boolean(config.ai.geminiApiKey),
        hasOpenAiKey: Boolean(config.ai.openaiApiKey),
      },
      marketplace: {
        activeAgentsCount: agents.length,
        pendingSubmissionsCount: submissions.filter((s) => s.status === 'pending').length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});
