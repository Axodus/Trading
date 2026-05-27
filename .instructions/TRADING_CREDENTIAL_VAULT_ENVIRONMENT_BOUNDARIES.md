# Trading Credential Vault Environment Boundaries

Status: IMPLEMENTED

Date: 2026-05-24

## Objective

Define how Credential Vault behavior must differ between local, staging, and production environments.

This document prevents local/mock credential infrastructure from being mistaken for production readiness.

## Environment Matrix

| Capability | Local | Staging | Production |
| --- | --- | --- | --- |
| Vault adapter | Mock/local encrypted only | Mock/local encrypted or selected provider sandbox | Selected production vault only |
| Real user credentials | Forbidden | Forbidden unless explicitly approved for test tenants with no user funds | Allowed only after production blockers are cleared |
| Raw secrets in contracts/events/logs | Forbidden | Forbidden | Forbidden |
| Product/ACS/Trinity secret access | Forbidden | Forbidden | Forbidden |
| Live exchange access | Forbidden | Forbidden by default | Future sprint only, explicitly approved |
| Paper/simulation | Allowed | Allowed | Allowed where policy permits |
| Withdrawal scope | Impossible | Impossible | Impossible |
| Seed data | Mock/simulation only | Synthetic/test only | No seed secrets |
| Audit retention | Local dev logs only | Staging audit sink | Production audit retention policy |
| Key material | Mock key aliases | Test keys only | Production KMS/Vault keys |

## Local Boundary

Local development may use:

- `MockEncryptedCredentialVaultAdapter`
- in-memory repositories
- local Postgres with mock data
- fake vault references
- synthetic envelope metadata
- simulation/paper fixtures

Local development must not use:

- real API keys
- real API secrets
- real wallet private keys
- production database credentials
- production vault credentials
- live exchange credentials
- live Hummingbot exchange sessions

## Staging Boundary

Staging may use:

- selected provider sandbox
- mock/local encrypted adapter for integration simulation
- synthetic or test exchange credentials with no user funds
- short TTL grants
- separate staging keys
- separate staging vault namespace
- separate staging database
- staging audit sink

Staging must not use:

- production user credentials
- production exchange accounts
- production wallet private keys
- production KMS keys
- production audit sinks
- withdrawal-capable credentials

## Production Boundary

Production credential onboarding requires:

- selected production vault adapter
- approved key rotation policy
- approved emergency revocation policy
- approved operator access policy
- approved audit retention policy
- approved incident response outline
- approved provider credential permission checklist
- compliance disclosure coverage
- environment-specific secrets and keys
- live trading approval in a future sprint

Production must preserve:

- no raw secrets in contracts
- no raw secrets in logs
- no raw secrets in telemetry
- no raw secrets in frontend/Product Surface/ACS/Trinity
- provider-scoped ephemeral grants
- TTL-bound grants
- revocable grants
- no withdrawal scope

## Environment Separation Requirements

Each environment must have distinct:

- vault namespace or account
- KMS keys or key aliases
- service accounts/IAM roles
- database
- audit sink
- runtime configuration
- provider configuration
- credential grant policy

Secrets must never be copied from production to staging or local.

Staging/local fixtures must be synthetic and clearly marked mock/simulation-only.

## Promotion Rules

Allowed promotion:

- contracts
- migrations
- service code
- redacted docs
- synthetic fixtures
- test-only vault references

Forbidden promotion:

- raw secrets
- encrypted production credential payloads
- production KMS keys
- production audit logs containing tenant-sensitive details
- production provider configs
- production wallet bindings

## Runtime Rules

All environments must enforce:

- tenant/runtime/provider scope
- TTL
- revocation
- no withdrawal-like scope
- redacted diagnostics
- audit events
- no direct ACS/Trinity/Product credential access

Production additionally requires:

- operator least privilege
- break-glass audit
- incident runbook
- retention policy
- vault provider SLA review

## Final Rule

Local and staging vault behavior exists to validate boundaries.

It does not authorize production credential onboarding or live exchange execution.
