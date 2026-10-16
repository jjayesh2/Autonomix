import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { healthRouter } from './routes/health.js';
import { marketplaceRouter } from './routes/marketplace.js';
import { tasksRouter } from './routes/tasks.js';
import { developerRouter } from './routes/developer.js';
import { adminRouter } from './routes/admin.js';
import { transactionsRouter } from './routes/transactions.js';
import { profileRouter } from './routes/profile.js';
import { handleDataAgentService } from './sellers/dataAgent.js';
import { handleScraperAgentService } from './sellers/scraperAgent.js';
import { handleInferenceAgentService } from './sellers/inferenceAgent.js';

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Seller Agent Endpoints (HTTP 402 Pay-per-Call)
app.all('/api/agents/data', handleDataAgentService);
app.all('/api/agents/scraper', handleScraperAgentService);
app.all('/api/agents/inference', handleInferenceAgentService);

// Core API Routes
app.use('/api/health', healthRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/developer', developerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/profile', profileRouter);

// Centralized Error Handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Exception]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  });
});

// Start Server
app.listen(config.port, () => {
  console.log(`
  ======================================================
     🚀 AUTONOMIX — PAY-PER-CALL AGENT ECONOMY
  ======================================================
     • Backend API:      http://localhost:${config.port}/api
     • Health Endpoint:  http://localhost:${config.port}/api/health
     • Base Sepolia:     Chain ID ${config.web3.chainId} (eip155:84532)
     • USDC Token:       ${config.web3.usdcAddress}
     • Database Mode:    ${config.supabase.isConfigured ? 'Supabase PostgreSQL' : 'Local In-Memory Seed (Config Required)'}
     • Wallet Signing:   ${config.web3.isWalletConfigured ? 'Live Testnet Key' : 'Testnet Sandbox Mode'}
     • Audio Policy:     Web Audio Chimes (No Voice / No TTS)
  ======================================================
  `);
});

export default app;
