# Trading Status

Last updated: 2026-09-17

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

Status: `INCOMPLETE / EXTERNAL NETWORK BLOCKED / SAFE ABORT VALIDATED`

The CTO-authorized single mutation run was attempted on 2026-09-18. Local
preflight confirmed `.env.local` mode `0600`, Git-ignored and untracked. The
mandatory public Testnet `exchangeInfo` request failed before mutation because
the execution host could not resolve `testnet.binancefuture.com` (`EAI_AGAIN`).
No private call, order submission, cancellation, WebSocket, mainnet contact or
blind retry occurred. The mutation gate remains closed; no external cleanup is
required because no order was created.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B2_TESTNET_CONTROLLED_ORDER.md`.

## AXODUS-TRADING-VAL-04B2-R1 — Network Preflight

Status: `BLOCKED / DNS OR SANDBOX NETWORKING / SAFE STOP`

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
