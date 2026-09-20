# AXODUS-TRADING-VAL-11-PG — Real PostgreSQL Durable Performance Drift & Revalidation Acceptance

**Status:** `COMPLETE / PASS / CTO REVIEW REQUIRED`  
**Date:** 2026-09-20  
**Parent Gate:** `AXODUS-TRADING-EPIC-01 / REQ-11` (Strategy Performance Evaluation, Drift Detection & Controlled Revalidation)  
**PostgreSQL Target:** Real containerized PostgreSQL 18 (`127.0.0.1:55433`, database `axodus_trading_local`)  
**Environment:** Local Integration / Testnet Guarded / Simulated Transport  
**Live Order Submission:** `PROHIBITED`  
**Mainnet:** `PROHIBITED`  
**Real Capital:** `PROHIBITED`  
**Production/Customer Credentials:** `PROHIBITED`  

---

## 1. Executive Summary

This validation gate certifies the durable canonical Strategy Performance Evaluation, Drift Detection, and Controlled Revalidation Authority for `REQ-11` by executing an end-to-end 12-gate acceptance test suite against the **real PostgreSQL container** (`NodePostgresClient` on port `55433`). It empirically proves:
1. Clean application of migration `0010_performance_drift_revalidation.sql` creating tables `expected_performance_envelopes`, `performance_evaluations`, `performance_metric_deviations`, `performance_drift_assessments`, `performance_metric_assessments`, `revalidation_requests`, and `revalidation_request_events`.
2. Exact column mapping and durable persistence for `ExpectedPerformanceEnvelope` with expected metrics, evidence references, dataset references, and environment applicability.
3. Durable persistence and relational querying of `PerformanceEvaluation` and granular `performance_metric_deviations` across slippage, fees, fill ratios, latency, and net PnL.
4. Durable persistence and relational querying of `PerformanceDriftAssessment` and granular `performance_metric_assessments` preserving multi-dimensional drift classifications (`ECONOMIC`, `EXECUTION`, `COST`, `LATENCY`, `FILL_QUALITY`, `DATA_QUALITY`).
5. Revalidation request creation with transactional outbox event emission (`RevalidationRequested`, `PerformanceEvaluationCreated`, `PerformanceDriftDetected`) into `trading_execution_outbox`.
6. Mandatory concurrency protection: two concurrent workers attempting active revalidation requests for the same strategy revision converge to exactly **1** active `RevalidationRequest` in PostgreSQL via unique partial index `idx_unique_active_revalidation` and optimistic conflict resolution.
7. Durable idempotent replay returning existing evaluation, assessment, and request records on identical input digests without row duplication.
8. Idempotency conflict detection throwing typed `PerformanceIdempotencyConflictError` when an altered input digest is submitted for an existing entity.
9. Connection pool disconnect/reconnect state survival across pool restarts.
10. Process and repository restart persistence, enabling service reconstruction without loss of lookup or replay capabilities.
11. Transaction rollback on simulated failure injection during evaluation/request insertion leaving zero partial state in PostgreSQL.
12. Append-only status transition and audit history logging (`RevalidationStatusUpdatedTo_COMPLETED`) in `revalidation_request_events`.

Zero in-memory mocks were used for this database acceptance suite.

---

## 2. Gate-by-Gate Verification Matrix

