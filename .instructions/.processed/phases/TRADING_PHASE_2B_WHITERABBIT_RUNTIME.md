# Trading Phase 2B - WhiteRabbit Productization and Multi-Tenant Runtime

# Purpose

Phase 2B turns WhiteRabbit into the first official Axodus Trading strategy product and introduces local multi-tenant runtime orchestration.

No billing vendor, marketplace UI, copy-trading, or AI parameter mutation is implemented in this phase.

---

# Strategy Product Lifecycle

WhiteRabbit is represented as both:
- treasury-capable strategy provider
- user-facing `StrategyProduct`

The product adapter defines:
- product metadata
- visibility
- access policy
- subscription tier compatibility
- runtime quotas
- supported providers
- lifecycle status

WhiteRabbit remains compatible with treasury execution while also functioning as a premium user product.

---

# Multi-Tenant Runtime Lifecycle

```text
User
-> StrategyProduct
-> UserRuntimeProvisioner
-> RuntimeLifecycleService
-> RuntimeIsolationPolicy
-> Provider-bound UserRuntimeInstance
```

Supported lifecycle operations:
- provision
- suspend
- recover
- telemetry increment

Runtime quota exhaustion blocks provisioning before execution can be attempted.

---

# Runtime Isolation Model

Each runtime receives tenant-scoped isolation identifiers:
- credential binding scope
- position scope
- balance scope
- execution state scope

The same strategy product can be provisioned for multiple users without sharing:
- credentials
- positions
- balances
- execution state
- telemetry counters

---

# Telemetry Foundation

Telemetry is tenant-scoped by:
- `userId`
- `runtimeInstanceId`
- `strategyProductId`

WhiteRabbit exposes strategy telemetry and product telemetry metadata. Ranking is only modeled as metadata in this phase.

---

# Non-Goals

- no billing integration
- no marketplace UI
- no copy-trading
- no AI parameter mutation
- no real credential vault adapter
- no persistent runtime repository
