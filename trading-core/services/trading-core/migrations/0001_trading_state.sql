CREATE TABLE IF NOT EXISTS trading_events (
  sequence BIGSERIAL PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  source TEXT NOT NULL,
  dao_id TEXT,
  federation_id TEXT,
  user_id TEXT,
  strategy_id TEXT,
  strategy_product_id TEXT,
  runtime_instance_id TEXT,
  provider_id TEXT,
  payload JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_events_correlation_id ON trading_events (correlation_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_trading_events_user_id ON trading_events (user_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_trading_events_dao_id ON trading_events (dao_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_trading_events_runtime_instance_id ON trading_events (runtime_instance_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_trading_events_strategy_product_id ON trading_events (strategy_product_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_trading_events_provider_id ON trading_events (provider_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_trading_events_type ON trading_events (type, occurred_at, id);

CREATE TABLE IF NOT EXISTS trading_orders (
  provider_order_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  market TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trading_fills (
  fill_id TEXT PRIMARY KEY,
  provider_order_id TEXT NOT NULL,
  market TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity TEXT NOT NULL,
  price TEXT NOT NULL,
  fee JSONB,
  filled_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_fills_provider_order_id ON trading_fills (provider_order_id, filled_at, fill_id);

CREATE TABLE IF NOT EXISTS trading_positions (
  id BIGSERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  snapshot JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_positions_latest ON trading_positions (owner_id, captured_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS trading_portfolios (
  id BIGSERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  snapshot JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_portfolios_latest ON trading_portfolios (owner_id, captured_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS trading_runtime_instances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_product_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  execution_domain TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trading_provider_state (
  provider_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  detail TEXT,
  payload JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trading_runtime_audit (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  actor TEXT NOT NULL,
  execution_domain TEXT,
  user_id TEXT,
  dao_id TEXT,
  runtime_instance_id TEXT,
  provider_id TEXT,
  strategy_id TEXT,
  strategy_product_id TEXT,
  rejection_reason TEXT,
  detail TEXT,
  payload JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_runtime_audit_correlation_id ON trading_runtime_audit (correlation_id, occurred_at, id);
