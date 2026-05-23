# Trading Phase 3B - State Infrastructure

Status: IMPLEMENTED

---

# Objective

Introduce the Trading State Layer as the authoritative state boundary for runtime, execution, portfolio, positions, provider state, events, and audit history.

This layer prepares Trading Core for:
- runtime recovery
- event replay
- operational reconciliation
- audit telemetry
- normalized state ownership

---

# State Ownership Rule

Axodus owns normalized trading state.

Execution providers own venue-specific side effects only.

Hummingbot, native engines, DEX routers, Hyperliquid runtimes, and future institutional engines must not become the source of truth for:
- orders
- fills
- positions
- portfolio snapshots
- runtime status
- provider health
- audit history
- event history

Provider data must enter Axodus through normalized events and normalized snapshots.

---

# Service Boundary

Phase 3B adds these state services:

- `TradingStateService`
- `ExecutionStateService`
- `RuntimeStateService`
- `PositionStateService`
- `PortfolioStateService`
- `ProviderStateService`
- `TradingAuditService`

These are service boundaries, not persistence adapters.

The current implementation is contract-oriented and in-memory only where needed for tests.

---

# Repository Boundary

Repository interfaces define future persistence seams:

- `TradingEventRepository`
- `OrderRepository`
- `FillRepository`
- `PositionRepository`
- `PortfolioRepository`
- `RuntimeRepository`
- `ProviderStateRepository`

No database adapter is implemented in Phase 3B.

---

# Event-derived State

Execution state is derived from:
- `EXECUTION_REQUESTED`
- `ORDER_SUBMITTED`
- `ORDER_FILLED`
- `ORDER_CANCELLED`
- `EXECUTION_FAILED`

Runtime state is derived from:
- `USER_RUNTIME_PROVISIONED`
- `USER_RUNTIME_SUSPENDED`
- `EMERGENCY_SHUTDOWN_TRIGGERED`

Provider state is derived from:
- `PROVIDER_HEALTH_CHANGED`
- `EMERGENCY_SHUTDOWN_TRIGGERED`

Provider state supports:
- `healthy`
- `degraded`
- `offline`
- `suspended`

---

# Mutation Preconditions

State mutation requires correlation context plus tenant, runtime, DAO, or provider context.

Execution, portfolio, and position state require user, DAO, or runtime context.

Runtime state requires `runtimeInstanceId`.

Provider state requires `providerId`.

Anonymous state mutation is not allowed.

---

# Non-goals

Phase 3B does not include:
- database adapters
- Postgres migrations
- ClickHouse integration
- Redis/Kafka event streaming
- live provider reconciliation
- AxodusAPP UI
- Hummingbot source-of-truth behavior

---

# Next Steps

Future phases should add:
- persistent repositories
- event replay runner
- provider reconciliation jobs
- portfolio/accounting snapshots
- audit export pipelines
- observability dashboards for operators only
