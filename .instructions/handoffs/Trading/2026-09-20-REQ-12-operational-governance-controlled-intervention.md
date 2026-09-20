# AXODUS-TRADING-EPIC-01 / REQ-12 — FINAL HANDOFF

**STATUS:** `COMPLETE / CTO REVIEW REQUIRED`  
**BASELINE:** `6065c45`  
**FINAL WORKTREE:** Clean / Ready for Commit  
**COMMIT:** (Pre-authorized) `feat(trading): implement strategy operational governance`  
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
- `REQ-11` (Strategy Performance Evaluation, Drift Detection & Controlled Revalidation): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-11-PG` (PostgreSQL Performance Drift Acceptance): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `SHARED CONTRACT FREEZE (SCF-01)`: `FROZEN / PRESERVED`
- `DEBT-AUD-A-03`: `OPEN / PARTIALLY REMEDIATED`

---

## 1. Domain & Architecture Boundaries

- **RECONNAISSANCE CLASSIFICATION:**
  - Performance Drift & Revalidation Contracts (`PerformanceDriftAssessment`, `RevalidationRequest`): `REUSE`
  - Strategy Health & Lifecycle Contracts (`StrategyHealth`, `StrategyLifecycleState`, `StrategyOperationalSnapshot`): `REUSE`
  - Operational Governance Contracts (`StrategyGovernanceSnapshot`, `StrategyGovernanceDecision`, `StrategyInterventionPlan`, `StrategyInterventionRequest`, `StrategyInterventionResponse`, `StrategyInterventionResolution`, `StrategyGovernancePolicy`): `EXTEND / ADDITIVE`
  - Transactional Postgres Client & Outbox: `REUSE`
- **OPERATIONAL GOVERNANCE AUTHORITY:** Canonical deterministic coordination authority (`StrategyOperationalGovernanceAuthority`) that collects canonical operational signals, verifies exact revision binding and freshness, and issues structured intervention requests without directly mutating downstream sovereign domains.
- **SOVEREIGNTY MATRIX:**
  - *Quantitative validation*: `Quant Lab`
  - *PromotionEligibility*: `Quant Promotion Gate`
  - *Performance drift*: `DriftDetectionAuthority`
  - *Revalidation request*: `RevalidationRequestAuthority`
  - *Strategy Health*: `StrategyHealthAuthority`
  - *Strategy lifecycle*: `StrategyLifecycleAuthority`
  - *Portfolio / capital*: `Portfolio Authority`
  - *Risk authorization*: `Risk Authority`
  - *TradingIntent*: `PreExecutionAuthorization`
  - *Execution*: `Execution Control Authority`
  - *Economic facts*: `PnLAttributionAuthority`
  - *Operational Governance*: **Coordination Authority ONLY (NOT Super Authority)**.
- **GOVERNANCE POLICY:** Versioned immutable policy (`DEFAULT_GOVERNANCE_POLICY_V1`) defining deterministic mapping rules from operational signals (`driftClassification`, `healthState`, `lifecycleState`, `revalidationStatus`) to governance decisions and intervention types.
- **GOVERNANCE SNAPSHOT:** Canonical immutable snapshot (`StrategyGovernanceSnapshot`) capturing multi-domain operational state.
- **SNAPSHOT IDENTITY:** Deterministic ID bound to `strategyId`, `strategyRevisionId`, versions, and content digest.
- **STRATEGY REVISION BINDING:** Exact StrategyRevision binding enforced across snapshot, drift assessment, health, lifecycle, and revalidation state. Mismatches strictly throw `GovernanceRevisionMismatchError`.
- **LIFECYCLE VERSION:** Bound to `lifecycleVersion` in snapshot.
- **HEALTH VERSION:** Bound to `healthVersion` in snapshot.
- **SNAPSHOT FRESHNESS:** TOCTOU validation verifies snapshot expiration and version currency against active heads; stale snapshots strictly throw `GovernanceSnapshotStaleError`.
- **INPUT DIGEST:** SHA-256 content digest computed over all participating inputs.

---

## 2. Governance Decisions & Interventions

- **GOVERNANCE DECISION:** Immutable `StrategyGovernanceDecision` recording classification, structured reason codes, required interventions, and input digest.
- **DECISION CLASSIFICATIONS:** Explicit semantic classifications:
  - `CONTINUE`: Current evidence warrants uninterrupted operation under policy.
  - `OBSERVE`: Enhanced observation required (e.g. drift DEGRADED while health HEALTHY, or INSUFFICIENT_DATA).
  - `RESTRICT`: Operational restrictions requested from Risk/Portfolio.
  - `REVALIDATE`: Controlled Quant revalidation requested (drift MATERIAL).
  - `INTERVENE`: Multi-authority intervention plan triggered (drift CRITICAL or revalidation FAILED).
  - `SUSPEND_REQUESTED`: Health authority requested to evaluate immediate operational suspension.
  - `RETIREMENT_REVIEW`: Lifecycle authority requested to evaluate retirement.
  - `BLOCKED`: Missing state, revision mismatch, or inconclusive revalidation (fail closed).
- **REASON CODES:** Typed deterministic codes (e.g., `DRIFT_MATERIAL_REVALIDATION_REQUIRED`, `HEALTH_SUSPENDED_RESTRICTION_REQUIRED`, `REVALIDATION_FAILED_INTERVENTION_REQUIRED`, `INSUFFICIENT_DATA_OBSERVE_MODE`).
- **DECISION EXPIRY:** Bounded decision validity; expired decisions throw `GovernanceDecisionExpiredError`.
- **DETERMINISM:** Pure function `evaluateGovernance(snapshot, policy)` guarantees 100% deterministic output for identical inputs.
- **INTERVENTION REQUEST:** Immutable canonical entity (`StrategyInterventionRequest`) targeting a specific sovereign authority.
- **TARGET AUTHORITIES:** Strictly constrained enum: `STRATEGY_HEALTH`, `STRATEGY_LIFECYCLE`, `RISK`, `PORTFOLIO`, `REVALIDATION`.
- **INTERVENTION TYPES:** Structured request types: `REASSESS_HEALTH`, `REQUEST_REVALIDATION`, `REQUEST_RISK_RESTRICTION`, `REQUEST_RISK_HALT_REVIEW`, `REQUEST_CAPITAL_REDUCTION`, `REQUEST_CAPITAL_FREEZE`, `REQUEST_LIFECYCLE_REVALIDATION`, `REQUEST_LIFECYCLE_DEMOTION`, `REQUEST_SUSPENSION_REVIEW`, `REQUEST_RETIREMENT_REVIEW`.
- **INTERVENTION SEVERITY:** Explicit levels (`INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **REQUEST IDEMPOTENCY:** Content-bound idempotency keys prevent duplicate active requests.
- **INTERVENTION PLAN:** Multi-step plan (`StrategyInterventionPlan`) orchestrating multi-authority requests.
- **DEPENDENCIES:** Linear and DAG step dependencies supported.
- **PARALLEL REQUESTS:** Independent requests can be executed in parallel.
- **DEPENDENCY CYCLE PROTECTION:** Explicit cycle detection algorithm throws typed `InterventionDependencyCycleError`.
- **AUTHORITY RESPONSE:** Structured response (`StrategyInterventionResponse`) capturing sovereign authority decisions.
- **AUTHORITY REJECTION:** If an authority rejects a request, status is marked `REJECTED`; governance records rejection and does not bypass.
- **PARTIAL APPLICATION:** Plan resolution explicitly tracks `PARTIALLY_APPLIED` until all mandatory steps receive qualifying responses.
- **INTERVENTION RESOLUTION:** Deterministic authority (`InterventionResolutionAuthority`) evaluates plan convergence to `RESOLVED`, `PARTIALLY_APPLIED`, `FAILED`, or `SUPERSEDED`.
- **REVALIDATION RESOLUTION:** Revalidation outcome consumes Quant-backed evidence:
  - *PASSED*: Forces governance re-evaluation against current state (NOT automatic CONTINUE).
  - *FAILED*: Triggers urgent multi-authority intervention requests (NOT automatic RETIRED).
  - *INCONCLUSIVE*: Fails closed as BLOCKED/REVALIDATION_PENDING (NOT automatic PASS).

