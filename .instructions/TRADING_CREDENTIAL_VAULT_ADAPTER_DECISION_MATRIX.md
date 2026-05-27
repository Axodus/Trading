# Trading Credential Vault Adapter Decision Matrix

Status: IMPLEMENTED

Date: 2026-05-24

## Objective

Compare future Credential Vault backend options without selecting or implementing a production provider in this sprint.

The current implementation remains provider-agnostic through `CredentialVaultAdapter`.

## Evaluation Summary

| Adapter option | Tenant isolation | Auditability | Rotation support | Emergency revocation | Envelope encryption fit | Operational complexity | Local development | Staging fit | Production readiness | Cost / maintenance risk | Vendor lock-in risk | Recommended role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HashiCorp Vault | Strong with namespaces/policies | Strong | Strong | Strong | Strong | High | Medium with dev mode | Strong | Strong if operated well | High ops burden | Low to medium | Best cloud-neutral production candidate |
| AWS KMS + Secrets Manager | Strong with IAM/account separation | Strong with CloudTrail | Strong | Strong | Strong | Medium | Medium with LocalStack/mocks | Strong if AWS selected | Strong in AWS-native stack | Medium | High | Best AWS-native production candidate |
| GCP KMS + Secret Manager | Strong with projects/IAM | Strong with Cloud Audit Logs | Strong | Strong | Strong | Medium | Medium with emulators/mocks | Strong if GCP selected | Strong in GCP-native stack | Medium | High | Best GCP-native candidate |
| Azure Key Vault | Strong with tenant/subscription separation | Strong with Azure Monitor/audit logs | Strong | Strong | Strong | Medium | Medium with mocks | Strong if Azure selected | Strong in Azure-native stack | Medium | High | Best Azure-native candidate |
| Local encrypted adapter | Weak to medium | Limited | Limited | Limited | Medium for testing only | Low | Strong | Limited | Not acceptable | Low | Low | Local/staging simulation only |

## Option Notes

### HashiCorp Vault

Strengths:

- strongest portability across cloud and self-hosted environments
- mature policy model
- strong audit devices
- strong token/lease semantics for TTL-bound access
- good fit for provider-scoped ephemeral grants

Risks:

- operationally heavy
- requires secure deployment, backup, unseal, HA, policy management, and audit sink operations
- misconfigured policies can still leak access

Best use:

- production if Axodus wants cloud-neutral vault control and accepts operational overhead

### AWS KMS / Secrets Manager

Strengths:

- strong production posture in AWS-native infrastructure
- CloudTrail auditability
- IAM and account isolation
- good key rotation and secret versioning support
- lower operational burden than self-managed Vault

Risks:

- AWS lock-in
- local development requires mocks or LocalStack-like tooling
- IAM complexity can become the real attack surface

Best use:

- production if Axodus infrastructure standardizes on AWS

### GCP KMS / Secret Manager

Strengths:

- strong production posture in GCP-native infrastructure
- project/IAM separation
- Cloud Audit Logs
- key/version support

Risks:

- GCP lock-in
- local development requires mocks/emulators
- IAM and project boundary design must be explicit

Best use:

- production if Axodus infrastructure standardizes on GCP

### Azure Key Vault

Strengths:

- strong production posture in Azure-native infrastructure
- good audit and access policies
- key/secret lifecycle support
- enterprise identity integration

Risks:

- Azure lock-in
- local development requires mocks
- operational model depends heavily on subscription/tenant/IAM structure

Best use:

- production if Axodus infrastructure standardizes on Azure

### Local Encrypted Adapter

Strengths:

- good for local/staging simulations
- simple developer workflows
- low operational overhead
- useful for adapter contract tests

Risks:

- not enough for production user funds
- limited audit guarantees
- weak operational isolation
- easy to misclassify as production-ready if naming is unclear

Best use:

- local development
- staging with synthetic/test credentials only
- adapter compatibility testing

## Decision Guidance

Do not implement every adapter.

Recommended decision path:

1. Keep `CredentialVaultAdapter` provider-agnostic.
2. Continue using `MockEncryptedCredentialVaultAdapter` for local tests and staging simulations.
3. Select one production provider only after infrastructure hosting direction is settled.
4. If Axodus needs cloud-neutral control, prefer HashiCorp Vault.
5. If Axodus standardizes on a cloud, prefer that cloud's native KMS and Secret Manager.

## Required Production Adapter Capabilities

A production adapter must support:

- encrypted secret storage
- key reference metadata
- key rotation
- secret versioning
- emergency revocation
- audit log export
- least-privilege runtime access
- tenant/environment separation
- diagnostics with redaction
- no withdrawal scope support
- no raw secret output through public application contracts

## Current Decision

No production adapter is selected in Phase 17E.

The system remains:

- provider-agnostic
- local/mock only for credential storage
- blocked for production credential onboarding
- blocked for live user credentials

## Blockers Before Final Adapter Selection

- infrastructure hosting decision
- audit retention requirement
- IAM/operator access model
- incident response procedure
- environment boundary implementation
- provider credential permission checklist
- compliance/legal review for non-custodial credential handling
