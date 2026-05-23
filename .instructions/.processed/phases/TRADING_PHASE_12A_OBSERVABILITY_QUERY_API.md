# Trading Phase 12A - Observability Query API

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Expose Trading observability as a safe headless read-only API for ACS, WhiteRabbit Product Surface, and future operator tools.

Observability is visibility infrastructure, not execution authority.

## Delivered Files

- `trading-core/packages/trading-contracts/src/observability/types.ts`
- `trading-core/services/trading-core/src/api/observability/TradingObservabilityApi.ts`
- `trading-core/services/trading-core/src/api/observability/TenantObservabilityQueryService.ts`
- `trading-core/services/trading-core/src/api/observability/ObservabilityAccessGuard.ts`

## Delivered Contracts

- `ObservabilityQueryContext`
- `RuntimeHealthReadModel`
- `ProviderHealthReadModel`
- `StrategyHealthReadModel`
- `OperationalTelemetrySnapshot`

## Capabilities

- runtime health query
- provider health query
- strategy health query
- telemetry ingestion quality in snapshot
- execution latency summary
- runtime degradation visibility
- provider degradation visibility
- tenant-scoped operational summary

## Architecture Rules

The observability API is read-only.

It must not:

- call providers
- mutate runtime
- expose provider DTOs
- expose secrets
- expose raw provider payloads
- expose private runtime internals
- bypass tenant scope

## Risk Rules

- health summaries are advisory
- health summaries do not imply profitability
- strategy health is telemetry visibility, not execution permission
- degraded status remains advisory unless consumed by future risk/gate policy

## Test Coverage

Implemented tests for:

- runtime health query returns normalized model
- provider health query excludes DTOs/secrets
- cross-tenant runtime query does not leak data
- strategy health summary excludes sensitive data
- tenant-scoped operational snapshot
- API does not expose mutation/provider execution methods

## Non-goals

- no Grafana
- no Prometheus
- no websocket streaming
- no public dashboard
- no alerting engine
- no frontend route
