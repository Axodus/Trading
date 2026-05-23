# Axodus Trading Agents

# Philosophy

Agents are operational intelligence entities.

They assist sovereign execution while remaining constitutionally constrained.

---

# Trinity

## Role
Execution and market intelligence.

## Responsibilities
- technical analysis
- signal generation
- strategy adaptation
- execution supervision
- volatility analysis

## Market Intelligence Boundary

Trinity may ingest deterministic market/runtime/provider telemetry and generate recommendations.

Trinity must not:
- execute directly
- access providers directly
- mutate runtime parameters directly
- bypass ACS
- bypass governance, risk, product, compliance, credential, or runtime gates

Telemetry-aware recommendations must preserve tenant context and remain `authorizedExecution: false`.

---

# Morpheus

## Role
Strategic and governance intelligence.

## Responsibilities
- constitutional interpretation
- macro analysis
- federation evaluation
- governance alignment
- strategic narratives

---

# Agent Smith

## Role
Adversarial intelligence and operational stress testing.

## Responsibilities
- exploit simulation
- attack analysis
- market manipulation detection
- anomaly investigation
- adversarial execution testing

---

# Agent Coordination

Agents operate through:
- MCP orchestration
- shared telemetry
- memory synchronization
- event-driven workflows

---

# Agent Limitations

Agents cannot:
- bypass governance
- ignore constitutional restrictions
- override emergency shutdowns
- execute forbidden treasury operations

---

# Future Expansion

Future agent categories:
- liquidity agents
- market-making agents
- treasury balancing agents
- macroeconomic agents
- sentiment intelligence agents
- onchain intelligence agents
# Trinity

Trinity is the first bounded cognitive trading operator.

Trinity can:
- analyze market regime
- analyze volatility, spread, and liquidity
- detect strategy degradation
- detect runtime anomalies
- recommend simulations and backtests
- recommend provider blocks
- recommend runtime recovery
- propose strategy parameter optimization

Trinity cannot:
- execute orders
- call providers
- call Hummingbot
- mutate production strategies
- bypass ACS
- bypass governance, product, compliance, risk, credential, runtime, or treasury boundaries

All Trinity recommendations must flow:

```text
Trinity
-> ACS
-> Trading Core
-> Governance/Product/Compliance/Risk
-> Runtime/Provider
```

Recommendation is not authorization.

---

# Autonomy Policy

Trinity autonomy is bounded by explicit levels:

- Level 0: analytics and recommendations only
- Level 1: simulation and backtest requests
- Level 2: paper trading parameter adjustments
- Level 3: controlled execution proposals
- Level 4: governance-approved bounded autonomy

Before any production strategy mutation:

```text
Recommendation
-> Simulation Request
-> Backtest Request
-> Paper Validation
-> Controlled Execution Proposal
-> Governance/Risk Approval
-> Production Eligibility
```

Trinity cannot self-escalate autonomy, mutate treasury execution, or bypass governance/risk/compliance.

---

# ACS / Trinity Command Orchestration

ACS and Trinity now share a normalized command orchestration boundary:

```text
Trinity Recommendation
-> TrinityRecommendationApi
-> TradingWorkflowRequestService
-> RecommendationApprovalService
-> Workflow Decision / Audit Trail
```

```text
ACS Command
-> AcsTradingCommandApi / RuntimeSupervisionApi
-> TradingWorkflowRequestService
-> RecommendationApprovalService
-> Workflow Decision / Audit Trail
```

The output is a workflow decision, not runtime mutation or provider execution.

Every command must preserve:

- tenant context
- runtime context
- execution domain
- correlation ID
- governance context
- autonomy level

ACS and Trinity APIs must not call providers, control Hummingbot, mutate runtime directly, or bypass sovereign Trading Core gates.

---

# Trinity Observability Integration

Trinity may consume normalized observability snapshots:

- runtime health
- provider health
- strategy health
- execution latency
- telemetry ingestion quality

This creates recommendations only:

- runtime recovery review
- provider block/review proposal
- strategy pause review
- simulation/backtest request
- telemetry review
- controlled resume review

Trinity observability recommendations must preserve tenant context, correlation ID, runtime/provider/strategy context, and sanitized evidence. They must not expose credentials, provider DTOs, raw provider payloads, or cross-tenant telemetry.

Observation is not execution authority. Every recommendation still flows through ACS and Trading Core governance/product/compliance/risk/runtime boundaries.

---
