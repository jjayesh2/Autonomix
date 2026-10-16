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
