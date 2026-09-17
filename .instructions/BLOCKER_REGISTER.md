# Trading Blocker Register

Last updated: 2026-06-08

## TRADING-BLOCKER-001 - Live Trading Blocked

Severity: CRITICAL

Status: OPEN

Description: Live trading, real CEX execution and withdrawals are not approved.

Impact: Trading remains local/paper-planning only.

Resolution path: Require governance, risk, compliance, audit and operator approval before any execution track.

## TRADING-BLOCKER-002 - Production Credentials Blocked

Severity: CRITICAL

Status: OPEN

Description: Production exchange keys, secrets, Credential Vault/KMS/HSM runtime and withdrawal authority are not approved.

Impact: No production exchange integration can be enabled.

Resolution path: Complete Credential Vault decisioning and secret-management approval.

## TRADING-BLOCKER-003 - Current Validation Refresh Required

Severity: MEDIUM

Status: RESOLVED

Description: Historical local E2E evidence exists, but current validation was not rerun in PORTFOLIO-REQ-01.

Impact: Resolved for local durable persistence/readiness evidence.

Resolution path: TRADING-REQ-04 ran `npm run trading:local:e2e -- --json --cleanup` successfully against local Postgres.

## TRADING-BLOCKER-004 - Root Package Boundary

Severity: LOW

Status: ACTIVE

Description: The Trading root workspace does not expose a root `package.json`. Validation commands are nested under `trading-core/services/trading-core`.

Impact: Operators must run validation from the documented nested service path.

Resolution path: Keep documented nested validation path, or create a root orchestration script only through a separate approved non-product request.

## PORTFOLIO-REQ-02 Blocker Review

| Blocker | Status |
|---|---|
| Live trading blocked | ACTIVE |
| Production credentials blocked | ACTIVE |
| Current validation refresh required | RESOLVED |
| Root `package.json` absent | ACTIVE |
| Real local Postgres E2E not executed | RESOLVED |

## TRADING-REQ-04 Blocker Review

| Blocker | Status |
|---|---|
| Live trading blocked | ACTIVE |
| Production credentials blocked | ACTIVE |
| Current validation refresh required | RESOLVED |
| Root `package.json` absent | ACTIVE |
| Real local Postgres E2E not executed | RESOLVED |
| Production database execution blocked | ACTIVE |
| Treasury movement blocked | ACTIVE |

## AXODUS-TRADING-BLOCKER-01 - Hummingbot WebSocket Authentication Compatibility

Severity: HIGH

Status: OPEN

Description: `hummingbot-api-client v1.5.9` opens WebSocket connections with a query-token path, while the current Hummingbot API server authenticates through `Authorization: Basic` or the `hummingbot-auth` subprotocol. The audited client path is therefore not admitted.

Impact: WebSocket-dependent market-data and runtime capabilities cannot be used by Axodus IMP-01. HTTP execution and offline contract validation remain available on the restricted baseline.

Resolution path: Perform a separate compatibility decision covering transport adaptation, upstream alignment or dependency-baseline change. Do not patch upstream opportunistically, implement a compatibility shim during IMP-01A/B/C, or treat WebSocket availability as implicit.

Preserved boundary: Hummingbot remains an operational substrate; Axodus owns the adapter, authorization, risk, order-intent and capital boundaries.

### BLOCKER-01 remediation design — 2026-09-17

The materialized client `v1.5.9` hard-codes a `?token=...` WebSocket URL in `hummingbot_api_client/ws.py`. The materialized server `2494e847…` authenticates before handshake acceptance through `Authorization: Basic` or the `hummingbot-auth` subprotocol and deliberately ignores query-string credentials/tokens. The client has no configuration hook that changes this authentication mode.

Option assessment:

- `CONFIGURE`: rejected for the current source; no authentication-mode setting exists.
- `ADAPT AXODUS TRANSPORT`: preferred future candidate if streaming is required; not selected or implemented.
- `UPDATE DEPENDENCY`: candidate only after a new source and compatibility-triangle review.
- `UPSTREAM FIX`: candidate only through an explicitly reviewed upstream change and revision freeze.
- `KEEP BLOCKED`: current decision and safe operating state.