| Gate | Target Capability | Result | Real PostgreSQL Evidence |
|---|---|---|---|
| **Gate 1** | Migration 0010 Application & Table Existence | `PASS` | Tables `expected_performance_envelopes`, `performance_evaluations`, `performance_metric_deviations`, `performance_drift_assessments`, `performance_metric_assessments`, `revalidation_requests`, `revalidation_request_events`, and indexes confirmed in `information_schema.tables`. |
| **Gate 2** | ExpectedPerformanceEnvelope Persistence & Column Mapping | `PASS` | Persisted `ExpectedPerformanceEnvelope` with `expectedMetrics`, `strategyEvidenceRefs`, `datasetRefs`, `environmentApplicability: ["SIMULATED", "TESTNET"]`, and `evidenceStrength: VALIDATED`. Verified direct SQL column round-trip. |
| **Gate 3** | PerformanceEvaluation & Deviations Persistence | `PASS` | Persisted `PerformanceEvaluation` with `sampleSize: 15`, `quality: COMPLETE`, and 5 distinct metric deviations in `performance_metric_deviations`. Verified relational join and exact decimal values. |
| **Gate 4** | PerformanceDriftAssessment & Metric Assessments | `PASS` | Persisted `PerformanceDriftAssessment` with `classification: MATERIAL`, `driftDimensions: ["ECONOMIC", "EXECUTION", "COST"]`, and 5 metric-level assessments. Verified relational query. |
| **Gate 5** | RevalidationRequest & Outbox Atomicity | `PASS` | Persisted `RevalidationRequest` with `requestedValidationScope: ["ECONOMIC_ASSUMPTIONS", "EXECUTION_ASSUMPTIONS", "COST_MODEL"]`, status `REQUESTED`, and atomical `RevalidationRequested` event written to `trading_execution_outbox`. |
| **Gate 6** | Two-Worker Concurrency Gate | `PASS` | Two concurrent workers evaluating identical material drift concurrently called `recordRevalidationRequestTransaction`. Verified exactly **1** record inserted; second worker received existing active request without crash. |
| **Gate 7** | Durable Idempotency Replay | `PASS` | Exact replay of evaluation, drift assessment, and revalidation request returned identical records with identical IDs without duplicate SQL insertions. |
| **Gate 8** | Idempotency Conflict Detection | `PASS` | Submitting an altered digest for an existing evaluation ID strictly threw typed `PerformanceIdempotencyConflictError`. |
| **Gate 9** | Disconnect + Reconnect Survival | `PASS` | Connection pool drained and re-opened; queried all tables and verified 100% data integrity and relationship survival. |
| **Gate 10** | Process / Repository Restart Persistence | `PASS` | Instantiated completely new `PostgresPerformanceDriftRepository` instances; verified replay and lookup operations succeeded without data loss. |
| **Gate 11** | Transaction Rollback / Failure Injection | `PASS` | Injected intentional DB error during batch insertion of deviations. Verified complete transaction rollback with zero orphan evaluations or outbox records. |
| **Gate 12** | Status Transition & Audit Trail | `PASS` | Transitioned revalidation request from `REQUESTED` to `IN_PROGRESS` to `COMPLETED` with Quant StrategyEvidence references. Verified append-only audit trail in `revalidation_request_events`. |

---

## 3. Test Command & Execution Output

```bash
cd trading-core/services/trading-core && node --test test/val-11-postgres-acceptance.test.mjs
```

```
▶ AXODUS-TRADING-EPIC-01 / VAL-11-PG — Real PostgreSQL Durable Performance Drift & Revalidation Acceptance
  ✔ Gate 1: Migration 0010 applies cleanly and all 7 tables exist in PostgreSQL (35.460903ms)
  ✔ Gate 2: ExpectedPerformanceEnvelope persistence & exact column mapping round-trip in real PostgreSQL (14.79516ms)
  ✔ Gate 3: PerformanceEvaluation & metric deviations persistence & querying in real PostgreSQL (25.777703ms)
  ✔ Gate 4: PerformanceDriftAssessment & metric assessments persistence with dimensions in real PostgreSQL (54.580891ms)
  ✔ Gate 5: RevalidationRequest creation with transactional outbox event emission in real PostgreSQL (39.51774ms)
  ✔ Gate 6: Concurrency protection — two workers attempting active revalidation requests converge to 1 active in PostgreSQL (62.122314ms)
  ✔ Gate 7: Durable idempotent replay on identical digests returns existing records without duplicate insert (7.140042ms)
  ✔ Gate 8: Idempotency conflict throws PerformanceIdempotencyConflictError on altered digest (10.306862ms)
  ✔ Gate 9: Disconnect + Reconnect — state survives across pool lifecycle in real PostgreSQL (28.751926ms)
  ✔ Gate 10: Process / Repository restart — new repository instance preserves replay & lookup in real PostgreSQL (8.956859ms)
  ✔ Gate 11: Transaction rollback / failure injection leaves zero partial state in real PostgreSQL (6.482821ms)
  ✔ Gate 12: Status transition and event append-only audit trail (RevalidationStatusUpdatedTo_COMPLETED) (53.865102ms)
✔ AXODUS-TRADING-EPIC-01 / VAL-11-PG — Real PostgreSQL Durable Performance Drift & Revalidation Acceptance (524.106295ms)
```

---

## 4. Invariant Compliance

1. **Exact StrategyRevision Binding:** `strategyRevision` is strictly bound across envelope, evaluation, assessment, and revalidation request.
2. **Sample Sufficiency Invariant:** `INSUFFICIENT_DATA != NORMAL`. Sample size below `minSampleSize` is strictly marked `INSUFFICIENT_DATA`.
3. **Missing Data Invariant:** Missing metrics result in `UNAVAILABLE` deviations (never defaulted to zero).
4. **No Governance Usurpation:** Does not mutate `StrategyHealth`, `StrategyLifecycleState`, `RiskPolicy`, or `Portfolio` capital allocations.
5. **Two-Worker Deduplication:** Unique index `idx_unique_active_revalidation` prevents multiple active requests for the same strategy revision.
6. **Zero External Mutation:** No exchange orders, zero mainnet calls, zero real capital, zero credentials exposed.

**Verdict:** `VAL-11-PG: PASS / CERTIFIED`
