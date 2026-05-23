# Trading Phase 5A - Credential Vault Skeleton and Runtime Credential Authority

Status: IMPLEMENTED

---

# Objective

Implement the first credential authority layer for User Trading without exposing raw secrets to Product Layer, ACS, agents, telemetry, or frontend surfaces.

This phase establishes the non-custodial credential boundary required before realistic runtime provisioning and future live execution.

---

# Delivered Services

Implemented:

- `CredentialVaultService`
- `RuntimeCredentialBindingService`
- `CredentialAccessPolicyEvaluator`
- `CredentialLifecycleService`
- `InMemoryCredentialVaultRepository`

---

# Contracts

Credential contracts now include:

- `CredentialVaultReference`
- `ExchangeCredentialBinding`
- `WalletRuntimeBinding`
- `CredentialScope`
- `CredentialRotationPolicy`
- `CredentialAccessDecision`

Supported credential scopes:

- `read-only`
- `spot-trading`
- `futures-trading`
- `account-info`
- `telemetry-only`

Compatibility scopes remain supported for existing tests and adapters:

- `read-balances`
- `read-positions`
- `trade`
- `cancel-orders`
- `runtime-control`

Withdrawal-like scopes are rejected.

---

# Security Rule

The system must never expose:

- raw API secrets
- decrypted credentials
- signing material
- wallet private keys

Allowed external surfaces:

- vault references
- scoped metadata
- binding state
- access decisions

---

# Runtime Credential Binding

Runtime credential access follows:

```text
User
-> CredentialVaultReference
-> RuntimeCredentialBindingService
-> RuntimeInstance
-> Provider-scoped access
```

The runtime receives only a vault reference and allowed scopes. It does not receive raw secrets from the public service boundary.

---

# Enforcement

Runtime credential binding is blocked when:

- required scope is missing
- withdrawal-like scope is present
- credential is revoked
- credential belongs to another tenant
- provider does not match the runtime provider

---

# Events

Phase 5A adds support for:

- `CREDENTIAL_BINDING_CREATED`
- `CREDENTIAL_BINDING_REVOKED`
- `CREDENTIAL_ROTATED`
- `CREDENTIAL_ACCESS_DENIED`
- `RUNTIME_CREDENTIAL_BOUND`

---

# Non-goals

Phase 5A does not include:

- real encryption backend
- cloud KMS
- production vault
- real exchange APIs
- wallet signing
- provider login flow

The in-memory repository is a safe mock structure for contracts, tests, and future adapter design only.