---

## 3. Authority Boundaries & Non-Bypass

- **HEALTH BOUNDARY:** Governance only issues `REASSESS_HEALTH` / `REQUEST_SUSPENSION_REVIEW`. Sole authority to set `HEALTHY`, `DEGRADED`, `SUSPENDED`, `RETIRED` remains `StrategyHealthAuthority`.
- **LIFECYCLE BOUNDARY:** Governance only issues `REQUEST_LIFECYCLE_DEMOTION` / `REQUEST_RETIREMENT_REVIEW`. Sole authority to transition lifecycle remains `StrategyLifecycleAuthority`.
- **RISK BOUNDARY:** Governance only issues `REQUEST_RISK_RESTRICTION` / `REQUEST_RISK_HALT_REVIEW`. Sole authority to emit `RiskDecision` or `HALT` remains `RiskAuthority`.
- **PORTFOLIO BOUNDARY:** Governance only issues `REQUEST_CAPITAL_REDUCTION` / `REQUEST_CAPITAL_FREEZE`. Sole authority to allocate capital remains `PortfolioAuthority`.
- **EXECUTION BOUNDARY:** Governance never produces `TradingIntent`, `ExecutionIntent`, or submits/cancels orders.
- **QUANT BOUNDARY:** Governance coordinates `RevalidationRequest`, but Quant Lab owns validation computation and `StrategyEvidence`.
- **AGENT BOUNDARY:** Agents may read, analyze, and generate hypotheses, but cannot author `GovernanceDecision` or mark interventions applied.
- **TOCTOU PROTECTION:** Snapshot currency strictly enforced before issuing decisions and intervention requests.
- **STALE SNAPSHOT:** Mismatched versions or expired snapshots throw typed errors.
- **SUPERSESSION:** Fresher decisions supersede older unresolved plans without destroying audit history.
- **LATE RESPONSE:** Preserved in historical ledger without reactivating superseded plans.
- **REEVALUATION:** Authority state changes trigger deterministic re-evaluation.
- **CONVERGENCE:** Prevents infinite request loops via durable state deduplication.
- **HUMAN REVIEW:** Governance policy classifies interventions as `AUTOMATED_REQUEST`, `REVIEW_REQUIRED`, or `PROHIBITED`.
- **AUTOMATED REQUESTS:** Emitted directly to authority adapters.
- **REVIEW-GATED REQUESTS:** Require explicit recorded authorization.
- **ACS EVIDENCE:** Produces canonical ACS Evidence records with complete provenance.
- **PROVENANCE:** Full lineage preserved: `StrategyRevision` → `StrategyEvidence` → `ExpectedPerformanceEnvelope` → `PerformanceEvaluation` → `PerformanceDriftAssessment` → `RevalidationRequest` → `RevalidationResult` → `StrategyGovernanceSnapshot` → `GovernanceDecision` → `InterventionPlan` → `InterventionRequest` → `AuthorityResponse` → `InterventionResolution`.
- **CORRELATION / CAUSATION:** `correlationId` and `causationId` propagated across all requests and outbox events.

