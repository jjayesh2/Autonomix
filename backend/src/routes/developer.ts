import { Router, Request, Response } from 'express';
import { db } from '../db/supabase.js';
import { validateAgentEndpoint } from '../middleware/ssrfGuard.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export const developerRouter = Router();

// GET /api/developer/submissions - List submissions for the developer
developerRouter.get('/submissions', async (req: Request, res: Response) => {
  try {
    const developerId = req.query.developerId ? String(req.query.developerId) : undefined;
    const submissions = await db.getSubmissions(developerId);
    res.json({ submissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/developer/submissions - Submit a new agent for admin review
developerRouter.post('/submissions', async (req: Request, res: Response) => {
  try {
    const {
      developerId,
      name,
      description,
      category,
      endpointUrl,
      priceUsdc,
      recipientAddress,
      capabilities,
      inputSchema,
      outputSchema,
    } = req.body;

    if (!name || !description || !category || !endpointUrl || priceUsdc === undefined || !recipientAddress) {
      res.status(400).json({ error: 'Missing required agent fields' });
      return;
    }

    // SSRF Validation
    const ssrfCheck = validateAgentEndpoint(endpointUrl);
    if (!ssrfCheck.isValid) {
      res.status(400).json({ error: ssrfCheck.error });
      return;
    }

    // Price cap validation (0.10 USDC cap initially, max 0.50)
    const price = parseFloat(priceUsdc);
    if (isNaN(price) || price < 0 || price > 0.50) {
      res.status(400).json({ error: 'Service price must be between 0.00 and 0.50 USDC' });
      return;
    }

    const submission = await db.createSubmission({
      id: uuidv4(),
      developer_id: developerId || 'd0000000-0000-0000-0000-000000000001',
      name,
      description,
      category,
      endpoint_url: endpointUrl,
      price_usdc: price,
      recipient_address: recipientAddress,
      capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
      input_schema: inputSchema || {},
      output_schema: outputSchema || {},
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db.logAudit({
      actor_id: developerId,
      action: 'SUBMIT_AGENT_FOR_REVIEW',
      target_type: 'agent_submission',
      target_id: submission.id,
      details: { name, category, price_usdc: price },
    });

    res.status(201).json(submission);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/developer/test-endpoint - Health check & test an endpoint before submitting
developerRouter.post('/test-endpoint', async (req: Request, res: Response) => {
  try {
    const { endpointUrl } = req.body;
    if (!endpointUrl) {
      res.status(400).json({ error: 'Endpoint URL is required' });
      return;
    }

    const ssrfCheck = validateAgentEndpoint(endpointUrl);
    if (!ssrfCheck.isValid) {
      res.status(400).json({ healthy: false, error: ssrfCheck.error });
      return;
    }

    const start = Date.now();
    try {
      const response = await axios.get(endpointUrl, { timeout: 4000 });
      const latency = Date.now() - start;
      res.json({
        healthy: true,
        statusCode: response.status,
        latencyMs: latency,
        message: 'Endpoint responded successfully',
      });
    } catch (err: any) {
      const latency = Date.now() - start;
      // An HTTP 402 is also considered alive and compliant with x402!
      if (err.response && err.response.status === 402) {
        res.json({
          healthy: true,
          statusCode: 402,
          latencyMs: latency,
          message: 'Endpoint is active and responding with HTTP 402 Payment Challenge',
        });
      } else {
        res.json({
          healthy: false,
          statusCode: err.response?.status || 500,
          latencyMs: latency,
          error: err.message,
        });
      }
    }
  } catch (err: any) {
    res.status(500).json({ healthy: false, error: err.message });
  }
});

// GET /api/developer/analytics - Developer performance metrics & revenue summary
developerRouter.get('/analytics', async (req: Request, res: Response) => {
  try {
    const developerId = req.query.developerId ? String(req.query.developerId) : 'd0000000-0000-0000-0000-000000000001';
    const agents = await db.getApprovedAgents();
    const myAgents = agents.filter((a) => a.developer_id === developerId);

    let totalCalls = 0;
    let successfulCalls = 0;
    let failedCalls = 0;
    let totalRevenue = 0;
    const latencies: number[] = [];

    for (const a of myAgents) {
      if (a.metrics) {
        totalCalls += a.metrics.total_calls;
        successfulCalls += a.metrics.successful_calls;
        failedCalls += a.metrics.failed_calls;
        totalRevenue += a.metrics.total_revenue_usdc;
        latencies.push(a.metrics.median_latency_ms);
      }
    }

    const medianLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const successRate = totalCalls > 0 ? Number(((successfulCalls / totalCalls) * 100).toFixed(1)) : 100;

    res.json({
      developerId,
      agentCount: myAgents.length,
      totalCalls,
      successfulCalls,
      failedCalls,
      successRate,
      totalRevenueUsdc: Number(totalRevenue.toFixed(4)),
      medianLatencyMs: medianLatency,
      agents: myAgents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/developer/executions - Real-time execution traces for developer's agents
developerRouter.get('/executions', async (req: Request, res: Response) => {
  try {
    const developerId = req.query.developerId ? String(req.query.developerId) : undefined;
    const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const executions = await db.getDeveloperExecutions(developerId, agentId, status);
    res.json({ executions, count: executions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/developer/earnings - Verified net earnings and platform fee breakdown
developerRouter.get('/earnings', async (req: Request, res: Response) => {
  try {
    const developerId = req.query.developerId ? String(req.query.developerId) : 'd0000000-0000-0000-0000-000000000001';
    const earnings = await db.getDeveloperEarnings(developerId);
    res.json(earnings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/developer/request-access - User submits request to become developer
developerRouter.post('/request-access', async (req: Request, res: Response) => {
  try {
    const { userId, organization, reason } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    await db.logAudit({
      actor_id: userId,
      action: 'DEVELOPER_ROLE_REQUESTED',
      target_type: 'user_profile',
      target_id: userId,
      details: { organization, reason: reason || 'Requested to publish agent endpoints' },
    });

    // Auto-approve in demo mode or update profile
    await db.updateProfileRole(userId, 'developer');

    res.json({ success: true, message: 'Developer role access granted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

