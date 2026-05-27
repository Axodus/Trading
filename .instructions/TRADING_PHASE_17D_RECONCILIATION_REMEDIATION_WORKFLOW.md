# Trading Phase 17D - Reconciliation Remediation Workflow Skeleton

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Define the request-only remediation workflow after ACS approves a reconciliation proposal.

This sprint creates the next workflow step after ACS review without implementing auto-healing, provider mutation, order cancellation, position closure, direct Hummingbot control, exchange calls, or production workers.

## Delivered

- `ReconciliationRemediationWorkflowService`
- `ReconciliationRemediationRequestService`
- `ReconciliationRemediationWorkflowRepository`
- `RuntimeRecoveryRequestRouter`
- `ReconciliationRemediationAuditService`
- `RemediationWorkflowPolicy`
- `ProviderResyncRequestModel`
- `ManualOperatorReviewRequestModel`
- `RuntimeRecoveryRequestModel`

## Workflow

```text
Reconciliation Proposal
-> ACS Review
-> Risk/Governance Decision
-> Remediation Request
-> Remediation Workflow State
-> Audit Trail
```

## Supported Request Types

- runtime recovery request
- provider resync request
- manual operator review request
- reconciliation retry request
- paper validation retry request
- controlled resume review request

## Workflow States

- requested
- pending-risk-review
- pending-governance-review
- approved
- rejected
- blocked
- expired
- completed-as-request-only

## Safety Rules

- remediation workflow is request-only
- provider mutation is forbidden
- runtime mutation is forbidden
- sovereign state mutation is forbidden
- auto-healing is forbidden
- provider DTOs are not included
- raw exchange payloads are not included
- credentials are not accessed
- tenant context is preserved

## Events

Added:

- `REMEDIATION_WORKFLOW_REQUESTED`
- `REMEDIATION_WORKFLOW_APPROVED`
- `REMEDIATION_WORKFLOW_REJECTED`
- `REMEDIATION_WORKFLOW_BLOCKED`
- `RUNTIME_RECOVERY_REQUEST_ROUTED`
- `PROVIDER_RESYNC_REQUEST_ROUTED`
- `MANUAL_OPERATOR_REVIEW_REQUESTED`

## Validation

Tests cover:

- approved proposal creates request-only remediation workflow
- rejected proposal cannot create remediation workflow
- treasury remediation requires governance context before workflow
- user remediation preserves tenant/runtime context
- workflow emits audit events
- provider execution methods are not available

## Non-goals

- no auto-healing
- no provider mutation
- no order cancellation
- no position close
- no live exchange reconciliation
- no websocket sync
- no production worker

