# Trading Security Model

# Credential Vault Domain

Phase 0 defines a credential vault boundary for non-custodial user trading.

The contract layer may expose:
- vault references
- provider-scoped bindings
- lifecycle state
- wallet runtime bindings

The contract layer must not expose:
- raw API secrets
- decrypted credential payloads
- signing material

---

# Boundary Services

- `CredentialVaultService`
- `RuntimeCredentialBindingService`
- `CredentialAccessPolicyEvaluator`

These boundaries keep secret storage separated from core orchestration, product services, agents, and frontend state.

---

# Phase 5A Implementation

Credential Vault now exists as a service boundary with an in-memory safe mock repository.

Implemented services:
- `CredentialVaultService`
- `RuntimeCredentialBindingService`
- `CredentialAccessPolicyEvaluator`
- `CredentialLifecycleService`
- `InMemoryCredentialVaultRepository`

Runtime binding requires:
- matching tenant
- matching provider
- active credential lifecycle status
- allowed scopes
- no withdrawal-like scope

External layers remain secret-blind and receive only references, scoped metadata, and decisions.
