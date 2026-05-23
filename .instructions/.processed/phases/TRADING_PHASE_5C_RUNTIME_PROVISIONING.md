# Trading Phase 5C - Runtime Provisioning API and Lifecycle Orchestration

Status: IMPLEMENTED

---

# Objective

Formalize runtime provisioning as a sovereign lifecycle workflow governed by entitlement, compliance, credential binding, runtime policy, and risk validation.

Product surfaces and ACS may request provisioning, but they cannot provision runtimes directly.

---

# Delivered Services

Implemented:

- `RuntimeProvisioningService`
- `RuntimeProvisioningRequest`
- `RuntimeProvisioningDecision`
- `RuntimeProvisioningPolicy`
- `RuntimeLifecycleCoordinator`
- `RuntimeRecoveryService`

---

# Provisioning Flow

```text
User Product Surface / ACS
-> Product Entitlement
-> Compliance Gate
-> Credential Binding
-> Runtime Quota
-> Runtime Policy
-> Risk Validation
-> Runtime Provisioning Decision
-> Runtime Instance
```

---

# Runtime Lifecycle States

Supported normalized states:

- requested
- provisioning
- active
- paused
- suspended
- degraded
- recovering
- failed
- terminated

Legacy `stopped` remains supported for existing lifecycle compatibility.

---

# Runtime Recovery

Conceptual recovery is modeled for:

- provider disconnect
- runtime crash
- degraded provider
- orphan runtime
- stale execution state

No live exchange reconciliation is included.

---

# Runtime Policy

Runtime provisioning policy enforces:

- provider compatibility
- strategy/product compatibility
- tenant restrictions
- quota enforcement
- execution domain separation
- treasury/user isolation

---

# Events

Phase 5C supports:

- `RUNTIME_PROVISION_REQUESTED`
- `RUNTIME_PROVISION_APPROVED`
- `RUNTIME_PROVISION_REJECTED`
- `RUNTIME_STARTED`
- `RUNTIME_PAUSED`
- `RUNTIME_RECOVERING`
- `RUNTIME_TERMINATED`

---

# Non-goals

Phase 5C does not include:

- container orchestration
- Kubernetes
- process manager
- real Hummingbot sessions
- production runtime scaling
- live exchange reconciliation
