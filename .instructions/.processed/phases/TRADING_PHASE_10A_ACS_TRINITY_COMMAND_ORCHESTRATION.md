# Trading Phase 10A - ACS / Trinity Command Orchestration API

Status: IMPLEMENTED

Date: 2026-05-21

## Objective

Formalize the command boundary used by ACS and Trinity to supervise, recommend, orchestrate, and request Trading Core workflows.

ACS remains the sovereign orchestration layer. Trinity remains a bounded cognitive operator.

## Delivered Services

- `AcsTradingCommandApi`
- `TrinityRecommendationApi`
- `RuntimeSupervisionApi`
- `TradingWorkflowRequestService`
- `RecommendationApprovalService`

## Delivered Contracts

Added or expanded under `trading-contracts/src/acs/types.ts` and `trading-contracts/src/agents/types.ts`:

- `AcsTradingCommand`
- `TrinityRecommendationRequest`
- `TradingWorkflowRequest`
- `WorkflowApprovalDecision`
- `RuntimeSupervisionDecision`

## Supported ACS Commands

- request simulation
- request backtest
- request provisioning
- request runtime recovery
- request provider suspension
- request strategy pause
- request telemetry inspection
- request strategy activation review

## Supported Trinity Workflows

- recommendation submission
- simulation proposal
- degradation report
- volatility warning
- provider degradation recommendation
- runtime anomaly escalation

## Workflow Rule

Every command preserves:

- `tenantId`
- runtime context
- execution domain
- `correlationId`
- governance context
- autonomy level

## Boundary Rules

ACS and Trinity command APIs must not:

- call providers directly
- bypass governance
- bypass risk
- bypass compliance
- bypass runtime lifecycle
- mutate runtime directly
- control Hummingbot directly
- grant production live authority

The API output is a workflow decision, not execution authority.

## Event Model

Added workflow/audit events:

- `TRADING_WORKFLOW_REQUESTED`
- `TRADING_WORKFLOW_APPROVED`
- `TRADING_WORKFLOW_REJECTED`
- `RUNTIME_SUPERVISION_REQUESTED`
- `TRINITY_RECOMMENDATION_SUBMITTED`
- `RECOMMENDATION_APPROVAL_APPROVED`
- `RECOMMENDATION_APPROVAL_REJECTED`

## Test Coverage

Implemented tests for:

- ACS command tenant context preservation
- Trinity recommendation cannot mutate runtime directly
- governance rejection blocks workflow escalation
- risk rejection blocks workflow continuation
- recommendation approval persists audit trail

## Non-goals

- no autonomous execution
- no self-modifying runtime
- no direct Hummingbot runtime control
- no direct provider access
- no production live authority
