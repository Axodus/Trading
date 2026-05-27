# Trading Phase 17E - Credential Vault Threat Model

Status: IMPLEMENTED

Date: 2026-05-24

## Objective

Prepare Axodus Trading for a future production Credential Vault backend without implementing provider-specific secret storage, cloud KMS integration, wallet signing, provider login flows, or live credential onboarding.

This sprint is security planning only.

## Current Vault State

Trading currently has:

- `CredentialVaultService`
- `RuntimeCredentialBindingService`
- `CredentialAccessPolicyEvaluator`
- `CredentialLifecycleService`
- `CredentialGrantLifecycleService`
- `CredentialVaultAdapter`
- `CredentialVaultAdapterRegistry`
- `MockEncryptedCredentialVaultAdapter`
- reference-based credential contracts
- redacted encrypted envelope metadata
- tenant/runtime/provider-scoped ephemeral credential grants
- TTL and revocation enforcement
- withdrawal-like scope rejection

Current posture:

- adapter-ready
- mock/staging-ready
- not production credential-ready

## Protected Assets

The following assets are security-sensitive:

- CEX API key identifier
- CEX API secret
- exchange passphrase
- wallet binding metadata
- signing material
- encrypted credential envelope
- KMS key reference
- vault reference
- ephemeral credential grant
- provider-scoped credential access decision
- credential audit trail

The following must never appear in public contracts, frontend surfaces, ACS payloads, Trinity recommendations, telemetry, logs, product read models, or event payloads:

- raw API secrets
- decrypted credentials
- wallet private keys
- seed phrases
- signing material
- full connection strings with credentials
- withdrawal-capable scopes

## Principals

### User

Owns exchange account, wallet, capital, and credential authorization.

### Trading Core

Evaluates runtime context, access policy, credential lifecycle, grant scope, and audit emission.

### Runtime Instance

May receive only a scoped, TTL-bound credential grant. It must not receive raw secrets through public contracts.

### Execution Provider Adapter

May request provider-scoped access through the Credential Vault boundary. It must not expose provider DTOs or raw credential material outside the adapter boundary.

### Product Surface

May display binding status and required actions only. It must remain secret-blind.

### ACS

May request, inspect, pause, resume, or supervise workflows. It must remain secret-blind and cannot access raw credentials.

### Trinity

May analyze telemetry and create recommendations. It must remain secret-blind and cannot request credential access directly.

### Operator

May perform limited, audited operational actions according to access policy. Production break-glass must require explicit approval, audit retention, and least-privilege scope.

### Vault Administrator

May administer vault infrastructure, keys, policies, or namespaces. Vault administration must be separated from Trading runtime authority.

## Trust Boundaries

```text
Product Surface / ACS / Trinity
        |
        | references and normalized status only
        v
Trading Core Credential Boundary
        |
        | scoped access decision
        v
Credential Vault Service
        |
        | adapter-specific secret operation
        v
Vault Adapter / KMS / Secret Backend
```

Boundary rules:

- Product surfaces never access secrets.
- ACS never accesses secrets.
- Trinity never accesses secrets.
- Telemetry never carries secrets.
- Events never carry secrets.
- Runtime receives only scoped grant metadata through Trading contracts.
- Vault adapter is the only boundary that may interact with real secret storage in a future implementation.
- No withdrawal, transfer, or account-draining permission is supported.

## Threat Model

### Cross-tenant grant reuse

Threat:
A grant issued for one tenant/runtime/provider is reused by another tenant or runtime.

Required controls:

- tenant scope
- runtime scope
- provider scope
- purpose scope
- TTL enforcement
- revocation support
- audit event on denied access

### Overbroad exchange permission

Threat:
A credential contains withdrawal, transfer, or account-management permissions.

Required controls:

- reject withdrawal-like scopes
- require provider credential permission checklist before onboarding
- allow only read, telemetry, account-info, spot/futures trading, trade, cancel-orders, and runtime-control scopes where explicitly approved
- treat broader exchange permissions as onboarding blockers

### Secret exposure through logs or telemetry

Threat:
Credential material leaks through diagnostics, logs, telemetry, event payloads, product surfaces, ACS inspection, or Trinity recommendation output.

Required controls:

- redact adapter diagnostics
- store only vault references in normalized state
- keep envelope metadata redacted
- prohibit raw provider payloads in public read models
- add security review before any provider adapter obtains real credential access

### Provider adapter compromise

Threat:
A provider adapter or runtime misuses a credential grant.

Required controls:

- provider-scoped grants
- short TTL
- purpose-bound grants
- emergency revocation
- runtime suspension path
- provider health and observability audit
- no direct provider access outside Trading Core

### Operator abuse

Threat:
An operator grants, rotates, or revokes credentials outside approved policy.

Required controls:

- least-privilege operator roles
- audited break-glass procedure
- dual-control for production secret access
- environment separation
- immutable audit trail
- no operator access through frontend/Product Surface/ACS commands

### Stale credential after rotation

Threat:
A runtime continues using an old grant or credential after rotation.

Required controls:

- invalidate previous credential on rotate where policy requires it
- revoke active grants on rotation
- require runtime refresh/recovery workflow
- audit rotation and grant revocation

### Environment bleed

Threat:
Local, staging, or production credentials are copied across environments.

Required controls:

- separate vault namespaces
- separate KMS keys
- separate service accounts
- separate databases
- separate audit sinks
- no secret promotion between environments
- synthetic-only local seed data

### Grant replay

Threat:
A captured grant is replayed after intended use.

Required controls:

- short TTL
- runtime/provider/user binding
- status validation
- expiration enforcement
- revocation enforcement
- correlationId audit

## Incident Response Assumptions

Before production credential onboarding, Axodus Trading must have:

- selected vault adapter
- emergency revoke procedure
- rotation procedure
- operator access policy
- incident severity model
- audit retention policy
- tenant communication procedure
- provider credential permission checklist
- runtime suspension workflow

## Production Credential Onboarding Blockers

Production user credential onboarding remains blocked until all items below are complete:

- final vault adapter selected
- adapter-specific threat model reviewed
- key rotation procedure approved
- emergency revocation procedure approved
- audit retention policy approved
- operator break-glass policy approved
- environment separation implemented
- provider credential permission checklist approved
- compliance disclosure flow covers non-custodial automation risk
- live provider execution remains explicitly disabled until approved in a later sprint

## Final Posture

Credential Vault is the sovereign credential authority boundary for User Trading.

It is not production-ready secret infrastructure yet.

Live credentials remain disabled.

Withdrawal scope remains impossible.
