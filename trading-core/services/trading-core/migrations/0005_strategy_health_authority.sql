CREATE TABLE IF NOT EXISTS strategy_health_heads (
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  health_state TEXT NOT NULL,
  health_version BIGINT NOT NULL DEFAULT 0,
  effective_at TIMESTAMPTZ NOT NULL,
  evaluation_policy_revision TEXT NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  previous_health_version BIGINT,
  last_transition_id TEXT,
  PRIMARY KEY (strategy_id, strategy_revision_id)
);

CREATE TABLE IF NOT EXISTS strategy_health_transitions (
  transition_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  previous_health TEXT NOT NULL,
  new_health TEXT NOT NULL,
  previous_version BIGINT NOT NULL,
  new_version BIGINT NOT NULL,
  policy_revision TEXT NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  authorization_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_hash TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_health_transitions_idempotency
  ON strategy_health_transitions (strategy_id, strategy_revision_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_strategy_health_transitions_history
  ON strategy_health_transitions (strategy_id, strategy_revision_id, new_version ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS strategy_health_policies (
  policy_revision TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rules JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_operational_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  lifecycle_version BIGINT NOT NULL,
  health_state TEXT NOT NULL,
  health_version BIGINT NOT NULL,
  compatibility TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  snapshot_version TEXT NOT NULL,
  UNIQUE (strategy_id, strategy_revision_id, lifecycle_version, health_version)
);
