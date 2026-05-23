# Trading Open Risks

Status: REVIEW CHECKPOINT

Date: 2026-05-23

## Current Open Risks

### 1. Large Uncommitted Worktree

Risk:
Multiple completed phases are accumulated in one dirty worktree.

Impact:
- harder review
- harder rollback
- harder merge conflict resolution
- weaker sprint traceability

Mitigation:
- split commits by phase/domain
- review docs and tests together with each implementation group
- avoid starting Phase 14C before checkpoint is committed or explicitly accepted

### 2. Local Postgres Is Prepared but Not Always Exercised

Risk:
The local Postgres E2E test is gated and skipped unless local env is enabled.

Impact:
Persistence can regress without being caught by default unit tests.

Mitigation:
- add a local/CI command for real Postgres validation
- run the smoke script before staging
- keep in-memory tests as fast default, but require real DB validation before persistence changes merge

### 3. Credential Vault Is Not Production Encryption

Risk:
Vault adapter boundary exists, but real encryption/KMS/HSM is not implemented.

Impact:
User Trading cannot safely use production credentials yet.

Mitigation:
- keep live trading disabled
- keep all runtime config reference-based
- perform vault adapter selection spike before real credential onboarding

### 4. Reconciliation Does Not Yet Have Approval Workflow

Risk:
Reconciliation proposals exist but do not yet flow through ACS/Governance review.

Impact:
Operational divergence can be detected but not governed end-to-end.

Mitigation:
- implement ACS review flow for reconciliation proposals
- keep worker proposal-only
- avoid auto-healing until review and approval lifecycle is implemented

### 5. Paper Trading Is Foundational, Not Strategy Validation

Risk:
Paper session lifecycle exists, but WhiteRabbit-specific paper validation is not complete.

Impact:
Paper runtime exists as infrastructure, not yet as a full strategy validation workflow.

Mitigation:
- implement Phase 14C WhiteRabbit Paper Validation Workflow
- include telemetry summary and controlled resume evidence

### 6. Hummingbot Deep Live Boundary Remains Disabled

Risk:
Hummingbot adapter has paper-compatible boundaries, but live execution is intentionally not enabled.

Impact:
Do not treat this as production exchange readiness.

Mitigation:
- keep Hummingbot as runtime/provider only
- require paper validation, vault hardening, ACS approvals, and risk policies before any live adapter expansion

### 7. Observability Risk Is Advisory Until Wired to Workflow

Risk:
Observability risk decisions are persisted but do not yet automatically route through ACS/Governance workflow.

Impact:
Risk evidence exists but may not produce operator action without explicit workflow integration.

Mitigation:
- implement paper observability risk loop
- connect observability risk proposals to ACS workflow request services

## Confirmed Non-risks In Current Scope

- no live trading route is enabled
- no autonomous execution authority exists
- no raw production secrets found
- no wallet private keys found
- no real yield/profit claims introduced
- no provider DTOs intentionally exposed as public surface contracts

## Security Scan Notes

Detected sensitive-looking strings are test sentinels, not real secrets:

- `raw-api-key-must-not-leak`
- `raw-api-secret-must-not-leak`
- `prod-key-must-not-leak`

Detected withdrawal-like scopes are negative tests and rejection constants:

- `withdraw`
- `withdrawal`
- `transfer`

These are acceptable only because they verify rejection behavior.
