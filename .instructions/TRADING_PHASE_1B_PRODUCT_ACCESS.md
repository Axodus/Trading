# Trading Phase 1B - Product Access and Entitlement Gates

# Purpose

Phase 1B makes the Product Layer gate operational for user execution while keeping all evaluators mocked and local.

There is no blockchain, staking, NFT, billing vendor, or wallet RPC integration in this phase.

---

# Access Validation Flow

```text
User Execution
-> ProductExecutionGate
-> StrategyAccessService
-> EntitlementEvaluator
-> TokenGateEvaluator
-> RuntimeQuotaEvaluator
-> RiskGateway
-> Provider Registry
```

Treasury execution bypasses the Product Layer and remains governed by governance and treasury-risk gates.

---

# Entitlement Lifecycle

Supported entitlement states:
- eligible
- active
- trial
- expired
- suspended
- revoked

Execution is allowed only when the strategy policy is satisfied by:
- public access
- active entitlement
- allowed subscription tier
- active trial entitlement
- token policy success
- DAO membership for DAO-only strategies

---

# Quota Enforcement Model

Runtime quota checks include:
- max active runtimes
- max active strategies
- max executions per day
- max concurrent positions
- trial execution limits

Quota exhaustion blocks execution before provider lookup.

---

# Runtime Access Lifecycle

Supported runtime states:
- provisioning
- active
- paused
- suspended
- stopped
- failed

Only active runtimes may execute.

Suspended, paused, provisioning, stopped, and failed runtimes block execution before provider access.

---

# Non-Goals

- no billing vendor integration
- no staking contract integration
- no NFT validation
- no blockchain calls
- no persistence adapter
- no real exchange access
