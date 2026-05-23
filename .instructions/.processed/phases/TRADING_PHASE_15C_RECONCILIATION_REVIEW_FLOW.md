# Trading Phase 15C - ACS Review Flow for Reconciliation Proposals

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Close the reconciliation proposal loop through ACS review, risk/governance decisioning and controlled remediation requests.

The reconciliation worker may detect and propose. It must not auto-correct.

## Delivered

- `ReconciliationProposalReviewService`
- `ReconciliationProposalAuditService`
- `ReconciliationRemediationEligibilityService`
- `ReconciliationReviewPolicy`
- `AcsReconciliationReviewCommand`
- `ReconciliationApprovalDecision`
- `ReconciliationRemediationRequest`

## Governed Flow

```text
ReconciliationWorker
-> ReconciliationProposal
-> ACS Review
-> Risk/Governance Decision
-> Remediation Request
-> Audit Trail
```

## Review States

Supported review states now include:

- `pending-review`
- `under-risk-review`
- `under-governance-review`
- `approved-for-remediation`
- `rejected`
- `expired`
- `superseded`

## Remediation Request Types

The workflow can create request-only remediation intents:

- runtime recovery request
- provider resync request
- order review request
- position review request
- reconciliation retry request
- manual operator review request

## Safety Rules

- no auto-healing
- no provider mutation
- no order cancellation
- no position closure
- no direct exchange access
- no provider DTO leakage
- no cross-tenant review
- worker cannot approve its own proposal

## Events

Added:

- `RECONCILIATION_REVIEW_REQUESTED`
- `RECONCILIATION_REVIEW_APPROVED`
- `RECONCILIATION_REVIEW_REJECTED`
- `RECONCILIATION_REMEDIATION_REQUESTED`
- `RECONCILIATION_REMEDIATION_BLOCKED`

## Validation

Tests cover:

- ACS review command requires tenant context
- risk rejection blocks remediation request
- governance rejection blocks treasury remediation
- approved proposal creates remediation request only
- rejected proposal remains auditable
- worker cannot auto-approve its own proposal

## Non-goals

- no auto-healing
- no automatic order cancellation
- no automatic position closure
- no provider mutation
- no live exchange reconciliation
- no websocket sync
