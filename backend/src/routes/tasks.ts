import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { buyerAgent } from '../orchestrator/buyerAgent.js';
import { budgetGuard } from '../payments/budgetGuard.js';
import { v4 as uuidv4 } from 'uuid';

export const tasksRouter = Router();

// POST /api/tasks/plan - Pre-flight plan & cost estimation without executing
tasksRouter.post('/plan', async (req: Request, res: Response) => {
  try {
    const { description, budgetLimit } = req.body;
    if (!description || typeof description !== 'string') {
      res.status(400).json({ error: 'Description is required' });
      return;
    }
    const budget = parseFloat(budgetLimit) || 0.10;
    if (budget <= 0) {
      res.status(400).json({ error: 'Budget limit must be greater than 0' });
      return;
    }

    const plan = await buyerAgent.planTask(description, budget);
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks - Create a new task with budget limit
tasksRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { description, budgetLimit, title, userId } = req.body;
    if (!description || typeof description !== 'string') {
      res.status(400).json({ error: 'Description is required' });
      return;
    }
    const budget = parseFloat(budgetLimit) || 0.10;
    if (budget <= 0) {
      res.status(400).json({ error: 'Budget limit must be greater than 0' });
      return;
    }

    const plan = await buyerAgent.planTask(description, budget);
    if (!plan.canExecute) {
      res.status(400).json({
        error: 'Budget Insufficient',
        message: plan.explanation,
        plan,
      });
      return;
    }

    const task = await db.createTask({
      id: uuidv4(),
      user_id: userId || 'c0000000-0000-0000-0000-000000000001',
      title: title || description.slice(0, 48),
      description,
      budget_limit: budget,
      total_cost: 0,
      status: 'pending',
      orchestration_plan: plan,
      rationale: plan.explanation,
      created_at: new Date().toISOString(),
    });

    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks - List all tasks for current user
tasksRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const tasks = await db.getTasks(userId);
    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id - Get task detail, steps, transactions, and result
tasksRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const steps = await db.getTaskSteps(task.id);
    const result = await db.getTaskResult(task.id);
    const transactions = await db.getTransactions(task.id);
    const remainingBudget = await budgetGuard.getRemainingBudget(task.id);

    res.json({
      task,
      steps,
      result,
      transactions,
      remainingBudget,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/execute - Trigger execution of task
tasksRouter.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.status === 'in_progress') {
      res.status(409).json({ error: 'Task is already executing' });
      return;
    }

    // Execute task in background or synchronously
    buyerAgent.executeTask(task.id).catch((err) => {
      console.error(`[Execution Error for task ${task.id}]:`, err);
    });

    res.json({ message: 'Task execution started', taskId: task.id, status: 'in_progress' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
