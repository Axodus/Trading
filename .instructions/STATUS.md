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
