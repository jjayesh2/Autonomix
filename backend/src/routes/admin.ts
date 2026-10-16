import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { aiService } from '../ai/aiService.js';

export const adminRouter = Router();

// GET /api/admin/submissions - List all submissions for admin review
adminRouter.get('/submissions', async (req: Request, res: Response) => {
  try {
    const submissions = await db.getSubmissions();
    res.json({ submissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/submissions/:id/review - Review submission (approve, reject, suspend)
adminRouter.post('/submissions/:id/review', async (req: Request, res: Response) => {
  try {
    const { action, rejectionReason, adminId } = req.body;
    const submissionId = req.params.id;

    if (!['approve', 'reject', 'suspend'].includes(action)) {
      res.status(400).json({ error: 'Action must be approve, reject, or suspend' });
      return;
    }

    if (action === 'reject' && (!rejectionReason || !rejectionReason.trim())) {
      res.status(400).json({ error: 'Rejection reason is required when rejecting a submission' });
      return;
    }

    const submissions = await db.getSubmissions();
    const sub = submissions.find((s) => s.id === submissionId);
    if (!sub) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    const reviewedAt = new Date().toISOString();
    let newStatus: 'approved' | 'rejected' | 'suspended' = 'pending' as any;

    if (action === 'approve') {
      newStatus = 'approved';
      // Create or activate approved agent in marketplace
      const agentId = sub.agent_id || uuidv4();
      await db.createAgent({
        id: agentId,
        developer_id: sub.developer_id,
        name: sub.name,
        description: sub.description,
        category: sub.category,
        endpoint_url: sub.endpoint_url,
        price_usdc: sub.price_usdc,
        recipient_address: sub.recipient_address,
        capabilities: sub.capabilities,
        input_schema: sub.input_schema,
        output_schema: sub.output_schema,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await db.updateSubmission(submissionId, {
        status: 'approved',
        agent_id: agentId,
        reviewed_by: adminId || 'a0000000-0000-0000-0000-000000000000',
        reviewed_at: reviewedAt,
      });
    } else if (action === 'reject') {
      newStatus = 'rejected';
      await db.updateSubmission(submissionId, {
        status: 'rejected',
        rejection_reason: rejectionReason,
        reviewed_by: adminId || 'a0000000-0000-0000-0000-000000000000',
        reviewed_at: reviewedAt,
      });
    } else if (action === 'suspend') {
      newStatus = 'suspended';
      if (sub.agent_id) {
        await db.updateAgent(sub.agent_id, { is_active: false });
      }
      await db.updateSubmission(submissionId, {
        status: 'suspended',
        reviewed_by: adminId || 'a0000000-0000-0000-0000-000000000000',
        reviewed_at: reviewedAt,
      });
    }

    await db.logAudit({
      actor_id: adminId || 'a0000000-0000-0000-0000-000000000000',
      action: `ADMIN_${action.toUpperCase()}_AGENT`,
      target_type: 'agent_submission',
      target_id: submissionId,
      details: { action, rejectionReason, agentName: sub.name },
    });

    res.json({ message: `Submission successfully marked as ${newStatus}`, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit-logs - Administrative and security audit logs
adminRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = await db.getAuditLogs();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users - List all registered user profiles
adminRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const profiles = await db.getAllProfiles();
    res.json({ users: profiles, count: profiles.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/role - Update a user's role
adminRouter.post('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { role, adminId } = req.body;
    const userId = req.params.id;

    if (!['customer', 'developer', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role specified' });
      return;
    }

    const updated = await db.updateProfileRole(userId, role);
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await db.logAudit({
      actor_id: adminId || 'a0000000-0000-0000-0000-000000000000',
      action: 'ADMIN_UPDATE_USER_ROLE',
      target_type: 'user_profile',
      target_id: userId,
      details: { newRole: role },
    });

    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/executions - Platform-wide agent execution monitoring
adminRouter.get('/executions', async (req: Request, res: Response) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const executions = await db.getAllExecutions(status);
    res.json({ executions, count: executions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/overview - Operational platform metrics
adminRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const [profiles, agents, submissions, tasks, txs, executions] = await Promise.all([
      db.getAllProfiles(),
      db.getApprovedAgents(),
      db.getSubmissions(),
      db.getTasks(),
      db.getTransactions(),
      db.getAllExecutions(),
    ]);

    const activeTasks = tasks.filter((t) => t.status === 'in_progress').length;
    const failedTasks = tasks.filter((t) => t.status === 'failed').length;
    const failedTxs = txs.filter((t) => t.payment_status === 'failed').length;
    const pendingReviews = submissions.filter((s) => s.status === 'pending').length;

    res.json({
      totalUsers: profiles.length,
      activeAgents: agents.length,
      pendingReviews,
      totalTasks: tasks.length,
      activeTasks,
      failedTasks,
      totalTransactions: txs.length,
      failedTransactions: failedTxs,
      totalExecutions: executions.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/ai/status - Inspect AI model configuration & usage metrics safely
adminRouter.get('/ai/status', async (req: Request, res: Response) => {
  try {
    const status = aiService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ai/test - Health check & latency test for configured AI provider
adminRouter.post('/ai/test', async (req: Request, res: Response) => {
  try {
    const result = await aiService.testProvider();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

