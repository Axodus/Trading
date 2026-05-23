ALTER TABLE trading_events
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_trading_events_tenant_id ON trading_events (tenant_id, occurred_at, id);
