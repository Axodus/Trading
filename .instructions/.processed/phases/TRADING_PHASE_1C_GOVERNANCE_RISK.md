# Trading Phase 1C - Governance and Sovereign Risk Pipeline

# Purpose

Phase 1C establishes the first sovereign protection pipeline for institutional execution.

The implementation remains deterministic and local. There are no external governance APIs, market feeds, AI systems, or real-time risk providers in this phase.

---

# Sovereign Execution Model

```text
ExecutionIntent
-> ProductExecutionGate
-> GovernanceExecutionGuard
   -> ConstitutionalStandingEvaluator
   -> FederationExecutionEvaluator
   -> TreasuryPolicyEvaluator
-> RiskGateway
   -> GlobalRiskGateway
   -> TreasuryRiskGateway
   -> UserRuntimeRiskGateway
-> ExecutionProviderRegistry
-> SimulationProvider
```

Provider execution is unreachable when governance, federation, treasury, or risk evaluators reject the intent.

---

# Governance Enforcement Lifecycle

Treasury execution is evaluated by:
- governance status
- constitutional standing
- strategy whitelist
- federation tier
- delegated execution permission
- federation strategy authorization
- treasury authorization
- treasury strategy authorization

User execution does not inherit treasury permissions. It remains governed by product access and user runtime risk boundaries.

---

# Risk Escalation Flow

Risk is evaluated in three layers:

## Global Risk

Blocks all execution when:
- platform emergency shutdown is active
- provider is blocked
- volatility protection is active
- liquidity protection is active

## Treasury Risk

Blocks treasury execution when:
- treasury exposure exceeds policy
- leverage exceeds policy
- federation allocation is not allowed

## User Runtime Risk

Blocks user execution when:
- user exposure exceeds runtime limits
- beginner-safe limits are exceeded
- provider is not whitelisted
- quote currency is not allowed

---

# Audit Telemetry

Rejections emit typed events:
- `GOVERNANCE_EXECUTION_BLOCKED`
- `RISK_CHECK_REJECTED`

All rejection events preserve `correlationId` for audit tracing.

---

# Non-Goals

- no AI logic
- no market volatility feeds
- no external risk APIs
- no live governance sync
- no real treasury accounting adapter
