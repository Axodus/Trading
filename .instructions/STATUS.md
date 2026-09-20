## AXODUS-TRADING-EPIC-01 / REQ-07D — Canonical TradingIntent & Pre-Execution Authorization Boundary

Status: `COMPLETE / CTO REVIEW REQUIRED`

Implemented the canonical, deterministic, durable pre-execution authorization authority in Trading Core (`PreExecutionAuthorizationService`, `PreExecutionAuthorizationValidator`, `PostgresPreExecutionAuthorizationRepository`). The authority converts an already evaluated trading action (`TradeProposal` + `PortfolioDecision` + `RiskDecision` + `StrategyOperationalSnapshot`) into an immutable, provider-neutral `TradingIntent` after strict final authorization consistency validation.

Enforces strict invariants:
- `NO CURRENT VALID RISK AUTHORIZATION = NO TRADINGINTENT`: `ALLOW` or `MODIFY` is required; `REJECT` and `HALT` are strictly blocked (with `HALT` having top safety precedence).
- `VALID HISTORICAL RISK AUTHORIZATION ≠ CURRENT VALID RISK AUTHORIZATION`: Closes TOCTOU vulnerabilities by verifying that the current `StrategyOperationalSnapshot` exactly matches the Risk-evaluated lifecycle version, health version, and snapshot identity, and is unexpired.
- `TradingIntent ≠ ExecutionIntent`: `TradingIntent` is strictly provider-neutral and contains zero exchange endpoints, order candidates, or live connector commands.
- `Risk Monotonicity`: `TradingIntent.approvedCapital <= RiskDecision.effectiveCapital <= PortfolioDecision.approvedCapital` and `TradingIntent.approvedLeverage <= RiskDecision.effectiveLeverage` using exact `FixedDecimal` 12-decimal arithmetic.
- `Single-Use Risk Decision Consumption`: Single-use authorization tracking prevents duplicate intent creation from the same `RiskDecision` (`AUTHORIZATION_ALREADY_CONSUMED`).
- `Transactional Atomicity & Outbox`: Atomically persists authorization record, trading intent, and enqueues `TradingIntentCreated` event to `trading_execution_outbox`.
- `Durable Idempotency & Conflict Prevention`: Exact replay returns existing intent; conflicting payload fails closed with `IDEMPOTENCY_CONFLICT`.
- `DEBT-AUD-A-03 Tracking`: Acknowledged as OPEN / PARTIALLY REMEDIATED.

Validation:
- TypeScript typecheck & build: PASS (0 errors)
- TypeScript test suites: 32/32 test files PASS (100% green; REQ-07D has 22 focused tests)
- Python quants-lab test suites: 45/45 PASS (100% green)
- `git diff --check`: PASS (0 errors). Zero external mutations, zero real capital, zero mainnet calls, zero credentials exposed.

## AXODUS-TRADING-EPIC-01 / REQ-07B — Strategy Lifecycle Authority Implementation

Status: `COMPLETE / CTO REVIEW REQUIRED`

The canonical, deterministic, durable, non-agentic `StrategyLifecycleAuthority` has been implemented in Trading Core. Governs strategy lifecycle state transitions under immutable, versioned policies (`DEFAULT_LIFECYCLE_POLICY_V1`), exact `StrategyRevision` binding, optimistic concurrency control (CAS) on lifecycle heads, durable append-only PostgreSQL transition history, idempotent replay suppression, and transactional outbox event emission (`StrategyLifecycleTransitionAccepted`, `StrategyRetired`, `StrategyDemoted`, `StrategyRevalidationEntered`, `StrategyLifecycleTransitionRejected`). Enforces strict boundary invariants: `QUALIFICATION ≠ TRANSITION` (PromotionEligibility is a necessary policy input where required, never a self-mutating authority), `LIFECYCLE ≠ HEALTH`, `LIFECYCLE ≠ RISK`, and `LIFECYCLE ≠ TRADINGINTENT`. Agents, Quant lab, Risk, and Health are strictly prevented from directly mutating lifecycle state.

Validation: contracts typecheck PASS; Trading Core typecheck PASS; build PASS; tests PASS (30 test suites passed / 0 failed / 0 skipped); Quant lab tests PASS (45/45); `git diff --check` PASS. Zero external trading mutations, zero real capital, zero mainnet calls.

# Trading Status

## AXODUS-TRADING-EPIC-01 / REQ-05

Status: `COMPLETE / CTO REVIEW REQUIRED`

Portfolio & Capital Allocation foundations are implemented. The milestone establishes the canonical Portfolio & Capital Allocator boundary consuming CanonicalPortfolioSnapshot, competing TradeProposals, StrategyHealth, and PromotionEligibility under versioned CapitalPolicyLimits to produce provider-neutral PortfolioDecisions. Enforces capital conservation (allocated ≤ available), strategy-level budget caps, instrument concentration limits, directional exposure tracking, conflict detection for opposing positions, explicit unknown-correlation handling, deterministic replay, input-permutation invariance, and immutable decision revalidation. RiskDecision authority, kill-switch ownership, TradingIntent generation, and Execution Plane integration remain out of scope.

Validation: contracts typecheck PASS; Trading Core typecheck PASS; build PASS; tests PASS (28 test suites passed / 0 failed / 0 skipped); `git diff --check` PASS. Zero external trading mutations.

## AXODUS-TRADING-EPIC-01 / REQ-04

Status: `COMPLETE / CTO REVIEW REQUIRED`

Strategy Intelligence and TradeProposal foundations are implemented. The milestone establishes the canonical Strategy Specialist boundary consuming qualified Opportunities, exact StrategyRevisions, MarketStates, PromotionEligibility, StrategyEvidence and StrategyHealth context to produce provider-neutral TradeProposals or NO_PROPOSAL. Supports deterministic specialists (Directional Swing, Futures Scalping), model/Agent-assisted specialists with fail-closed candidate validation, exact StrategyIdentity vs AgentIdentity separation, proposal deduplication, temporal expiry, immutable revalidation, and evidence lineage. Portfolio allocation, RiskDecision authority, TradingIntent runtime and Execution Plane integration remain out of scope.

