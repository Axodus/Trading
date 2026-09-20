# AXODUS-TRADING-VAL-07D-PG — Real PostgreSQL Durable Pre-Execution Acceptance

**Status:** `COMPLETE / PASS / CTO REVIEW REQUIRED`  
**Date:** 2026-09-20  
**Parent Gate:** `AXODUS-TRADING-EPIC-01 / REQ-07D` (Canonical TradingIntent & Pre-Execution Authorization Boundary)  
**Baseline Commit:** `0614264e93fe21587c021abeb21eaca89caa139e`  
**PostgreSQL Target:** Real containerized PostgreSQL 18 (`127.0.0.1:55433`, database `axodus_trading_local`)  
**Environment:** Local Integration / Testnet Prep  
**Mainnet:** `PROHIBITED`  
**Real Capital:** `PROHIBITED`  

---

## 1. Executive Summary

This validation gate resolves the CTO validation gap for `REQ-07D` by executing an end-to-end, 11-gate test suite against the **real PostgreSQL container** (`NodePostgresClient` on port `55433`). It empirically proves migration application, column mapping, durable persistence, idempotent replay, idempotency conflict rejection, single-use `RiskDecision` consumption, two-worker concurrency with PostgreSQL unique constraint enforcement, transaction rollback on failure injection, transactional outbox atomicity, connection pool disconnect/reconnect survival, service/repository restart persistence, and complex `FixedDecimal` `MODIFY` arithmetic durability.

Zero in-memory mocks were used for this acceptance suite.

---

## 2. Gate-by-Gate Verification Matrix

| Gate | Target Capability | Result | PostgreSQL Evidence |
|---|---|---|---|
| **Gate 1** | Migration 0006 Application & Table Existence | `PASS` | Tables `trading_intents`, `pre_execution_authorizations`, and `trading_execution_outbox` confirmed in `information_schema.tables`. Index `idx_trading_intents_risk_decision` confirmed unique in `pg_indexes`. |
| **Gate 2** | Full Column Mapping & Persistence | `PASS` | `PreExecutionAuthorizationService` persisted record + intent. Direct SQL verified all fields: `strategy_id`, `strategy_revision_id`, `decision`, `effective_capital`, `effective_size`, `effective_leverage`, `expires_at`, `risk_decision_id`, `portfolio_decision_id`. |
| **Gate 3** | Durable Idempotent Replay | `PASS` | Exact command replay returned identical `TradingIntent`. Direct SQL query confirmed row count in `trading_intents` remained exactly 1 (no duplicate row created). |
| **Gate 4** | Idempotency Conflict Rejection | `PASS` | Replay with identical `idempotencyKey` but altered proposal payload threw typed `PreExecutionIdempotencyConflictError`. |
| **Gate 5** | Single-Use `RiskDecision` Consumption | `PASS` | Second independent command attempting to consume the already-consumed `riskDecisionId` returned `decision: 'CONFLICT'` with reason code `AUTHORIZATION_ALREADY_CONSUMED`. Zero duplicate intent inserted. |
| **Gate 6** | Two-Worker Concurrency & Unique Constraints | `PASS` | Concurrent execution via `Promise.allSettled` of two workers presenting identical RiskDecision resulted in exactly 1 `AUTHORIZED` intent and 1 rejected/conflict. `COUNT(*)` in `trading_intents` strictly 1. |
| **Gate 7** | Transaction Rollback & Failure Injection | `PASS` | Injected failure during intent insertion triggered full transaction rollback. Direct SQL confirmed 0 rows in `pre_execution_authorizations`, `trading_intents`, and `trading_execution_outbox`. |
| **Gate 8** | Outbox Atomicity | `PASS` | `TradingIntentCreated` event committed atomically in `trading_execution_outbox` within the same transaction as the intent and authorization record. |
| **Gate 9** | Disconnect & Reconnect | `PASS` | Client pool closed and reopened with fresh connection. Previous intent and authorization records queried and verified fully intact. |
| **Gate 10** | Process / Repository Restart | `PASS` | Completely fresh instances of `PostgresPreExecutionAuthorizationRepository` and `PreExecutionAuthorizationService` initialized. Exact lookup and idempotent replay verified without data corruption. |
| **Gate 11** | Multi-Strategy & `MODIFY` Exact Arithmetic Durability | `PASS` | Tested `FixedDecimal` arithmetic under Risk `MODIFY` (capital reduced from 100 to 40, leverage 1.5, quantity scaled to 0.002000000000). Durably stored and retrieved across distinct strategies with exact 12-decimal precision. |

---

## 3. Test & Regression Evidence

- **Dedicated PostgreSQL Suite:** `trading-core/services/trading-core/test/val-07d-postgres-acceptance.test.mjs` — **11/11 tests PASS** (100% green)
- **Full Trading Core Regression:** `npm --prefix trading-core/services/trading-core test` — **33/33 test files PASS** (526 passed, 0 failed, 1 skipped)
- **TypeScript Typecheck:** `npm --prefix trading-core/services/trading-core run typecheck` — **PASS** (0 errors)
- **TypeScript Build:** `npm --prefix trading-core/services/trading-core run build` — **PASS** (0 errors)
- **Python Quant Lab Regression:** `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — **45/45 tests PASS** (100% green)
- **Git Diff Hygiene:** `git diff --check` & `git -C quants-lab diff --check` — **PASS** (0 errors)

---

## 4. Safety & Operational Accounting

```yaml
exchangeOrderPost: 0
exchangeOrderDelete: 0
dexTransactionSigning: 0
hummingbotLiveExecution: 0
condorLiveExecution: 0
webSocketLiveExecution: 0
executionIntentEmitted: 0
mainnetMutation: 0
realCapital: 0
productionCredentialsUsed: 0
customerCredentialsUsed: 0
secretsExposed: false
```

---

## 5. Residual Risk & Program Status

- **`DEBT-AUD-A-03`**: Remains `OPEN / PARTIALLY REMEDIATED`. The durable idempotency implemented in `PostgresPreExecutionAuthorizationRepository` guarantees that duplicate execution requests at the pre-execution boundary cannot produce duplicate `TradingIntent`s or duplicate outbox events. Full resolution of `DEBT-AUD-A-03` at the upstream Portfolio allocation tier remains scheduled for future portfolio hardening.
- **Next Program Gate:** Advancement to Execution Boundary / ExecutionIntent integration gates upon CTO acceptance of `VAL-07D-PG` and closure of `REQ-07D`.
