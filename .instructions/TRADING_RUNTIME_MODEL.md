# Trading Runtime Model

# Multi-Tenant Runtime

User Trading is multi-tenant by design.

One strategy product may create many isolated user runtime instances, each associated with:
- one user
- one product entitlement state
- one runtime quota state
- one provider binding
- one credential vault reference set

---

# Runtime Responsibilities

- runtime provisioning boundary
- runtime lifecycle state
- quota-aware admission control
- provider association
- credential binding references
- suspension and failure metadata

---

# WhiteRabbit Productization

```text
WhiteRabbit V1
-> WhiteRabbit Engine
-> StrategyProvider
-> StrategyProduct
-> UserRuntimeInstance or TreasuryStrategyInstance
-> ExecutionProvider
```