Validation: contracts typecheck PASS; Trading Core typecheck PASS; build PASS; tests PASS (27 test suites passed / 0 failed / 0 skipped); `git diff --check` PASS. Zero external trading mutations.

## AXODUS-TRADING-EPIC-01 / REQ-01

## AXODUS-TRADING-EPIC-01 / REQ-02

## AXODUS-TRADING-EPIC-01 / REQ-03

Status: `COMPLETE / CTO REVIEW REQUIRED`

Opportunity Discovery foundation is implemented. Discovery consumes canonical MarketState, applies versioned detector and strategy-context semantics, fails closed on stale or incomplete inputs, emits deterministic contextual Opportunities, suppresses duplicates, supports expiry/revalidation and provides methodology-scoped comparison. TradeProposal, Portfolio, Risk and Execution authority remain out of scope.

Validation: contracts typecheck PASS; Trading Core typecheck PASS; build PASS; tests PASS (26 passed / 0 failed / 0 skipped); `git diff --check` PASS. Zero external trading mutations.

Status: `COMPLETE / CTO REVIEW REQUIRED`

Market Intelligence and MarketState construction foundations are implemented. Market observations are normalized into provider-neutral records, live freshness is evaluated against policy without invalidating historical data, feature-version compatibility is enforced, and deterministic `MarketState` objects are built with complete provenance and sequence quality tracking.

Validation: contracts typecheck PASS; Trading Core typecheck PASS; build PASS; tests PASS (25 suites passed / 0 failed); `git diff --check` PASS. Zero external trading mutations.

Status: `COMPLETE / CTO REVIEW REQUIRED`

Canonical Harness domain contracts and pure contract validators are implemented in
`trading-core/packages/trading-contracts`. The milestone includes StrategyIdentity,
StrategyRevision, lifecycle, feature, research references, MarketState, Opportunity,
TradeProposal, PortfolioDecision, RiskDecision and TradingIntent. Runtime intelligence,
portfolio optimization, complete risk admission and Execution Plane integration remain
out of scope.

Validation: contracts typecheck PASS; Trading Core typecheck PASS; build PASS; tests
PASS, 23 passed / 0 failed / 0 skipped; `git diff --check` PASS. No external orders,
mainnet calls, real capital or production credentials were used.

Last updated: 2026-09-19

## Portfolio Normalization

Request: PORTFOLIO-REQ-01 - Portfolio Status Normalization

Normalization result: COMPLETE

## Current Maturity

Detected level: L4 candidate - Functional integration readiness

Maturity recommendation: PROMOTE_TO_L4_CANDIDATE

Rationale:

- `.instructions` exists and contains Trading Core architecture, runtime model, compliance model, credential vault boundaries, risk, strategies, open risks and local E2E runbook evidence.
- Historical docs record local Postgres E2E and paper/local boundaries.
- Root workspace does not expose a direct `package.json`; validation commands are nested and must be run through a dedicated request.
- Live trading, real exchange keys, withdrawals, production database, credential vault runtime and treasury actions remain blocked.

Trading is not production-ready and cannot execute live or paper trading expansion in this cycle.

## Evidence Used

- `.instructions/TRADING_CORE_ARCHITECTURE.md`
- `.instructions/TRADING_RUNTIME_MODEL.md`
- `.instructions/TRADING_COMPLIANCE_MODEL.md`
- `.instructions/TRADING_CREDENTIAL_VAULT_ENVIRONMENT_BOUNDARIES.md`
- `.instructions/TRADING_REQUEST_03_LOCAL_E2E_ENVIRONMENT.md`
- `.instructions/TRADING_PHASE_17B_LOCAL_POSTGRES_E2E_RUNBOOK.md`
- `.instructions/TRADING_OPEN_RISKS.md`
- `.instructions/SECURITY.md`
- `trading-core/`

## Missing Operational Files Before Normalization

- `.instructions/STATUS.md`
- `.instructions/BLOCKER_REGISTER.md`
- `.instructions/VALIDATION.md`
- `.instructions/HANDOFF.md`

## Blockers

- Live trading is blocked.
- Real CEX execution and withdrawals are blocked.
- Production exchange keys and secrets are blocked.
- Production Credential Vault/KMS/HSM runtime is not approved.
- Production database execution path is not approved.
- Treasury actions are blocked.
- Current validation must be refreshed through the appropriate nested workspace.

## Dependencies

- Credential Vault approval.
- Risk/compliance approval.
- Governance approval for any execution path.
- Production database policy.
- Exchange integration policy.
- Treasury policy.

## Execution Policy

Allowed:

- local-only validation;
- paper/local planning where explicitly approved;
- credential-vault design documentation;
- non-executing architecture work.

Forbidden without explicit approval:

- live trading;
- real exchange API execution;
- withdrawals;
- production credentials;
- treasury movement;
- wallet signing;
- production database execution.

## Production Status

Production readiness: NO

Production execution: DISABLED

## Current Dependency and Implementation Status

