# Trading Phase 17B - Local Postgres E2E Operational Runbook

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Turn the local Postgres E2E command into the official durable persistence validation workflow for Trading Core developers.

This sprint is documentation and operational runbook work only. It does not introduce staging deployment, production migration automation, live exchange connectivity, Hummingbot live sessions, or runtime feature expansion.

## Official Command

From:

```bash
cd trading-core/services/trading-core
```

Run:

```bash
npm run trading:local:e2e
```

Supported modes:

```bash
npm run trading:local:e2e -- --json
npm run trading:local:e2e -- --cleanup
npm run trading:local:e2e -- --reset-local
npm run trading:local:e2e -- --skip-docker
```

## Operational Flow

The command validates:

```text
local safety validation
-> docker compose up
-> wait for Postgres
-> trading-db migrate
-> trading-db seed-local
-> trading-db health
-> trading-db validate
-> repository readiness and replay smoke
-> optional docker compose down
```

## Durable Persistence Coverage

The runbook confirms the local flow validates:

- local Docker Postgres
- migration execution
- mock/simulation seed data
- normalized database health
- schema validation
- repository readiness
- event persistence
- event replay
- tenant-safe traces

## Safety Rules

The local E2E command must reject or avoid:

- production-like environment values
- production database names or hosts
- real credentials
- real CEX API keys
- wallet private keys
- live provider configs
- production DB URLs
- live Hummingbot sessions
- treasury execution

All diagnostics must redact secrets, including database password values.

## Documentation Added

Developer runbooks:

- `trading-core/services/trading-core/docs/LOCAL_POSTGRES_E2E.md`
- `trading-core/services/trading-core/docs/LOCAL_POSTGRES_TROUBLESHOOTING.md`

README updated:

- `trading-core/services/trading-core/README.md`

## Validation Guidance

Expected validation commands:

```bash
npm run trading:local:e2e
npm run trading:local:e2e -- --json
npm run trading:local:e2e -- --cleanup
```

If Docker or local Postgres is unavailable, record the blocker and keep the runbook as developer-ready documentation.

Latest local validation result:

```text
npm run trading:local:e2e
PASS

npm run trading:local:e2e -- --json
PASS

npm run trading:local:e2e -- --cleanup
PASS
```

Environment note:

The default local port `55432` was already allocated in this developer environment. The runbook troubleshooting path was validated by using a local `.env` copy with:

```text
TRADING_DB_PORT=55433
```

The `.env` file was removed after validation and was not committed.

Operational fixes applied:

- local scripts now reference the actual compiled `dist` path used by the current workspace layout
- local scripts load the workspace `.env` before database config validation
- Postgres connection pool resolution supports the service-local `node_modules/pg` package when compiled files run from workspace-level `dist`

## Non-goals

- no cloud Postgres
- no Kubernetes
- no staging deployment
- no production migration automation
- no Redis/Kafka/ClickHouse
- no live exchange
- no live trading

## Outcome

Phase 17B makes `npm run trading:local:e2e` the official local durable persistence validation workflow for Trading Core developers.
