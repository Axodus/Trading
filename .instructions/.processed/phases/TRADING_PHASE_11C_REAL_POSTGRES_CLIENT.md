# Trading Phase 11C - Real Postgres Client Adapter

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Add a real Node/Postgres client adapter behind the existing `PostgresQueryClient` contract without breaking repository interfaces or mock tests.

This sprint connects the persistence boundary to a real local Postgres database.

## Delivered Files

- `trading-core/services/trading-core/src/repositories/postgres/NodePostgresClient.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresErrorMapper.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresConnectionPool.ts`
- `trading-core/services/trading-core/src/config/PostgresEnvConfig.ts`

Updated:

- `trading-core/services/trading-core/scripts/bootstrap-local-db.ts`
- `trading-core/services/trading-core/scripts/healthcheck-db.ts`
- `trading-core/services/trading-core/scripts/seed-local-trading.ts`
- `trading-core/services/trading-core/scripts/trading-db.ts`
- `trading-core/services/trading-core/scripts/local-db-utils.ts`
- `trading-core/services/trading-core/package.json`
- `.env.example`

## Capabilities

- real `pg`-backed adapter
- parameterized query execution
- connection pooling
- query timeout
- conservative retry policy
- connection health check support
- graceful pool shutdown
- normalized query/connection/timeout errors
- env config mapping
- redacted diagnostics
- repository compatibility through `PostgresQueryClient`

## Architecture Rules

- repositories depend only on `PostgresQueryClient`
- `NodePostgresClient` is swappable with `InMemoryPostgresClient`
- no repository imports `pg`
- no business logic in the DB adapter
- no provider/runtime logic in the DB adapter
- local scripts use the real adapter by default

## Security Rules

- use parameterized query API
- no credentials in diagnostics
- env diagnostics redact password
- local-only defaults remain explicit
- no real exchange or wallet credentials involved

## Risk Rules

- DB outage produces normalized controlled errors
- query timeout fails safely
- retry policy is bounded and conservative
- closed pool rejects queries safely
- transaction helper rolls back on failure

## Test Coverage

Implemented tests for:

- parameterized query execution
- connection health check through existing manager
- timeout handling
- error normalization and secret redaction
- pool shutdown
- repository compatibility with real client abstraction
- env config mapping and redacted diagnostics

## Non-goals

- no cloud Postgres
- no read replicas
- no clustering
- no distributed locks
- no production-grade HA
- no ClickHouse/Redis/Kafka
- no live trading
- no real exchange execution
