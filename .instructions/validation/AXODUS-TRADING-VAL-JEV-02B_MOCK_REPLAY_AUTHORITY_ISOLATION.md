# AXODUS-TRADING-VAL-JEV-02B — Mock, Replay and Authority Isolation

**Status:** PASS

`DeterministicMockDecisionProvider` covers fixed, delayed, timeout, provider error, malformed, duplicate and stale outcomes. `ShadowDecisionDispatcher.enqueue` does not await provider or persistence work. Queue saturation returns `DROPPED`; missing adapter returns `DISABLED`; worker and persistence failures increment experimental telemetry and do not alter the canonical result.

Acceptance evidence:

- delayed provider does not delay construction/use of the baseline decision;
- provider and persistence failure leave Portfolio/Risk baseline values unchanged;
- disabled/removed provider leaves canonical input identity unchanged;
- duplicate/stale responses remain shadow statuses;
- shadow contracts expose no authoritative Portfolio, Risk, TradingIntent, ExecutionIntent or provider-order identity;
- PostgreSQL stores append-only snapshot/observation/evaluation evidence with idempotency conflicts and transactional outbox records.

Real PostgreSQL focused validation: 2/2 PASS. Provider-neutral focused validation: 12/12 PASS.
