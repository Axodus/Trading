-- AXODUS-TRADING-IMP-02 — provider-neutral SHADOW decision evidence only.
-- These tables do not own Portfolio, Risk, Intent, Execution, or exchange state.

CREATE TABLE IF NOT EXISTS shadow_decision_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('PAPER', 'TESTNET')),
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  instrument TEXT NOT NULL,
  market_state_ref TEXT NOT NULL,
  market_state_digest TEXT NOT NULL,
  opportunity_ref TEXT NOT NULL,
  opportunity_digest TEXT NOT NULL,
  trade_proposal_ref TEXT NOT NULL,
  trade_proposal_digest TEXT NOT NULL,
  experiment_identity JSONB NOT NULL,
  question_set_identity JSONB NOT NULL,
  requested_provider TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  provider_state JSONB NOT NULL,
  input_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_snapshots_cohort
  ON shadow_decision_snapshots (strategy_id, strategy_revision_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS shadow_decision_observations (
  observation_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  snapshot_id TEXT NOT NULL REFERENCES shadow_decision_snapshots(snapshot_id) ON DELETE RESTRICT,
  correlation_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  resolved_model TEXT,
  status TEXT NOT NULL,
  answers JSONB NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
  attempts JSONB NOT NULL,
  total_provider_wall_time_ms INTEGER NOT NULL CHECK (total_provider_wall_time_ms >= 0),
  usage JSONB,
  observed_at TIMESTAMPTZ NOT NULL,
  failure_code TEXT,
  input_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_observations_analysis
  ON shadow_decision_observations (provider, resolved_model, status, observed_at DESC);

CREATE TABLE IF NOT EXISTS shadow_decision_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES shadow_decision_observations(observation_id) ON DELETE RESTRICT,
  snapshot_id TEXT NOT NULL REFERENCES shadow_decision_snapshots(snapshot_id) ON DELETE RESTRICT,
  label_policy_identity JSONB NOT NULL,
  baseline_decision_ref TEXT NOT NULL,
  portfolio_decision_ref TEXT,
  risk_decision_ref TEXT,
  execution_result_ref TEXT,
  outcome_ref TEXT,
  counterfactual_provenance TEXT NOT NULL,
  scorable BOOLEAN NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  input_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_evaluations_dataset
  ON shadow_decision_evaluations (counterfactual_provenance, scorable, evaluated_at DESC);
