# Trading Credential Vault Emergency Revocation

Status: IMPLEMENTED

Date: 2026-05-24

## Objective

Define the emergency revocation policy for future real Credential Vault backends.

This policy prepares incident response boundaries. It does not implement a real cloud vault, KMS, HSM, wallet signer, exchange login flow, or live trading control.

## Revocation Triggers

Emergency revocation may be triggered by:

- suspected credential leak
- suspected tenant account compromise
- provider adapter compromise
- exchange incident
- abnormal credential access pattern
- runtime anomaly
- unexplained provider drift
- operator access incident
- compliance/legal hold
- key compromise
- audit sink compromise
- user request for immediate credential disablement

## Revocation Levels

### Level 1 - Grant revocation

Revoke one or more active ephemeral grants.

Use when:

- a runtime grant is stale
- a grant has been overused
- runtime scope no longer matches provider/context
- TTL policy was violated

### Level 2 - Credential binding suspension

Suspend runtime binding for a credential reference.

Use when:

- runtime access should stop but credential lifecycle is still under review
- provider compatibility is uncertain
- runtime recovery requires rebinding

### Level 3 - Credential reference revocation

Revoke the credential reference.

Use when:

- credential compromise is suspected
- user requests deactivation
- provider permissions are unsafe
- credential cannot be safely rotated

### Level 4 - Provider access block

Block provider-scoped credential access through policy.

Use when:

- provider adapter compromise is suspected
- provider health is critical
- exchange-level incident affects many tenants

### Level 5 - Platform vault freeze

Freeze vault grant creation for an environment or provider.

Use when:

- vault backend compromise is suspected
- KMS key compromise is suspected
- audit integrity is uncertain
- systemic risk affects multiple tenants

## Emergency Flow

```text
Detection
-> Severity Classification
-> Scope Identification
-> Grant Revocation
-> Credential / Binding Suspension or Revocation
-> Runtime Suspension or Recovery Request
-> Audit Event Emission
-> Operator / ACS Notification
-> Rotation or Rebinding Requirement
-> Post-incident Review
```

## Critical Boundaries

Emergency revocation must not:

- place live exchange orders
- cancel orders directly
- close positions directly
- mutate strategy internals directly
- call Hummingbot directly
- expose secrets to ACS
- expose secrets to Trinity
- expose secrets to Product Surface
- bypass governance/risk/compliance workflows

If remediation is required, it must become a governed request:

```text
Revocation Evidence
-> ACS / Governance / Risk Review
-> Remediation Request
-> Audit Trail
```

## Required Events

Emergency revocation must emit or preserve:

- `CREDENTIAL_GRANT_REVOKED`
- `CREDENTIAL_ACCESS_DENIED`
- `CREDENTIAL_BINDING_REVOKED`
- `CREDENTIAL_ROTATION_AUDITED`
- runtime suspension/recovery request events where applicable
- provider health/risk events where applicable

Events must include:

- tenant context
- runtime context where applicable
- providerId
- vaultRefId
- reason
- correlationId

Events must not include:

- raw secrets
- decrypted payloads
- signing material
- wallet private keys
- provider DTOs

## Operator Access Policy

Production emergency revocation requires:

- least-privilege operator role
- explicit reason code
- correlationId
- audit trail
- dual-control for broad provider/platform freezes
- post-incident review

Break-glass access must be:

- time-limited
- audited
- reviewed after use
- unable to view raw secrets by default

## Audit Retention Draft

Minimum production audit expectations:

- grant creation/revocation retained
- credential binding lifecycle retained
- adapter diagnostics retained in redacted form
- operator action retained
- incident classification retained
- runtime suspension/recovery request retained

Retention duration requires legal/compliance decision before production onboarding.

## Production Blockers

Before production emergency revocation is enabled:

- final adapter selected
- provider-specific revoke tested
- operator roles defined
- incident severity model defined
- audit retention approved
- communication procedure approved
- no-withdrawal credential checklist approved
- runtime suspension workflow validated

## Final Rule

Emergency revocation is a defensive security workflow.

It is not an execution workflow and must not become an implicit live trading control path.
