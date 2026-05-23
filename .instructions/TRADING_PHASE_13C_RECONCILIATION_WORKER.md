# Trading Phase 13C - Reconciliation Worker Skeleton

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Transform reconciliation services into an executable local/mock workflow.

The worker detects and proposes. It does not auto-heal, cancel orders, close positions, call providers, call Hummingbot, or mutate runtime/provider/strategy state blindly.

## Delivered Files

- `trading-core/services/trading-core/src/reconciliation/ReconciliationWorker.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationWorkerScheduler.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationCandidateDiscoveryService.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationProposalRepository.ts`
- `trading-core/services/trading-core/src/reconciliation/RuntimeStaleScanService.ts`
- `trading-core/services/trading-core/src/reconciliation/ProviderDriftScanService.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationWorkerAuditService.ts`

Updated:

- `trading-core/packages/trading-contracts/src/reconciliation/types.ts`
- `trading-core/packages/trading-contracts/src/events/types.ts`
- `trading-core/services/trading-core/src/index.ts`

## Delivered Contracts

- `ReconciliationProposalReviewState`
- `ReconciliationCandidateType`
- `ReconciliationWorkerCandidate`
- `ReconciliationWorkerRunResult`

Proposal review states:

- created
- pending-review
- approved
- rejected
- superseded
- expired

## Events

- `RECONCILIATION_WORKER_STARTED`
- `RECONCILIATION_WORKER_COMPLETED`
- `RECONCILIATION_CANDIDATE_FOUND`
- `RECONCILIATION_PROPOSAL_CREATED`
- `RECONCILIATION_PROPOSAL_REVIEW_REQUIRED`

## Worker Flow

```text
ReconciliationWorkerScheduler
-> ReconciliationWorker
-> ReconciliationCandidateDiscoveryService
-> ProviderReconciliationService
-> ReconciliationProposalRepository
-> ReconciliationWorkerAuditService
-> Event/Audit Trail
```

## Capabilities

- stale runtime candidate workflow
- provider drift candidate workflow
- orphan runtime candidate workflow
- order/position divergence proposal support through existing reconciliation service
- proposal persistence
- review-required audit events
- user/treasury tenant isolation
- safe failure result when discovery or candidate processing fails

## Architecture Rules

The worker consumes normalized snapshots and state boundaries.

The worker must not:

- auto-heal
- call providers
- call Hummingbot
- cancel orders
- close positions
- mutate provider state directly
- mutate runtime execution state blindly
- bypass ACS, risk, or governance

## Test Coverage

Implemented tests for:

- stale runtime scan creates proposal
- provider drift scan creates proposal
- orphan runtime candidate creates proposal
- proposal preserves tenant context
- worker failure emits safe audit event
- worker does not expose provider execution or auto-healing methods

## Non-goals

- no websocket live sync
- no real exchange
- no auto-healing
- no order cancellation
- no position correction
- no production cron
- no distributed worker
