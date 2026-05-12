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
