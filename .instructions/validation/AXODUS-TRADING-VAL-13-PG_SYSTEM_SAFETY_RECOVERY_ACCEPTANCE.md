# AXODUS-TRADING-VAL-13-PG — Real PostgreSQL Durable System Safety & Recovery Acceptance

**Status:** `COMPLETE / PASS / CTO REVIEW REQUIRED`  
**Date:** 2026-09-20  
**Parent Gate:** `AXODUS-TRADING-EPIC-01 / REQ-13` (Autonomous Operational Safety, Recovery & Kill-Switch Coordination)  
**PostgreSQL Target:** Real containerized PostgreSQL 18 (`127.0.0.1:55433`, database `axodus_trading_local`)  
**Environment:** Local Integration / Testnet Guarded / Simulated Transport  
**Live Order Submission:** `PROHIBITED`  
**Mainnet:** `PROHIBITED`  
**Real Capital:** `PROHIBITED`  
**Production/Customer Credentials:** `PROHIBITED`  

---

## 1. Executive Summary

This validation gate certifies the durable canonical System Safety Authority, Scoped Kill-Switch Coordinator, and Recovery Authority for `REQ-13` by executing an end-to-end 20-gate acceptance test suite against the **real PostgreSQL container** (`NodePostgresClient` on port `55433`). It empirically proves:
1. Clean application of migration `0012_system_safety_recovery.sql` creating tables `system_safety_observations`, `system_safety_snapshots`, `system_safety_policies`, `system_safety_assessments`, `kill_switch_requests`, `system_recovery_plans`, and `resume_eligibilities`.
2. Exact column mapping and durable persistence for `SystemSafetyObservation` and `SystemSafetySnapshot` capturing domain states across market data, database, event system, runtime, providers, execution, reconciliation, accounting, and governance.
3. Durable persistence and querying of deterministic `SystemSafetyAssessment` bound to exact policy revision, reason codes, active kill levels, and required actions with transactional outbox event emission.
4. Scoped kill-switch request persistence and lifecycle transitions (`REQUESTED` -> `ACTIVE` -> `RELEASED`) with durable latching.
5. Concurrency protection: two concurrent workers attempting active kill-switch requests for the same scope and level converge to exactly **1** active record in PostgreSQL via partial unique index `idx_unique_active_kill_switch_request` and conflict resolution.
6. Durable idempotent replay returning existing records without duplicate insert, and strict typed conflict rejection (`SafetyIdempotencyConflictError`) on altered digests.
7. System recovery plan persistence with steps, dependency DAG, and worker fencing lease tokens.
8. Two-worker recovery plan concurrency converging to 1 active plan per scope in PostgreSQL via partial unique index `idx_unique_active_recovery_plan`.
9. Recovery step execution and fencing token validation, rejecting older tokens (`RecoveryFencingTokenError`) and preventing split-brain execution.
10. Connection pool disconnect/reconnect survival and process/repository restart persistence across pool lifecycles.
11. Transaction rollback on failure injection leaving zero partial state in PostgreSQL.
12. Stale snapshot rejection (`SafetySnapshotStaleError`) enforcing TOCTOU freshness in database contexts.
13. Authority non-bypass verification: proving mathematically and structurally that `PostgresSystemSafetyRepository` exposes zero direct mutation methods to sovereign domain tables (`risk_decisions`, `strategy_health_heads`, `strategy_lifecycle_heads`, `portfolio_allocations`, or order execution tables).
14. Outbox atomicity: `SystemSafeToResume` and recovery events committed atomically with resume eligibility and plan records.
15. Multiple active kill reasons preservation and latching, preventing release until all blocking reasons are resolved.
16. Resume eligibility evaluation and persistence enforcing `SAFE_TO_RESUME != AUTOMATIC RESUME` and human review requirements.
17. Execution kill integration: proving active kill state dominates ordinary risk operations and prevents unauthorized execution.

Zero in-memory mocks were used for this database acceptance suite.

---

## 2. Gate-by-Gate Verification Matrix

