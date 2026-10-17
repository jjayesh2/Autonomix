import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';

export const transactionsRouter = Router();

// GET /api/transactions - List transactions with optional taskId filter
transactionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const taskId = req.query.taskId ? String(req.query.taskId) : undefined;
    const transactions = await db.getTransactions(taskId);
    res.json({ transactions, count: transactions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/reconcile - Reconcile on-chain transaction against Base Sepolia RPC
transactionsRouter.post('/reconcile', async (req: Request, res: Response) => {
  try {
    const { txId, txHash } = req.body;
    const target = txId || txHash;
    if (!target) {
      res.status(400).json({ error: 'Missing txId or txHash in request body' });
      return;
    }
    const result = await db.reconcileTransactionWithRpc(String(target));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/:id/reconcile - Reconcile specific transaction by ID
transactionsRouter.post('/:id/reconcile', async (req: Request, res: Response) => {
  try {
    const result = await db.reconcileTransactionWithRpc(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
