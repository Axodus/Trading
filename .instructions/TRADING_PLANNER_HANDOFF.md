# Axodus Trading Core - Planner Handoff

Date: 2026-05-23

Workspace: `/mnt/d/Rede/Github/Axodus/Trading`

## Purpose

This report consolidates the latest Trading Core sprint reports and gives the Planner a clean execution direction for the next sprint wave.

The current priority is not live trading. The current priority is to stabilize, review, validate and operationalize the headless Trading Core around durable local persistence, governed paper validation, reconciliation review, observability risk evidence, and credential vault hardening.

---

## Current Architecture State

Axodus Trading Core is now modeled as:

```text
Infrastructure + Product + Economy + Monetization + Observability + Bounded Intelligence
```

Confirmed operating model:

```text
Governance
-> Federation
-> Trading Product Layer
-> ACS / Product Surfaces / Intelligence
-> Trading Core
-> Execution Providers
-> State / Event / Audit / Observability
```

The core remains headless. User-facing Trading access should happen through Strategy Product surfaces such as WhiteRabbit, ACS, Marketplace, DeFi, DEX, Academy or Tenant DAO pages. A generic public `/trading` route remains a non-goal unless explicitly scoped as internal admin or observability.

---

## Consolidated Completed Scope

### Core Execution and Provider Abstraction

Delivered:

- `TradingCore`
- `ExecutionOrchestrator`
- `ExecutionProviderRegistry`
- `TradingEventBus`
- `SimulationProvider`
- Hummingbot provider/runtime adapter boundary
- provider health normalization
- DTO isolation for Hummingbot internals

Key rule:

```text
Provider execution only happens after product/governance/compliance/risk/runtime gates.
```

### Product Economy and User Runtime

Delivered:

- Product access gate
- strategy entitlement evaluation
- token/access policy placeholders
- runtime quota evaluation
- subscription/trial-aware access model
- WhiteRabbit as first `StrategyProduct`
- WhiteRabbit product surface API
- runtime provisioning lifecycle
- multi-tenant runtime isolation

Key rule:

```text
Product surfaces submit requests and expose normalized reads. They do not execute.
```

### Governance, Risk and Compliance

Delivered:

- governance execution guard
- treasury policy evaluator
- federation execution evaluator
- constitutional standing evaluator
- global risk gateway
- treasury risk gateway
- user runtime risk gateway
- compliance runtime gate
- disclosure acceptance/version enforcement
- observability risk feedback policy
- paper observability risk loop

Key rule:

```text
Observability and paper telemetry are evidence. They are not authority.
```

### State, Event Store and Persistence

Delivered:

- authoritative Trading State Layer
- in-memory event/audit persistence
- Postgres repository adapters
- append-only event store
- migration runner
- database bootstrap service
- local Docker Compose Postgres runtime
- migration CLI
- real `pg`-backed `NodePostgresClient`
- repository readiness check
- local Postgres E2E smoke command

