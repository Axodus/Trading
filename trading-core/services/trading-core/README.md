# Trading Core Service

Sovereign orchestration boundary for:
- execution domains
- governance coordination
- treasury versus user execution context
- risk routing
- telemetry normalization
- persistence bootstrap
- runtime observability

## Local Infrastructure Runtime

Phase 11A introduces a local-only Postgres runtime for Trading persistence development.

This is not production deployment infrastructure.

### 1. Create Local Env

From the Trading workspace root:

```bash
cp .env.example .env
```

The example uses only local development credentials:

```text
TRADING_ENV=local
TRADING_DB_HOST=127.0.0.1
TRADING_DB_PORT=55432
TRADING_DB_NAME=axodus_trading_local
TRADING_DB_USER=axodus_trading
TRADING_DB_PASSWORD=axodus_trading_local_password
TRADING_DB_SCHEMA=public
TRADING_DB_MIN_SCHEMA_VERSION=0002_trading_events_tenant_id.sql
```

Do not place production credentials, exchange API keys, wallet private keys, or live provider credentials in this file.

### 2. Start Local Postgres

From the Trading workspace root:

```bash
docker compose --env-file .env -f docker-compose.trading.yml up -d
```

The local service is isolated as:

- container: `axodus-trading-postgres-local`
- volume: `axodus_trading_postgres_data`
- default host port: `55432`

### 3. Run Migrations

From `trading-core/services/trading-core`:

```bash
npm run db:bootstrap-local
```

Or through the operational CLI:

```bash
npm run trading-db -- migrate
npm run trading-db -- migrate --json
```

This command builds the service, loads SQL files from `migrations/`, runs them through `MigrationRunner`, writes migration history to `trading_schema_migrations`, and returns normalized health output.

### 4. Healthcheck

```bash
npm run db:healthcheck
npm run trading-db -- health
```

The healthcheck reports:

- database connectivity
- schema version
- migration consistency
- repository readiness

### 5. Seed Mock Data

```bash
npm run db:seed-local
npm run trading-db -- seed-local
```

The seed command inserts simulation-only mock data into the event store.

It refuses production-like environments and never writes:

- real API keys
- wallet private keys
- live exchange credentials
- treasury execution data

### 6. Local End-to-end Smoke Test

After Postgres is running, validate the full durable local path:

```bash
npm run db:smoke-local
```

This runs:

```text
local Postgres
-> migrations
-> healthcheck
-> repository readiness
-> mock event persistence
-> correlation replay
-> tenant-scoped replay
```

The smoke test uses only mock/simulation data and refuses production-like database settings.

### 7. Reset Local Database

For local development only:

```bash
npm run db:reset-local
```

This drops Trading local tables and migration history so the local schema can be recreated with:

```bash
npm run db:bootstrap-local
```

The reset helper is guarded by the same local/test environment checks as seed data. It must not be used against staging or production.

### 8. Teardown

From the Trading workspace root:

```bash
docker compose --env-file .env -f docker-compose.trading.yml down
```

To remove local data:

```bash
docker compose --env-file .env -f docker-compose.trading.yml down -v
```

## Non-goals

- no Kubernetes
- no cloud database
- no production deployment
- no distributed locks
- no Redis/Kafka
- no ClickHouse
- no real exchange connection
- no live Hummingbot session

## Trading DB CLI

The local/staging operational CLI supports:

```bash
npm run trading-db -- migrate
npm run trading-db -- status
npm run trading-db -- health
npm run trading-db -- version
npm run trading-db -- validate
npm run trading-db -- seed-local
npm run db:smoke-local
npm run db:reset-local
npm run trading:local:e2e
```

Every command supports JSON output:

```bash
npm run trading-db -- status --json
```

The CLI never prints the database password and returns a non-zero exit code on failure.

## Local CI-style Postgres Validation

Phase 16B adds a repeatable local E2E command:

```bash
npm run trading:local:e2e
```

This command runs a local-only validation flow:

```text
docker compose up
-> wait for Postgres
-> trading-db migrate
-> trading-db seed-local
-> trading-db health
-> trading-db validate
-> db:smoke-local
```

Useful options:

```bash
npm run trading:local:e2e -- --json
npm run trading:local:e2e -- --cleanup
npm run trading:local:e2e -- --reset-local
npm run trading:local:e2e -- --skip-docker
```

The command is local developer tooling only. It refuses production-like settings, redacts database passwords, seeds only mock/simulation data, and does not enable live trading, live Hummingbot sessions, live exchange connectivity, or treasury execution.

## Real Postgres Client

Local database commands use `NodePostgresClient`, a `pg`-backed adapter behind the existing `PostgresQueryClient` contract.

The adapter supports:

- parameterized queries
- connection pooling
- query timeout
- conservative retry policy
- normalized errors
- graceful shutdown

Configuration is read from env:

```text
TRADING_DB_POOL_MAX=5
TRADING_DB_CONNECTION_TIMEOUT_MS=3000
TRADING_DB_IDLE_TIMEOUT_MS=10000
TRADING_DB_QUERY_TIMEOUT_MS=5000
TRADING_DB_MAX_RETRIES=1
```

Repositories must continue to depend only on `PostgresQueryClient`.
