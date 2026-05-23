# Trading Phase 4A - ACS Tenant Operator Boundary

Status: IMPLEMENTED

---

# Objective

Define the official access boundary between Tenant ACS and the headless Trading Core.

ACS is an operator interface. It may request, supervise, pause, resume, stop, inspect, or forward recommendations, but it is not an authority layer.

---

# Gate Rule

All ACS flows must enter through Trading Core:

```text
ACS Intent
-> Trading Core
-> Compliance/Product/Governance Gate
-> Risk Gate
-> Runtime/Provider Boundary
-> Event/Audit Trail
```

ACS must never bypass:
- product entitlement
- governance
- risk
- runtime permissions
- credential boundaries
- compliance preconditions
- provider abstraction

---

# Contracts

Phase 4A adds ACS contracts:

- `AcsTradingIntent`
- `AcsRuntimeCommand`
- `AcsSupervisionRequest`
- `AcsTradingRecommendation`
- `AcsRuntimeInspectionRequest`
- `AcsTradingFeedbackEvent`

Command types include:
- request execution
- pause runtime
- resume runtime
- stop runtime
- inspect runtime
- request risk review
- request strategy simulation
- request telemetry summary

---

# Service Boundary

`AcsTradingAccessService` is the Trading Core entrypoint for ACS.

It depends on:
- `ExecutionOrchestrator`
- `TradingEventBus`
- optional runtime lifecycle service
- optional event query service

It does not depend on `ExecutionProviderRegistry` or provider adapters.

This prevents direct ACS provider execution.

---

# Runtime Inspection

ACS runtime inspection returns normalized runtime state, telemetry, and events only.

It must not expose:
- credential material
- credential binding internals
- runtime isolation identifiers
- raw provider DTOs
- Hummingbot controls

---

# Recommendations

Agent/ACS recommendations are advisory input only.

A recommendation is not execution authorization.

Execution still requires a separate `AcsTradingIntent` routed through Trading Core gates.

---

# Non-goals

Phase 4A does not include:
- real ACS integration
- agent autonomy
- direct Hummingbot access
- UI
- live execution
