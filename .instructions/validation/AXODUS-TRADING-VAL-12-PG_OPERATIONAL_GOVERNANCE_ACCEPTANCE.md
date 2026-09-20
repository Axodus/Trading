# AXODUS-TRADING-VAL-12-PG — Real PostgreSQL Durable Operational Governance Acceptance

**Status:** `COMPLETE / PASS / CTO REVIEW REQUIRED`  
**Date:** 2026-09-20  
**Parent Gate:** `AXODUS-TRADING-EPIC-01 / REQ-12` (Strategy Operational Governance, Revalidation Resolution & Controlled Intervention)  
**PostgreSQL Target:** Real containerized PostgreSQL 18 (`127.0.0.1:55433`, database `axodus_trading_local`)  
**Environment:** Local Integration / Testnet Guarded / Simulated Transport  
**Live Order Submission:** `PROHIBITED`  
**Mainnet:** `PROHIBITED`  
**Real Capital:** `PROHIBITED`  
**Production/Customer Credentials:** `PROHIBITED`  

---

## 1. Executive Summary

This validation gate certifies the durable canonical Strategy Operational Governance, Revalidation Resolution, and Controlled Intervention Coordination Authority for `REQ-12` by executing an end-to-end 16-gate acceptance test suite against the **real PostgreSQL container** (`NodePostgresClient` on port `55433`). It empirically proves:
1. Clean application of migration `0011_strategy_operational_governance.sql` creating tables `strategy_governance_snapshots`, `strategy_governance_decisions`, `strategy_intervention_plans`, `strategy_intervention_requests`, `strategy_intervention_responses`, `strategy_intervention_resolutions`, and `strategy_governance_policies`.
2. Exact column mapping and durable persistence for `StrategyGovernanceSnapshot` capturing multi-domain canonical state (`lifecycleState`, `lifecycleVersion`, `healthState`, `healthVersion`, `operationalSnapshotId`, `driftAssessmentId`, `driftClassification`, `revalidationRequestId`, `revalidationOutcomeRef`).
3. Durable persistence and relational querying of deterministic `StrategyGovernanceDecision` bound to exact policy revision, reason codes, and required interventions.
4. Durable idempotent replay returning existing snapshots, decisions, plans, and requests on identical input digests without row duplication.
5. Idempotency conflict detection throwing typed `GovernanceIdempotencyConflictError` when an altered input digest is submitted for an existing entity.
6. Mandatory concurrency protection: two concurrent workers evaluating identical material drift and requesting revalidation intervention converge to exactly **1** active `StrategyInterventionRequest` in PostgreSQL via unique partial index `idx_unique_active_intervention_request` and optimistic conflict handling.
7. Multi-authority `StrategyInterventionPlan` persistence, dependency modeling, and step-level status tracking.
8. Authority response persistence (`StrategyInterventionResponse`) and atomic transactional outbox event emission (`StrategyInterventionApplied`, `StrategyInterventionRejected`) into `trading_execution_outbox`.
9. Intervention resolution persistence (`StrategyInterventionResolution`) with explicit representation of `PARTIALLY_APPLIED` and `RESOLVED` states.
10. Connection pool disconnect/reconnect state survival across pool restarts.
11. Process and repository restart persistence, enabling service reconstruction without loss of lookup or replay capabilities.
12. Transaction rollback on simulated failure injection during multi-entity insertion leaving zero partial state in PostgreSQL.
13. Stale snapshot rejection (TOCTOU protection in database context) enforcing strict version matching against live operational heads.
14. Authority non-bypass verification: proving mathematically and structurally that `PostgresStrategyOperationalGovernanceRepository` has zero direct write methods to `strategy_health_heads`, `strategy_lifecycle_heads`, `risk_decisions`, `portfolio_allocations`, or order execution tables.
15. Outbox atomicity: `StrategyGovernanceEvaluated`, `StrategyInterventionRequested`, `StrategyInterventionApplied`, and `StrategyInterventionResolved` events committed atomically with governance entities.
16. Intervention resolution convergence without infinite loops, properly distinguishing partial multi-authority execution from complete resolution.

Zero in-memory mocks were used for this database acceptance suite.

---

## 2. Gate-by-Gate Verification Matrix

