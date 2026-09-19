# AXODUS-TRADING-REQ-15 — Sovereign Agentic Trading Architecture & Infrastructure Freeze

Status: `PROPOSED / DOCUMENTAL AUDIT / CTO REVIEW REQUIRED`

Date: `2026-09-19`

Authority: `AXODUS TRADING PROGRAM PLANNING MANDATE`

## Purpose

REQ-15 converts the Sovereign Program Planning & Epic Architecture Mandate into
a reviewable audit and architecture-freeze package. It defines the ownership,
interfaces, evidence requirements, and gates that must be accepted before any
new Trading IMP, AEES, strategy, Agent implementation, Quant Lab rebuild,
Hummingbot/Condor integration, Pocket work, or production enablement.

REQ-15 is a documentation, factual-audit, and architecture decision record. It
is not an implementation milestone and grants no execution, credential,
capital, production, or customer-launch authority.

## Entry gate and current evidence

The mandate entry condition `VAL-05 COMPLETE / PASS` is satisfied and CTO accepted
on commit `ded3f85d2acc3f2f6d6d9e1337bf1dcafc123710`.

Safety accounting: External Safety PASS, Residual Orders 0, Residual Position 0,
Blind Retries 0, Duplicate Submissions 0, Mainnet Calls 0, Secrets Exposed false,
Cleanup PASS.

REQ-15 planning is authorized to proceed without an intermediate gate.

## Sovereign architecture target

```text
ACS identity, revisions, workforces and evidence
                    ↓
Trading Agents and bounded Workforces
                    ↓
Axodus Trading Harness
  market intelligence → market state → opportunity discovery
  strategy fit → proposals → portfolio/capital allocation → risk authority
                    ↓
Canonical Trading Intent / provider-neutral Execution Contract
                    ↓
Approved Execution Plane (Hummingbot / Condor subject to audit)
                    ↓
Venue truth: orders, fills, positions, balances and PnL
                    ↓
Axodus evidence, performance attribution, strategy health and feedback
                    ↺ ACS + Trading Harness + Quant Lab
```

The Harness owns domain intelligence, portfolio allocation, capital policy,
risk decisions, intent, evidence, and feedback. ACS owns generic Agent and
Workforce infrastructure. The Execution Plane owns operational mechanics only
after an authorized intent. The venue remains authoritative for external
execution facts. Quant Lab owns reproducible research and qualification.

## Required factual audits

REQ-15 must inspect current source, revisions, contracts, runtime surfaces,
security boundaries, and validation evidence for:

| Subject | Required question | Output |
| --- | --- | --- |
| Trading repository | What is implemented, governed, deferred, or blocked? | gap and dependency register |
| ACS | Which generic Agent, Workforce, lifecycle, runtime, evidence, and usage capabilities are canonical? | ACS boundary and adapter contract |
| Hummingbot | Which connector, order, market-data, account, and runtime capabilities are factual at the selected baseline? | execution ownership matrix |
| Condor | Which orchestration, lifecycle, configuration, and monitoring surfaces are factual? | runtime ownership matrix |
| Standalone Binance runtime | Which validated contracts and evidence can survive the sovereign boundary? | KEEP / REUSE / ADAPT / REFERENCE / CONFORMANCE / DEPRECATE / REJECT |
| Current risk/reconciliation | What is durable, deterministic, provider-dependent, or still gated? | risk and reconciliation gap register |
| Market data | What is real-time, historical, normalized, fresh, persistent, and research-grade? | data architecture decision |
| `quants-lab` | Does it satisfy the required research and robustness capabilities? | REUSE / ADAPT / REBUILD / REPLACE / RETIRE |
| Deployment/runtime | Which local, paper, testnet, and production boundaries are actually available? | rollout and safety gates |

External capabilities must be verified from materialized source or reproducible
artifacts. Names, documentation, or prior assumptions are not sufficient.

## Decisions REQ-15 must freeze

1. Trading Harness boundary and canonical ownership.
2. ACS Agent, revision, Workforce, lifecycle, runtime, evidence, usage, and governance boundaries.
3. Agent/Workforce relationship and specialization model without prematurely freezing Agent count.
4. Market Intelligence, Market State, Opportunity, Strategy Fit, and data ownership.
5. Portfolio and Capital Allocation authority.
6. Independent Risk Authority with deterministic hard controls where appropriate.
7. Provider-neutral `TradeProposal`, `RiskDecision`, `TradingIntent`, `ExecutionResult`, `StrategyEvidence`, and `StrategyHealth` boundaries.
8. Hummingbot and Condor ownership, adapter surfaces, and prohibited direct-authority paths.
9. Exchange truth, reconciliation, durable decision history, and evidence provenance.
10. Credential ownership, tenant isolation, secret boundary, and Agent secret blindness.
11. Quant Lab boundary and `quants-lab` disposition.
12. Core versus Axodus Trading Pocket separation.
13. Standalone executor disposition.
14. Strategy lifecycle and promotion gates from IDEA through RETIRE.
15. Proposed EPIC sequence and dependency gates.