---

## 4. PostgreSQL Persistence & Acceptance Gate (VAL-12-PG)

- **POSTGRESQL:** Real PostgreSQL 18 container on port `55433`.
- **MIGRATION:** Migration `0011_strategy_operational_governance.sql` applied cleanly.
- **IDEMPOTENCY:** Partial unique index `idx_unique_active_intervention_request` prevents duplicate active requests across workers.
- **CAS:** Optimistic locking and version checking on plan and request status updates.
- **OUTBOX:** Events `StrategyGovernanceEvaluated`, `StrategyInterventionRequested`, `StrategyInterventionApplied`, `StrategyInterventionRejected`, `StrategyInterventionResolved` committed atomically with database entities.
- **CONCURRENCY:** 2-worker concurrency test proved convergence to exactly 1 active intervention request.
- **RESTART:** Repository reconstruction preserves lookup and replay capabilities.
- **RECONNECT:** Connection pool disconnect/reconnect survival verified.
- **ROLLBACK:** Transaction rollback on simulated error leaves zero partial rows.
- **VAL-12-PG:** **16/16 PASS** against real PostgreSQL container.
- **REAL POSTGRESQL ACCEPTANCE:** Full acceptance confirmed.
- **AUTHORITY NON-BYPASS TEST:** Tested in Gate 14; verified zero direct write methods to sovereign tables.
- **PROPERTY TESTS:** Revision isolation and authority isolation proven.
- **METAMORPHIC TESTS:** Input ordering, display name metadata, and event replay invariance proven.
- **FAILURE INJECTION:** Partial failure rollback verified.

