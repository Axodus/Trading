# Trading Phase 11B - Migration CLI & Operational Scripts

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Transform the existing migration runner and database health services into operational CLI commands for local and future staging workflows.

The CLI makes database operations repeatable, inspectable, and automation-friendly.

## Delivered Files

- `trading-core/services/trading-core/src/cli/trading-db.ts`
- `trading-core/services/trading-core/src/cli/commands/migrate.ts`
- `trading-core/services/trading-core/src/cli/commands/status.ts`
- `trading-core/services/trading-core/src/cli/commands/health.ts`
- `trading-core/services/trading-core/src/cli/commands/version.ts`
- `trading-core/services/trading-core/src/cli/commands/validate.ts`
- `trading-core/services/trading-core/src/cli/commands/seed-local.ts`
- `trading-core/services/trading-core/src/cli/output/JsonOutput.ts`
- `trading-core/services/trading-core/src/cli/output/HumanOutput.ts`
- `trading-core/services/trading-core/scripts/trading-db.ts`

## Commands

From `trading-core/services/trading-core`:

```bash
npm run trading-db -- migrate
npm run trading-db -- status
npm run trading-db -- health
npm run trading-db -- version
npm run trading-db -- validate
npm run trading-db -- seed-local
```

JSON output:

```bash
npm run trading-db -- status --json
```

## Capabilities

- migration execution
- migration status inspection
- schema version inspection
- schema compatibility validation
- normalized database health check
- safe local seed command
- human-readable output
- JSON output for automation
- non-zero exit code on failure

## Architecture Rules

The CLI calls existing services:

- `MigrationRunner`
- `DatabaseHealthService`
- `DatabaseConnectionManager`
- `PostgresBootstrapService`
- `TradingDatabaseConfig`

The CLI does not duplicate migration logic, mutate schema outside migration files, implement rollback, or bypass the migration runner.

## Security Rules

- database password is redacted from failure output
- full credentialed connection strings are not printed
- env secrets are not printed
- `seed-local` rejects non-local/non-test environments

## Risk Rules

- migration failures stop safely
- invalid commands fail with non-zero exit code
- invalid schema is not silently accepted
- repeated migrations remain idempotent
- rollback is not implemented as destructive behavior

## Test Coverage

Implemented tests for:

- CLI migrate calls the migration path
- CLI health returns normalized health
- JSON output is valid
- database password is redacted from output
- invalid command fails safely
- `seed-local` rejects non-local environments

## Non-goals

- no production rollback system
- no migration squashing
- no cloud deployment
- no Kubernetes jobs
- no distributed migration locking
- no secrets manager integration