- `AXODUS-TRADING-REQ-04`: `COMPLETE / CTO ACCEPTED / CURRENT BASELINE FROZEN / PUBLISHED`
- Current baseline: Condor `d89e74f…`, `hummingbot-api-client v1.5.9` at `dae015a3…`, Hummingbot API `2494e847…`
- `AXODUS-TRADING-IMP-01`: `COMPLETE / CTO ACCEPTED / RESTRICTED HTTP SUBSTRATE ESTABLISHED / PUBLISHED`
- `IMP-01A`: `COMPLETE / CTO ACCEPTED / PUBLISHED`; `IMP-01B`: `COMPLETE / CTO ACCEPTED / PUBLISHED`; `IMP-01C`: `COMPLETE / CTO ACCEPTED / PUBLISHED`
- `AXODUS-TRADING-IMP-01D-HTTP`: `COMPLETE / CTO ACCEPTED / PUBLISHED / HTTP-SAFE / STREAMING DEFERRED`
- `AXODUS-TRADING-BLOCKER-01`: open; Hummingbot client WebSocket authentication path is blocked; remediation design accepted
- Condor integration remains later work and cannot control execution directly

`AXODUS-TRADING-REQ-06`: complete / CTO accepted / published. The current Hummingbot baseline lacks caller-supplied client-order identity, provider idempotency and exact lookup surfaces needed for safe unknown-outcome reconciliation. `AXODUS-TRADING-BLOCKER-02` is open and `IMP-02` remains blocked. This status does not authorize credentials, direct trading, real orders, Gateway/wallet authority, production, System One activity or capital.

`AXODUS-TRADING-REQ-07`: complete / CTO accepted / published with classification `IDENTITY PROPAGATION NOT RELIABLE / IMP-02 REMAINS BLOCKED`; `AXODUS-TRADING-BLOCKER-02` remains open.

`AXODUS-TRADING-REQ-08`: complete as a source/provenance audit with final classification `CORE BASELINE UNRESOLVED`. The materialized API installs `hummingbot` unpinned and provides no Core revision, immutable package, lockfile or image digest. Binance spot/perpetual and Gateway/DEX identity behavior therefore remains unverified. `AXODUS-TRADING-BLOCKER-02` remains open and `IMP-02` remains blocked.

`AXODUS-TRADING-REQ-09`: complete with classification `PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED`. API history recovers explicit package pins `hummingbot==20241125` and `hummingbot==20250715`, but both were removed and no pin maps to an immutable Core SHA, artifact or image digest for API `2494e847...`. Historical reconstruction is therefore unresolved; prospective Axodus baseline qualification requires CTO selection. Connector identity trace and `IMP-02` remain blocked.

## Next Recommended Request

Select a prospective Axodus Core qualification path or provide immutable historical Core provenance. Do not clone upstream HEAD or select a historical package pin by approximation.

## PORTFOLIO-REQ-02 Validation Refresh

Status: COMPLETE_WITH_GAPS

Validation result: PASS_WITH_E2E_GAP

Commands:

```bash
npm run typecheck
npm test
```

Executed from:

```text
trading-core/services/trading-core
```

Evidence:

- typecheck: PASS
- tests: PASS, 240 passed / 1 skipped
- skipped: real local Postgres E2E test

Maturity decision: REQUIRES_REVALIDATION

Rationale:

- Trading Core contracts, boundaries and local tests passed.
- The root workspace still has no `package.json`.
- The real local Postgres E2E path remains documented but was not executed as a full live local E2E cycle in this request.
- Live trading, exchange execution, credentials, withdrawals and treasury remain blocked.

## TRADING-REQ-04 Safe Local Postgres E2E Revalidation

Status: COMPLETE

Validation result: PASS

