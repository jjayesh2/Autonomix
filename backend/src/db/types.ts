export type UserRole = 'customer' | 'developer' | 'admin';
export type AgentCategory = 'Data' | 'Inference' | 'Scraping';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type TaskStatus = 'pending' | 'planning' | 'in_progress' | 'completed' | 'partially_completed' | 'failed';
export type PaymentStatus = 'pending' | 'authorized' | 'confirmed' | 'failed' | 'reconciliation_required';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  wallet_address?: string;
  sound_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  developer_id: string;
  name: string;
  description: string;
  category: AgentCategory;
  endpoint_url: string;
  price_usdc: number;
  recipient_address: string;
  capabilities: string[];
  input_schema: any;
  output_schema: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metrics?: AgentMetrics;
}

export interface AgentSubmission {
  id: string;
  agent_id?: string;
  developer_id: string;
  name: string;
  description: string;
  category: AgentCategory;
  endpoint_url: string;
  price_usdc: number;
  recipient_address: string;
  capabilities: string[];
  input_schema: any;
  output_schema: any;
  status: SubmissionStatus;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  budget_limit: number;
  total_cost: number;
  status: TaskStatus;
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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paid_output_rejected' | 'skipped';
  latency_ms: number;
  price_paid: number;
  tx_hash?: string;
  error_message?: string;
  created_at: string;
}

export interface TaskResult {
  id: string;
  task_id: string;
  final_summary: string;
  structured_output: any;
  total_steps: number;
  successful_steps: number;
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
  voucher_digest?: string;
  explorer_url?: string;
  payment_status: PaymentStatus;
  service_status: 'pending' | 'success' | 'failed' | 'output_rejected' | 'empty_result';
  idempotency_key: string;
  nonce?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentMetrics {
  agent_id: string;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  median_latency_ms: number;
  total_revenue_usdc: number;
  rating_average: number;
  rating_count: number;
  updated_at: string;
}

export interface Review {
  id: string;
  agent_id: string;
  user_id: string;
  task_id?: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface PlatformFee {
  id: string;
  task_id: string;
  transaction_id: string;
  amount_usdc: number;
  fee_percent: number;
  treasury_address: string;
  status: 'recorded' | 'settled' | 'exempt';
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  target_type: string;
  target_id?: string;
  details: any;
  ip_address?: string;
  created_at: string;
}

export interface FundingOrder {
  id: string;
  user_id: string;
  amount: number;
  currency: 'INR' | 'USD';
  method: 'upi' | 'card' | 'netbanking' | 'faucet';
  payment_details?: any;
  status: 'pending' | 'completed' | 'failed';
  fee: number;
  gateway_reference?: string;
  credited_usdc?: number;
  created_at: string;
}

export interface DeveloperRequest {
  id: string;
  user_id: string;
  user_email: string;
  organization?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at?: string;
  created_at: string;
}

export interface ExecutionTrace extends TaskStep {
  task_title?: string;
  task_description?: string;
  developer_id?: string;
}
