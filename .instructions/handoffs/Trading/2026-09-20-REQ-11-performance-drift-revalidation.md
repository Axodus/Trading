# AXODUS-TRADING-EPIC-01 / REQ-11 — FINAL HANDOFF

**STATUS:** `COMPLETE / CTO REVIEW REQUIRED`  
**BASELINE:** `0e19c44`  
**FINAL WORKTREE:** Clean / Ready for Commit  
**COMMIT:** (Pre-authorized) `feat(trading): implement performance drift and controlled revalidation`  
**DEPENDENCY CLASSIFICATION:**
- `REQ-06` (Risk Authority): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-07A` (Strategy Promotion, Health & Risk Integration Boundary Freeze): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-07B` (Strategy Lifecycle Authority): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-07C` (Strategy Health Authority & Operational Snapshot): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-07D` (Canonical TradingIntent & Pre-Execution Authorization): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-07D-PG` (PostgreSQL Durable Pre-Execution Acceptance): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-08` (ExecutionIntent & Execution Boundary): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-08-PG` (PostgreSQL Execution Boundary Acceptance): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-09` (Controlled Execution Lifecycle, Order State & Reconciliation Boundary): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-09-PG` (PostgreSQL Execution Lifecycle Acceptance): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-09-TESTNET` (Binance Futures Testnet Provider Execution & Reconciliation Certification): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-10` (Controlled Continuous Feedback, Execution Diagnostics & PnL Attribution): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-10-PG` (PostgreSQL Economic Attribution Acceptance): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `SHARED CONTRACT FREEZE (SCF-01)`: `FROZEN / PRESERVED`
- `DEBT-AUD-A-03`: `OPEN / PARTIALLY REMEDIATED`

---

## 1. Domain & Architecture Boundaries

- **RECONNAISSANCE CLASSIFICATION:**
  - Economic Feedback Contracts (`ExecutionDiagnostics`, `PnLAttribution`, `TradingFeedbackSnapshot`): `REUSE`
  - Quant Strategy Evidence Contracts (`StrategyEvidence`, `PromotionEligibility`): `REFERENCE / REUSE`
  - Performance Evaluation & Drift Contracts (`ExpectedPerformanceEnvelope`, `PerformanceEvaluation`, `PerformanceDriftAssessment`, `RevalidationRequest`): `EXTEND / ADDITIVE`
  - Transactional Postgres Client & Outbox: `REUSE`
- **EXPECTED PERFORMANCE ENVELOPE:** Canonical immutable object (`ExpectedPerformanceEnvelope`) holding quantitative benchmarks derived directly from Quant StrategyEvidence (never Agent-authored).
- **ENVELOPE PROVENANCE:** Binds exact `strategyEvidenceRefs`, `datasetRefs`, `experimentRefs`, and `environmentApplicability`.
- **EVIDENCE STRENGTH:** Preserves Quant evidence strength classification (`INSUFFICIENT`, `PRELIMINARY`, `VALIDATED`, `ROBUST`).
- **ENVIRONMENT APPLICABILITY:** Explicit array of supported environments (e.g. `["SIMULATED", "TESTNET"]`). Cross-environment evaluation without compatibility policy throws `PerformanceEnvironmentMismatchError`.
- **REGIME APPLICABILITY:** Contextual market regime binding (`marketRegimeApplicability`); missing regime data is marked `unavailable`.
- **PERFORMANCE COMPARISON POLICY:** Versioned immutable policy (`DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1`) defining metric compatibility, minimum sample thresholds, observation windows, and metric-level tolerances.
- **METRIC COMPATIBILITY:** Compares only semantically compatible metrics (e.g. realized slippage bps vs expected slippage bps, realized fees vs expected fee model, fill ratio vs expected fill model, completion latency vs expected latency, realized net PnL vs expected return/PnL).
- **WINDOW POLICY:** Explicit observation window with `windowStart`, `windowEnd`, and `asOf` timestamps.
- **MINIMUM SAMPLE:** Strict sample threshold enforcement (`minSampleSize: 10`).
- **MISSING DATA SEMANTICS:** Mandatory invariant: `Missing Metric != 0`. Missing expected or observed metrics result in `deviationStatus: UNAVAILABLE` and are never silently zeroed.
- **PERFORMANCE EVALUATION AUTHORITY:** Canonical deterministic authority (`PerformanceEvaluationAuthority`) validating exact StrategyRevision, environment applicability, sample size, and metric deviations using `FixedDecimal` exact arithmetic.
- **PERFORMANCE EVALUATION IDENTITY:** Deterministic `evaluationId` bound to `strategyId`, `strategyRevisionId`, `windowStart`, `windowEnd`, and content digest.
- **OBSERVATION WINDOW:** Explicit start/end bounds.
- **OBSERVED PERFORMANCE SOURCE:** Derived exclusively from canonical REQ-10 `ExecutionDiagnostics` and `PnLAttribution` records.
- **EVALUATION QUALITY:** Explicit classification: `COMPLETE`, `PARTIAL`, `INSUFFICIENT_DATA`, `PENDING_RECONCILIATION`, or `INVALID`.
- **ECONOMIC COMPARISON:** Realized Net PnL compared against expected PnL envelope.
- **EXECUTION COMPARISON:** Realized volume-weighted slippage bps compared against expected slippage model.
- **COST COMPARISON:** Realized normalized fees compared against expected fee model.
- **BEHAVIOR COMPARISON:** Fill ratio and trade frequency compared against expected execution model.
- **REGIME COMPARISON:** Market regime compatibility verified when regime context is present.
- **DATA QUALITY COMPARISON:** Non-complete source facts preserve `PARTIAL` or `INVALID` quality into evaluation.