Command:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e -- --json --cleanup
```

Evidence:

- local safety validation: PASS
- docker compose up: PASS
- wait for Postgres: PASS
- migrations: PASS
- mock seed data: PASS
- database health: PASS
- schema validation: PASS
- repository readiness and replay smoke: PASS
- docker compose down: PASS

Validated configuration:

- environment: `local`
- database host: `127.0.0.1`
- database port: `55433`
- database name: `axodus_trading_local`
- schema version: `0002_trading_events_tenant_id.sql`
- mock: true
- simulationOnly: true
- liveTradingEnabled: false
- productionReady: false

Maturity decision: PROMOTE_TO_L4_CANDIDATE

Rationale:

- The documented real local Postgres E2E path passed.
- Trading now has current evidence for local durable persistence, migrations, mock seed data, health checks, schema validation, repository readiness and replay smoke.
- Production trading, credentials, withdrawals, treasury movement and production databases remain blocked.

## AXODUS-TRADING-IMP-02B — Canonical CEX Execution Lifecycle & Reconciliation

Status: IMPLEMENTED / CTO REVIEW PENDING

The CEX lifecycle foundation is implemented for the frozen Binance Spot and Binance Perpetual capability model. Axodus creates an attempt-specific execution client identity, owns lifecycle transitions, requires declared caller identity/exact lookup/deterministic reconciliation capabilities, and records `FOUND`, `NOT_FOUND` and `INDETERMINATE` evidence without blind resubmission.

Cancellation remains a separate process (`cancel-requested` is not `cancelled`). REST exact lookup is the admitted correctness path; WebSocket remains blocked under `AXODUS-TRADING-BLOCKER-01`. Gateway/DEX is excluded from this CEX model.

Validation: `npm test` passed with 7 test files and 0 failures from `trading-core/services/trading-core`; `VAL-02B` remains pending and `AXODUS-TRADING-BLOCKER-02` remains open until that validation is accepted.

## AXODUS-TRADING-VAL-02B — Offline Deterministic CEX Lifecycle & Reconciliation

Status: COMPLETE / VALIDATION EVIDENCE READY / CTO REVIEW PENDING

Classification: `CEX RECONCILIATION PARTIALLY VALIDATED / BLOCKER-02 REMAINS OPEN`.

Validated exact found/not-found/indeterminate reconciliation, ambiguous submission, malformed evidence, lookup failures, cancellation ambiguity, terminal-state protection, connector admission, Gateway/DEX exclusion, WebSocket independence, concurrent/repeated operations and snapshot-equivalent recovery. The current lifecycle repository remains in memory, so durable persistence and crash recovery are not claimed.

Validation: `npm run typecheck`, dedicated VAL-02B suite (12 passed), full `npm test`, and `git diff --check` passed.

Record: `.instructions/TRADING_VAL_02B_OFFLINE_CEX_LIFECYCLE_RECONCILIATION.md`.

## AXODUS-TRADING-REQ-12 — Durable Execution State & Recovery Architecture Freeze

Status: `COMPLETE / ARCHITECTURE PARTIAL / DEPENDENCY DECISION REQUIRED`

The reuse-first audit confirms reusable PostgreSQL, migration, repository and event foundations. The accepted CEX lifecycle remains in memory, and the current database/event surfaces do not prove a single-connection transaction that atomically commits execution state, provider evidence and audit/outbox records.

Open decisions are the durable `SubmissionAttempt` schema/repository, transaction-capable connection abstraction, optimistic version/CAS and worker claim/fencing semantics, transactional outbox requirement, and crash/recovery validation plan.

`IMP-02C` remains `HOLD`. `AXODUS-TRADING-BLOCKER-02` is durability-only. `BLOCKER-01` remains independent and open.

Record: `.instructions/TRADING_REQ_12_DURABLE_EXECUTION_STATE_RECOVERY_ARCHITECTURE_FREEZE.md`.

## AXODUS-TRADING-IMP-02C0 — Durable Execution Persistence Primitives

Status: `IMPLEMENTED / VALIDATION READY / CTO REVIEW PENDING`

Implemented the first durable primitives selected by REQ-12: PostgreSQL `SubmissionAttempt` and outbox schema, repository persistence, single-connection transactions, optimistic CAS/versioning, recovery-candidate queries and typed concurrency/transaction boundaries. The in-memory lifecycle remains unchanged.

Validation performed: typecheck, full service test suite, real PostgreSQL rollback/CAS/restart visibility and transactional attempt-plus-outbox coverage, build and diff check. `VAL-02C0` remains the next gate; `AXODUS-TRADING-BLOCKER-02` remains open for full durable lifecycle and crash recovery.

Record: `.instructions/TRADING_IMP_02C0_DURABLE_EXECUTION_PERSISTENCE_PRIMITIVES.md`.

## AXODUS-TRADING-IMP-02C — Durable CEX Lifecycle & Crash Recovery

Status: `IMPLEMENTED / VALIDATION EVIDENCE READY / CTO REVIEW PENDING`

The accepted in-memory CEX lifecycle is now integrated with the durable PostgreSQL `SubmissionAttempt` repository. Canonical transitions use the single-connection transaction context and CAS; provider calls remain outside database transactions. Ambiguous submissions and cancellation outcomes recover through exact identity reconciliation without blind resubmission.

Validation: targeted PostgreSQL suite passed 7/7; full service suite passed 10/10 test files; build and typecheck passed; local simulation E2E passed with migration 0003 and cleanup. `VAL-02C` remains the next gate. `AXODUS-TRADING-BLOCKER-02` remains open for crash-window, process-restart and end-to-end recovery acceptance.

Record: `.instructions/TRADING_IMP_02C_DURABLE_CEX_LIFECYCLE_CRASH_RECOVERY.md`.

## AXODUS-TRADING-VAL-02C — Durable Crash Recovery Acceptance

Status: `COMPLETE / CTO ACCEPTED`

Classification: `DURABLE CEX LIFECYCLE & CRASH RECOVERY VALIDATED / BLOCKER-02 CLOSURE ACCEPTED`.

Evidence accepted: PostgreSQL-backed lifecycle recovery, exact REST reconciliation, ambiguous submission and cancellation recovery, CAS-safe concurrent workers, restart using new service/repository instances, 7/7 targeted PostgreSQL tests, 10/10 full service test files, typecheck, build, local simulated E2E with cleanup and diff check. This validates the controlled Axodus/provider boundary only; real venue execution remains unvalidated.

## AXODUS-TRADING-BLOCKER-02 — Closure

Status: `RESOLVED / CTO CLOSED` on 2026-09-18.

The blocker evolution is preserved in `.instructions/BLOCKER_REGISTER.md`. Identity continuity, exact CEX reconciliation, durable persistence, CAS, outbox and crash-recovery integration are resolved within the simulated/provider boundary. `BLOCKER-01` remains open; Gateway/DEX reconciliation, Condor, live execution and capital remain outside scope and authority.

## AXODUS-TRADING-VAL-03 — Hummingbot Runtime & CEX Provider Integration Acceptance

Status: `COMPLETE / CTO ACCEPTED`.

The gate validates the materialized Python runtime, API/Core imports, controlled connector behavior, Axodus integration and runtime fault injection without credentials, exchange connectivity, orders, WebSocket, Condor, DEX or capital. Core compatibility 5/5, client contract 337/337, deterministic API synchronization 6/6, deterministic API reconciliation 7/7 and Trading Core regression pass. The full controlled lifespan harness now passes with local PostgreSQL, Core initialization, controlled connector submission/lookup/cancellation, restart visibility and cleanup. Temporary `hummingbot==20260901` is validation-only and is not a baseline change.

Controlled FastAPI HTTP and full-lifespan harness evidence is now available: submission identity, exact lookup, cancellation, malformed request rejection, provider failure normalization, no-blind-retry behavior, PostgreSQL persistence, service reconstruction and deterministic cleanup all pass. The order-history timeout remains unaccepted and is proposed for CTO review as a documented non-critical limitation because it is outside submission, exact reconciliation, cancellation and crash recovery.

## AXODUS-TRADING-REQ-13 — External CEX Validation & Paper/Shadow Readiness Freeze

Status: `COMPLETE / CTO REVIEW READY`

Classification: `PAPER/SHADOW READINESS FROZEN / EXTERNAL CONNECTIVITY HOLD`

Defined the strict environment, credential, security, and operational capability boundaries required before Axodus Trading can enter testnet, sandbox, paper, or shadow environments:
- External connectivity: HOLD
- Credentials: HOLD
- Orders: NOT AUTHORIZED
- Capital: NONE
- BLOCKER-01 (WebSocket): OPEN / KEEP BLOCKED / DO NOT USE; the external validation path relies strictly on HTTP/REST.
- Order history timeout: DOCUMENTED NON-CRITICAL LIMITATION.

Record: `.instructions/TRADING_REQ_13_EXTERNAL_READINESS_FREEZE.md`

## AXODUS-TRADING-VAL-04 Phase A — External Safety Preflight & Governance Freeze

Status: `COMPLETE / CTO REVIEW READY`

Classification: `EXTERNAL SAFETY PREFLIGHT VALIDATED / PHASE B READY FOR CTO REVIEW`

Implemented and validated the strict offline safety preflight evaluation policy:
- Environment admission: only testnet, sandbox, and paper are admitted; mainnet, production, live, and prod are deterministically rejected.
- Zero-withdrawal credential enforcement: rejection of `withdraw`, `withdrawal`, `transfer`, and `universal_transfer` scopes.
- Instrument allowlist: strict matching against allowed pairs.
- Hard limits: enforces per-order maximum notional ceiling, maximum cumulative run notional budget, and maximum concurrent outstanding orders.
- Duplicate/replay protection: rejects active concurrent reuse of `clientOrderId`.
- Session and tenant isolation: enforces exact match of `tenantId` and `runSessionId`.
- Kill switch: deterministic suspension of order dispatch.
- Deterministic cleanup preflight: verifies automated cancellation list preparation and state clearing.
- WebSocket independence: confirms full HTTP/REST execution boundary under `BLOCKER-01`.

Validation: `npm run typecheck` passed; `npm test` passed 11/11 test files including `val-04a-safety-preflight.test.mjs`.

Record: `.instructions/TRADING_VAL_04A_EXTERNAL_SAFETY_PREFLIGHT.md`

## AXODUS-TRADING-VAL-04B — Pre-Credential External CEX Harness

Status: `COMPLETE / PRE-CREDENTIAL VALIDATED / EXTERNAL EXECUTION HOLD`

Implemented and validated the offline preparation boundary for the frozen
`binance_perpetual_testnet` envelope. The harness derives BTC-USDT venue rules
from runtime `exchangeInfo`, derives a minimum valid LIMIT order, applies the
Axodus hard notional ceiling, rejects credential capability during the
pre-credential stage, and keeps external execution closed by default behind an
explicit approval gate.

Validation: `npm run typecheck` passed; `npm test` passed 12/12 test files.
No Binance credentials, private calls, testnet orders, WebSocket, capital, or
mainnet activity were used.

Record: `.instructions/TRADING_VAL_04B_PRE_CREDENTIAL_HARNESS.md`

## AXODUS-TRADING-VAL-04B1 — Testnet Credential & Authenticated Read

Status: `COMPLETE / R2 PASS / AUTHENTICATED READ ACCEPTED / EXTERNAL EXECUTION CLOSED`

The pre-credential boundary is implemented for Binance USDⓈ-M Futures Testnet:
exact testnet domain, mainnet exclusion, credential environment/scope checks,
read-only account GET admission, ephemeral signing, sanitized results and
redaction validation. The process currently has no injected testnet
credentials, so no authenticated private call was made. `VAL-04B1-R2` then
performed the single CTO-authorized authenticated read with the refreshed
testnet credential pair.

Validation: typecheck, build, 13/13 Trading Core test files and diff check
passed. R2 returned HTTP 200 from the exact Binance USDⓈ-M Futures Testnet
account endpoint with authenticated account evidence. `.env.local` is mode
`0600`, ignored and untracked. Sanitized evidence recorded `canTrade: true`,
8 assets, `mutatingCallsMade: false`, `websocketUsed: false`, and secret
redaction. No order, cancellation, WebSocket, mainnet or capital activity
occurred. `VAL-04B2` remains `HOLD` pending separate CTO authorization.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B1_TESTNET_AUTHENTICATED_READ.md`.

