# Trading Phase 13B - Observability Risk Feedback Policy

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Model how observability health signals feed the risk pipeline without becoming direct execution authority.

Observability is evidence. Risk policy decides what that evidence means. ACS/Governance still controls escalation and approval.

## Delivered Files

- `trading-core/services/trading-core/src/risk/observability/ObservabilityRiskPolicy.ts`
- `trading-core/services/trading-core/src/risk/observability/ObservabilityRiskSignalFactory.ts`
- `trading-core/services/trading-core/src/risk/observability/ProviderHealthRiskEvaluator.ts`
- `trading-core/services/trading-core/src/risk/observability/RuntimeHealthRiskEvaluator.ts`
- `trading-core/services/trading-core/src/risk/observability/StrategyHealthRiskEvaluator.ts`
- `trading-core/services/trading-core/src/risk/observability/ObservabilityRiskDecisionService.ts`
- `trading-core/services/trading-core/src/risk/observability/ObservabilityRiskAuditService.ts`

Updated:

- `trading-core/packages/trading-contracts/src/risk/types.ts`
- `trading-core/packages/trading-contracts/src/events/types.ts`
- `trading-core/services/trading-core/src/index.ts`

## Delivered Contracts

- `ObservabilityRiskSignal`
- `ObservabilityRiskPolicy`
- `ObservabilityRiskDecision`
- `ObservabilityRiskSignalType`
- `ObservabilityRiskDecisionType`

## Supported Inputs

- provider critical
- provider degraded
- runtime critical
- runtime degraded
- strategy degraded
- execution latency spike
- telemetry ingestion degraded
- repeated runtime recovery

## Supported Decisions

- allow
- warn
- require review
- recommend block
- require recovery
- require simulation
- require backtest
- require controlled resume approval

## Events

- `OBSERVABILITY_RISK_SIGNAL_CREATED`
- `OBSERVABILITY_RISK_REVIEW_REQUIRED`
- `PROVIDER_BLOCK_RECOMMENDED`
- `RUNTIME_RECOVERY_REQUIRED`
- `STRATEGY_REVALIDATION_REQUIRED`
- `CONTROLLED_RESUME_REQUIRED`

## Architecture Rules

Correct flow:

```text
Observability Signal
-> ObservabilityRiskPolicy
-> Risk Decision / Proposal
-> ACS or Governance Workflow
-> Trading Core Gate
-> Audit Trail
```

Observability risk feedback must not:

- call providers
- mutate runtime
- mutate provider state
- mutate strategy state
- execute blocks directly
- expose provider DTOs
- expose secrets
- bypass tenant scope

Every decision is:

- `authorizedExecution: false`
- `mutatesRuntime: false`
- `mutatesProvider: false`
- `mutatesStrategy: false`

## Test Coverage

Implemented tests for:

- provider critical generates block proposal, not direct block
- runtime critical generates recovery-required decision
- strategy degraded generates revalidation-required decision
- cross-tenant signal is rejected
- tenantId and correlationId are preserved
- audit trail persists signal and decision lifecycle
- normal `RiskGateway` remains final execution authority

## Non-goals

- no automatic provider suspension
- no automatic runtime mutation
- no autonomous execution
- no live exchange integration
- no external observability platform
- no frontend dashboard
