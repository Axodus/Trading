# Trading Phase 13A - Local Postgres End-to-End Validation

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Validate the real local Postgres infrastructure end-to-end.

This phase proves that Trading Core can run locally with durable persistence, migrations, seed data, repository readiness, and event replay without relying only on in-memory clients.

## Delivered Files

- `trading-core/services/trading-core/scripts/smoke-local-postgres.ts`
- `trading-core/services/trading-core/scripts/reset-local-db.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresRepositoryReadinessCheck.ts`
- `trading-core/services/trading-core/test/postgres.e2e.test.mjs`
- `trading-core/services/trading-core/migrations/0002_trading_events_tenant_id.sql`

Updated:

- `trading-core/services/trading-core/package.json`
- `trading-core/services/trading-core/README.md`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresTradingEventRepository.ts`
- `trading-core/services/trading-core/src/repositories/postgres/InMemoryPostgresClient.ts`

## Local Flow

```text
docker compose
-> local Postgres
-> trading-db migrate
-> trading-db health
-> trading-db seed-local
-> repository readiness
-> event persistence
-> event replay
```

## Commands

From `trading-core/services/trading-core`:

```bash
npm run db:smoke-local
npm run db:reset-local
```

The smoke command runs real local migrations, health, repository readiness, event persistence, correlation replay, and tenant-scoped replay.

The reset command drops Trading local tables and migration history. It is guarded by local/test environment checks and refuses production-like settings.

## Repository Readiness

`PostgresRepositoryReadinessCheck` validates:

- required Trading tables exist
- event repository append/replay works
- runtime repository save/read works
- readiness issues are reported in a normalized result

## Event Replay

Postgres event store now supports tenant-scoped replay through `tenant_id`.

Migration:

- `0002_trading_events_tenant_id.sql`

Repository behavior:

- user events derive tenant from `payload.tenantId` or `userId`
- treasury events derive tenant from `daoId`
- replay by tenant remains isolated from unrelated tenants

## Gated Integration Test

The local Postgres E2E test is skipped by default.

Enable only when local Postgres is running and env is configured:

```bash
TRADING_POSTGRES_E2E=1 npm test --prefix trading-core/services/trading-core
```

It validates:

- migrations against real Postgres
- health command
- seed-local command
- repository readiness
- correlation replay
- tenant replay
- user/treasury trace separation

## Security Rules

- no real secrets
- no production DB access
- no wallet private keys
- no CEX API keys
- no live provider credentials
- local env must be explicit
- seed/smoke data is mock and simulation-only

## Risk Rules

- no live trading
- no Hummingbot live session
- no treasury execution
- no production-like seed
- no real exchange connectivity

## Non-goals

- no production deployment
- no cloud database
- no Kubernetes
- no Redis/Kafka
- no ClickHouse
- no live exchange
- no live trading
- no public API
