# AXODUS-TRADING-EPIC-01 — Trading Harness Foundations (Planning Baseline)

**STATUS:** `ACCEPTED PLANNING BASELINE / READY FOR REQ-01 FOUNDATIONS`  
**PARENT AUTHORITY:** `AXODUS-TRADING-REQ-15`  
**CROSS-EPIC AUTHORITY:** `AXODUS-TRADING-CROSS-EPIC-SCF-01`  
**GOAL:** Establish the canonical Trading domain contracts and runtime foundations for the Axodus Trading Harness.

## Canonical Path

```text
MarketData
  ↓
MarketState
  ↓
Opportunity
  ↓
TradeProposal
  ↓
PortfolioDecision
  ↓
RiskDecision
  ↓
TradingIntent
  ↓
Execution Plane Boundary
```

## Milestone Decomposition

1. **REQ-01** — Canonical Harness Contract Foundations
2. **REQ-02** — Market Intelligence & MarketState Foundations
3. **REQ-03** — Opportunity Discovery Boundary
4. **REQ-04** — Strategy & ACS Proposal Boundary
5. **REQ-05** — Portfolio & Capital Allocation Boundary
6. **REQ-06** — Sovereign Risk Authority Integration
7. **REQ-07** — TradingIntent Generation & Preconditions
8. **REQ-08** — Evidence & Observability Lineage
9. **REQ-09** — Harness Integration & Simulation Acceptance

## Invariants

- NO MARKET CONTEXT → NO TRADE PROPOSAL
- NO ELIGIBLE STRATEGY → NO TRADING INTENT
- NO PORTFOLIO AUTHORIZATION → NO CAPITAL ALLOCATION
- NO RISK AUTHORIZATION → NO TRADING INTENT
- AGENT PROPOSAL ≠ RISK AUTHORIZATION
- TRADING INTENT ≠ EXCHANGE ORDER
- PROVIDER API ≠ TRADING DOMAIN CONTRACT
- ACS OWNS GENERIC AGENT/EVIDENCE INFRASTRUCTURE
- TRADING OWNS TRADING DOMAIN INTELLIGENCE