## Required deliverables

REQ-15 is complete only when the following are reviewable and internally
consistent:

- end-to-end sovereign architecture diagram;
- ownership matrix for ACS, Trading Harness, Quant Lab, Hummingbot, Condor,
  Pocket, and venue/provider;
- component classification matrix using the mandate vocabulary;
- Agent/Workforce architecture with responsibilities and open count decision;
- conceptual Trading domain contracts and evidence references;
- real-time, historical, research, and operational data architecture;
- Core and Pocket execution architecture;
- Quant Lab target architecture independent of `quants-lab` survival;
- credential, tenant, provider, and execution security boundary;
- strategy lifecycle and promotion evidence gates;
- P0/P1/P2 gap register with owners and dependencies;
- proposed EPIC sequence with explicit acceptance gates.

## Contract and ownership baseline

| Contract/capability | Canonical owner | Consumer | Required boundary |
| --- | --- | --- | --- |
| Agent identity, revision, Workforce, lifecycle, runtime evidence | ACS | Trading Harness and research Workforces | no parallel generic Trading Agent platform |
| MarketState | Trading Harness, using admitted data sources | Opportunity and Strategy Agents | freshness, provenance, and schema version required |
| Opportunity | Trading Harness | Strategy Agents and Portfolio | contextual by instrument, venue, strategy, timeframe, and state |
| TradeProposal | Strategy capability through Harness contract | Portfolio and Risk | proposal cannot directly issue venue commands |
| RiskDecision | independent Trading Risk Authority | Trading Intent | ALLOW, MODIFY, REJECT, or HALT with evidence |
| TradingIntent | Trading Harness | Execution Plane | provider-neutral, authorized, traceable, bounded |
| ExecutionResult | Execution Plane plus venue evidence | Harness reconciliation | external truth reconciled into Axodus history |
| StrategyEvidence / StrategyHealth | Quant Lab and Trading Harness | ACS attribution and promotion gate | reproducible source, revision, assumptions, and outcome |
| TrialPolicy and credential boundary | Pocket security/runtime boundary | Pocket execution adapter | system-enforced limits; Agents remain secret-blind |

## Candidate EPIC sequence

These are planning families only. REQ-15 acceptance must confirm, split, merge,
or reorder them before implementation authorization.

1. Sovereign Trading Harness.
2. Execution Plane integration against the frozen provider-neutral contract.
3. `AXODUS-TRADING-EPIC-QUANT` — Quantitative Research & Strategy Validation Laboratory, beginning with the `quants-lab` legacy audit.
4. Strategy Research & Qualification.
5. Trading Feedback & Performance Intelligence.
6. Axodus Trading Pocket.

The Quant EPIC identity is a proposal and must not be treated as an existing
allocation until the roadmap is accepted.

## Validation and acceptance gates

REQ-15 validation is documentary and evidence-based:

- every factual claim links to source, revision, test, or local record;
- each capability has one owner, one consumer path, and explicit non-ownership;
- provider-specific concepts do not cross the provider-neutral contracts;
- Agent proposals cannot bypass Portfolio or Risk Authority;
- Execution Plane cannot become global strategy, capital, credential, or evidence authority;
- Core and Pocket have separate security, tenant, credential, and promotion gates;
- `quants-lab` classification is supported by an actual repository audit;
- existing standalone runtime classification is supported by existing validation evidence;
- all P0 gaps have owners and a decision or validation path;
- CTO acceptance is recorded before any downstream IMP/AEES authorization.

No local test, paper/testnet result, or architecture document changes the
production, credential, capital, or live-trading restrictions.

## Explicit non-goals before REQ-15 acceptance

- no new exchange adapter or standalone executor feature;
- no new strategy implementation;
- no Trading-specific generic Agent platform;
- no Hummingbot or Condor integration implementation;
- no `quants-lab` rebuild or Quant Lab implementation;
- no Pocket implementation or customer credential path;
- no production/mainnet enablement;
- no live trading, treasury movement, withdrawals, or capital authority.

## Open decisions and dependencies

- access to current ACS architecture and evidence contracts;
- factual audit of materialized Hummingbot and Condor revisions;
- factual audit of `quants-lab`;
- selection or recovery of immutable Hummingbot Core provenance;
- ownership decision for market-data persistence and research-grade history;
- root-coordinator consolidation after this local planning handoff.

## Decision state

`PROPOSED / DOCUMENTAL AUDIT / CTO REVIEW REQUIRED`

This record is ready to guide the audit package. It is not a REQ-15 acceptance,
architecture freeze, implementation authorization, or production decision.
