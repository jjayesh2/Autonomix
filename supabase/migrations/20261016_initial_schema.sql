-- ====================================================================
-- Autonomix Database Schema Migration
-- Pay-per-Call Agent Economy | PostgreSQL / Supabase
-- ====================================================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'developer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE agent_category AS ENUM ('Data', 'Inference', 'Scraping');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'planning', 'in_progress', 'completed', 'partially_completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'confirmed', 'failed', 'reconciliation_required');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. PROFILES TABLE (Supabase Auth link)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    wallet_address TEXT,
    sound_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. AGENTS TABLE (Approved active marketplace agents)
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category agent_category NOT NULL,
    endpoint_url TEXT NOT NULL,
    price_usdc NUMERIC(10, 4) NOT NULL CHECK (price_usdc >= 0 AND price_usdc <= 0.50),
    recipient_address TEXT NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. AGENT SUBMISSIONS TABLE (Developer proposals and review workflow)
CREATE TABLE IF NOT EXISTS public.agent_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    developer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category agent_category NOT NULL,
    endpoint_url TEXT NOT NULL,
    price_usdc NUMERIC(10, 4) NOT NULL CHECK (price_usdc >= 0 AND price_usdc <= 0.50),
    recipient_address TEXT NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    status submission_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TASKS TABLE (User buyer tasks & strict budgets)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    budget_limit NUMERIC(10, 4) NOT NULL CHECK (budget_limit > 0),
    total_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    status task_status NOT NULL DEFAULT 'pending',
    orchestration_plan JSONB,
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

-- 6. BUDGET RESERVATIONS TABLE (Atomic concurrent spending lock)
CREATE TABLE IF NOT EXISTS public.budget_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    amount_reserved NUMERIC(10, 4) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'committed', 'released')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TASK STEPS TABLE (Execution trace & verification)
CREATE TABLE IF NOT EXISTS public.task_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    agent_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    input_payload JSONB,
    output_payload JSONB,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    latency_ms INTEGER DEFAULT 0,
    price_paid NUMERIC(10, 4) DEFAULT 0.0000,
    tx_hash TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. TASK RESULTS TABLE (Synthesized validated output)
CREATE TABLE IF NOT EXISTS public.task_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
    final_summary TEXT NOT NULL,
    structured_output JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_steps INTEGER NOT NULL DEFAULT 0,
    successful_steps INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. TRANSACTIONS TABLE (x402 v2 On-chain payment ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    step_id UUID REFERENCES public.task_steps(id) ON DELETE SET NULL,
    buyer_address TEXT NOT NULL,
    seller_address TEXT NOT NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    token_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 84532,
    amount_usdc NUMERIC(10, 4) NOT NULL,
    platform_fee_usdc NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    tx_hash TEXT,
    explorer_url TEXT,
    payment_status payment_status NOT NULL DEFAULT 'pending',
    service_status TEXT NOT NULL DEFAULT 'pending' CHECK (service_status IN ('pending', 'success', 'failed')),
    idempotency_key TEXT UNIQUE NOT NULL,
    nonce TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. AGENT METRICS TABLE (Aggregated reputation & quality)
CREATE TABLE IF NOT EXISTS public.agent_metrics (
    agent_id UUID PRIMARY KEY REFERENCES public.agents(id) ON DELETE CASCADE,
    total_calls INTEGER NOT NULL DEFAULT 0,
    successful_calls INTEGER NOT NULL DEFAULT 0,
    failed_calls INTEGER NOT NULL DEFAULT 0,
    median_latency_ms INTEGER NOT NULL DEFAULT 0,
    total_revenue_usdc NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    rating_average NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    rating_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. REVIEWS TABLE (Customer feedback)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. PLATFORM FEES TABLE (Audited fee collection)
CREATE TABLE IF NOT EXISTS public.platform_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    amount_usdc NUMERIC(10, 4) NOT NULL,
    fee_percent NUMERIC(5, 2) NOT NULL,
    treasury_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'settled', 'exempt')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. AUDIT LOGS TABLE (Security & administrative event history)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. INDEXES FOR HIGH-THROUGHPUT QUERIES
CREATE INDEX IF NOT EXISTS idx_agents_category ON public.agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON public.agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_submissions_status ON public.agent_submissions(status);
CREATE INDEX IF NOT EXISTS idx_agent_submissions_developer ON public.agent_submissions(developer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON public.task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_transactions_task_id ON public.transactions(task_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON public.transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON public.transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_budget_reservations_task ON public.budget_reservations(task_id);

-- 15. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_reservations ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Public profiles are readable by everyone" 
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- AGENTS POLICIES
CREATE POLICY "Active approved agents are visible to everyone" 
    ON public.agents FOR SELECT USING (is_active = true OR developer_id = auth.uid());

CREATE POLICY "Developers can update their own agents" 
    ON public.agents FOR UPDATE USING (developer_id = auth.uid());

-- AGENT SUBMISSIONS POLICIES
CREATE POLICY "Developers can see their own submissions" 
    ON public.agent_submissions FOR SELECT USING (developer_id = auth.uid());

CREATE POLICY "Developers can create submissions" 
    ON public.agent_submissions FOR INSERT WITH CHECK (developer_id = auth.uid());

CREATE POLICY "Developers can update pending submissions" 
    ON public.agent_submissions FOR UPDATE USING (developer_id = auth.uid() AND status IN ('pending', 'rejected'));

-- TASKS POLICIES
CREATE POLICY "Users can see their own tasks" 
    ON public.tasks FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own tasks" 
    ON public.tasks FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tasks" 
    ON public.tasks FOR UPDATE USING (user_id = auth.uid());

-- TASK STEPS POLICIES
CREATE POLICY "Users can see task steps of their tasks" 
    ON public.task_steps FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_steps.task_id AND tasks.user_id = auth.uid())
    );

-- TASK RESULTS POLICIES
CREATE POLICY "Users can see task results of their tasks" 
    ON public.task_results FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_results.task_id AND tasks.user_id = auth.uid())
    );

-- TRANSACTIONS POLICIES
CREATE POLICY "Users can view transactions related to their tasks" 
    ON public.transactions FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = transactions.task_id AND tasks.user_id = auth.uid())
    );

-- AGENT METRICS POLICIES
CREATE POLICY "Agent metrics are readable by everyone" 
    ON public.agent_metrics FOR SELECT USING (true);

-- REVIEWS POLICIES
CREATE POLICY "Reviews are viewable by everyone" 
    ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Users can insert their own reviews" 
    ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Note: Admin access and sensitive mutations are executed via the Backend Service Role
-- which bypasses RLS securely on the server.
