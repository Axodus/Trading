# Trading Credential Vault Rotation Policy

Status: IMPLEMENTED

Date: 2026-05-24

## Objective

Define the required rotation policy for future production Credential Vault backends.

This policy is a draft security control. It does not implement real KMS rotation or real secret storage.

## Rotation Scope

Rotation applies to:

- credential references
- encrypted envelopes
- KMS key references
- provider-scoped credential bindings
- runtime credential grants
- exchange API credentials
- future wallet runtime bindings

Rotation does not allow:

- withdrawal scope
- secret exposure to Product Surface
- secret exposure to ACS
- secret exposure to Trinity
- secret exposure to telemetry
- secret exposure to frontend

## Rotation Triggers

Rotate credentials when any of the following occurs:

- scheduled policy threshold reached
- user requests credential rotation
- provider reports suspected compromise
- runtime anomaly suggests credential misuse
- adapter diagnostics indicate vault/key issue
- tenant account compromise is suspected
- operator access incident occurs
- exchange permission set changes
- provider adapter changes credential access model
- runtime moves across provider boundary
- emergency revocation procedure is triggered
- major compliance/security update invalidates existing grants

## Rotation Flow

```text
Rotation Trigger
-> Access Policy Review
-> New Credential / Envelope Registration
-> Binding Update
-> Active Grant Revocation
-> Runtime Refresh or Suspension
-> Rotation Audit
-> Post-rotation Validation
```

## Required Controls

### Credential reference lifecycle

- old reference must become `rotated`, `revoked`, or `suspended`
- new reference must be explicitly active before runtime access
- runtime binding must reference only the active credential

### Grant lifecycle

- active grants for the rotated credential must be revoked
- grant refresh must re-run access policy evaluation
- expired grants must not authorize runtime access
- revoked grants must not authorize runtime access

### Envelope lifecycle

- encrypted envelope status must be updated during rotation
- old envelope must not be used for new grants after rotation
- key alias and version must be auditable
- envelope metadata must remain redacted

### Runtime behavior

- runtime must not continue with stale grants
- runtime should enter pause/recovery workflow if rotation affects active provider access
- runtime recovery must request a fresh grant through Credential Vault policy

## TTL Policy

Draft defaults:

- grant TTL must always be explicit
- grant TTL should be short-lived
- recommended maximum default: 15 minutes
- emergency grant TTL: immediate revoke
- telemetry-only grants may use shorter TTLs where possible
- refresh is not automatic authority; refresh must re-evaluate tenant/runtime/provider context

## Treasury vs User Rotation

### User Trading

User credential rotation requires:

- user/tenant context
- runtime binding validation
- provider compatibility
- grant revocation
- audit trail

### Treasury Trading

Treasury credential rotation requires:

- treasury policy approval
- governance/federation context where applicable
- stricter operator access controls
- audit trail
- no inheritance by user runtimes

## Required Audit Events

Rotation must emit or preserve:

- `CREDENTIAL_ROTATED`
- `CREDENTIAL_ROTATION_AUDITED`
- `CREDENTIAL_GRANT_REVOKED`
- `CREDENTIAL_ACCESS_DENIED` when stale access is attempted
- `RUNTIME_CREDENTIAL_BOUND` when a runtime receives a new reference binding

Events must not include raw secrets, decrypted payloads, signing material, or provider DTOs.

## Production Blockers

Before production rotation is enabled:

- final vault adapter selected
- adapter-specific rotation tested
- key alias/version strategy approved
- rollback-safe revocation plan approved
- runtime recovery behavior validated
- audit retention policy approved
- operator runbook approved
- provider permission checklist approved

## Final Rule

Rotation is a security lifecycle operation.

It must not become an implicit provider execution path, strategy mutation path, or live trading approval path.
