import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';

export const profileRouter = Router();

// GET /api/profile/:id - Get user profile
profileRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const profile = await db.getProfile(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profile - Upsert user profile (role, sound setting, wallet)
profileRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { id, email, display_name, role, wallet_address, sound_enabled } = req.body;
    if (!id || !email) {
      res.status(400).json({ error: 'User id and email are required' });
      return;
    }

    const updated = await db.upsertProfile({
      id,
      email,
      display_name,
      role,
      wallet_address,
      sound_enabled,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
