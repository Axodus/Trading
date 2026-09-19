# AXODUS-TRADING-REQ-15 — Sovereign Agentic Trading Architecture & Infrastructure Freeze

Status: `COMPLETE / DOCUMENTAL AUDIT & ARCHITECTURE FREEZE / CTO REVIEW REQUIRED`

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

The factual audit and architecture decisions are recorded below. This does not
authorize implementation, deployment, credentials, capital, or production
execution.

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

---

# 11. Factual Audit Decisions

## 11.1 Trading repository

**Decision:** `CANONICAL / EXTEND`.

Trading owns domain contracts, market intelligence, opportunity qualification,
strategy proposals, portfolio allocation, risk authority, Trading Intent,
durable execution state, reconciliation, accounting evidence, and feedback.
The existing TypeScript contracts, PostgreSQL persistence, CEX lifecycle,
controlled runtime, and VAL-05 provider composition are reusable foundations.

The repository remains nested-command based because the Trading root has no
root `package.json`. This is a tooling gap, not an architecture reason to
move ownership into a provider.

## 11.2 ACS

**Decision:** `REUSE / ADAPT` as the canonical generic Agent and Workforce
platform.

ACS provides agent identity, revisions, lifecycle, workflow execution,
capability routing, permissions, and run evidence. Trading supplies trading
specializations and domain contracts through an adapter. Trading must not
create a second generic Agent platform.

Observed ACS boundaries include bounded local workflows, receipt persistence,
capability-based routing, and explicit non-production/provider restrictions.
ACS Agents may recommend, request simulations/backtests, inspect telemetry, and
submit bounded workflow requests. They do not own canonical positions,
portfolio accounting, credentials, capital, or venue authority.

## 11.3 Hummingbot

**Decision:** `ADAPT / ISOLATE` as the preferred operational Execution Plane
substrate.

The materialized API/client baseline provides REST surfaces for market data,
connectors, orders, cancellation, positions, and balances. Hummingbot owns
connector and order mechanics after an authorized provider-neutral intent.

Hummingbot does not own Axodus strategy semantics, portfolio allocation,
sovereign risk policy, ACS identity, credentials, capital authority, or
Trading Evidence. The client WebSocket query-token path remains
`KEEP BLOCKED / DO NOT USE` under `AXODUS-TRADING-BLOCKER-01`.

## 11.4 Condor

**Decision:** `ADAPT / ISOLATE` as an external Agent runtime and bounded
orchestration adapter.

The materialized Condor source contains Agent/session orchestration, MCP/tool
surfaces, reflection, strategy/risk modules, CEX handlers, and credential
surfaces. These capabilities make isolation mandatory.

Condor may consume permissioned Trading views and emit recommendations or
workflow requests. It may not call venues directly, own credentials, approve
its own risk, create unapproved orders, own canonical financial state, or
bypass ACS, Governance, Compliance, or Risk Authority.

## 11.5 quants-lab

**Decision:** `ADAPT / REBUILD PARCIAL`; it is not the canonical Quant Lab.

The repository contains reusable backtesting engines, Optuna optimization,
market-feed collectors, feature engineering, regime features, strategy
controllers, and task orchestration. It is not accepted as the sovereign
laboratory because:

- `hummingbot` is unpinned in `pyproject.toml`;
- MongoDB is the default persistence and task database;
- the repository does not provide a complete walk-forward, Monte Carlo,
  out-of-sample, deflated-Sharpe, leakage, survivorship, or stress-testing gate;
- `core/services/okx_dex_api.py` contains private-key signing and broadcast
  surfaces that violate the Quant Lab secret-blind research boundary;
- research, execution, and deployment concerns are mixed in one repository.

Reusable feature and backtest mathematics may be extracted after a separate
implementation authorization. MongoDB as the canonical evidence store,
floating dependencies, DEX signing, and direct production deployment are
rejected.

## 11.6 Standalone Binance runtime

**Decision:** `REFERENCE / CONFORMANCE / POCKET FOUNDATION`.

The validated standalone runtime remains useful as a provider-conformance
reference and a possible future Pocket execution foundation. Standalone
feature expansion remains frozen until it is mapped to the provider-neutral
Execution Contract and Pocket boundary.

## 11.7 Pocket

**Decision:** `SEPARATE DEPLOYMENT PROFILE; PREPARE ONLY AFTER CORE CONTRACTS`.

Pocket must not expose the institutional Harness. It requires a system-enforced
`TrialPolicy`, tenant isolation, withdrawal-disabled credentials where
supported, hard capital/position/leverage/loss/duration limits, revocation,
deletion, and independent product/security/legal/compliance review.