## AXODUS-TRADING-VAL-04B2 — First Controlled Testnet Order Acceptance

Status: `EXECUTED / PASS CANDIDATE / CTO REVIEW REQUIRED`

The native-host execution completed the authorized single Testnet lifecycle.
Runtime venue rules were derived dynamically for `BTCUSDT / PERPETUAL`, one
LIMIT order was submitted, exact client identity was preserved through lookup,
the same order was canceled and terminally reconciled, and cleanup confirmed
zero active validation orders and zero residual position. Sanitized evidence is
recorded in the validation record. CTO final review remains required.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B2_TESTNET_CONTROLLED_ORDER.md`.

## AXODUS-TRADING-VAL-04B2-R1 — Network Preflight

Status: `BLOCKED / DNS OR SANDBOX NETWORKING / SAFE STOP`

## AXODUS-TRADING-VAL-04B2-R5 — Native Host Public Qualification

Status: `COMPLETE / CTO ACCEPTED / NATIVE HOST PATH QUALIFIED`

The native host `whostler` passed DNS, TLS, public REST and built-runner
qualification for `BTCUSDT / PERPETUAL / TRADING` with runtime-derived venue
filters. The Agent sandbox restriction remains an external environment fact.

## AXODUS-TRADING-VAL-04B2 — Controlled Testnet Order Lifecycle

Status: `EXECUTED / PASS CANDIDATE / CTO REVIEW REQUIRED`

One authorized Testnet LIMIT order was submitted and canceled successfully.
Exact identity lookup, terminal reconciliation and zero-residual cleanup passed;
blind retries, WebSocket and mainnet contact were zero.

## AXODUS-TRADING-VAL-04B2-R2 — Public Network Qualification

Status: `COMPLETE / CTO ACCEPTED / SANDBOX NETWORK ISOLATION CONFIRMED`

## AXODUS-TRADING-VAL-04B2-R4-R4 — Built Entrypoint Correction

Status: `COMPLETE / CTO REVIEW READY / PHASE B NOT AUTHORIZED`

The live runner execution targets were corrected to run from the built JavaScript
output (`dist/services/trading-core/trading-core/services/trading-core/src/external/val-04b2-live-runner.js`),
resolving the `.js` module resolution defect without altering canonical source
imports or the frozen harness. A dedicated verification script
`scripts/verify-val-04b2-built-runner.mjs` was added to assert that all built
dependencies resolve and that `--execute` without operational confirmation fails
closed. Typecheck, build, 15/15 test files, diff-check and secret protection pass.

Historical Phase B attempts summary: Attempts #1, #2, and #3 all aborted safely
prior to credential loading, private calls, or order submission; total orders
submitted across all attempts: 0; mutation authority consumed: no. Phase B
mutation remains strictly on HOLD pending explicit CTO authorization.

The CTO-authorized public network qualification was attempted for
`testnet.binancefuture.com` with zero credentials. The command sandbox
isolates network sockets, and an escalated execution request failed automated
approval review due to the upstream provider issue (`structured output is not
implemented by opencodex`). The gate aborted safely without private calls,
orders, cancellations, WebSocket, or mainnet contact.

The authorized public-only preflight could not resolve
`testnet.binancefuture.com` in the current execution host. TCP/TLS and public
`GET /fapi/v1/exchangeInfo` were not reached. No credentials, private calls,
orders, cancellations, WebSocket or mainnet endpoints were used. The mutation
authority from the prior B2 attempt is consumed and closed; a future retry
requires a new CTO authorization after public reachability is proven.
## AXODUS-TRADING-REQ-14 — Operational Trading Readiness & Failure Recovery

Status: `COMPLETE / CTO REVIEW REQUIRED`

The audit confirms that controlled Testnet execution is validated, while
continuous Testnet trading and autonomous Agent trading are not ready. The
remaining gaps are the continuous execution supervisor, complete fill/terminal
state coverage, startup recovery orchestration, durable position/order drift
admission, continuous risk limits, unified kill switch, strategy intent
ownership and operational observability. Mainnet is out of scope.

Record: `.instructions/TRADING_REQ_14_OPERATIONAL_TRADING_READINESS_FAILURE_RECOVERY.md`.

## AXODUS-TRADING-AEES-05 / IMP-05A — Continuous Execution Runtime & Durable Execution Ownership

Status: `COMPLETE / PERSISTED IN COMMIT`

Continuous execution runtime establishes canonical, durable execution creation before any external mutation can occur. Deterministic client order identity is bound prior to mutation submission. Preflight gates reject unadmitted environments and notional limit breaches fail-closed. In-flight network ambiguities transition explicitly to `execution-unknown` requiring reconciliation, strictly preventing blind resubmission.

Validation: 16 test files pass, typecheck passes, build passes.

## AXODUS-TRADING-AEES-05 / IMP-05B — Failure Recovery & Order Reconciliation

Status: `COMPLETE / PERSISTED IN COMMIT`

Continuous order recovery service provides discovery and deterministic reconciliation for non-terminal attempts after crash, restart, or lost response. Discovered attempts are looked up via read-only exact client order identity query without issuing any new order mutations. Idempotency across repeated recovery passes is proven.

Validation: 17 test files pass, typecheck passes, build passes.

## AXODUS-TRADING-AEES-05 / IMP-05C — Position Reconciliation, Risk Envelope & Kill Switch

Status: `COMPLETE / PERSISTED IN WORKTREE (GIT RO)`

Position reconciliation, continuous risk envelope, and fail-closed kill switch services are fully implemented. Risk envelope enforces symbol allowlists, testnet/sandbox environments, stale quote rejections, limit price deviation bounds, order/position notional ceilings, and active order counts. Kill switch operates fail-closed across operator stops and divergence signals.

Validation: 18 test files pass, typecheck passes, build passes.

## AXODUS-TRADING-AEES-05 / IMP-05D — Trading Intent Admission & Operational Concurrency

Status: `COMPLETE / PERSISTED IN WORKTREE (GIT RO)`

Continuous intent admission service defines the canonical boundary between Strategy/Agent and Execution Runtime without sharing exchange credentials. Concurrency controls enforce symbol-level mutual exclusion, idempotent duplicate intent suppression, and active execution collision gating.

Validation: 19 test files pass, typecheck passes, build passes.

## AXODUS-TRADING-AEES-05 / IMP-05E — Operational Hardening, Observability & Continuous Runtime Integration

Status: `COMPLETE / READY FOR VAL-05 / ALL 20 TEST SUITES PASS`

Continuous observability collector and simulation runner integrate telemetry with strict secret sanitization redaction. Comprehensive failure-injection suite validates persistence drops, ambiguous mutation responses, post-POST crash recovery, sanitized telemetry, and multi-intent simulation sessions.

Validation: 20 test files pass (100% pass), typecheck passes, build passes.

## AXODUS-TRADING-AEES-05 / IMP-05F — Continuous Live Provider Composition

Status: `COMPLETE / CTO ACCEPTED / PERSISTED / ALL 21 TEST SUITES PASS`

Implemented canonical `ContinuousBinanceTestnetProvider` providing live mutation (`POST /order`), exact lookup (`GET /order` by `origClientOrderId`), cancellation (`DELETE /order`), open orders (`GET /openOrders`), and position risk (`GET /positionRisk`). Implemented `Val05ContinuousRunner` with explicit session envelope, durable session budgeting (`PostgresVal05SessionBudgetStore`), and guarded runner modes. Deterministic integration tests cover all 20 required scenarios.

Validation: 21 test files pass (100% pass), typecheck passes, build passes, live public Testnet read verified, `BLOCKER-05` resolved by commit `7e5d8cb`.

Evidence: `.instructions/validation/AXODUS-TRADING-IMP-05F_CONTINUOUS_LIVE_PROVIDER_COMPOSITION.md`.

## AXODUS-TRADING-VAL-05 — Continuous Testnet Trading Acceptance

Status: `COMPLETE / PASS / CTO ACCEPTED`

Reconciled and formally accepted by CTO review following `VAL-05-FIX-01`.
The continuous live provider composition, durable PostgreSQL session accounting,
and exact client-order reconciliation are validated. Final evidence commit:
`ded3f85d2acc3f2f6d6d9e1337bf1dcafc123710`.

Safety accounting: External Safety PASS, Residual Orders 0, Residual Position 0,
Blind Retries 0, Duplicate Submissions 0, Mainnet Calls 0, Secrets Exposed false,
Cleanup PASS.

Evidence: `.instructions/validation/AXODUS-TRADING-VAL-05_CONTINUOUS_TESTNET_TRADING_ACCEPTANCE.md`.

## AXODUS-TRADING-VAL-05-FIX-01 — Provider-Acknowledged Exact Reconciliation

Status: `COMPLETE / CTO ACCEPTED`

Corrected the lifecycle so `provider-acknowledged` requires exact provider
reconciliation instead of being treated as terminal. Added deterministic
coverage for provider states, lookup failures, repeated reconciliation,
persisted identity, and no-blind-retry behavior. Historical VAL-05 Executions
A/B were read-only reconciled on Binance Futures Testnet by their persisted
client identities; both returned `CANCELED`, with zero orders, zero
cancellations, zero residual position, and durable session budget preserved at
`2 / 0`.

Validation: typecheck PASS, build PASS, 22/22 test files PASS, built-runner
verification PASS, `git diff --check` PASS.
Evidence: `.instructions/validation/AXODUS-TRADING-VAL-05_CONTINUOUS_TESTNET_TRADING_ACCEPTANCE.md`.

## AXODUS-TRADING-REQ-15 — Sovereign Agentic Trading Architecture & Infrastructure Freeze

Status: `COMPLETE / DOCUMENTAL AUDIT & ARCHITECTURE FREEZE / CTO REVIEW REQUIRED`

Authorized by the Sovereign Program Planning & Epic Architecture Mandate following
the acceptance of `VAL-05`. Covers the documentary audits of Trading, ACS, Hummingbot,
Condor, and `quants-lab`, the Sovereign Architecture Freeze, ownership and component
classification matrices, domain contracts, data architecture, security boundaries,
strategy lifecycle, gap register, and candidate EPIC sequencing.

Record: `.instructions/TRADING_REQ_15_SOVEREIGN_AGENTIC_TRADING_ARCHITECTURE_FREEZE.md`.
## AXODUS-TRADING-CROSS-EPIC-SCF-01 — Shared Contract Freeze

Status: `COMPLETE / CTO REVIEW REQUIRED / IMPLEMENTATION HOLD`

SCF-01 freezes the shared semantic boundary between EPIC-01 and EPIC-QUANT for
strategy identity/revision, lifecycle, MarketState, feature definitions,
dataset and experiment references, StrategyEvidence, PromotionEligibility and
StrategyHealth. It also records ACS Evidence mapping, provider-neutrality,
versioning, immutability and shared-file change control.

Readiness remains `PARALLEL IMPLEMENTATION READY: NO`: the formal EPIC-01 plan
was not found in the local audit surface and ACS adapter conformance is not yet
validated. No runtime implementation or trading authority is granted.

## AXODUS-TRADING-AEES-AUDIT-01 — Critical Audit Remediation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Remediated all five defects identified in the adversarial audit `AXODUS-TRADING-CROSS-EPIC-AUDIT-01-REPORT`:
1. `FIX-A-01` (AUD-A-01 / P0): Replaced native JS floating-point arithmetic in `CapitalAllocationService` with exact `FixedDecimal` BigInt arithmetic (12 decimal places), eliminating precision drift and fractional over-allocation.
2. `FIX-A-02` (AUD-A-02 / P0): Opposing directional proposals fail closed and are rejected when `policy.allowOpposingPositions` is not explicitly enabled.
3. `FIX-A-03` (AUD-A-03 / P2): Implemented durable proposal tombstones preventing duplicate proposal submission attacks across allocation batches.
4. `FIX-Q-01` (AUD-Q-01 / P1): Walk-forward validation with failed folds withholds aggregate moment/Sharpe diagnostics to eliminate survivorship bias.
5. `FIX-C-01` (AUD-C-01 / P1): Enforced schema validation for `MarketState` feature objects across TypeScript contracts and Python data pipelines.

Validation:
- `npm --prefix trading-core/services/trading-core run typecheck` — PASS
- `npm --prefix trading-core/services/trading-core test` — PASS (28/28 test suites)
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — PASS (36/36 tests)
- `git diff --check` & `git -C quants-lab diff --check` — PASS

## AXODUS-TRADING-CROSS-EPIC / VAL-AUDIT-01 — Independent Adversarial Remediation Validation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Validated all five remediations delivered by `AEES-AUDIT-01` through independent adversarial property testing, fuzzing, boundary replay, and cross-language schema conformance:
1. `AUD-A-01` (P0): CLOSED. `FixedDecimal` BigInt arithmetic strictly conserves capital (`Σ approved ≤ available`) across 1,000 micro-allocations and large edge cases without IEEE-754 drift.
2. `AUD-A-02` (P0): CLOSED. Opposing directional proposals fail closed by default; explicit policy strictly bounds allocations to remaining gross headroom.
3. `AUD-A-03` (P2): PARTIALLY REMEDIATED (non-blocking). `processedProposalsTombstone` prevents re-submission attacks within service lifetime; durable deduplication is enforced downstream by Postgres repository.
4. `AUD-Q-01` (P1): CLOSED. Walk-forward executions with failed folds set status to `PARTIAL` and withhold aggregate statistical diagnostics, preventing survivorship bias.
5. `AUD-C-01` (P1): CLOSED. 100% agreement on positive and negative `MarketState` feature validation fixtures across TypeScript and Python.

Result: `VAL-AUDIT-01 RESULT: PASS WITH REMEDIATIONS`
Track Gates: `EPIC-01 / REQ-06` (Risk Authority) and `EPIC-QUANT / REQ-QUANT-06` (Strategy Evidence Qualification & Promotion Gate) are READY for CTO unblocking.


## AXODUS-TRADING-EPIC-01 / REQ-06  14 Risk Authority & Execution Boundary

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Implemented deterministic, non-agentic `RiskAuthorityService` in `trading-core/services/trading-core/src/risk/`.
- Implemented canonical `RiskDecisionValidator` enforcing pure contracts, evaluation context validation, monotonicity constraints, and kill-switch verification.
- Enforced complete frozen disposition precedence: `HALT > REJECT > MODIFY > ALLOW`.
- Enforced explicit `HaltScope` model: `PROPOSAL`, `STRATEGY`, `INSTRUMENT`, `PORTFOLIO`, `SYSTEM`.
- Enforced exact `FixedDecimal` BigInt arithmetic (12 decimal places) for financial boundaries, preventing IEEE-754 floating-point drift.
- Enforced risk monotonicity: Risk Authority can only reduce or reject capital and leverage; it can never increase upstream exposure.
- Enforced gross exposure vs net exposure: gross concentration cannot be masked by netting.
- Enforced opposing position protection: opposing directional proposals fail closed absent explicit policy.
- Enforced StrategyHealth gating: `SUSPENDED` and `RETIRED` strictly fail closed; `UNKNOWN` and `REVALIDATION_REQUIRED` fail closed; `DEGRADED` is strictly policy-governed.
- Enforced temporal determinism & freshness: stale or expired MarketState and PortfolioDecision fail closed.
- Strict boundary preservation: zero `TradingIntent` or execution plane emission.

Validation:
- `npm --prefix trading-core/services/trading-core run typecheck`  14 PASS (0 errors)
- `npm --prefix trading-core/services/trading-core run build`  14 PASS (0 errors)
- `npm --prefix trading-core/services/trading-core test`  14 PASS (29/29 test suites, including all 18 REQ-06 tests)
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py'`  14 PASS (45/45 tests)
- `git diff --check`  14 PASS (0 errors)

