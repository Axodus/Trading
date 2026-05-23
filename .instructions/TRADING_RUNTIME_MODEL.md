# Trading Runtime Model

# Multi-Tenant Runtime

User Trading is multi-tenant by design.

Runtime is headless infrastructure. Users interact with runtimes through strategy products, ACS tenant workflows, marketplace product pages, DAO tenant pages, or contextual DeFi/DEX surfaces.

The runtime layer must not require or imply a generic public Trading frontend.

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

Runtime controls exposed to users must be mediated by product or ACS workflows. Provider-level controls, including Hummingbot controls, remain internal operational infrastructure.

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

WhiteRabbit is the first user-facing runtime product. Its UI-accessible surface should be a WhiteRabbit product experience, not a generic `/trading` page.

---

# Phase 5C Runtime Provisioning

Runtime provisioning is now modeled as a governed Trading Core workflow.

Provisioning requires:
- product entitlement
- compliance gate approval
- credential binding
- runtime quota
- runtime policy
- risk validation

Product surfaces and ACS submit provisioning requests; they do not provision runtimes directly.

Normalized lifecycle events include:
- `RUNTIME_PROVISION_REQUESTED`
- `RUNTIME_PROVISION_APPROVED`
- `RUNTIME_PROVISION_REJECTED`
- `RUNTIME_STARTED`
- `RUNTIME_PAUSED`
- `RUNTIME_RECOVERING`
- `RUNTIME_TERMINATED`

Runtime termination revokes provider credential access through the credential authority boundary when a runtime binding exists.
