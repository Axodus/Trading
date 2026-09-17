# Axodus Trading Workspace

# Operational Source of Truth

Keep this directory focused on current execution guidance.

Current canonical files:
- `README.md`
- `WORKFLOW.md`
- `DECISIONS.md`
- `TASKS.md`
- `ROADMAP.md`
- `SECURITY.md`
- `RISK.md`
- `EXCHANGES.md`
- `STRATEGIES.md`
- `TRADING_AGENTS.md`
- `TRADING_CORE_ARCHITECTURE.md`
- `TRADING_PRODUCT_ECONOMY.md`
- `TRADING_RUNTIME_MODEL.md`
- `TRADING_SECURITY_MODEL.md`
- `TRADING_COMPLIANCE_MODEL.md`
- `TRADING_MONETIZATION.md`
- `TRADING_CORE_PROGRESS_REPORT.md`
- `TRADING_PLANNER_HANDOFF.md`
- `TRADING_PHASE_17A_CHECKPOINT_REVIEW.md`
- `TRADING_IMPLEMENTATION_INVENTORY.md`
- `TRADING_COMMIT_SPLIT_PLAN.md`
- `TRADING_REVIEW_FINDINGS.md`
- `TRADING_NEXT_WAVE_BOUNDARIES.md`
- `TRADING_PHASE_17B_LOCAL_POSTGRES_E2E_RUNBOOK.md`
- `TRADING_PHASE_17C_WHITERABBIT_PAPER_SCENARIO.md`
- `TRADING_PHASE_17D_RECONCILIATION_REMEDIATION_WORKFLOW.md`
- `TRADING_PHASE_17E_CREDENTIAL_VAULT_THREAT_MODEL.md`
- `TRADING_REQUEST_03_LOCAL_E2E_ENVIRONMENT.md`
- `TRADING_CREDENTIAL_VAULT_ADAPTER_DECISION_MATRIX.md`
- `TRADING_CREDENTIAL_VAULT_ROTATION_POLICY.md`
- `TRADING_CREDENTIAL_VAULT_EMERGENCY_REVOCATION.md`
- `TRADING_CREDENTIAL_VAULT_ENVIRONMENT_BOUNDARIES.md`
- `TRADING_NEXT_PHASE_BOUNDARIES.md`
- `TRADING_OPEN_RISKS.md`
- `TRADING_HUMMINGBOT_BACKEND_API_OWNERSHIP.md`

Processed sprint docs, older plans, duplicate architecture drafts, checkpoint inventories, and historical reports live in:

```text
.instructions/.processed/
```

Use processed files as historical documentation only. For implementation decisions, prefer the canonical files above.

---

# Purpose

The Trading workspace is the strategic market execution layer of the Axodus ecosystem.

This workspace coordinates:
- strategy execution
- exchange routing
- market intelligence
- risk systems
- execution telemetry
- portfolio balancing
- AI-assisted trading coordination
- treasury-aligned market operations

Trading is not a retail signal platform.

Trading is financial execution infrastructure.

---

# Trading Philosophy

Trading is:
- risk-first
- treasury-aware
- execution-oriented
- telemetry-driven
- governance-compatible
- AI-assisted
- modular
- observable

The objective is long-term strategic execution and treasury sustainability.

---

# Governance Relationship

Trading remains governance-aware.

Governance defines:
- execution boundaries
- treasury permissions
- risk restrictions
- exchange restrictions
- execution policies

Trading systems must never bypass governance authority.

---

# Defi Relationship

Trading acts as an execution layer for Defi treasury operations.

Trading may coordinate:
- treasury exposure
- ETF balancing
- liquidity execution
- market operations
- strategy diversification

Trading execution must remain accountable to treasury systems.

---

# ACS Relationship

Trading integrates with ACS for:
- orchestration
- AI-assisted analysis
- execution coordination
- telemetry
- workflow automation
- simulation systems

AI systems assist execution but do not become sovereign authorities.

---

# Core Trading Domains

## Strategies
Execution logic and market behavior systems.

Examples:
- grid
- DCA
- scalping
- arbitrage
- market making
- hedging
- volatility systems

---

## Risk
Capital preservation and operational protection systems.

---

## Exchanges
Execution endpoints and market integrations.

---

## Telemetry
Execution monitoring and operational visibility.

---

## Portfolio Coordination
Treasury exposure and market balancing.

---

## AI-assisted Execution
Cognitive analysis and bounded optimization systems.

---

# Execution Philosophy

Execution systems must:
- expose telemetry
- expose accounting
- expose risk visibility
- expose execution state

Avoid opaque automated trading systems.

---

# Current Priority

1. preserve headless Trading Core boundaries
2. keep paper/simulation workflows non-live
3. maintain ACS/Governance/Risk approval paths
4. validate local Postgres with `trading:local:e2e`
5. advance WhiteRabbit and reconciliation through governed request-only flows
6. keep Credential Vault and compliance boundaries secret-blind
7. avoid autonomous/live execution until explicitly approved

---

# Non-Negotiables

- risk-first execution
- treasury accountability
- observable execution
- governance compatibility
- auditable strategies
- bounded automation
- no opaque execution

## Current canonical audit

- `TRADING_REQ_02_CANONICAL_ARCHITECTURE_AUDIT.md` — canonical Hummingbot/Condor architecture, ownership, RAG/SPEC reconciliation and implementation gap map
- `TRADING_REQ_03_IMPLEMENTATION_BASELINE_GAP_FREEZE.md` — concrete source verification gate before adapter implementation