Next Gate:
- CTO review and acceptance of `EPIC-01 / REQ-06`.
- Authorization to advance to `EPIC-01 / REQ-07` (Canonical TradingIntent & Execution Boundary Integration).


## AXODUS-TRADING-CROSS-EPIC / REQ-07A — Strategy Promotion, Health & Risk Integration Boundary Freeze

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Completed comprehensive architectural specification `.instructions/TRADING_REQ_07A_STRATEGY_PROMOTION_HEALTH_RISK_BOUNDARY_FREEZE.md`.
- Reconciled and frozen all 10 canonical architectural decisions (`DEC-07A-01` through `DEC-07A-10`).
- Defined explicit cross-epic boundaries connecting Quant Evidence Qualification (`REQ-QUANT-06`), Strategy Lifecycle (`REQ-07B`), Strategy Health (`REQ-07C`), Risk Authority (`REQ-06`), and TradingIntent (`REQ-07D`).
- Established the canonical 6x12 StrategyHealth x StrategyLifecycleState compatibility matrix, TOCTOU prevention via `StrategyOperationalSnapshot`, emergency suspension escalation protocols, atomic PostgreSQL transactional outbox patterns, and rigorous TradingIntent emission prerequisites.
- Zero runtime mutations, zero execution plane emission, zero credential exposure, zero mainnet calls.