---

## 2. Drift Detection & Controlled Revalidation

- **DRIFT DETECTION AUTHORITY:** Single canonical authority (`DriftDetectionAuthority`) that consumes `PerformanceEvaluation` and applies versioned `DriftPolicy` to classify drift across multiple dimensions.
- **DRIFT POLICY:** Immutable policy (`DEFAULT_DRIFT_POLICY_V1`) specifying severity thresholds (`DEGRADED`, `MATERIAL`, `CRITICAL`), metric weights, persistence windows required (`persistenceWindowsRequired: 3`), and recovery hysteresis (`recoveryWindowsRequired: 3`).
- **DRIFT CLASSIFICATIONS:** Explicit typed states: `INSUFFICIENT_DATA`, `NORMAL`, `DEGRADED`, `MATERIAL`, `CRITICAL`.
- **DRIFT DIMENSIONS:** Preserves granular dimensions: `ECONOMIC`, `EXECUTION`, `COST`, `LATENCY`, `FILL_QUALITY`, `DATA_QUALITY`, `BEHAVIOR`, `REGIME`.
- **HYSTERESIS:** Prevents metric flapping by requiring persistent degraded windows before escalating to `MATERIAL`.
- **RECOVERY:** Requires consecutive qualifying normal windows to transition from degraded/material back to `NORMAL`.
- **STATISTICAL DISCIPLINE:** Insufficient sample size (`sampleSize < minSampleSize`) strictly produces `INSUFFICIENT_DATA` (never `NORMAL`).
- **MULTIPLE COMPARISON HANDLING:** Metric-level tolerances avoid false-positive drift accumulation.
- **SEQUENTIAL MONITORING:** Window-based evaluation preserves sequential historical assessments.
- **PERFORMANCE DRIFT ASSESSMENT:** Immutable record (`PerformanceDriftAssessment`) containing overall classification, active dimensions, persistence state, and metric assessments.
- **METRIC ASSESSMENTS:** Granular breakdown per metric preserving `metric`, `expectedValue`, `observedValue`, `deviation`, `threshold`, `status`, and `provenance`.
- **INPUT DIGEST:** Deterministic SHA-256 hash across evaluation inputs, policies, and window parameters.
- **POLICY REVISION:** Binds exact policy revision (`v1.0.0`).
- **REVALIDATION REQUEST AUTHORITY:** Deterministic authority (`RevalidationRequestAuthority`) that constructs deduplicated `RevalidationRequest`s when drift classification is `MATERIAL` or `CRITICAL`.
- **REVALIDATION REQUEST:** Immutable governance record binding `strategyId`, `strategyRevisionId`, `triggerAssessmentId`, `requestedValidationScope`, status `REQUESTED`, and evidence references.
- **REVALIDATION SCOPE:** Explicit targeted scopes (e.g. `ECONOMIC_ASSUMPTIONS`, `EXECUTION_ASSUMPTIONS`, `COST_MODEL`, `SLIPPAGE_MODEL`, `FULL_STRATEGY`).
- **REVALIDATION TRIGGER:** Triggered deterministically by `MATERIAL` or `CRITICAL` drift assessment.
- **REQUEST IDEMPOTENCY:** Concurrency-safe deduplication: multiple requests for the same strategy revision converge to at most 1 active request.
- **REQUEST STATUS:** Lifecycle states: `REQUESTED`, `ACKNOWLEDGED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `SUPERSEDED`, `CANCELLED`.
- **QUANT HANDOFF:** Clean provider-neutral boundary: Revalidation request emits canonical `RevalidationRequested` event for Quant Lab processing.
- **REVALIDATION RESULT REFERENCE:** Completed revalidations reference new Quant `StrategyEvidence` and dataset IDs.

---

## 3. Governance Boundaries & Non-Usurpation Invariants

- **STRATEGY HEALTH BOUNDARY:** REQ-11 emits diagnostic observations only. It does NOT mutate `StrategyHealth` directly. Health authority (`REQ-07C`) remains sovereign.
- **LIFECYCLE BOUNDARY:** REQ-11 does NOT trigger lifecycle state transitions. Strategy Lifecycle authority (`REQ-07B`) remains sovereign.
- **RISK BOUNDARY:** REQ-11 does NOT emit `RiskDecision` or system halts. Risk authority (`REQ-06`) remains sovereign.
- **PORTFOLIO BOUNDARY:** REQ-11 does NOT reallocate capital. Portfolio authority (`REQ-05`) remains sovereign.
- **AGENT BOUNDARY:** Agents may analyze drift evidence and propose hypotheses (`AgentDriftHypothesis`), but CANNOT define accounting facts, mutate expected envelopes, or self-validate revalidation.
- **ACS EVIDENCE:** Reuses canonical ACS Evidence envelope for all drift assessments and revalidation records.
- **PROVENANCE:** Full end-to-end chain: `StrategyRevision` → `StrategyEvidence` → `ExpectedPerformanceEnvelope` → `ExecutionDiagnostics` + `PnLAttribution` → `TradingFeedbackSnapshot` → `PerformanceEvaluation` → `PerformanceDriftAssessment` → `RevalidationRequest`.
- **HISTORICAL REPRODUCIBILITY:** Exact inputs + policy revisions produce bit-identical evaluation and assessment digests.
- **LATE FACTS:** Late-arriving reconciled facts trigger new evaluation version lineage (`supersedes` / `supersededBy`).
- **CORRECTION LINEAGE:** Immutable append-only audit trail in PostgreSQL.
- **POLICY EVOLUTION:** New policy revisions generate distinct evaluation records without mutating historical assessments.

---

## 4. PostgreSQL Persistence & Real DB Acceptance (VAL-11-PG)

- **MIGRATION:** `0010_performance_drift_revalidation.sql` applies cleanly, creating 7 normalized tables with foreign keys and unique constraints.
- **IDEMPOTENCY:** Replay with identical digest returns existing record without duplicate SQL insert; differing digest throws `PerformanceIdempotencyConflictError`.
- **CAS:** Optimistic concurrency control on status updates and head tracking.
- **CONCURRENCY:** Two concurrent workers attempting active revalidation requests for the same strategy revision converge to exactly 1 active record via `idx_unique_active_revalidation`.
- **OUTBOX:** Atomic transactional event emission (`PerformanceEvaluationCreated`, `PerformanceDriftDetected`, `RevalidationRequested`) into `trading_execution_outbox`.
- **RESTART:** State survives connection pool restart and repository re-instantiation.
- **RECONNECT:** Survives simulated pool connection drop and reconnect.
- **ROLLBACK:** Injected failure during deviation insertion triggers 100% rollback with zero orphan evaluations or outbox records.
- **REAL POSTGRESQL ACCEPTANCE:** `VAL-11-PG` executed against real PostgreSQL container (`127.0.0.1:55433`). Result: **12/12 Gates PASS**.

---

## 5. Test Suite Verification & Regressions

- **TYPECHECK:** Strict TypeScript typecheck: `0 errors`
- **BUILD:** TypeScript build: `0 errors`
- **TRADING REGRESSION:** `643 tests passing`, `0 failing`, `1 skipped`
- **REQ-11 FOCUSED TESTS:** `29/29 PASS` (`epic01-req11-performance-drift-revalidation.test.mjs` + `val-11-postgres-acceptance.test.mjs`)
- **REQ-10 REGRESSION:** Preserved (`VAL-10-PG` 12/12 PASS)
- **REQ-09 REGRESSION:** Preserved (`VAL-09-PG` 12/12 PASS, `VAL-09-TESTNET` 6/6 PASS)
- **REQ-08 REGRESSION:** Preserved (`VAL-08-PG` 12/12 PASS)
- **REQ-07D REGRESSION:** Preserved (`VAL-07D-PG` 11/11 PASS)
- **RISK REGRESSION:** `18/18 PASS`
- **LIFECYCLE REGRESSION:** `28/28 PASS`
- **HEALTH REGRESSION:** `20/20 PASS`
- **QUANT REGRESSION:** `45/45 PASS` (`quants-lab` test suite)
- **DIFF CHECK:** Clean (`0 whitespace or lint errors`)
- **SCF-01 SEMANTIC CHANGE REQUIRED:** `NO` (Additive contracts only)
- **DEBT-AUD-A-03:** `OPEN / PARTIALLY REMEDIATED` (Tracked explicitly; REQ-11 does not close portfolio tombstone debt)

---

## 6. External Mutation Accounting

- `exchangeTestnetOrderPost:` **0**
- `exchangeTestnetOrderDelete:` **0**
- `exchangeMainnetOrderPost:` **0**
- `exchangeMainnetOrderDelete:` **0**
- `dexTransactionSigning:` **0**
- `hummingbotProductionExecution:` **0**
- `condorProductionExecution:` **0**
- `mainnetMutation:` **0**
- `realCapital:` **0**
- `productionCredentialsUsed:` **0**
- `customerCredentialsUsed:` **0**
- `privateKeysUsed:` **0**
- `secretsExposed:` **false**
- `blindRetries:` **0**

---

## 7. Files Changed & Artifacts

- **Shared Contracts:**
  - `trading-core/packages/trading-contracts/src/execution/performanceDrift.ts`
  - `trading-core/packages/trading-contracts/src/index.ts`
- **Service Implementation:**
  - `trading-core/services/trading-core/src/execution/drift/PerformanceDriftErrors.ts`
  - `trading-core/services/trading-core/src/execution/drift/PerformanceEvaluationAuthority.ts`
  - `trading-core/services/trading-core/src/execution/drift/DriftDetectionAuthority.ts`
  - `trading-core/services/trading-core/src/execution/drift/RevalidationRequestAuthority.ts`
  - `trading-core/services/trading-core/src/execution/drift/PostgresPerformanceDriftRepository.ts`
  - `trading-core/services/trading-core/src/index.ts`
- **PostgreSQL Migration:**
  - `trading-core/services/trading-core/migrations/0010_performance_drift_revalidation.sql`
- **Tests:**
  - `trading-core/services/trading-core/test/epic01-req11-performance-drift-revalidation.test.mjs`
  - `trading-core/services/trading-core/test/val-11-postgres-acceptance.test.mjs`
- **Validation Record:**
  - `.instructions/validation/AXODUS-TRADING-VAL-11-PG_PERFORMANCE_DRIFT_REVALIDATION_ACCEPTANCE.md`
- **Handoff Document:**
  - `.instructions/handoffs/Trading/2026-09-20-REQ-11-performance-drift-revalidation.md`

---

## 8. Residual Risks & Next Gate Recommendation

- **Residual Risks:** `DEBT-AUD-A-03` remains open at Portfolio level; Quant revalidation worker integration will be completed in subsequent orchestration gates.
- **Next Gate Recommendation:** Proceed to **`AXODUS-TRADING-EPIC-01 / REQ-12 — Strategy Operational Governance, Revalidation Resolution & Controlled Intervention`**.
