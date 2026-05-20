# Trading Tasks

# Phase 0 - Trading Architecture and Product Economy

Status: IN PROGRESS

Objectives:
- define sovereign Trading Core architecture
- define Trading Product Layer architecture
- separate Treasury Trading from User Trading
- define product, marketplace, access, runtime, billing, security, and compliance boundaries
- define risk ownership and execution-domain gates
- define event model and shared TypeScript contracts

Deliverables:
- `TRADING_CORE_PLAN.md`
- `TRADING_CORE_ARCHITECTURE.md`
- `TRADING_PRODUCT_ECONOMY.md`
- `TRADING_MONETIZATION.md`
- `TRADING_RUNTIME_MODEL.md`
- `TRADING_SECURITY_MODEL.md`
- `TRADING_COMPLIANCE_MODEL.md`
- `trading-core/packages/trading-contracts`
- `trading-core/services/trading-core`
- `trading-core/services/trading-product`
- event contracts for execution, product, runtime, security, and compliance
- documented non-goals for deep Hummingbot runtime work

---

# Phase 1 — Execution Foundation

Status: IN PROGRESS

Objectives:
- implement the first functional Trading Core execution skeleton
- prove execution gate ordering before provider calls
- route approved executions to `SimulationProvider`
- preserve `correlationId` through the flow
- keep Hummingbot out of deep runtime scope

Deliverables:
- `TradingCore`
- `ExecutionOrchestrator`
- `ExecutionProviderRegistry`
- `SimulationProvider`
- `ProductExecutionGate`
- `StrategyAccessService`
- `TokenGateEvaluator`
- `EntitlementEvaluator`
- `RuntimeQuotaEvaluator`
- `GovernanceExecutionGuard` placeholder
- `RiskGateway` placeholder
- `TradingEventBus`
- repository interfaces
- gate-order tests for user, treasury, risk, provider lookup, correlation, and simulation execution
- product access tests for missing entitlement, token gate failure, suspended runtime, quota exhaustion, expired trial, and DAO-only rejection
- governance and sovereign risk tests for governance rejection, treasury policy rejection, emergency shutdown, domain separation, and federation strategy restrictions

---

# Phase 2 — Strategy Infrastructure

Status: PLANNED

Objectives:
- implement modular strategy systems

Deliverables:
- strategy framework
- isolated strategy execution
- strategy telemetry
- strategy lifecycle management
- allocation controls

---

# Phase 3 — Risk Infrastructure

Status: PLANNED

Objectives:
- implement sovereign risk systems

Deliverables:
- exposure limits
- drawdown controls
- emergency execution controls
- treasury protection systems
- risk telemetry

---

# Phase 4 — ACS Integration

Status: PLANNED

Objectives:
- integrate AI-assisted execution

Deliverables:
- orchestration integration
- execution recommendations
- telemetry analysis
- strategy simulations
- bounded optimization

---

# Phase 5 — Cross-market Coordination

Status: FUTURE

Objectives:
- multi-market treasury coordination

Deliverables:
- cross-exchange execution
- cross-market balancing
- liquidity coordination
- exposure normalization

---

# Phase 6 — Autonomous Market Coordination

Status: FUTURE

Objectives:
- bounded autonomous execution

Deliverables:
- autonomous orchestration
- treasury-aware execution
- AI-assisted portfolio balancing
- strategy adaptation systems

Autonomous systems must remain:
- bounded
- observable
- governance-constrained
