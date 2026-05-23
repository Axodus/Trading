# Trading Phase 11A - Local Infrastructure Runtime

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Create the first standardized local infrastructure runtime for Axodus Trading Core.

The goal is to run Trading Core persistence against a real local Postgres service instead of relying only on in-memory clients.

## Delivered Files

- `docker-compose.trading.yml`
- `.env.example`
- `trading-core/services/trading-core/scripts/bootstrap-local-db.ts`
- `trading-core/services/trading-core/scripts/healthcheck-db.ts`
- `trading-core/services/trading-core/scripts/seed-local-trading.ts`
- `trading-core/services/trading-core/scripts/local-db-utils.ts`
- `trading-core/services/trading-core/src/config/TradingDatabaseConfig.ts`
- `trading-core/services/trading-core/README.md`

## Delivered Commands

From `trading-core/services/trading-core`:

- `npm run db:bootstrap-local`
- `npm run db:healthcheck`
- `npm run db:seed-local`

## Local Runtime

Start Postgres from the Trading workspace root:

```bash
docker compose --env-file .env -f docker-compose.trading.yml up -d
```

Default local service:

- container: `axodus-trading-postgres-local`
- volume: `axodus_trading_postgres_data`
- host: `127.0.0.1`
- port: `55432`
- database: `axodus_trading_local`

## Capabilities

- start local Postgres
- configure database from env
- run migrations against local database
- verify schema status
- run repository readiness healthcheck
- seed safe local sample data
- teardown local infrastructure

## Migration Boundary

The bootstrap command uses the existing `MigrationRunner`.

It does not bypass:

- migration ordering
- migration history tracking
- schema version validation
- database health validation

## Security Boundary

No real secrets are committed.

`.env.example` contains local development values only.

Seed data is explicitly:

- mock
- simulation-only
- non-custodial
- non-treasury
- non-live-execution

Seed data must never contain:

- real CEX API keys
- wallet private keys
- live exchange credentials
- production database credentials
- treasury execution data

## Risk Boundary

This sprint does not enable:

- live execution
- Hummingbot live trading
- provider connection to real exchanges
- treasury execution
- production deployment

## Test Coverage

Implemented tests for:

- local database env validation
- missing database config rejection
- migration bootstrap command flow against mock client
- healthcheck flow against mock client
- seed guard rejecting production-like environments

## Non-goals

- no Kubernetes
- no cloud database
- no production deployment
- no distributed locks
- no Redis/Kafka
- no ClickHouse
- no real exchange connection
- no live Hummingbot session
