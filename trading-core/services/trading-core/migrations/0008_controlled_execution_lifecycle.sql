-- Migration 0008: Controlled Execution Lifecycle, Order State & Reconciliation
-- REQ-09 Canonical execution attempts, canonical orders, events, fills, observations, and reconciliation records

CREATE TABLE IF NOT EXISTS execution_attempts (
  attempt_id TEXT PRIMARY KEY,
  execution_intent_id TEXT NOT NULL,
  trading_intent_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  venue TEXT NOT NULL,
  environment TEXT NOT NULL,
  attempt_number INT NOT NULL,
  idempotency_key TEXT NOT NULL,
  client_order_id TEXT NOT NULL UNIQUE,
  provider_order_id TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_attempts_intent_attempt
  ON execution_attempts (execution_intent_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_execution_attempts_status
  ON execution_attempts (status);

CREATE INDEX IF NOT EXISTS idx_execution_attempts_strategy
  ON execution_attempts (strategy_id, strategy_revision_id);

CREATE TABLE IF NOT EXISTS canonical_orders (
  canonical_order_id TEXT PRIMARY KEY,
  execution_intent_id TEXT NOT NULL UNIQUE,
  execution_attempt_id TEXT NOT NULL,
  trading_intent_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_revision_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  venue TEXT NOT NULL,
  instrument TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  authorized_quantity TEXT NOT NULL,
  execution_quantity TEXT NOT NULL,
  cumulative_filled_quantity TEXT NOT NULL,
  remaining_quantity TEXT NOT NULL,
  weighted_average_price TEXT,
  state TEXT NOT NULL,
  order_version INT NOT NULL,
  client_order_id TEXT NOT NULL UNIQUE,
  provider_order_id TEXT,
  last_observation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canonical_orders_state
  ON canonical_orders (state);

CREATE INDEX IF NOT EXISTS idx_canonical_orders_client_id
  ON canonical_orders (client_order_id);

CREATE TABLE IF NOT EXISTS canonical_order_events (
  event_id TEXT PRIMARY KEY,
  canonical_order_id TEXT NOT NULL,
  order_version INT NOT NULL,
  previous_state TEXT NOT NULL,
  new_state TEXT NOT NULL,
  observation_id TEXT,
  rationale TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_order_events_version
  ON canonical_order_events (canonical_order_id, order_version);

CREATE TABLE IF NOT EXISTS canonical_fills (
  canonical_fill_id TEXT PRIMARY KEY,
  canonical_order_id TEXT NOT NULL,
  execution_intent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_trade_id TEXT NOT NULL,
  instrument TEXT NOT NULL,
  side TEXT NOT NULL,
  fill_quantity TEXT NOT NULL,
  fill_price TEXT NOT NULL,
  fee TEXT,
  fee_asset TEXT,
  provider_timestamp TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_fills_trade
  ON canonical_fills (canonical_order_id, provider_trade_id);

CREATE INDEX IF NOT EXISTS idx_canonical_fills_order
  ON canonical_fills (canonical_order_id);

CREATE TABLE IF NOT EXISTS provider_observations (
  observation_id TEXT PRIMARY KEY,
  observation_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  venue TEXT NOT NULL,
  client_order_id TEXT,
  provider_order_id TEXT,
  provider_trade_id TEXT,
  provider_status TEXT,
  observed_quantity TEXT,
  observed_price TEXT,
  observed_fee TEXT,
  observed_fee_asset TEXT,
  source TEXT NOT NULL,
  sequence_number BIGINT,
  observed_at TIMESTAMPTZ NOT NULL,
  provider_timestamp TIMESTAMPTZ,
  raw_payload_digest TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_observations_digest
  ON provider_observations (provider, raw_payload_digest);

CREATE INDEX IF NOT EXISTS idx_provider_observations_client_id
  ON provider_observations (client_order_id);

CREATE TABLE IF NOT EXISTS reconciliation_records (
  reconciliation_id TEXT PRIMARY KEY,
  canonical_order_id TEXT,
  client_order_id TEXT,
  provider_order_id TEXT,
  decision TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  reconciliation_version INT NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  discrepancy_details TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_records_order
  ON reconciliation_records (canonical_order_id);