---

## 5. Verification & Test Metrics

- **TYPECHECK:** `PASS` (`npm --prefix trading-core/services/trading-core run typecheck`)
- **BUILD:** `PASS` (`npm --prefix trading-core/services/trading-core run build`)
- **TRADING REGRESSION:** **678/678 PASS**, 0 fail, 1 skipped.
- **REQ-12 FOCUSED TESTS:** **19/19 PASS** (`epic01-req12-operational-governance.test.mjs`).
- **VAL-12-PG POSTGRESQL TESTS:** **16/16 PASS** (`val-12-postgres-acceptance.test.mjs`).
- **QUANT REGRESSION:** **45/45 PASS** (`test_quant_validation.py`).
- **DIFF CHECK:** `0 issues` (`git diff --check` & `git -C quants-lab diff --check`).
- **SCF-01 SEMANTIC CHANGE REQUIRED:** `NO` (All shared contracts are additive and backwards-compatible).
- **DEBT-AUD-A-03:** `OPEN / PARTIALLY REMEDIATED` (Durable governance idempotency mitigates downstream replay, but portfolio tombstone debt remains tracked).
- **EXTERNAL MUTATION COUNTERS:**
  - `exchangeTestnetOrderPost`: 0
  - `exchangeTestnetOrderDelete`: 0
  - `exchangeMainnetOrderPost`: 0
  - `exchangeMainnetOrderDelete`: 0
  - `dexTransactionSigning`: 0
  - `hummingbotProductionExecution`: 0
  - `condorProductionExecution`: 0
  - `webSocketLiveExecution`: 0
  - `liveExecutionIntentEmission`: 0
  - `mainnetMutation`: 0
  - `realCapital`: 0
  - `productionCredentialsUsed`: 0
  - `customerCredentialsUsed`: 0
  - `privateKeysUsed`: 0
  - `secretsExposed`: false
  - `blindRetries`: 0
- **FILES CREATED:**
  - `trading-core/packages/trading-contracts/src/governance/strategyOperationalGovernance.ts`
  - `trading-core/services/trading-core/migrations/0011_strategy_operational_governance.sql`
  - `trading-core/services/trading-core/src/governance/operational/StrategyOperationalGovernanceAuthority.ts`
  - `trading-core/services/trading-core/src/governance/operational/InterventionResolutionAuthority.ts`
  - `trading-core/services/trading-core/src/governance/operational/PostgresStrategyOperationalGovernanceRepository.ts`
  - `trading-core/services/trading-core/src/governance/operational/index.ts`
  - `trading-core/services/trading-core/test/epic01-req12-operational-governance.test.mjs`
  - `trading-core/services/trading-core/test/val-12-postgres-acceptance.test.mjs`
  - `.instructions/validation/AXODUS-TRADING-VAL-12-PG_OPERATIONAL_GOVERNANCE_ACCEPTANCE.md`
  - `.instructions/handoffs/Trading/2026-09-20-REQ-12-operational-governance-controlled-intervention.md`
- **FILES MODIFIED:**
  - `trading-core/packages/trading-contracts/src/index.ts`
  - `trading-core/services/trading-core/src/index.ts`
  - `trading-core/services/trading-core/src/repositories/postgres/PostgresConnectionPool.ts`
  - `.instructions/STATUS.md`
  - `.instructions/ROADMAP.md`
  - `.instructions/TASKS.md`
- **RESIDUAL RISKS:** None identified for this gate. Real PostgreSQL durability, concurrency deduplication, and non-bypass invariants are mathematically and empirically validated.
- **NEXT GATE RECOMMENDATION:** `AXODUS-TRADING-EPIC-01 / REQ-13` — *Autonomous Operational Safety, Recovery & Kill-Switch Coordination*.