Condor calls the same client WebSocket surfaces and has reconnect/backoff behavior, but that cannot repair a handshake rejected before the stream is established. HTTP remains admitted for the published IMP-01 path. WebSocket market data remains unavailable to Axodus; `IMP-01D-HTTP` is complete and streaming remains deferred.

Detailed record: `.instructions/TRADING_BLOCKER_01_REMEDIATION_DESIGN.md`.


## AXODUS-TRADING-BLOCKER-02 - Provider Identity and Unknown-Outcome Reconciliation Gap

Severity: HIGH

Status: OPEN / IMPLEMENTATION BLOCKER ONLY / CEX FEASIBILITY RESOLVED

Description: CEX identity continuity is now represented in the Axodus lifecycle foundation for the accepted Binance Spot and Binance Perpetual capability model. The remaining blocker is implementation validation of exact REST reconciliation, recovery and lifecycle semantics before operational use.

Impact: Until VAL-02B is accepted, PROVIDER_EXECUTION_UNKNOWN recovery and restart behavior remain unvalidated for operational use. Gateway/DEX remains outside the CEX identity model.

Resolution path: execute and accept VAL-02B for acknowledged, rejected, ambiguous, exact-found, exact-not-found, indeterminate, cancellation and restart/recovery semantics. Do not add blind retry or infer exactly-once semantics.

Preserved boundary: Axodus owns order intent, idempotency, lifecycle, reconciliation, risk, accounting and capital authority. Hummingbot remains an operational substrate; Condor cannot bypass the boundary.

Detailed record: .instructions/TRADING_REQ_06_EXECUTION_STATE_RECONCILIATION_IDEMPOTENCY_FREEZE.md.

IMP-02B implementation record: `.instructions/TRADING_IMP_02B_CEX_LIFECYCLE_RECONCILIATION.md`.

### AXODUS-TRADING-REQ-07 source audit — 2026-09-17

The materialized source confirms that `clientOrderId` is accepted at the Axodus contract boundary but is dropped by `HummingbotHttpExecutionProvider`. The client `TradeRequest`, server `TradeRequest`, API router and account/trading services contain no caller-supplied identity field and call connector `buy/sell` without one. Hummingbot persistence stores provider-generated `client_order_id` values, but that does not establish continuity from Axodus.

The concrete Hummingbot Core connector package is not materialized or revision-pinned in the workspace, so caller-ID acceptance, venue preservation and exact exchange lookup remain unverified. The current classification is `IDENTITY PROPAGATION NOT RELIABLE / IMP-02 REMAINS BLOCKED`.

The selected direction remains `AXODUS-CONTROLLED CLIENT ORDER ID PROPAGATION`. No shim, upstream modification, connector modification, heuristic lookup or retry behavior is authorized by this audit.

Detailed record: `.instructions/TRADING_REQ_07_PROVIDER_ORDER_IDENTITY_PROPAGATION_FEASIBILITY.md`.

### VAL-02B validation result — 2026-09-17

The offline validation passed the in-process deterministic CEX lifecycle cases, including exact identity reconciliation, no-blind-retry behavior, cancellation ambiguity, terminal protection, connector admission, Gateway/DEX exclusion, WebSocket independence and snapshot-equivalent recovery. The current implementation still uses an in-memory lifecycle repository; durable persistence, crash recovery and cross-process atomicity remain unvalidated.

Classification: `CEX RECONCILIATION PARTIALLY VALIDATED / BLOCKER-02 REMAINS OPEN`.

The blocker is not closed by this validation. A future authorized increment must establish durable execution-state persistence and validate restart/recovery semantics before operational readiness.

Detailed record: `.instructions/TRADING_VAL_02B_OFFLINE_CEX_LIFECYCLE_RECONCILIATION.md`.
