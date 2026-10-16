import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';

export const marketplaceRouter = Router();

// GET /api/marketplace/agents - List approved agents with search, filter, and sort
marketplaceRouter.get('/agents', async (req: Request, res: Response) => {
  try {
    const { category, search, sort, minRating } = req.query;
    let agents = await db.getApprovedAgents(category ? String(category) : undefined);

    if (search) {
      const q = String(search).toLowerCase();
      agents = agents.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.capabilities.some((c) => c.toLowerCase().includes(q))
      );
    }

    if (minRating) {
      const min = parseFloat(String(minRating));
      agents = agents.filter((a) => (a.metrics?.rating_average || 5.0) >= min);
    }

    if (sort) {
      switch (String(sort)) {
        case 'price_asc':
          agents.sort((a, b) => a.price_usdc - b.price_usdc);
          break;
        case 'price_desc':
          agents.sort((a, b) => b.price_usdc - a.price_usdc);
          break;
        case 'rating':
          agents.sort((a, b) => (b.metrics?.rating_average || 0) - (a.metrics?.rating_average || 0));
          break;
        case 'latency':
          agents.sort((a, b) => (a.metrics?.median_latency_ms || 9999) - (b.metrics?.median_latency_ms || 9999));
          break;
        case 'calls':
          agents.sort((a, b) => (b.metrics?.total_calls || 0) - (a.metrics?.total_calls || 0));
          break;
      }
    }

    res.json({ agents, count: agents.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/marketplace/agents/:id - Detailed agent information
marketplaceRouter.get('/agents/:id', async (req: Request, res: Response) => {
  try {
    const agent = await db.getAgentById(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(agent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
