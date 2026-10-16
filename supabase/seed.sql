-- ====================================================================
-- Autonomix Database Seed Script
-- Initial demo profiles, 3 approved seller agents, and metrics
-- ====================================================================

-- Demo User IDs (Deterministic UUIDs for local seed/testing)
-- Note: In Supabase production Auth, users are registered via auth.users.
-- We seed matching profiles for local/development use.

-- 1. PROFILES
INSERT INTO public.profiles (id, email, display_name, role, wallet_address, sound_enabled)
VALUES 
    ('d0000000-0000-0000-0000-000000000001', 'developer@autonomix.network', 'Dev Studio Core', 'developer', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', true),
    ('a0000000-0000-0000-0000-000000000000', 'admin@autonomix.network', 'Autonomix Admin', 'admin', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', true),
    ('c0000000-0000-0000-0000-000000000001', 'customer@autonomix.network', 'Enterprise Buyer', 'customer', '0x90F79bf6EB2c4f870365E785982E1f101E93b906', true)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    wallet_address = EXCLUDED.wallet_address;

-- 2. APPROVED SELLER AGENTS
-- 2.1 AlphaData Market Oracle (Data Agent)
INSERT INTO public.agents (
    id, developer_id, name, description, category, endpoint_url, price_usdc, recipient_address, capabilities, input_schema, output_schema, is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'AlphaData Market Oracle',
    'Provides verified financial feeds, live crypto exchange metrics, and macro indicators with normalized JSON outputs.',
    'Data',
    'http://localhost:5000/api/agents/data',
    0.0200,
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    ARRAY['market_data', 'crypto_rates', 'macro_indicators', 'price_feed'],
    '{
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Asset symbol or topic, e.g. ETH, BTC, BASE, inflation"},
            "timeframe": {"type": "string", "enum": ["1h", "24h", "7d", "30d"], "default": "24h"}
        },
        "required": ["query"]
    }'::jsonb,
    '{
        "type": "object",
        "properties": {
            "asset": {"type": "string"},
            "price_usd": {"type": "number"},
            "change_24h_pct": {"type": "number"},
            "volume_24h_usd": {"type": "number"},
            "timestamp": {"type": "string"},
            "source": {"type": "string"}
        },
        "required": ["asset", "price_usd", "timestamp"]
    }'::jsonb,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_usdc = EXCLUDED.price_usdc,
    endpoint_url = EXCLUDED.endpoint_url;

-- 2.2 WebExtract Sandbox Crawler (Scraping Agent)
INSERT INTO public.agents (
    id, developer_id, name, description, category, endpoint_url, price_usdc, recipient_address, capabilities, input_schema, output_schema, is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    'WebExtract Sandbox Crawler',
    'Ethical, rate-controlled sandbox web extractor for extracting structured product items, pricing tables, and public articles.',
    'Scraping',
    'http://localhost:5000/api/agents/scraper',
    0.0300,
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    ARRAY['web_scraping', 'html_parsing', 'product_catalog', 'structured_json'],
    '{
        "type": "object",
        "properties": {
            "target": {"type": "string", "description": "Keyword or URL path to extract from sandbox"},
            "extract_fields": {"type": "array", "items": {"type": "string"}, "default": ["title", "price", "url"]}
        },
        "required": ["target"]
    }'::jsonb,
    '{
        "type": "object",
        "properties": {
            "url": {"type": "string"},
            "items_found": {"type": "integer"},
            "items": {"type": "array"},
            "scraped_at": {"type": "string"}
        },
        "required": ["items_found", "items"]
    }'::jsonb,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_usdc = EXCLUDED.price_usdc,
    endpoint_url = EXCLUDED.endpoint_url;

-- 2.3 CogniSynthesize LLM (Inference Agent)
INSERT INTO public.agents (
    id, developer_id, name, description, category, endpoint_url, price_usdc, recipient_address, capabilities, input_schema, output_schema, is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001',
    'CogniSynthesize LLM',
    'Advanced multi-step reasoning, fact synthesis, sentiment classification, and structured executive brief generation.',
    'Inference',
    'http://localhost:5000/api/agents/inference',
    0.0400,
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    ARRAY['summarization', 'sentiment_analysis', 'entity_extraction', 'synthesis'],
    '{
        "type": "object",
        "properties": {
            "context": {"type": "string", "description": "Raw inputs, data, or texts to synthesize"},
            "task_goal": {"type": "string", "description": "Objective of the inference (e.g. summarize, compare, classify)"},
            "format": {"type": "string", "enum": ["executive_summary", "structured_json", "bullet_brief"], "default": "executive_summary"}
        },
        "required": ["context", "task_goal"]
    }'::jsonb,
    '{
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "key_takeaways": {"type": "array", "items": {"type": "string"}},
            "sentiment": {"type": "string"},
            "confidence_score": {"type": "number"},
            "model_used": {"type": "string"}
        },
        "required": ["summary", "key_takeaways", "confidence_score"]
    }'::jsonb,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_usdc = EXCLUDED.price_usdc,
    endpoint_url = EXCLUDED.endpoint_url;

-- 3. AGENT METRICS
INSERT INTO public.agent_metrics (agent_id, total_calls, successful_calls, failed_calls, median_latency_ms, total_revenue_usdc, rating_average, rating_count)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 142, 140, 2, 165, 2.8400, 4.92, 38),
    ('a0000000-0000-0000-0000-000000000002', 98, 95, 3, 310, 2.9400, 4.85, 24),
    ('a0000000-0000-0000-0000-000000000003', 215, 212, 3, 540, 8.6000, 4.96, 61)
ON CONFLICT (agent_id) DO UPDATE SET
    total_calls = EXCLUDED.total_calls,
    successful_calls = EXCLUDED.successful_calls,
    total_revenue_usdc = EXCLUDED.total_revenue_usdc;

-- 4. INITIAL REVIEWS
INSERT INTO public.reviews (agent_id, user_id, rating, comment)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 5, 'Ultra low latency price feeds on Base Sepolia. Clean schema adherence.'),
    ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 5, 'Reliable scraping from sandbox targets without formatting issues.'),
    ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 5, 'High quality synthesis, accurate schema response and clean summary.');
