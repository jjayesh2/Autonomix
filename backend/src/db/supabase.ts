import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  Agent,
  AgentSubmission,
  Task,
  TaskStep,
  TaskResult,
  Transaction,
  AgentMetrics,
  Profile,
  AuditLog,
} from './types.js';

let supabaseClient: SupabaseClient | null = null;

if (config.supabase.isConfigured) {
  try {
    supabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[Database] Supabase PostgreSQL Client initialized successfully.');
  } catch (err) {
    console.warn('[Database] Failed to initialize Supabase client:', err);
  }
} else {
  console.log('[Database] No Supabase credentials configured in .env. Initializing in-memory fallback repository with demo seed data.');
}

// In-Memory Fallback Seed Data for out-of-the-box development & testing
const inMemoryProfiles: Map<string, Profile> = new Map([
  [
    'd0000000-0000-0000-0000-000000000001',
    {
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'developer@autonomix.network',
      display_name: 'Dev Studio Core',
      role: 'developer',
      wallet_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      sound_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  [
    'a0000000-0000-0000-0000-000000000000',
    {
      id: 'a0000000-0000-0000-0000-000000000000',
      email: 'admin@autonomix.network',
      display_name: 'Autonomix Admin',
      role: 'admin',
      wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      sound_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  [
    'c0000000-0000-0000-0000-000000000001',
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      email: 'customer@autonomix.network',
      display_name: 'Enterprise Buyer',
      role: 'customer',
      wallet_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      sound_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
]);

const inMemoryAgents: Map<string, Agent> = new Map([
  [
    'a0000000-0000-0000-0000-000000000001',
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      developer_id: 'd0000000-0000-0000-0000-000000000001',
      name: 'AlphaData Market Oracle',
      description: 'Provides verified financial feeds, live crypto exchange metrics, and macro indicators with normalized JSON outputs.',
      category: 'Data',
      endpoint_url: 'http://localhost:5000/api/agents/data',
      price_usdc: 0.02,
      recipient_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      capabilities: ['market_data', 'crypto_rates', 'macro_indicators', 'price_feed'],
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Asset symbol or topic, e.g. ETH, BTC, BASE, inflation' },
          timeframe: { type: 'string', enum: ['1h', '24h', '7d', '30d'], default: '24h' },
        },
        required: ['query'],
      },
      output_schema: {
        type: 'object',
        properties: {
          asset: { type: 'string' },
          price_usd: { type: 'number' },
          change_24h_pct: { type: 'number' },
          volume_24h_usd: { type: 'number' },
          timestamp: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['asset', 'price_usd', 'timestamp'],
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metrics: {
        agent_id: 'a0000000-0000-0000-0000-000000000001',
        total_calls: 142,
        successful_calls: 140,
        failed_calls: 2,
        median_latency_ms: 165,
        total_revenue_usdc: 2.84,
        rating_average: 4.92,
        rating_count: 38,
        updated_at: new Date().toISOString(),
      },
    },
  ],
  [
    'a0000000-0000-0000-0000-000000000002',
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      developer_id: 'd0000000-0000-0000-0000-000000000001',
      name: 'WebExtract Sandbox Crawler',
      description: 'Ethical, rate-controlled sandbox web extractor for extracting structured product items, pricing tables, and public articles.',
      category: 'Scraping',
      endpoint_url: 'http://localhost:5000/api/agents/scraper',
      price_usdc: 0.03,
      recipient_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      capabilities: ['web_scraping', 'html_parsing', 'product_catalog', 'structured_json'],
      input_schema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Keyword or category to search in sandbox' },
          extract_fields: { type: 'array', items: { type: 'string' }, default: ['title', 'price', 'url'] },
        },
        required: ['target'],
      },
      output_schema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          items_found: { type: 'integer' },
          items: { type: 'array' },
          scraped_at: { type: 'string' },
        },
        required: ['items_found', 'items'],
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metrics: {
        agent_id: 'a0000000-0000-0000-0000-000000000002',
        total_calls: 98,
        successful_calls: 95,
        failed_calls: 3,
        median_latency_ms: 310,
        total_revenue_usdc: 2.94,
        rating_average: 4.85,
        rating_count: 24,
        updated_at: new Date().toISOString(),
      },
    },
  ],
  [
    'a0000000-0000-0000-0000-000000000003',
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      developer_id: 'd0000000-0000-0000-0000-000000000001',
      name: 'CogniSynthesize LLM',
      description: 'Advanced multi-step reasoning, fact synthesis, sentiment classification, and structured executive brief generation.',
      category: 'Inference',
      endpoint_url: 'http://localhost:5000/api/agents/inference',
      price_usdc: 0.04,
      recipient_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      capabilities: ['summarization', 'sentiment_analysis', 'entity_extraction', 'synthesis'],
      input_schema: {
        type: 'object',
        properties: {
          context: { type: 'string', description: 'Raw inputs, data, or texts to synthesize' },
          task_goal: { type: 'string', description: 'Objective of the inference' },
          format: { type: 'string', enum: ['executive_summary', 'structured_json', 'bullet_brief'], default: 'executive_summary' },
        },
        required: ['context', 'task_goal'],
      },
      output_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          key_takeaways: { type: 'array', items: { type: 'string' } },
          sentiment: { type: 'string' },
          confidence_score: { type: 'number' },
          model_used: { type: 'string' },
        },
        required: ['summary', 'key_takeaways', 'confidence_score'],
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metrics: {
        agent_id: 'a0000000-0000-0000-0000-000000000003',
        total_calls: 215,
        successful_calls: 212,
        failed_calls: 3,
        median_latency_ms: 540,
        total_revenue_usdc: 8.60,
        rating_average: 4.96,
        rating_count: 61,
        updated_at: new Date().toISOString(),
      },
    },
  ],
]);