---

# 12. Sovereign Ownership Matrix

| Capability | Canonical owner | Consumer | Explicit non-ownership |
|---|---|---|---|
| Agent identity, revision, Workforce, lifecycle, runtime evidence | ACS | Trading Harness, Quant Lab | Trading does not create a generic Agent platform |
| MarketState and Market Intelligence | Trading Harness | Opportunity and Strategy Agents | Providers do not own normalized state |
| Opportunity discovery and Strategy Fit | Trading Harness | Specialist Agents, Portfolio | No universal pair score |
| TradeProposal | Strategy capability through Harness | Portfolio and Risk | Proposal cannot issue venue commands |
| Portfolio and Capital Allocation | Trading Harness | Risk Authority | Agents cannot allocate capital independently |
| RiskDecision | Independent Axodus Risk Authority | Trading Intent | Agents cannot authorize their own risk |
| TradingIntent | Trading Harness | Execution adapter | Provider-specific REST/WS details do not cross boundary |
| Execution mechanics | Hummingbot/Condor through approved adapter | Venues | Execution Plane does not own strategy, capital, or evidence |
| Venue truth | Exchange venue | Reconciliation | Axodus cannot rewrite external fills or positions |
| Durable decision/evidence history | Axodus Trading | ACS attribution, accounting, feedback | Providers do not own institutional evidence |
| Quantitative research and promotion evidence | Axodus Quant Lab | Strategy lifecycle and Harness | Quant Lab cannot sign or execute trades |
| Credentials | Axodus Credential Vault boundary | Execution runtime | Agents and research code are secret-blind |
| Customer trials | Axodus Trading Pocket | Restricted tenants | Pocket cannot expose institutional authority |

---

# 13. Provider-Neutral Domain Contracts

REQ-15 freezes the following conceptual interfaces for downstream EPIC design:

- `MarketState`: instrument, venue, timestamp, regime, normalized features,
  freshness, sequence/provenance, and source reference.
- `Opportunity`: instrument, venue, strategy family, timeframe, state
  reference, qualification score/reason, expiry, and discovery evidence.
- `TradeProposal`: strategy/revision, opportunity, direction, horizon,
  entry/exit/stop conditions, requested capital/leverage, expected return/risk,
  evidence package, and proposing Agent.
- `RiskDecision`: proposal reference, `ALLOW | MODIFY | REJECT | HALT`,
  authorized capital/leverage, modified conditions, violations, check trace,
  and decision evidence.
- `TradingIntent`: strategy/revision, venue/instrument, side/order type,
  quantity/price, time constraints, slippage policy, risk authorization, and
  deterministic execution client identity.
- `ExecutionResult`: intent reference, provider evidence, accepted/rejected
  state, fills, timestamps, and reconciliation status.
- `StrategyEvidence`: immutable strategy revision, dataset references,
  assumptions, fees/slippage/latency model, experiment manifest, metrics,
  robustness results, and promotion decision.
- `StrategyHealth`: realized-vs-expected performance, drawdown, drift,
  regime fit, execution quality, unresolved reconciliation, and demotion state.

No downstream adapter may make these contracts intrinsically dependent on
Binance, Hummingbot, Condor, one CEX, or one database.

---

# 14. Quant Lab and Strategy Lifecycle Freeze

The canonical Quant Lab is a separate research authority with immutable,
versioned datasets and reproducible experiment manifests:

```text
IDEA
  -> RESEARCH
  -> BACKTEST
  -> MASS TRIALS
  -> WALK-FORWARD / OUT-OF-SAMPLE
  -> MONTE CARLO / REGIME / STRESS TEST
  -> STRATEGY EVIDENCE PACKAGE
  -> PAPER
  -> TESTNET
  -> LIMITED LIVE REVIEW
  -> CORE OR POCKET PROMOTION
  -> MONITOR / ATTRIBUTE
  -> REVALIDATE / DEMOTE / RETIRE
```

Promotion evidence must model fees, slippage, funding, latency, liquidity,
leverage, fill assumptions, data leakage, look-ahead bias, survivorship bias,
parameter sensitivity, and regime dependence. A single profitable backtest
cannot promote a strategy.

The real-time operational data tier, historical research tier, and append-only
evidence tier remain separate. Event replay is not microstructure replay.

---

# 15. Security and Execution Boundaries

The authoritative execution path is:

```text
ACS Agent / Strategy Agent
  -> TradeProposal
  -> Portfolio Allocation
  -> Risk Authority
  -> TradingIntent
  -> Credential Boundary
  -> Execution Adapter
  -> Hummingbot / Condor operational mechanics
  -> Venue
  -> Exact Reconciliation and Evidence
```

Agents, Quant Lab code, Condor reasoning, and Hummingbot operational
components do not receive sovereign capital authority. Credential material is
bound only at the runtime boundary. Gateway/DEX, wallet signing, withdrawals,
mainnet, production credentials, and treasury movement remain outside the
REQ-15 implementation scope.

---

# 16. Gap Register

| Priority | Gap | Decision / required path | Owner |
|---|---|---|---|
| P0 | Formal `MarketState`, `Opportunity`, `TradeProposal`, `StrategyEvidence`, and `StrategyHealth` contracts are incomplete | Open EPIC-01 contract work against this freeze | Trading Contracts |
| P0 | Canonical Quant Lab storage and reproducibility boundary is absent | Open EPIC-QUANT; replace floating/MongoDB authority and reject signing surfaces | Quant Lab / Trading |
| P0 | Independent portfolio/capital allocator and deterministic Risk Authority are not yet the sovereign Harness path | Open EPIC-03 after contract and research boundaries | Trading Harness / Risk |
| P1 | Hummingbot WebSocket authentication remains incompatible | Keep blocked; evaluate a dedicated transport decision only if streaming is required | Execution Plane |
| P1 | Condor direct trading and credential surfaces require isolation | Build bounded ACS/Trading adapter before any Condor execution integration | ACS / Trading |
| P1 | Market-data history lacks proven lossless L2/L3 replay | Separate acquisition, rights, storage, and replay decision from operational feeds | Quant Lab / Trading |
| P2 | Standalone executor expansion and Pocket boundary are not yet productized | Preserve reference/conformance role; open Pocket only after Core contracts | Pocket / Trading |
| P2 | Trading root has no orchestration `package.json` | Maintain documented nested commands or open tooling-only request | Trading repository |

---

# 17. Frozen EPIC Sequence

The next EPICs derive from the sovereign Harness and may not reopen ownership
decisions unless an explicit architecture change review is approved:

1. **`AXODUS-TRADING-EPIC-01` — Sovereign Trading Contracts & Intelligence Foundations**
   Formalize the provider-neutral contracts, Market Intelligence normalization,
   contextual Opportunity Discovery, and Harness evidence references.
2. **`AXODUS-TRADING-EPIC-QUANT` — Quantitative Research & Strategy Validation Laboratory**
   Audit/extract `quants-lab`, establish reproducible datasets, mass trials,
   walk-forward, robustness gates, and Strategy Evidence Packages.
3. **`AXODUS-TRADING-EPIC-02` — Strategy Research, Specialization & Workforce Modeling**
   Connect ACS Workforces to specialist strategy proposals without direct execution.
4. **`AXODUS-TRADING-EPIC-03` — Portfolio Allocation & Sovereign Risk Authority**
   Establish cross-strategy utility, capital allocation, deterministic limits,
   kill switches, and ALLOW/MODIFY/REJECT/HALT decisions.
5. **`AXODUS-TRADING-EPIC-04` — Execution Plane Integration**
   Bind the frozen TradingIntent/Execution Contract to isolated Hummingbot and
   Condor adapters; preserve provider-neutrality and secret blindness.
6. **`AXODUS-TRADING-EPIC-05` — Feedback, Attribution & Strategy Health**
   Compare expected-vs-realized outcomes and feed evidence into allocation,
   promotion, demotion, and retirement.
7. **`AXODUS-TRADING-EPIC-06` — Axodus Trading Pocket**
   Implement only after Core contracts, security review, TrialPolicy, and
   independent product/legal/compliance gates are accepted.

No new IMP or AEES is authorized by this sequence. Each EPIC requires its own
REQ, AEES/IMP, validation evidence, and explicit ownership mapping.

---

# 18. Architecture Decision State

`COMPLETE / DOCUMENTAL AUDIT & ARCHITECTURE FREEZE / CTO REVIEW REQUIRED`

REQ-15 now freezes sufficient ownership, classification, contract, security,
Quant Lab, lifecycle, gap, and EPIC decisions for downstream EPIC opening
without reinterpreting the architecture from available execution tools.

CTO review remains required for acceptance of this freeze. Until acceptance,
implementation remains `HOLD`, standalone expansion remains `FROZEN`, and
mainnet/real capital remain `PROHIBITED`.
