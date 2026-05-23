# Local Postgres E2E Runbook

## Purpose

Use this runbook to validate the Axodus Trading Core durable local persistence path against a real local Postgres service.

This is developer-local validation only. It is not staging readiness, production readiness, live trading enablement, or Hummingbot live exchange enablement.

## Prerequisites

Run from the Trading workspace root first:

```bash
cp .env.example .env
```

Required local env values:

```text
TRADING_ENV=local
TRADING_DB_HOST=127.0.0.1
TRADING_DB_PORT=55432
TRADING_DB_NAME=axodus_trading_local
TRADING_DB_USER=axodus_trading
TRADING_DB_PASSWORD=axodus_trading_local_password
TRADING_DB_SCHEMA=public
TRADING_DB_MIN_SCHEMA_VERSION=0002_trading_events_tenant_id.sql
TRADING_DB_POOL_MAX=5
TRADING_DB_CONNECTION_TIMEOUT_MS=3000
TRADING_DB_IDLE_TIMEOUT_MS=10000
TRADING_DB_QUERY_TIMEOUT_MS=5000
TRADING_DB_MAX_RETRIES=1
```

Do not put production credentials, exchange API keys, wallet private keys, real provider configs, or production database URLs in `.env`.

## Main Validation Command

From the Trading Core service directory:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e
```

The command runs:

```text
local safety validation
-> docker compose up
-> wait for Postgres
-> trading-db migrate
-> trading-db seed-local
-> trading-db health
-> trading-db validate
-> repository readiness and replay smoke
```

## Expected Successful Human Output

The exact durations vary, but a successful run should look like:

```text
Trading local E2E: PASSED
Duration: <duration>ms
Mode: local mock/simulation-only
Live trading enabled: false

Steps:
- PASSED local safety validation
- PASSED docker compose up
- PASSED wait for postgres
- PASSED run migrations
- PASSED seed local data
- PASSED database health
- PASSED schema validation
- PASSED repository readiness and replay smoke
```

With cleanup enabled, the final step should also appear:

```text
- PASSED docker compose down
```

## JSON Output

For automation-friendly output:

```bash
npm run trading:local:e2e -- --json
```

Expected shape:

```json
{
  "ok": true,
  "status": "passed",
  "environment": "local",
  "cleanup": false,
  "reset": false,
  "skipDocker": false,
  "steps": [
    {
      "name": "local safety validation",
      "status": "passed"
    }
  ],
  "mock": true,
  "simulationOnly": true,
  "liveTradingEnabled": false,
  "productionReady": false
}
```

Consumers should treat `ok: true` and `status: "passed"` as the success signal.

## Options

### `--cleanup`

Starts Postgres, runs validation, then stops the compose service:

```bash
npm run trading:local:e2e -- --cleanup
```

This does not remove the Docker volume. Local data remains available unless the volume is removed separately.

### `--reset-local`

Runs the guarded local reset before migrations:

```bash
npm run trading:local:e2e -- --reset-local
```

Use this when the local schema is stale or when you want a clean local validation cycle.

The reset helper is local/test guarded and must not be used against staging or production.

### `--skip-docker`

Skips `docker compose up` and assumes Postgres is already running:

```bash
npm run trading:local:e2e -- --skip-docker
```

Use this when you manually started Postgres or when validating against an already running local container.

### Combined Options

Options may be combined:

```bash
npm run trading:local:e2e -- --json --reset-local --cleanup
```

## What This Validates

The E2E command validates:

- local Docker Postgres availability
- migration execution through `MigrationRunner`
- mock seed data through `seed-local`
- normalized database health
- schema compatibility through `validate`
- repository readiness
- event persistence
- event replay by correlation and tenant context
- user/treasury separation in local replay smoke paths

## What This Does Not Validate

The command does not validate:

- production deployment
- staging deployment
- cloud Postgres
- Kubernetes
- Redis/Kafka/ClickHouse
- live exchange connectivity
- production credentials
- Hummingbot live exchange sessions
- autonomous execution
- treasury execution

## Safety Checklist

Before running, confirm:

- `.env` was copied from `.env.example`
- `TRADING_ENV=local`
- database name is local/test only
- database host is local
- no CEX API key is present
- no wallet private key is present
- no production database URL is present
- Docker is running if not using `--skip-docker`

## Teardown

To stop local Postgres manually from workspace root:

```bash
docker compose --env-file .env -f docker-compose.trading.yml down
```

To remove local data:

```bash
docker compose --env-file .env -f docker-compose.trading.yml down -v
```

Use volume removal only for local development data.