Validation:
- TypeScript typecheck & build: PASS (0 errors)
- TypeScript test suites: 29/29 PASS
- Python quants-lab test suites: 45/45 PASS
- `git diff --check`: PASS (0 errors)

Next Gate:
- CTO review and acceptance of `REQ-07A`.
- Unblocking of `REQ-07B` (Strategy Lifecycle Authority Implementation), `REQ-07C` (Strategy Health Authority Implementation), and `REQ-07D` (Canonical TradingIntent & Execution Boundary Integration).

## AXODUS-TRADING-EPIC-01 / REQ-07C — Strategy Health Authority & Operational Snapshot

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered the canonical non-agentic `StrategyHealthAuthority` with exact StrategyRevision binding, immutable policy revisions, append-only transition history, CAS, durable idempotency, and transactional outbox writes. The authority preserves the six frozen health states and rejects direct Agent or Quant state mutation.

Delivered `StrategyOperationalSnapshot` as the atomic read-side join of lifecycle and health heads. It binds StrategyRevision, lifecycle version, health version, compatibility disposition, deterministic identity, and explicit expiry. The 6 × 12 lifecycle-health compatibility matrix is exhaustive; it is distinct from RiskDecision dispositions. Live Risk evaluation now requires and records the operational snapshot binding, making health or lifecycle drift detectable before future TradingIntent work.

Validation:
- `npm --prefix trading-core/services/trading-core run typecheck` — PASS (0 errors)
- `npm --prefix trading-core/services/trading-core run build` — PASS (0 errors)
- `npm --prefix trading-core/services/trading-core test` — PASS (31/31 suites; REQ-07C: 8/8 tests)
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — PASS (45/45 tests)
- `git diff --check` and `git -C quants-lab diff --check` — PASS

Boundaries preserved: no TradingIntent, no execution adapter, no exchange mutation, no credentials, no mainnet, and no real capital. `DEBT-AUD-A-03` remains open / partially remediated.
