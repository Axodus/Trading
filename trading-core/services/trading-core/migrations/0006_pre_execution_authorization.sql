CREATE TABLE IF NOT EXISTS trading_intents (
  intent_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  market_state_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  portfolio_decision_id TEXT NOT NULL,
  risk_decision_id TEXT NOT NULL UNIQUE,
  eligibility_id TEXT NOT NULL,
  instrument TEXT NOT NULL,
  venue TEXT,
  action TEXT NOT NULL,
  approved_quantity TEXT NOT NULL,
  approved_capital TEXT NOT NULL,
  approved_leverage TEXT,
  price_constraints JSONB,
  time_constraints JSONB,
  execution_policy_ref TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_trading_intents_strategy
  ON trading_intents (strategy_id, strategy_revision_id);

CREATE INDEX IF NOT EXISTS idx_trading_intents_created_at
  ON trading_intents (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_intents_risk_decision
  ON trading_intents (risk_decision_id);

CREATE TABLE IF NOT EXISTS pre_execution_authorizations (
  authorization_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  portfolio_decision_id TEXT NOT NULL,
  risk_decision_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  intent_id TEXT,
  effective_capital TEXT NOT NULL,
  effective_leverage TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_hash TEXT NOT NULL,
  rationale TEXT,
  decided_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pre_execution_authorizations_idempotency
  ON pre_execution_authorizations (strategy_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_pre_execution_authorizations_risk_decision
  ON pre_execution_authorizations (risk_decision_id);

