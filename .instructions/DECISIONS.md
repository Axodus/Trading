# Trading Decisions

# Active Decisions

## Trading Direction

Decision:
Trading acts as the strategic market execution layer of the Axodus ecosystem.

Status:
CONFIRMED

---

## Risk Philosophy

Decision:
Risk systems take priority over execution optimization.

Treasury preservation is sovereign priority.

Status:
CONFIRMED

---

## Execution Philosophy

Decision:
Execution systems must remain:
- observable
- auditable
- telemetry-driven
- governance-compatible

Opaque execution is forbidden.

Status:
CONFIRMED

---

## Governance Integration

Decision:
Trading remains governance-aware and governance-constrained.

Trading systems must never bypass:
- governance permissions
- treasury boundaries
- constitutional restrictions

Status:
CONFIRMED

---

## ACS Integration

Decision:
ACS systems may assist:
- analysis
- simulations
- optimization
- telemetry interpretation

ACS systems must remain bounded and observable.

Status:
CONFIRMED

---

## Strategy Philosophy

Decision:
Strategies remain isolated execution systems.

Strategies must:
- expose telemetry
- expose accounting
- expose risk boundaries

Status:
CONFIRMED

---

## Exchange Philosophy

Decision:
Exchange integrations must remain modular and abstracted.

Avoid exchange-specific coupling.

Status:
CONFIRMED

---

## Telemetry Philosophy

Decision:
Telemetry is mandatory infrastructure.

All execution systems must expose:
- execution state
- accounting visibility
- failure telemetry
- portfolio visibility

Status:
CONFIRMED

---

## Trading Infrastructure as a Service

Decision:
Trading is a product economy layer as well as sovereign execution infrastructure.

Axodus provides:
- orchestration
- automation
- intelligence
- tooling
- governed infrastructure access

Users retain:
- their own capital
- their own wallets
- their own exchange accounts
- their own execution credentials

Status:
CONFIRMED

---

## Treasury Trading and User Trading

Decision:
Treasury Trading and User Trading share one `TradingCore`, but must remain distinct execution domains with separate policy, risk, compliance, and permission boundaries.

Status:
CONFIRMED

---

## Product Economy Boundaries

Decision:
Phase 0 must formalize first-class product boundaries for marketplace, access, runtime, billing, credential vault, and disclosure acceptance.

Status:
CONFIRMED

---

## Free Strategy Monetization

Decision:
Free or no-commission strategies may still support revenue and token utility through token gating, staking, subscriptions, premium telemetry, marketplace upgrades, access tiers, and runtime quotas.

Status:
CONFIRMED

---

## First Execution Provider

Decision:
The first functional execution flow must run against `SimulationProvider`.

Hummingbot must not be introduced as a deep runtime dependency until the provider abstraction, gate ordering, event flow, and risk/provider boundaries are proven independently.

Status:
CONFIRMED

---

## Product Gate Implementation

Decision:
User execution must pass through ProductExecutionGate before risk and provider access.

Phase 1B uses mocked local evaluators for strategy access, entitlement, token policy, runtime quota, and DAO membership. External billing, chain, staking, NFT, and wallet integrations remain out of scope.

Status:
CONFIRMED

---

## Sovereign Protection Pipeline

Decision:
Treasury execution must pass through constitutional, federation, treasury policy, global risk, and treasury risk evaluation before provider access.

User execution must remain separated from treasury permissions and pass through product access plus user runtime risk evaluation.

Phase 1C uses deterministic local evaluators only.

Status:
CONFIRMED

---

# Pending Decisions

## Canonical Exchange Priority Strategy

Status:
PENDING

---

## Cross-market Routing Strategy

Status:
PENDING

---

## Autonomous Execution Limits

Status:
PENDING

---

## Derivatives Infrastructure Strategy

Status:
PENDING

---

## AI-assisted Optimization Boundaries

Status:
PENDING
