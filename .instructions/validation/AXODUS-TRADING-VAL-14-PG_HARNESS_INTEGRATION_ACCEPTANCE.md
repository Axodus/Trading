# AXODUS-TRADING-VAL-14-PG — Real PostgreSQL Durable Trading Harness Acceptance

**Status:** `COMPLETE / PASS / CTO REVIEW REQUIRED`  
**Date:** 2026-09-20  
**Parent Gate:** `AXODUS-TRADING-EPIC-01 / REQ-14` (Autonomous Trading Harness Integration, End-to-End Paper/Testnet Control Loop & Readiness Gate)  
**PostgreSQL Target:** Real containerized PostgreSQL 18 (`127.0.0.1:55433`, database `axodus_trading_local`)  
**Environment:** Local Integration / Paper / Testnet Guarded  
**Mainnet:** `PROHIBITED`  
**Real Capital:** `PROHIBITED`  
**Production/Customer Credentials:** `PROHIBITED`  

---

## 1. Executive Summary

This validation gate certifies the durable persistence, outbox atomicity, CAS concurrency control, worker fencing, and restart durability for the canonical `TradingHarnessCoordinator` and `TradingHarnessRun` integration layer against the **real PostgreSQL container** (`NodePostgresClient` on port `55433`).

Empirically verified gates:
1. Clean execution of migration `0013_trading_harness_integration.sql` adding tables `trading_harness_runs`, `harness_stage_transitions`, `harness_evidence_packages`, and `harness_readiness_assessments` with partial unique index `idx_unique_active_harness_run`.
2. Full lifecycle persistence for `TradingHarnessRun` across all 17 monotonic stages (`MARKET_INGESTION` -> `COMPLETE`) with stage transition logging.
3. Durable idempotent replay returning identical run references without duplicate insertion.
4. Strict typed conflict rejection (`HarnessRunIdempotencyConflictError`) on altered payloads with matching idempotency keys.
5. Two-worker run concurrency: concurrent workers attempting active runs for the same strategy revision and environment converge to exactly **1** active record in PostgreSQL.
6. Worker fencing and token lease validation, rejecting stale lease tokens (`HarnessFencingTokenError`) and preventing split-brain execution.
7. Restart durability: complete state reconstruction across process/repository restart with zero state loss or duplicate economic mutation.
8. Transaction rollback on failure injection leaving zero orphan state in PostgreSQL.
9. Outbox atomicity: `HarnessRunCreated`, `HarnessStageTransitioned`, and `HarnessRunCompleted` committed atomically with run records.
10. Cross-domain reference integrity and full provenance package reconstruction.
11. Authority non-bypass: proving structurally and empirically that `PostgresTradingHarnessRepository` exposes zero direct mutation methods to sovereign domain tables.

---

## 2. Gate-by-Gate Verification Matrix

| Gate | Target Capability | Result | Real PostgreSQL Evidence |
|---|---|---|---|
| **Gate 1** | Migration 0013 Application | `PASS` | Tables `trading_harness_runs`, `harness_stage_transitions`, `harness_evidence_packages`, `harness_readiness_assessments` confirmed in `information_schema.tables`. |
| **Gate 2** | HarnessRun Persistence & Column Mapping | `PASS` | Persisted run across 17 stages with exact timestamp, version, and inputDigest round-trip. |
| **Gate 3** | Stage Transition Logging & Ordering | `PASS` | Sequential stage transitions recorded with monotonic ordering and duration tracking. |
| **Gate 4** | Durable Idempotent Replay | `PASS` | Replaying identical payload digests returned existing run record without duplicate insert. |
| **Gate 5** | Idempotency Conflict Detection | `PASS` | Replaying modified payload triggered `HarnessRunIdempotencyConflictError`. |
| **Gate 6** | Two-Worker Run Concurrency | `PASS` | Two concurrent workers converged to 1 active run via `idx_unique_active_harness_run`. |
| **Gate 7** | Worker Fencing & Lease Tokens | `PASS` | Stale fencing tokens rejected with `HarnessFencingTokenError`. |
| **Gate 8** | Restart after PortfolioDecision | `PASS` | State reconstructed accurately from PostgreSQL with zero duplicate allocation. |
| **Gate 9** | Restart after RiskDecision | `PASS` | State reconstructed accurately with Risk authorization preserved. |
| **Gate 10** | Restart after TradingIntent | `PASS` | Single-use TradingIntent integrity preserved across restart. |
| **Gate 11** | Restart after Execution Reservation | `PASS` | Execution attempt reservation verified intact without resubmission. |
| **Gate 12** | Restart during SUBMITTED_UNKNOWN | `PASS` | Ambiguous state preserved without blind resubmission. |
| **Gate 13** | Restart after Reconciliation | `PASS` | Canonical order and fill state reconstructed accurately. |
| **Gate 14** | Restart during Governance Intervention | `PASS` | Multi-authority intervention plan state reconstructed with zero duplicate requests. |
| **Gate 15** | Restart while Kill-Switch ACTIVE | `PASS` | System safety kill latching preserved across restart; new run blocked. |
| **Gate 16** | Outbox Atomicity & Rollback | `PASS` | Outbox events committed atomically with run state; failure injection produced 0 orphan rows. |
