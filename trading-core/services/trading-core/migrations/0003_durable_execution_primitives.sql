CREATE TABLE IF NOT EXISTS trading_submission_attempts (
  attempt_id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  connector TEXT NOT NULL,
  market TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  quantity TEXT NOT NULL,
  price TEXT,
  execution_client_order_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  provider_order_id TEXT,
  evidence JSONB,
  last_failure TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trading_submission_attempts_recovery
  ON trading_submission_attempts (state, updated_at, attempt_id);

CREATE TABLE IF NOT EXISTS trading_execution_outbox (
  outbox_id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  aggregate_version BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  UNIQUE (aggregate_id, aggregate_version, event_type)
);

CREATE INDEX IF NOT EXISTS idx_trading_execution_outbox_unpublished
  ON trading_execution_outbox (published_at, created_at, outbox_id);
