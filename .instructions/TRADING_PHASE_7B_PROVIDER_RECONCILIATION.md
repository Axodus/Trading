# Trading Phase 7B - Provider Reconciliation Skeleton

Status: IMPLEMENTED

Date: 2026-05-21

## Objective

Prepare Trading Core for provider/runtime divergence handling before real live Hummingbot execution.

Phase 7B establishes reconciliation boundaries between provider side effects and Axodus normalized state.

## Delivered Services

- `ProviderReconciliationService`
- `OrderReconciliationService`
- `PositionReconciliationService`
- `RuntimeReconciliationService`
- `ProviderDriftDetector`
- `StaleExecutionStateDetector`

## Delivered Contracts

Added reconciliation contracts under `trading-contracts/src/reconciliation/types.ts`:
- `ReconciliationState`
- `ReconciliationFindingType`
- `ReconciliationContext`
- `ProviderOrderSnapshot`
- `ProviderRuntimeSnapshot`
- `ProviderSideEffectSnapshot`
- `SovereignReconciliationSnapshot`
- `ReconciliationFinding`
- `ReconciliationProposal`
- `ReconciliationRequest`

## Reconciliation States

Supported:
- `synchronized`
- `stale`
- `divergent`
- `degraded`
- `orphaned`
- `reconciliation-required`

## Reconciliation Events

Added:
- `PROVIDER_RECONCILIATION_STARTED`
- `PROVIDER_RECONCILIATION_COMPLETED`
- `PROVIDER_DRIFT_DETECTED`
- `POSITION_DIVERGENCE_DETECTED`
- `ORDER_DIVERGENCE_DETECTED`
- `STALE_RUNTIME_DETECTED`
- `RECONCILIATION_REQUIRED`

## Runtime Rules

Provider reconciliation never directly mutates sovereign state.

Reconciliation outputs:
- findings
- proposals
- recommended actions
- telemetry/audit events

It does not perform:
- auto-healing
- provider-side mutation
- order mutation
- runtime mutation
- treasury mutation

## Isolation Rule

Treasury reconciliation and user reconciliation preserve separate correlation and tenant context.

User reconciliation uses `userId` and runtime/product context.

Treasury reconciliation uses `daoId` and federation/governance context when available.

## Non-goals

- no live exchange integration
- no websocket synchronization
- no auto-healing
- no automatic execution mutation
- no live Hummingbot reconciliation
- no provider drift correction jobs

## Test Coverage

Implemented tests for:
- divergent provider state detection
- stale runtime detection
- orphan runtime detection
- reconciliation proposal generation
- treasury/user reconciliation isolation
- provider drift telemetry event emission