const inMemorySubmissions: Map<string, AgentSubmission> = new Map();
const inMemoryTasks: Map<string, Task> = new Map();
const inMemorySteps: Map<string, TaskStep[]> = new Map();
const inMemoryResults: Map<string, TaskResult> = new Map();
const inMemoryTransactions: Map<string, Transaction[]> = new Map();
const inMemoryAuditLogs: AuditLog[] = [];

export const db = {
  isConfigured: () => Boolean(supabaseClient),

  async getProfile(userId: string): Promise<Profile | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
      if (!error && data) return data as Profile;
    }
    return inMemoryProfiles.get(userId) || null;
  },

  async upsertProfile(profile: Partial<Profile> & { id: string; email: string }): Promise<Profile> {
    const updated: Profile = {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name || profile.email.split('@')[0],
      role: profile.role || 'customer',
      wallet_address: profile.wallet_address || '',
      sound_enabled: profile.sound_enabled ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('profiles').upsert(updated).select().single();
      if (!error && data) return data as Profile;
    }
    inMemoryProfiles.set(profile.id, updated);
    return updated;
  },

  async getApprovedAgents(category?: string): Promise<Agent[]> {
    if (supabaseClient) {
      let query = supabaseClient.from('agents').select('*, agent_metrics(*)').eq('is_active', true);
      if (category) {
        query = query.eq('category', category);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((item: any) => ({
          ...item,
          metrics: item.agent_metrics?.[0] || item.agent_metrics,
        }));
      }
    }
    const agents = Array.from(inMemoryAgents.values()).filter((a) => a.is_active);
    if (category) {
      return agents.filter((a) => a.category.toLowerCase() === category.toLowerCase());
    }
    return agents;
  },

  async getAgentById(id: string): Promise<Agent | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('agents').select('*, agent_metrics(*)').eq('id', id).single();
      if (!error && data) {
        return {
          ...data,
          metrics: data.agent_metrics?.[0] || data.agent_metrics,
        } as Agent;
      }
    }
    return inMemoryAgents.get(id) || null;
  },

  async createAgent(agent: Agent): Promise<Agent> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('agents').insert(agent).select().single();
      if (!error && data) return data as Agent;
    }
    inMemoryAgents.set(agent.id, agent);
    return agent;
  },

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('agents').update(updates).eq('id', id).select().single();
      if (!error && data) return data as Agent;
    }
    const existing = inMemoryAgents.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
    inMemoryAgents.set(id, merged);
    return merged;
  },

  async getSubmissions(developerId?: string): Promise<AgentSubmission[]> {
    if (supabaseClient) {
      let query = supabaseClient.from('agent_submissions').select('*');
      if (developerId) query = query.eq('developer_id', developerId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data as AgentSubmission[];
    }
    let subs = Array.from(inMemorySubmissions.values());
    if (developerId) subs = subs.filter((s) => s.developer_id === developerId);
    return subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createSubmission(sub: AgentSubmission): Promise<AgentSubmission> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('agent_submissions').insert(sub).select().single();
      if (!error && data) return data as AgentSubmission;
    }
    inMemorySubmissions.set(sub.id, sub);
    return sub;
  },

  async updateSubmission(id: string, updates: Partial<AgentSubmission>): Promise<AgentSubmission | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('agent_submissions').update(updates).eq('id', id).select().single();
      if (!error && data) return data as AgentSubmission;
    }
    const existing = inMemorySubmissions.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
    inMemorySubmissions.set(id, merged);
    return merged;
  },

  async getTasks(userId?: string): Promise<Task[]> {
    if (supabaseClient) {
      let query = supabaseClient.from('tasks').select('*');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data as Task[];
    }
    let tasks = Array.from(inMemoryTasks.values());
    if (userId) tasks = tasks.filter((t) => t.user_id === userId);
    return tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getTaskById(id: string): Promise<Task | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('tasks').select('*').eq('id', id).single();
      if (!error && data) return data as Task;
    }
    return inMemoryTasks.get(id) || null;
  },

  async createTask(task: Task): Promise<Task> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('tasks').insert(task).select().single();
      if (!error && data) return data as Task;
    }
    inMemoryTasks.set(task.id, task);
    return task;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('tasks').update(updates).eq('id', id).select().single();
      if (!error && data) return data as Task;
    }
    const existing = inMemoryTasks.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    inMemoryTasks.set(id, merged);
    return merged;
  },

  async getTaskSteps(taskId: string): Promise<TaskStep[]> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('task_steps').select('*').eq('task_id', taskId).order('step_number', { ascending: true });
      if (!error && data) return data as TaskStep[];
    }
    return inMemorySteps.get(taskId) || [];
  },

  async createTaskStep(step: TaskStep): Promise<TaskStep> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('task_steps').insert(step).select().single();
      if (!error && data) return data as TaskStep;
    }
    const current = inMemorySteps.get(step.task_id) || [];
    current.push(step);
    inMemorySteps.set(step.task_id, current);
    return step;
  },

  async updateTaskStep(id: string, taskId: string, updates: Partial<TaskStep>): Promise<TaskStep | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('task_steps').update(updates).eq('id', id).select().single();
      if (!error && data) return data as TaskStep;
    }
    const current = inMemorySteps.get(taskId) || [];
    const index = current.findIndex((s) => s.id === id);
    if (index === -1) return null;
    current[index] = { ...current[index], ...updates };
    inMemorySteps.set(taskId, current);
    return current[index];
  },

  async getTaskResult(taskId: string): Promise<TaskResult | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('task_results').select('*').eq('task_id', taskId).single();
      if (!error && data) return data as TaskResult;
    }
    return inMemoryResults.get(taskId) || null;
  },

  async createTaskResult(result: TaskResult): Promise<TaskResult> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('task_results').insert(result).select().single();
      if (!error && data) return data as TaskResult;
    }
    inMemoryResults.set(result.task_id, result);
    return result;
  },

  async getTransactions(taskId?: string): Promise<Transaction[]> {
    if (supabaseClient) {
      let query = supabaseClient.from('transactions').select('*');
      if (taskId) query = query.eq('task_id', taskId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data as Transaction[];
    }
    let allTx: Transaction[] = [];
    for (const txList of inMemoryTransactions.values()) {
      allTx = allTx.concat(txList);
    }
    if (taskId) {
      allTx = allTx.filter((t) => t.task_id === taskId);
    }
    return allTx.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createTransaction(tx: Transaction): Promise<Transaction> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('transactions').insert(tx).select().single();
      if (!error && data) return data as Transaction;
    }
    const current = inMemoryTransactions.get(tx.task_id) || [];
    current.push(tx);
    inMemoryTransactions.set(tx.task_id, current);
    return tx;
  },

  async recordMetrics(agentId: string, success: boolean, latencyMs: number, priceUsdc: number): Promise<void> {
    const existing = (await this.getAgentById(agentId))?.metrics;
    const totalCalls = (existing?.total_calls || 0) + 1;
    const successfulCalls = (existing?.successful_calls || 0) + (success ? 1 : 0);
    const failedCalls = (existing?.failed_calls || 0) + (success ? 0 : 1);
    const medianLatency = existing?.median_latency_ms ? Math.round((existing.median_latency_ms + latencyMs) / 2) : latencyMs;
    const totalRevenue = Number(((existing?.total_revenue_usdc || 0) + (success ? priceUsdc : 0)).toFixed(4));

    const metricsData = {
      agent_id: agentId,
      total_calls: totalCalls,
      successful_calls: successfulCalls,
      failed_calls: failedCalls,
      median_latency_ms: medianLatency,
      total_revenue_usdc: totalRevenue,
      rating_average: existing?.rating_average || 5.0,
      rating_count: existing?.rating_count || 1,
      updated_at: new Date().toISOString(),
    };

    if (supabaseClient) {
      await supabaseClient.from('agent_metrics').upsert(metricsData);
    }
    const agent = inMemoryAgents.get(agentId);
    if (agent) {
      agent.metrics = metricsData;
    }
  },

  async logAudit(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
    const entry: AuditLog = {
      id: `audit-${Date.now()}`,
      ...log,
      created_at: new Date().toISOString(),
    };
    if (supabaseClient) {
      await supabaseClient.from('audit_logs').insert(entry);
    }
    inMemoryAuditLogs.push(entry);
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (!error && data) return data as AuditLog[];
    }
    return [...inMemoryAuditLogs].reverse().slice(0, 50);
  },
};
