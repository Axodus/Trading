# TRADING-REQ-04 - Safe Local Postgres E2E Revalidation Report

Date: 2026-06-08

Workspace: `/opt/Axodus/Trading`

Service workspace: `/opt/Axodus/Trading/trading-core/services/trading-core`

## Summary

TRADING-REQ-04 validated the documented local Postgres E2E workflow for Trading Core.

Final decision: PROMOTE_TO_L4_CANDIDATE

This is a maturity/readiness decision only. It does not authorize live trading, exchange credentials, withdrawals, deposits, wallet signing, on-chain execution, treasury interaction, production databases, production execution or production readiness.

## Files Inspected

- `.instructions/STATUS.md`
- `.instructions/VALIDATION.md`
- `.instructions/BLOCKER_REGISTER.md`
- `.instructions/HANDOFF.md`
- `.instructions/TRADING_MATURITY_ASSESSMENT.md`
- `.instructions/TRADING_REQUEST_03_LOCAL_E2E_ENVIRONMENT.md`
- `.instructions/TRADING_PHASE_17B_LOCAL_POSTGRES_E2E_RUNBOOK.md`
- `trading-core/services/trading-core/README.md`
- `trading-core/services/trading-core/docs/LOCAL_POSTGRES_E2E.md`
- `trading-core/services/trading-core/docs/LOCAL_POSTGRES_TROUBLESHOOTING.md`
- `trading-core/services/trading-core/package.json`
- `docker-compose.trading.yml`
- `.env.example`

## E2E Path Located

Command:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e -- --json --cleanup
```

The command builds Trading Core, starts local Postgres, waits for readiness, runs migrations, seeds mock data, checks health, validates schema, runs repository readiness/replay smoke, then stops the local compose service.

## Local Database Configuration

Local-only defaults:

- environment: `local`
- host: `127.0.0.1`
- port: `55433`
- database: `axodus_trading_local`
- user: `axodus_trading`
- schema: `public`
- minimum schema version: `0002_trading_events_tenant_id.sql`

No production database URL, exchange credential, wallet key or secret was used.

## Validation Commands

Preflight:

```bash
docker version
docker compose --env-file .env.example -f docker-compose.trading.yml ps
env | rg '^TRADING_(ENV|DB_)' || true
git status --short --branch
```

Primary validation:

```bash
npm run trading:local:e2e -- --json --cleanup
```

Post-run cleanup check:

```bash
docker compose --env-file .env.example -f docker-compose.trading.yml ps || true
```

## Validation Results

Primary validation: PASS

JSON summary:

```text
ok: true
status: passed
environment: local
durationMs: 145003
cleanup: true
reset: false
skipDocker: false
mock: true
simulationOnly: true
liveTradingEnabled: false
productionReady: false
```

Step results:

| Step | Result |
|---|---|
| local safety validation | PASS |
| docker compose up | PASS |
| wait for postgres | PASS |
| run migrations | PASS |
| seed local data | PASS |
| database health | PASS |
| schema validation | PASS |
| repository readiness and replay smoke | PASS |
| docker compose down | PASS |

## Blocker Review

| Blocker | Status | Notes |
|---|---|---|
| Live trading blocked | ACTIVE | Still forbidden. |
| Production credentials blocked | ACTIVE | Still forbidden. |
| Current validation refresh required | RESOLVED | Local Postgres E2E passed. |
| Root `package.json` absent | ACTIVE | Still true; validation path is nested. |
| Real local Postgres E2E not executed | RESOLVED | E2E passed with cleanup. |
| Production database execution blocked | ACTIVE | Still forbidden. |
| Treasury movement blocked | ACTIVE | Still forbidden. |

## Maturity Assessment

Previous decision: REQUIRES_REVALIDATION

New decision: PROMOTE_TO_L4_CANDIDATE

Rationale:

- documented local Postgres E2E path passed;
- local durable persistence path validated against real local Postgres;
- migrations, mock seed, health, schema validation, repository readiness and replay smoke passed;
- cleanup passed;
- JSON output confirms mock/simulation-only mode and no production readiness.

## Remaining Risks

- Live trading remains blocked.
- Production credentials remain blocked.
- Production database execution remains blocked.
- Credential Vault/KMS/HSM runtime remains not approved.
- Withdrawals, deposits, treasury movement, wallet signing and on-chain writes remain blocked.
- Root workspace still does not expose a root `package.json`; validation remains nested under Trading Core.

## Final Recommendation

Promote Trading to L4 candidate for local durable persistence/readiness evidence.

Keep Trading on HOLD for production/execution-sensitive work.
