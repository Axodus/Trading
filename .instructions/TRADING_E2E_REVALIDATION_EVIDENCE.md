# Trading E2E Revalidation Evidence

Date: 2026-06-08

Request: TRADING-REQ-04 - Safe Local Postgres E2E Revalidation

## Decision

Maturity recommendation: PROMOTE_TO_L4_CANDIDATE

## Scope

Validated the documented local Postgres E2E path for Trading Core.

This evidence is local-only and mock/simulation-only. It does not authorize production database use, live trading, real exchange connectivity, production credentials, wallet signing, withdrawals, treasury movement, Hummingbot live runtime, or production readiness.

## Workspace

- Root workspace: `/opt/Axodus/Trading`
- Service workspace: `/opt/Axodus/Trading/trading-core/services/trading-core`
- Branch at validation start: `dev`
- Root `package.json`: NOT_PRESENT
- Service `package.json`: PRESENT

## Documented Validation Path

Primary command:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e -- --json --cleanup
```

Documented support files:

- `trading-core/services/trading-core/docs/LOCAL_POSTGRES_E2E.md`
- `trading-core/services/trading-core/docs/LOCAL_POSTGRES_TROUBLESHOOTING.md`
- `docker-compose.trading.yml`
- `.env.example`
- `trading-core/services/trading-core/scripts/trading-local-e2e.ts`
- `trading-core/services/trading-core/scripts/trading-db.ts`
- `trading-core/services/trading-core/scripts/smoke-local-postgres.ts`
- `trading-core/services/trading-core/migrations/0001_trading_state.sql`
- `trading-core/services/trading-core/migrations/0002_trading_events_tenant_id.sql`

## Local Configuration Used

No `TRADING_ENV` or `TRADING_DB_*` shell variables were exported during the preflight check.

Local defaults:

```text
TRADING_ENV=local
TRADING_DB_HOST=127.0.0.1
TRADING_DB_PORT=55433
TRADING_DB_NAME=axodus_trading_local
TRADING_DB_USER=axodus_trading
TRADING_DB_SCHEMA=public
TRADING_DB_MIN_SCHEMA_VERSION=0002_trading_events_tenant_id.sql
```

The database password value is intentionally not repeated in this evidence file.

Docker:

- Docker server: available
- Compose state before run: no active Trading service
- Compose cleanup after run: PASS

## Command Executed

```bash
npm run trading:local:e2e -- --json --cleanup
```

## Result

Overall result: PASS

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

## Step Results

| Step | Status |
|---|---|
| local safety validation | PASSED |
| docker compose up | PASSED |
| wait for postgres | PASSED |
| run migrations | PASSED |
| seed local data | PASSED |
| database health | PASSED |
| schema validation | PASSED |
| repository readiness and replay smoke | PASSED |
| docker compose down | PASSED |

## Database Evidence

- Host: `127.0.0.1`
- Port: `55433`
- Database: `axodus_trading_local`
- User: `axodus_trading`
- Schema version: `0002_trading_events_tenant_id.sql`
- Health: `healthy`
- Connectivity: `connected`
- Migration consistency: `consistent`
- Repository readiness: `ready`
- Schema compatibility: `compatible`

## Repository Readiness Evidence

Required tables were present:

- `trading_events`
- `trading_orders`
- `trading_fills`
- `trading_positions`
- `trading_portfolios`
- `trading_runtime_instances`
- `trading_provider_state`
- `trading_runtime_audit`

Replay smoke:

- event persistence: PASS
- correlation replay: PASS
- tenant-scoped replay: PASS
- user/treasury separation in replay paths: PASS

## Boundary Confirmation

Confirmed by E2E JSON:

- mock: true
- simulationOnly: true
- liveTradingEnabled: false
- productionReady: false

Preserved:

- live trading: DISABLED
- real exchange execution: DISABLED
- withdrawals: DISABLED
- production credentials: DISABLED
- wallet signing: DISABLED
- treasury movement: DISABLED
- on-chain writes: DISABLED
- production database execution: DISABLED

## Blocker Status

Resolved:

- Real local Postgres E2E not executed.
- Current validation refresh required.

Still active:

- Live trading blocked.
- Production credentials blocked.
- Root `package.json` absent.
- Production database execution blocked.
- Treasury movement blocked.

## Final Assessment

The local Postgres E2E blocker is resolved. Trading has current evidence for local durable persistence, migrations, mock seed data, database health, schema validation, repository readiness and replay smoke.

Trading may be promoted to L4 candidate for local durable persistence/readiness evidence only.

Trading remains non-production and execution-gated.
