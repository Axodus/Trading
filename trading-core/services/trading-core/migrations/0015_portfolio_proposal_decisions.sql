CREATE TABLE IF NOT EXISTS trading_portfolio_proposal_decisions (
  proposal_id TEXT PRIMARY KEY,
  proposal_fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('CLAIMED', 'TERMINAL')),
  decision_payload JSONB,
  evaluation_payload JSONB,
  correlation_id TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  claimed_at TIMESTAMPTZ NOT NULL,
  lease_until TIMESTAMPTZ NOT NULL,
  terminal_at TIMESTAMPTZ,
  CHECK ((state = 'CLAIMED' AND decision_payload IS NULL AND evaluation_payload IS NULL)
      OR (state = 'TERMINAL' AND decision_payload IS NOT NULL AND evaluation_payload IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_portfolio_proposal_decisions_recovery
  ON trading_portfolio_proposal_decisions (state, lease_until);
