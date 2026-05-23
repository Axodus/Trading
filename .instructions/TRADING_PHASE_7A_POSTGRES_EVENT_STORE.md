# Trading Phase 7A - Persistent Repository Adapters and Postgres Event Store

Status: IMPLEMENTED

Date: 2026-05-21

## Objective

Replace in-memory-only repository skeletons with durable Postgres-backed adapter boundaries while preserving sovereign state ownership.

Phase 7A establishes the first persistent authority boundary for:
- normalized trading events
- orders
- fills
- positions
- portfolios
- runtime instances
- provider state
- runtime audit

## Delivered Files

Migration:
- `trading-core/services/trading-core/migrations/0001_trading_state.sql`

Repository adapters:
- `PostgresTradingEventRepository`
- `PostgresOrderRepository`
- `PostgresFillRepository`
- `PostgresPositionRepository`
- `PostgresPortfolioRepository`
- `PostgresRuntimeRepository`
- `PostgresProviderStateRepository`
- `PostgresClient`
- `InMemoryPostgresClient`

Runtime integration:
- `RuntimeRecoveryService` can hydrate missing runtime lifecycle state from `RuntimeRepository` before recovery.

Tests:
- persistent event replay across repository instances
- execution lifecycle reconstruction from replayed events
- runtime recovery from persistent state
- user and treasury trace isolation
- subscriber failure does not affect persistence
- append-only event store guarantee

## Event Store Model

`trading_events` is append-only.

Events are persisted before subscriber dispatch. This preserves the audit trail even when telemetry or downstream subscribers fail.

Replay is supported by:
- `correlationId`
- `runtimeInstanceId`
- `strategyProductId`
- `providerId`
- tenant id (`userId` or `daoId`)
- event type

## State Ownership Rule

Axodus owns normalized state.

Execution providers own venue-specific side effects only.

Provider snapshots, Hummingbot runtime output, and future exchange reconciliation must enter the system as normalized events or snapshots before updating authoritative state.

## Runtime Recovery Rule

Runtime recovery may use persisted runtime state to rehydrate the in-memory lifecycle model.

Recovery remains conceptual in Phase 7A:
- no live exchange reconciliation
- no Kubernetes/process orchestration
- no Hummingbot deep session recovery
- no provider drift correction

## Non-goals

- no ClickHouse
- no Kafka
- no Redis
- no distributed event streaming
- no external observability
- no live exchange reconciliation
- no production Postgres connection bootstrap

## Implementation Notes

The Postgres adapters accept a `PostgresQueryClient` interface so production can inject a real `pg` compatible client later.

`InMemoryPostgresClient` is a test adapter that simulates Postgres persistence across repository instances without introducing infrastructure into the test suite.

Position and portfolio repositories currently persist latest snapshots by owner key. Existing snapshot contracts do not yet carry a distinct tenant owner field, so callers must pass the same canonical owner key used during snapshot persistence until the snapshot ownership contract is expanded.
