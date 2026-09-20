CREATE TABLE IF NOT EXISTS strategy_lifecycle_heads (
  strategy_id TEXT PRIMARY KEY,
  current_revision_id TEXT NOT NULL,
  current_state TEXT NOT NULL,
  lifecycle_version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL,
  last_transition_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_strategy_lifecycle_heads_state
  ON strategy_lifecycle_heads (current_state, updated_at);

CREATE TABLE IF NOT EXISTS strategy_lifecycle_transitions (
  transition_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  previous_version BIGINT NOT NULL,
  new_version BIGINT NOT NULL,
  policy_revision TEXT NOT NULL,
  eligibility_ref TEXT,
  authorization_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision TEXT NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key TEXT NOT NULL,
  command_hash TEXT NOT NULL,
  rationale TEXT,
  requested_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_lifecycle_transitions_strategy
  ON strategy_lifecycle_transitions (strategy_id, new_version DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_lifecycle_transitions_idempotency
  ON strategy_lifecycle_transitions (strategy_id, idempotency_key);

CREATE TABLE IF NOT EXISTS strategy_lifecycle_policies (
  policy_revision TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  default_max_eligibility_age_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