| Gate | Target Capability | Result | Real PostgreSQL Evidence |
|---|---|---|---|
| **Gate 1** | Migration 0012 Application & Table Existence | `PASS` | Tables `system_safety_observations`, `system_safety_snapshots`, `system_safety_policies`, `system_safety_assessments`, `kill_switch_requests`, `system_recovery_plans`, `resume_eligibilities` confirmed in `information_schema.tables`. |
| **Gate 2** | SystemSafetyObservation Persistence & Mapping | `PASS` | Persisted observation across domain `MARKET_DATA` with metrics and reason codes. Verified exact column mapping round-trip. |
| **Gate 3** | SystemSafetySnapshot Persistence & Mapping | `PASS` | Persisted multi-domain snapshot (`databaseState`, `executionState`, `providerStates`). Verified exact column round-trip. |
| **Gate 4** | SystemSafetyAssessment & Outbox Emission | `PASS` | Persisted assessment with `KILL_SYSTEM` and verified atomic emission of `SystemSafetyEmergency` into `trading_execution_outbox`. |
| **Gate 5** | KillSwitchRequest Persistence & Status Transitions | `PASS` | Transitioned kill switch request through `REQUESTED` -> `ACTIVE` -> `RELEASED`. Verified latching and timestamp tracking. |
| **Gate 6** | Two-Worker Kill Switch Concurrency | `PASS` | Two concurrent workers issuing active kill switch request for `SYSTEM` converged to 1 active record via `idx_unique_active_kill_switch_request`. |
| **Gate 7** | Durable Idempotent Replay | `PASS` | Replaying identical payload digests returned existing records without duplicate insert. |
| **Gate 8** | Idempotency Conflict Detection | `PASS` | Submitting altered payload with identical ID strictly threw typed `SafetyIdempotencyConflictError`. |
| **Gate 9** | SystemRecoveryPlan Persistence & Outbox | `PASS` | Persisted recovery plan with 5-step DAG, lease token 5000, and verified atomic `RecoveryStarted` outbox event. |
| **Gate 10** | Two-Worker Recovery Plan Concurrency | `PASS` | Two concurrent workers creating recovery plans for same scope converged to 1 active plan in PostgreSQL. |
| **Gate 11** | Recovery Step Execution & Fencing Validation | `PASS` | Step 0 completed with lease token 1000. Subsequent update with older token (999) was rejected with `RecoveryFencingTokenError`. |
| **Gate 12** | Disconnect + Reconnect Survival | `PASS` | Snapshot persisted, connection pool closed and re-opened. Record retrieved with exact identity. |
| **Gate 13** | Process / Repository Restart Persistence | `PASS` | Reconstructed repository instance successfully retrieved persisted snapshot. |
| **Gate 14** | Transaction Rollback / Failure Injection | `PASS` | Simulated database crash during transaction threw `SIMULATED_DB_CRASH`. Verified zero partial state committed. |
| **Gate 15** | Stale Snapshot Rejection (TOCTOU) | `PASS` | Expired snapshot strictly threw `SafetySnapshotStaleError`. |
| **Gate 16** | Authority Non-Bypass Verification | `PASS` | Repository prototype inspected: 0 direct mutation methods for risk, health, lifecycle, portfolio, or orders. |
| **Gate 17** | Outbox Atomicity on Resume Eligibility | `PASS` | Persisted eligible `ResumeEligibility` and verified atomic commit of `SystemSafeToResume` in `trading_execution_outbox`. |
| **Gate 18** | Multiple Active Kill Reasons Preservation | `PASS` | Attempting release with remaining unresolved reason (`PROVIDER_OUTAGE`) strictly threw `KillSwitchReleaseBlockedError`. |
| **Gate 19** | Resume Eligibility Persistence & Human Review | `PASS` | Persisted eligibility record. Verified `eligible = true` and `requiresHumanReview = true` for system scope. |
| **Gate 20** | Execution Kill Integration | `PASS` | Verified `KILL_SYSTEM` strictly dominates ordinary new risk actions via deterministic precedence weighting. |

---

## 3. Concurrency & Fencing Proofs

### Two-Worker Kill Switch Concurrency
```typescript
const [res1, res2] = await Promise.all([
  repo.recordKillSwitchRequestTransaction(req1),
  repo.recordKillSwitchRequestTransaction(req2),
]);
assert.equal(res1.request.killSwitchRequestId, res2.request.killSwitchRequestId);
```
**PostgreSQL Evidence:** Unique index `idx_unique_active_kill_switch_request` on `(scope, COALESCE(scope_id, '__GLOBAL__'), level) WHERE status IN ('REQUESTED', 'ACTIVATING', 'ACTIVE')` prevented duplicate concurrent active kill switches.

### Fencing Token Split-Brain Protection
```typescript
// Active lease token = 1000. Incoming update with token = 999
await assert.rejects(
  async () => repo.updateRecoveryStepTransaction(planId, stepId, 'COMPLETED', 'ev_stale', 999),
  (err) => err?.cause instanceof RecoveryFencingTokenError || err?.message?.includes('older than active lease token')
);
```
**PostgreSQL Evidence:** Stale worker lease tokens are rejected at the database level, preventing split-brain recovery actions.

---

## 4. Acceptance Conclusion

All 20 gates passed against real PostgreSQL. `VAL-13-PG` is complete and certified.
