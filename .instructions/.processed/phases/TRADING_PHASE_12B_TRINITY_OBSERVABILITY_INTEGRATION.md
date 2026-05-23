# Trading Phase 12B - Trinity Observability Integration

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Use the Runtime Observability Layer as normalized input for Trinity recommendations.

Trinity becomes telemetry-aware, not sovereign. Observability findings may produce recommendations, but every action remains subject to ACS, Trading Core, governance/product/compliance/risk, and runtime/provider boundaries.

## Delivered Files

- `trading-core/services/trading-core/src/agents/trinity/TrinityObservabilityAdapter.ts`
- `trading-core/services/trading-core/src/agents/trinity/RuntimeHealthRecommendationService.ts`
- `trading-core/services/trading-core/src/agents/trinity/ProviderHealthRecommendationService.ts`
- `trading-core/services/trading-core/src/agents/trinity/StrategyHealthRecommendationService.ts`
- `trading-core/services/trading-core/src/agents/trinity/LatencySpikeRecommendationService.ts`
- `trading-core/services/trading-core/src/agents/trinity/ObservabilityRecommendationAuditService.ts`
- `trading-core/services/trading-core/src/agents/trinity/ObservabilityRecommendationTypes.ts`

## Delivered Contracts

- Added observability-oriented recommendation types:
  - `recommend-strategy-pause`
  - `recommend-simulation`
  - `recommend-backtest`
  - `recommend-telemetry-review`
  - `recommend-controlled-resume`
- Added `executionDomain` and `federationId` support to `ObservabilityQueryContext`
- Added audit events:
  - `TRINITY_OBSERVABILITY_RECOMMENDATION_CREATED`
  - `TRINITY_OBSERVABILITY_EVIDENCE_RECORDED`

## Capabilities

- degraded runtime creates runtime recovery recommendation
- critical runtime creates higher-confidence recovery recommendation
- degraded/critical provider creates provider block/review recommendation
- degraded strategy creates pause and simulation recommendations
- critical strategy can create backtest recommendation
- execution latency spike creates telemetry review recommendation
- degraded telemetry ingestion creates telemetry review recommendation
- recommendations preserve `tenantId`, `correlationId`, runtime, provider, strategy, user/DAO context
- recommendation lifecycle is persisted through the event bus/audit trail

## Architecture Rules

Trinity Observability Integration:

- consumes `TradingObservabilityApi` snapshots
- does not call providers
- does not mutate runtime
- does not pause strategies directly
- does not block providers directly
- does not expose provider DTOs
- does not expose credentials or secrets
- does not bypass ACS

Required flow:

```text
Observability Snapshot
-> TrinityObservabilityAdapter
-> Recommendation
-> ACS
-> Trading Core
-> Governance/Product/Compliance/Risk
-> Runtime/Provider Boundary
```

## Security Rules

- recommendations contain only sanitized observability evidence
- no API secrets, signing material, provider payloads, or raw DTOs
- tenant context is required for queries
- cross-tenant telemetry must not be exposed

## Risk Rules

- provider critical recommends block/review, but does not execute a block
- strategy degraded recommends pause/simulation, but does not mutate production
- latency spikes recommend investigation/recovery workflow
- all recommendations remain `authorizedExecution: false`
- all recommendations require ACS intake

## Test Coverage

Implemented tests for:

- runtime degraded input emits recovery recommendation
- provider critical input emits block recommendation
- strategy degraded input emits pause/simulation recommendation
- latency spike emits telemetry warning recommendation
- ACS approval remains required
- recommendation lifecycle persists through audit trail

## Non-goals

- no autonomous execution
- no automatic provider block
- no automatic strategy pause
- no live AI trading
- no public report publication
- no frontend implementation
