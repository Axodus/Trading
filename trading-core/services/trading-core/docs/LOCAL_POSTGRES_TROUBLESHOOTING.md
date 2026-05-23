# Local Postgres E2E Troubleshooting

## Purpose

This guide lists common failures for:

```bash
npm run trading:local:e2e
```

The command is local developer validation only. Do not point it at production or staging databases.

## Common Failures

### Missing `.env`

Symptom:

```text
Missing required Trading database config
```

Fix from workspace root:

```bash
cp .env.example .env
```

Then rerun from the service directory:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e
```

### Docker Is Not Running

Symptom:

```text
docker compose up failed
```

or:

```text
Cannot connect to the Docker daemon
```

Fix:

Start Docker Desktop or the local Docker daemon, then rerun:

```bash
npm run trading:local:e2e
```

If Postgres is already running outside the command, use:

```bash
npm run trading:local:e2e -- --skip-docker
```

### Port `55432` Already In Use

Symptom:

```text
Bind for 0.0.0.0:55432 failed
```

Fix options:

1. Stop the process using port `55432`.
2. Change `TRADING_DB_PORT` in `.env` to another local port.
3. Restart the command.

### Postgres Health Timeout

Symptom:

```text
wait for postgres failed
```

Fix:

Check container state from the workspace root:

```bash
docker compose --env-file .env -f docker-compose.trading.yml ps
docker logs axodus-trading-postgres-local
```

Then retry:

```bash
npm run trading:local:e2e
```

### Migration Failure

Symptom:

```text
run migrations failed
```

Fix:

Inspect migration status:

```bash
npm run trading-db -- status
npm run trading-db -- validate
```

For local-only reset:

```bash
npm run trading:local:e2e -- --reset-local
```

Do not use reset against non-local databases.

### Seed Rejected

Symptom:

```text
seed-local rejected production-like environment
```

Cause:

The command detected production-like environment, host, database name, or unsafe configuration.

Fix:

Use `.env.example` local defaults and confirm:

```text
TRADING_ENV=local
TRADING_DB_HOST=127.0.0.1
TRADING_DB_NAME=axodus_trading_local
```

### Schema Validation Failure

Symptom:

```text
schema validation failed
```

Fix:

Run:

```bash
npm run trading-db -- version
npm run trading-db -- status
npm run trading-db -- validate --json
```

If this is a disposable local database, run:

```bash
npm run trading:local:e2e -- --reset-local
```

### Repository Readiness Or Replay Smoke Failure

Symptom:

```text
repository readiness and replay smoke failed
```

Fix:

Run the smoke command directly for focused diagnostics:

```bash
npm run db:smoke-local
```

If schema drift is suspected:

```bash
npm run trading:local:e2e -- --reset-local
```

## Secret Redaction

The command redacts database password values from diagnostics.

If an output appears to expose a secret, stop and fix the redaction path before sharing logs.

Never include:

- real CEX API keys
- wallet private keys
- signing material
- production database passwords
- full production connection strings

## Local Cleanup

Stop local Postgres:

```bash
docker compose --env-file .env -f docker-compose.trading.yml down
```

Remove local data:

```bash
docker compose --env-file .env -f docker-compose.trading.yml down -v
```

This removes local development state only.

## Escalation Checklist

When reporting a failure, include:

- command used
- whether Docker is running
- whether `.env` came from `.env.example`
- sanitized output
- failing step name
- whether `--json` output shows `failure`

Do not include secrets.