| Gate | Target Capability | Result | Real PostgreSQL Evidence |
|---|---|---|---|
| **Gate 1** | Migration 0011 Application & Table Existence | `PASS` | Tables `strategy_governance_snapshots`, `strategy_governance_decisions`, `strategy_intervention_plans`, `strategy_intervention_requests`, `strategy_intervention_responses`, `strategy_intervention_resolutions`, `strategy_governance_policies`, and indexes confirmed in `information_schema.tables`. |
| **Gate 2** | GovernanceSnapshot Persistence & Column Mapping | `PASS` | Persisted `StrategyGovernanceSnapshot` with multi-domain versions (`lifecycleVersion: 3`, `healthVersion: 4`, `operationalSnapshotId: op_snap_pg_01`). Verified direct SQL column round-trip. |
| **Gate 3** | Deterministic GovernanceDecision Persistence | `PASS` | Persisted `StrategyGovernanceDecision` with `classification: REVALIDATE`, reason codes, and required interventions. Verified relational query and exact fields. |
| **Gate 4** | Durable Idempotency Replay | `PASS` | Exact replay of snapshot, decision, plan, and request returned identical records with identical IDs without duplicate SQL insertions. |
| **Gate 5** | Idempotency Conflict Detection | `PASS` | Submitting an altered digest for an existing decision ID strictly threw typed `GovernanceIdempotencyConflictError`. |
| **Gate 6** | Two-Worker Concurrency Gate | `PASS` | Two concurrent workers issuing the same active intervention request concurrently called `recordInterventionRequestTransaction`. Verified exactly **1** record inserted; second worker received existing active request. |
| **Gate 7** | Multi-Authority InterventionPlan Persistence | `PASS` | Persisted `StrategyInterventionPlan` with linear step dependencies. Verified relational storage and plan status updates. |
| **Gate 8** | Authority Response & Outbox Atomicity | `PASS` | Recorded `StrategyInterventionResponse` marking request `APPLIED` and verified atomic emission of `StrategyInterventionApplied` event into `trading_execution_outbox`. |
| **Gate 9** | Intervention Resolution Persistence | `PASS` | Persisted `StrategyInterventionResolution` demonstrating transition from `PARTIALLY_APPLIED` to `RESOLVED` upon receiving all qualifying responses. |
| **Gate 10** | Disconnect + Reconnect Survival | `PASS` | Connection pool drained and re-opened; queried all tables and verified 100% data integrity and relationship survival. |
| **Gate 11** | Process / Repository Restart Persistence | `PASS` | Instantiated completely new `PostgresStrategyOperationalGovernanceRepository` instances; verified replay and lookup operations succeeded without data loss. |
| **Gate 12** | Transaction Rollback / Failure Injection | `PASS` | Injected intentional DB error during plan creation transaction. Verified complete rollback with zero orphan rows. |
| **Gate 13** | Stale Snapshot Rejection (TOCTOU) | `PASS` | Simulated drift on stale snapshot with mismatched versions; verified rejection with typed `GovernanceSnapshotStaleError`. |
| **Gate 14** | Authority Non-Bypass Verification | `PASS` | Inspected repository methods; verified repository only writes to governance tables and never to health, lifecycle, risk, or portfolio tables. |
| **Gate 15** | Outbox Atomicity | `PASS` | Verified all governance events (`StrategyGovernanceEvaluated`, `StrategyInterventionRequested`, etc.) are written atomically to `trading_execution_outbox` inside the same database transaction. |
| **Gate 16** | Intervention Resolution Convergence | `PASS` | Verified convergence to `RESOLVED` once all authority responses arrive, without infinite loops or redundant state changes. |

---

## 3. Test Execution Command & Output

```bash
npm --prefix trading-core/services/trading-core run build
npx --prefix trading-core/services/trading-core tsc -p trading-core/services/trading-core/tsconfig.test.json
node --test trading-core/services/trading-core/test/val-12-postgres-acceptance.test.mjs
```

**Output:**
```
▶ AXODUS-TRADING-EPIC-01 / VAL-12-PG — Real PostgreSQL Durable Operational Governance Acceptance
  ✔ Gate 1: Migration 0011 applies cleanly and all 7 tables exist in PostgreSQL (44.238085ms)
  ✔ Gate 2: GovernanceSnapshot persistence & exact column mapping round-trip (15.596123ms)
  ✔ Gate 3: Deterministic GovernanceDecision persistence & querying in real PostgreSQL (28.236949ms)
  ✔ Gate 4: Durable idempotent replay on identical digests returns existing records without duplicate insert (22.033481ms)
  ✔ Gate 5: Idempotency conflict throws GovernanceIdempotencyConflictError on altered digest (19.723268ms)
  ✔ Gate 6: Concurrency protection — two workers attempting active revalidation intervention converge to 1 active in PostgreSQL (62.550594ms)
  ✔ Gate 7: Multi-authority InterventionPlan persistence and status management (29.515459ms)
  ✔ Gate 8: Authority response persistence & transactional outbox emission (32.679312ms)
  ✔ Gate 9: Intervention resolution persistence with partial and resolved states (45.464219ms)
  ✔ Gate 10: Disconnect + Reconnect survival across pool lifecycle in real PostgreSQL (31.417939ms)
  ✔ Gate 11: Process / Repository restart persistence in real PostgreSQL (5.509819ms)
  ✔ Gate 12: Transaction rollback / failure injection leaves zero partial state in real PostgreSQL (18.442572ms)
  ✔ Gate 13: Stale snapshot rejection (TOCTOU protection in database context) (3.438431ms)
  ✔ Gate 14: Authority non-bypass verification — repository has zero direct write methods to health/lifecycle/risk/portfolio (0.851208ms)
  ✔ Gate 15: Outbox atomicity — StrategyGovernanceEvaluated and StrategyInterventionRequested in PostgreSQL (20.349951ms)
  ✔ Gate 16: Intervention resolution convergence without infinite loops (26.317185ms)
✔ AXODUS-TRADING-EPIC-01 / VAL-12-PG — Real PostgreSQL Durable Operational Governance Acceptance (610.210644ms)
ℹ tests 16
ℹ suites 1
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 865.37464
```

---

## 4. Verification of Core Invariants

1. **Operational Governance is Coordination, NOT Super-Authority:** Governance only evaluates signals and issues requests (`InterventionRequest`). Only sovereign authorities (`StrategyHealthAuthority`, `StrategyLifecycleAuthority`, `RiskAuthority`, `PortfolioAuthority`, `QuantLab`) can execute state transitions in their respective domains.
2. **Authority Non-Bypass:** Verified in Gate 14 that `PostgresStrategyOperationalGovernanceRepository` has zero direct write pathways to sovereign tables.
3. **Exact StrategyRevision Binding:** Snapshot, drift, health, lifecycle, and revalidation inputs must strictly share the exact same `StrategyRevisionId`.
4. **TOCTOU Snapshot Freshness:** Stale snapshot strictly throws `GovernanceSnapshotStaleError`.
5. **Durable Concurrency Protection:** Unique partial index `idx_unique_active_intervention_request` prevents concurrent duplicate active requests across workers.
6. **Zero External Mutation:** Live order submission = 0, Mainnet = 0, real capital = 0, credentials used = 0.

