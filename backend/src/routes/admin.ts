import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { v4 as uuidv4 } from 'uuid';

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
