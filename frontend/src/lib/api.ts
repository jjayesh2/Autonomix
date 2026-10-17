const API_BASE = '/api';

export interface Agent {
  id: string;
  developer_id: string;
  name: string;
  description: string;
  category: 'Data' | 'Inference' | 'Scraping';
  endpoint_url: string;
  price_usdc: number;
  recipient_address: string;
  capabilities: string[];
  input_schema: any;
  output_schema: any;
  is_active: boolean;
  metrics?: {
    total_calls: number;
    successful_calls: number;
    failed_calls: number;
    median_latency_ms: number;
    total_revenue_usdc: number;
    rating_average: number;
    rating_count: number;
  };
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  budget_limit: number;
  total_cost: number;
  status: 'pending' | 'planning' | 'in_progress' | 'completed' | 'partially_completed' | 'failed';
  orchestration_plan?: any;
  rationale?: string;
  created_at: string;
  completed_at?: string;
}

export interface TaskStep {
  id: string;
  task_id: string;
  step_number: number;
  agent_id?: string;
  agent_name: string;
  action_type: string;
  input_payload?: any;
  output_payload?: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  latency_ms: number;
  price_paid: number;
  tx_hash?: string;
  error_message?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  task_id: string;
  step_id?: string;
  buyer_address: string;
  seller_address: string;
  agent_id?: string;
  token_address: string;
  chain_id: number;
  amount_usdc: number;
  platform_fee_usdc: number;
  tx_hash?: string;
  explorer_url?: string;
  payment_status: 'pending' | 'authorized' | 'confirmed' | 'failed' | 'reconciliation_required';
  service_status: 'pending' | 'success' | 'failed';
  idempotency_key: string;
  created_at: string;
}

export interface AgentSubmission {
  id: string;
  developer_id: string;
  name: string;
  description: string;
  category: 'Data' | 'Inference' | 'Scraping';
  endpoint_url: string;
  price_usdc: number;
  recipient_address: string;
  capabilities: string[];
  input_schema: any;
  output_schema: any;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason?: string;
  reviewed_at?: string;
  created_at: string;
}

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getMarketplaceAgents(params: { category?: string; search?: string; sort?: string } = {}) {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'All') query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);

    const res = await fetch(`${API_BASE}/marketplace/agents?${query.toString()}`);
    return res.json();
  },

  async getAgentDetails(id: string) {
    const res = await fetch(`${API_BASE}/marketplace/agents/${id}`);
    return res.json();
  },

  async planTask(description: string, budgetLimit: number) {
    const res = await fetch(`${API_BASE}/tasks/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, budgetLimit }),
    });
    return res.json();
  },

  async createTask(payload: { description: string; budgetLimit: number; userId?: string; title?: string; plan?: any }) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getTask(id: string) {
    const res = await fetch(`${API_BASE}/tasks/${id}`);
    return res.json();
  },

  async getTasks(userId?: string) {
    const query = userId ? `?userId=${userId}` : '';
    const res = await fetch(`${API_BASE}/tasks${query}`);
    return res.json();
  },

  async executeTask(id: string) {
    const res = await fetch(`${API_BASE}/tasks/${id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  async getDeveloperAnalytics(developerId?: string) {
    const query = developerId ? `?developerId=${developerId}` : '';
    const res = await fetch(`${API_BASE}/developer/analytics${query}`);
    return res.json();
  },

  async getDeveloperSubmissions(developerId?: string) {
    const query = developerId ? `?developerId=${developerId}` : '';
    const res = await fetch(`${API_BASE}/developer/submissions${query}`);
    return res.json();
  },

  async submitAgent(payload: any) {
    const res = await fetch(`${API_BASE}/developer/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async testEndpoint(endpointUrl: string) {
    const res = await fetch(`${API_BASE}/developer/test-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointUrl }),
    });
    return res.json();
  },

  async getAdminSubmissions() {
    const res = await fetch(`${API_BASE}/admin/submissions`);
    return res.json();
  },

  async reviewSubmission(id: string, action: 'approve' | 'reject' | 'suspend', rejectionReason?: string, adminId?: string) {
    const res = await fetch(`${API_BASE}/admin/submissions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rejectionReason, adminId }),
    });
    return res.json();
  },

  async getAdminAuditLogs() {
    const res = await fetch(`${API_BASE}/admin/audit-logs`);
    return res.json();
  },

  async getTransactions(taskId?: string) {
    const query = taskId ? `?taskId=${taskId}` : '';
    const res = await fetch(`${API_BASE}/transactions${query}`);
    return res.json();
  },

  async getProfile(id: string) {
    const res = await fetch(`${API_BASE}/profile/${id}`);
    return res.json();
  },

  async saveProfile(payload: any) {
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Developer routes
  async getDeveloperExecutions(params: { developerId?: string; agentId?: string; status?: string } = {}) {
    const query = new URLSearchParams();
    if (params.developerId) query.set('developerId', params.developerId);
    if (params.agentId) query.set('agentId', params.agentId);
    if (params.status) query.set('status', params.status);
    const res = await fetch(`${API_BASE}/developer/executions?${query.toString()}`);
    return res.json();
  },

  async getDeveloperEarnings(developerId?: string) {
    const query = developerId ? `?developerId=${developerId}` : '';
    const res = await fetch(`${API_BASE}/developer/earnings${query}`);
    return res.json();
  },

  async requestDeveloperAccess(payload: { userId: string; organization?: string; reason?: string }) {
    const res = await fetch(`${API_BASE}/developer/request-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Admin routes
  async getAdminUsers() {
    const res = await fetch(`${API_BASE}/admin/users`);
    return res.json();
  },

  async updateUserRole(userId: string, role: string, adminId?: string) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, adminId }),
    });
    return res.json();
  },

  async getAdminExecutions(status?: string) {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${API_BASE}/admin/executions${query}`);
    return res.json();
  },

  async getAdminOverview() {
    const res = await fetch(`${API_BASE}/admin/overview`);
    return res.json();
  },

  async getAIStatus() {
    const res = await fetch(`${API_BASE}/admin/ai/status`);
    return res.json();
  },

  async testAIConnection() {
    const res = await fetch(`${API_BASE}/admin/ai/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  // Wallet routes
  async getWalletSummary(userId?: string) {
    const query = userId ? `?userId=${userId}` : '';
    const res = await fetch(`${API_BASE}/wallet/summary${query}`);
    return res.json();
  },

  async addFunds(payload: { userId: string; amount: number; currency: 'INR' | 'USD'; method: string; paymentDetails?: any }) {
    const res = await fetch(`${API_BASE}/wallet/add-funds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};

