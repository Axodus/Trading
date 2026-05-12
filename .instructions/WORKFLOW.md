# Trading Workflow

# Development Philosophy

Trading development prioritizes:
- risk management
- treasury preservation
- execution observability
- accounting integrity
- governance compatibility

Avoid profit-first architecture.

---

# Operational Workflow

## 1. Strategy Definition

Before implementation:
- define market objective
- define treasury exposure
- define risk boundaries
- define execution requirements
- define accounting implications

No strategy should exist without explicit risk boundaries.

---

## 2. Risk Validation

Every strategy must:
- expose drawdown limits
- expose exposure limits
- expose treasury boundaries
- expose execution visibility

Risk systems take priority over execution systems.

---

## 3. Execution Validation

Before deployment:
- validate execution routing
- validate exchange behavior
- validate telemetry consistency
- validate accounting consistency
- validate failure handling

---

## 4. Implementation

Implementation rules:
- isolate strategy execution
- isolate exchange connectors
- isolate portfolio accounting
- expose telemetry
- expose execution state

---

## 5. Runtime Validation

Before merge:
- validate execution flow
- validate telemetry
- validate accounting
- validate risk systems
- validate orchestration integration

---

# Execution Workflow

## Order Lifecycle
- signal generation
- execution validation
- risk validation
- order routing
- execution tracking

---

## Position Lifecycle
- position creation
- exposure tracking
- telemetry updates
- accounting updates
- position closure

---

## Failure Handling
- execution retries
- exchange fallback
- telemetry generation
- treasury protection

---

# Strategy Workflow

## Strategy Creation
- define boundaries
- define risk profile
- define telemetry
- define treasury allocation

---

## Strategy Execution
- signal interpretation
- execution routing
- telemetry generation
- accounting updates

---

## Strategy Shutdown
- unwind positions
- finalize accounting
- archive telemetry

---

# ACS Workflow

## AI-assisted Analysis
- market analysis
- volatility interpretation
- execution recommendations
- telemetry interpretation

---

## Bounded Optimization
- strategy suggestions
- parameter optimization
- execution recommendations

AI systems must never bypass risk controls.

---

# Security Workflow

All trading-sensitive changes must:
- document execution impact
- document treasury impact
- document risk implications
- document orchestration implications

---

# Documentation Workflow

All architecture changes must update:
- ARCHITECTURE.md
- TASKS.md
- ROADMAP.md
- DECISIONS.md

The `.instructions` layer must remain operationally current.