Current local validation command:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e
```

Supported options:

```bash
npm run trading:local:e2e -- --json
npm run trading:local:e2e -- --cleanup
npm run trading:local:e2e -- --reset-local
npm run trading:local:e2e -- --skip-docker
```

### Reconciliation

Delivered:

- provider reconciliation services
- reconciliation worker skeleton
- stale runtime and provider drift scan services
- reconciliation proposal repository
- ACS review flow for reconciliation proposals
- remediation request model
- review states and audit events

Key rule:

```text
Reconciliation detects and proposes. It does not auto-heal.
```

### Credential Vault

Delivered:

- Credential Vault skeleton
- runtime credential binding service
- credential access policy evaluator
- in-memory safe repository
- credential lifecycle events
- provider-scoped access checks
- real adapter boundary for future encrypted vault
- encrypted envelope metadata
- ephemeral credential grant model
- mock encrypted vault adapter

Key rule:

```text
No raw secrets, decrypted credentials, API keys, signing material or wallet private keys leave the vault boundary.
```

### Trinity and ACS

Delivered:

- ACS tenant operator access boundary
- ACS/Trinity command orchestration API
- Trinity recommendation engine
- Trinity autonomy policy
- Trinity market intelligence ingestion
- Trinity observability integration
- recommendation approval workflow

Key rule:

```text
Recommendation != execution authority.
```

### WhiteRabbit Paper Validation

Delivered:

- WhiteRabbit paper validation service
- WhiteRabbit paper session adapter
- paper telemetry summary service
- controlled resume evaluator
- paper validation policy and decision models
- simulation evidence model

Key rule:

```text
WhiteRabbit paper validation is evidence for review. It is not live approval.
```

---

## Most Recent Sprint Reports Consolidated

### Phase 15B - WhiteRabbit Paper Validation Workflow

Status: implemented.

Delivered:

- strategy-specific paper validation workflow
- paper orders/fills normalization through Trading boundaries
- tenant-scoped telemetry summary
- reconciliation dry-run as evidence
- controlled resume eligibility model
- Trinity recommendation intake without mutation

Planner note:

WhiteRabbit is now ready for paper validation workflow refinement and operational execution against local/simulation infrastructure. It is not ready for live trading.

### Phase 15C - ACS Review Flow for Reconciliation Proposals

Status: implemented.

Delivered:

- ACS review command for reconciliation proposals
- risk/governance decision states
- request-only remediation model
- remediation eligibility service
- audit trail for approvals/rejections

Planner note:

The next reconciliation work should focus on operational workflow integration and operator review surfaces, not automatic correction.

### Phase 16A - Paper Observability Risk Loop

Status: implemented.

Delivered:

- paper session risk signal service
- paper session health evaluator
- paper execution quality evaluator
- paper controlled resume policy
- paper risk decision service
- paper risk audit service

Planner note:

Paper telemetry can now influence controlled resume eligibility through risk evidence. It must not become automatic execution authority.

### Phase 16B - Real Local Postgres CI Script

Status: implemented.

Delivered:

- local CI-style E2E command
- Docker Compose orchestration
- migration, seed, health, validate and replay smoke sequencing
- JSON output support
- local-only safety checks and secret redaction

Planner note:

The next priority is to run and standardize this command as the baseline local validation before deeper paper runtime work.

---

## Current Open Risks

### 1. Large Worktree and Review Risk

Multiple phases were implemented in the same local worktree. This increases review, merge and rollback risk.

Planner orientation:

- prioritize checkpoint review
- split commits by domain if possible
- do not start live/paper expansion until the implementation state is reviewed

### 2. Local Postgres Requires Real Execution Validation

The local Postgres E2E command exists, but it must be run in a real local environment and treated as a required validation step before persistence changes continue.

Planner orientation:

- make `npm run trading:local:e2e` the required local durable validation command
- capture standard pass/fail output
- document required local environment variables

### 3. Credential Vault Is Still Mock/Adapter-ready

The vault boundary exists, but real KMS/HSM/encryption provider selection is not complete.

Planner orientation:

- do not onboard production credentials
- perform vault threat model and provider selection before live provider credentials
- keep all runtime configs reference-only

### 4. Reconciliation Is Reviewable but Not Remediating

Reconciliation can produce proposals and ACS review can create remediation requests, but no remediation execution workflow should be assumed.

Planner orientation:

- keep remediation request-only
- next work may define controlled remediation workflow skeleton
- no auto-healing, order cancellation or position correction

### 5. Paper Validation Is Not Production Approval

WhiteRabbit paper validation and paper observability risk exist, but they are evidence-producing workflows only.

Planner orientation:

- no live enablement
- no performance/yield claims
- controlled resume remains gated by ACS/Governance/Risk

---

## Recommended Next Sprint Wave

### Sprint 17A - Checkpoint Review and Commit Split

Objective:

Freeze the current implementation state into reviewable units.

Recommended scope:

- full `git status` and `git diff` review
- domain-based file inventory
- commit split plan
- validate no secrets/provider DTO leakage
- run full local unit validation
- record final checkpoint status

Acceptance criteria:

- current work is reviewable by domain
- sprint-to-file mapping is clear
- no live execution path exists
- validations pass or blockers are documented

### Sprint 17B - Local Postgres E2E Operational Runbook

Objective:

Turn the local E2E command into the official developer validation workflow.

Recommended scope:

- run `npm run trading:local:e2e` against real local Docker Postgres
- document expected output
- document common failure modes
- confirm reset/cleanup behavior
- confirm JSON mode output for automation
- update README/runbook if gaps are found

Acceptance criteria:

- developer can validate local durable Trading runtime with one command
- failure diagnostics are actionable
- no production-like env can run accidentally

### Sprint 17C - WhiteRabbit Paper Validation Operational Scenario

Objective:

Exercise WhiteRabbit paper validation end-to-end using local/simulation infrastructure.

Recommended scope:

- create a deterministic WhiteRabbit paper scenario
- validate signal -> paper session -> normalized fills -> telemetry -> reconciliation dry-run -> controlled resume decision
- ensure tenant isolation
- ensure Trinity can recommend but not mutate

Acceptance criteria:

- complete paper validation trace exists
- controlled resume eligibility remains request/review-only
- critical telemetry or unresolved reconciliation blocks eligibility

### Sprint 17D - Reconciliation Remediation Workflow Skeleton

Objective:

Define the next request-only step after ACS approves a reconciliation proposal.

Recommended scope:

- remediation workflow request service
- runtime recovery request routing
- provider resync request model
- manual operator review request model
- audit events for remediation workflow lifecycle

Forbidden:

- no auto-healing
- no provider mutation
- no order cancellation
- no position closure

### Sprint 17E - Credential Vault Threat Model and Adapter Selection

Objective:

Prepare for a real encrypted vault backend without implementing provider-specific secrets yet.

Recommended scope:

- KMS/HSM/Vault comparison
- tenant/runtime/provider grant threat model
- key rotation policy
- emergency revocation policy
- audit retention policy
- production credential onboarding blockers

Acceptance criteria:

- Planner can choose a future vault adapter path
- live credentials remain disabled
- withdrawal scope remains impossible

### Sprint 17F - Paper Runtime Readiness Gate

Objective:

Define the explicit readiness gate before any deeper Hummingbot paper runtime expansion.

Recommended scope:

- checklist for compliance, entitlement, credential reference, runtime policy, risk, observability and reconciliation
- paper session readiness decision
- paper-only provider compatibility matrix
- Hummingbot paper boundary checklist

Acceptance criteria:

- paper runtime can advance only when all gates are satisfied
- no live trading implication exists

---

## Planner Non-goals For Next Wave

Do not plan:

- live trading
- production exchange orders
- production API key onboarding
- wallet signing
- withdrawal permissions
- autonomous execution
- direct ACS -> Hummingbot control
- direct Trinity -> provider control
- public generic `/trading` dashboard
- copy trading
- performance/yield/profit claims
- production cloud deployment
- Kubernetes or distributed workers
- Kafka/Redis/ClickHouse expansion unless separately approved

---

## Required Validation Baseline

Before the next implementation wave is considered stable, run:

```bash
npm run lint --prefix trading-core/services/trading-core
tsc --noEmit -p trading-core/packages/trading-contracts/tsconfig.json
npm run build --prefix trading-core/services/trading-core
npm test --prefix trading-core/services/trading-core
git diff --check
```

For local durable persistence validation:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e
```

Optional automation output:

```bash
npm run trading:local:e2e -- --json
```

---

## Planner Decision Summary

The correct next direction is:

```text
Checkpoint and review
-> run real local Postgres E2E validation
-> operationalize WhiteRabbit paper validation
-> route reconciliation remediation through request-only ACS workflows
-> harden Credential Vault design
-> then consider deeper Hummingbot paper runtime work
```

The incorrect next direction is:

```text
live trading
-> production credentials
-> autonomous execution
-> direct provider controls
-> public trading dashboard
```

Trading Core is paper-ready in architecture, not production-live ready.

