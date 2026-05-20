# Trading Phase 1A - Execution Core Foundation

# Purpose

Phase 1A proves the first functional execution pipeline without Hummingbot.

The only execution provider used in this phase is `SimulationProvider`.

---

# Execution Lifecycle

```text
ExecutionIntent
-> TradingCore
-> ExecutionOrchestrator
-> ProductExecutionGate
-> GovernanceExecutionGuard
-> RiskGateway
-> ExecutionProviderRegistry
-> SimulationProvider
-> TradingEventBus
```

The orchestrator validates execution context before gates. Provider execution is unreachable unless gates and risk approve.

---

# Provider Lifecycle

The simulation provider is split into:
- `SimulationProvider`
- `SimulationRuntime`
- `SimulationExecutionEngine`

The provider owns simulated side effects only:
- fake fills
- simulated balances
- simulated positions
- cancellation state
- deterministic price behavior
- configurable latency

---

# Event Propagation

`TradingEventBus` supports:
- publish
- subscribe
- ordered dispatch
- correlationId filtering
- subscriber failure isolation
- in-memory event tracing

Dispatch errors are captured and do not stop later subscribers.

---

# Repository Boundary

Phase 1A defines repository interfaces only:
- `OrderRepository`
- `FillRepository`
- `PositionRepository`
- `PortfolioRepository`
- `TradingEventRepository`
- `RuntimeRepository`

There are no database adapters in Phase 1A.
