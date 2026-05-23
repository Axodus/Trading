# Trading Phase 14A - Credential Vault Real Adapter Boundary

Status: IMPLEMENTED

Date: 2026-05-23

## Objective

Prepare Credential Vault for a future real encrypted backend without selecting a cloud provider or exposing secrets.

This phase evolves the in-memory credential model into a provider-agnostic vault adapter boundary.

## Delivered Files

- `trading-core/services/trading-core/src/security/CredentialVaultAdapter.ts`
- `trading-core/services/trading-core/src/security/CredentialVaultAdapterRegistry.ts`
- `trading-core/services/trading-core/src/security/MockEncryptedCredentialVaultAdapter.ts`
- `trading-core/services/trading-core/src/security/CredentialGrantLifecycleService.ts`

Updated:

- `trading-core/packages/trading-contracts/src/security/types.ts`
- `trading-core/packages/trading-contracts/src/events/types.ts`
- `trading-core/services/trading-core/src/security/CredentialVaultService.ts`
- `trading-core/services/trading-core/src/security/CredentialLifecycleService.ts`
- `trading-core/services/trading-core/src/index.ts`

## Delivered Contracts

- `CredentialVaultAdapter`
- `CredentialEncryptionEnvelope`
- `KmsKeyReference`
- `EphemeralCredentialGrant`
- `CredentialGrantPolicy`

## Events

- `CREDENTIAL_GRANT_CREATED`
- `CREDENTIAL_GRANT_EXPIRED`
- `CREDENTIAL_GRANT_REVOKED`
- `CREDENTIAL_ENVELOPE_REGISTERED`
- `CREDENTIAL_ROTATION_AUDITED`

## Grant Flow

```text
Runtime Request
-> CredentialAccessPolicyEvaluator
-> CredentialGrantLifecycleService
-> EphemeralCredentialGrant
-> Provider-scoped access
-> TTL expiration / revocation
```

## Architecture Rules

- vault adapter is swappable
- service layer does not depend on a specific KMS provider
- credential binding remains reference-based
- grants are scoped by tenant, runtime, provider, purpose and TTL
- revocation is auditable
- encrypted envelope metadata never carries raw secret material

## Security Rules

The system must not expose:

- raw API secrets
- decrypted credentials
- signing material
- wallet private keys
- withdrawal scope support

Envelope and grant events publish only:

- vault references
- envelope IDs
- adapter type
- key alias
- scopes
- TTL/expiration state
- provider/runtime references

## Test Coverage

Implemented tests for:

- expired grant blocks provider access
- revoked grant blocks provider access
- grant cannot be created with withdrawal-like scope
- grant is tenant/runtime/provider scoped
- adapter registry resolves mock adapter
- encrypted envelope serialization excludes sensitive fields

## Non-goals

- no AWS KMS
- no GCP KMS
- no HashiCorp Vault
- no HSM
- no real secret encryption
- no live exchange login
- no wallet signing
