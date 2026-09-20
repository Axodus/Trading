CREATE TABLE IF NOT EXISTS execution_intents (
  execution_intent_id TEXT PRIMARY KEY,
  trading_intent_id TEXT NOT NULL UNIQUE,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  instrument TEXT NOT NULL,
  market_type TEXT NOT NULL,
  side TEXT NOT NULL,
  authorized_capital TEXT NOT NULL,
  authorized_quantity TEXT NOT NULL,
  authorized_leverage TEXT NOT NULL,
  execution_capital TEXT NOT NULL,
  execution_quantity TEXT NOT NULL,
  execution_leverage TEXT NOT NULL,
  venue TEXT NOT NULL,
  target_adapter_type TEXT NOT NULL,
  constraints JSONB NOT NULL,
  trading_intent_digest TEXT NOT NULL,
  authorization_context_digest TEXT NOT NULL,
  execution_policy_ref TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_execution_intents_strategy
  ON execution_intents (strategy_id, strategy_revision_id);

CREATE INDEX IF NOT EXISTS idx_execution_intents_created_at
  ON execution_intents (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_intents_trading_intent
  ON execution_intents (trading_intent_id);

CREATE TABLE IF NOT EXISTS execution_translations (
  translation_id TEXT PRIMARY KEY,
  trading_intent_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  target_adapter_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_intent_id TEXT,
  effective_capital TEXT NOT NULL,
  effective_quantity TEXT NOT NULL,
  effective_leverage TEXT NOT NULL,
  policy_revision TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_hash TEXT NOT NULL,
  rationale TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_translations_idempotency
  ON execution_translations (trading_intent_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_execution_translations_trading_intent
  ON execution_translations (trading_intent_id);

CREATE TABLE IF NOT EXISTS execution_results (
  execution_result_id TEXT PRIMARY KEY,
  execution_intent_id TEXT NOT NULL,
  trading_intent_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_quantity TEXT NOT NULL,
  accepted_quantity TEXT NOT NULL,
  simulated_filled_quantity TEXT,
  simulated_average_price TEXT,
  fees JSONB,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_results_intent
  ON execution_results (execution_intent_id);
