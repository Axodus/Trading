# Trading Status

Last updated: 2026-06-08

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
- `AXODUS-TRADING-IMP-01`: `IMPLEMENTATION IN PROGRESS / RESTRICTED HTTP BASELINE`
- `IMP-01A`: `COMPLETE`; `IMP-01B`: `COMPLETE`; `IMP-01C`: `COMPLETE / CTO REVIEW PENDING`
- `AXODUS-TRADING-IMP-01D`: conditional on an explicitly admitted market-data transport
- `AXODUS-TRADING-BLOCKER-01`: open; Hummingbot client WebSocket authentication path is blocked
- Condor integration remains later work and cannot control execution directly

The next implementation work is governed by `.instructions/TRADING_IMP_01_RESTRICTED_BASELINE_AUTHORIZATION.md`. IMP-01C is complete for offline validation of the restricted HTTP order surface. `IMP-01D` remains conditional on an explicitly admitted market-data transport. This status does not authorize credentials, direct trading, real orders, Gateway/wallet authority, production, System One activity or capital.

## Next Recommended Request

`AXODUS-TRADING-IMP-01D` conditional market-data read boundary after transport admission

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
