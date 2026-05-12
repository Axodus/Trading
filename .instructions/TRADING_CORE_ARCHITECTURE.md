# Trading Core Architecture

# Sovereign Model

```text
Governance
    -> Federation
    -> Trading Product Layer
    -> Intelligence
    -> Trading Core
    -> Execution Providers
```

The core normalizes commands, state, events, and guardrail decisions.

---

# Execution Domains

## Treasury Trading

Used for Axodus-controlled capital and governed treasury operations.

Required gate order:

```text
Governance
-> Federation
-> Treasury Policy
-> Global Risk
-> Treasury Risk
-> Provider Execution
```

## User Trading

Used for non-custodial customer runtime execution.

Required gate order:

```text
Compliance Acceptance
-> Product Entitlement
-> Token or Access Policy
-> Runtime Permission
-> Credential Vault Binding
-> Global Risk
-> User Runtime Risk
-> Provider Execution
```

---

# Ownership Boundaries

Axodus owns normalized state for:
- execution context
- strategy product state
- runtime state
- access decisions
- quota consumption
- disclosure acceptance references
- event history

Execution providers own venue-specific side effects only.
