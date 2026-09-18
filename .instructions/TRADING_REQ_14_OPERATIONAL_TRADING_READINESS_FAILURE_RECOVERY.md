# AXODUS-TRADING-REQ-14 — Operational Trading Readiness & Failure Recovery

**Type:** Architecture & readiness audit  
**Status:** `COMPLETE / CTO REVIEW REQUIRED`  
**Date:** 2026-09-18  
**Baseline audited:** `3dc39251a531e01bfda4a649aab6073c83ea435f`  
**Scope:** Continuous Testnet trading readiness; Mainnet out of scope  
**Implementation:** `NOT AUTHORIZED BY THIS REQ`

## Executive finding

The repository has a validated controlled Testnet order path and substantial
execution, persistence, reconciliation, risk and runtime primitives. It does
not yet have a production-shaped continuous execution runtime. The current
boundary is therefore:

```text
single controlled order lifecycle       VALIDATED
continuous Testnet trading              NOT READY
autonomous Agent trading                 NOT READY
mainnet trading                          OUT OF SCOPE
```

The main gap is orchestration and admission control around the existing
primitives. The controlled harness owns one deliberately bounded lifecycle;
it is not a scheduler, durable intent queue, position authority, recovery
worker, session risk engine or autonomous strategy runtime.

No implementation changes, authenticated mutations or new exchange calls were
performed for this audit.

## Audit evidence

The audit inspected:

- `trading-core/services/trading-core/src/application/ExecutionOrchestrator.ts`
- `trading-core/services/trading-core/src/application/ExecutionIntent.ts`
- `trading-core/services/trading-core/src/execution/CexExecutionLifecycleService.ts`
- `trading-core/services/trading-core/src/execution/DurableCexExecutionLifecycleService.ts`
- `trading-core/services/trading-core/src/execution/ExecutionProviderRegistry.ts`
- `trading-core/services/trading-core/src/external/Val04B2ControlledOrderHarness.ts`
- `trading-core/services/trading-core/src/reconciliation/`
- `trading-core/services/trading-core/src/risk/`
- `trading-core/services/trading-core/src/runtime/`
- `trading-core/services/trading-core/src/state/`
- `trading-core/services/trading-core/src/telemetry/`
- `trading-core/packages/trading-contracts/src/execution/`
- `trading-core/packages/trading-contracts/src/risk/`
- `trading-core/packages/trading-contracts/src/runtime/`
- `trading-core/packages/trading-contracts/src/telemetry/`
- `trading-core/services/trading-core/test/`
- `.instructions/TRADING_REQ_06_EXECUTION_STATE_RECONCILIATION_IDEMPOTENCY_FREEZE.md`
- `.instructions/TRADING_REQ_12_DURABLE_EXECUTION_STATE_RECOVERY_ARCHITECTURE_FREEZE.md`
- `.instructions/TRADING_REQ_13_EXTERNAL_READINESS_FREEZE.md`
- `.instructions/validation/AXODUS-TRADING-VAL-04B2_TESTNET_CONTROLLED_ORDER.md`

The accepted VAL-04B2 evidence proves one real Testnet order, deterministic
client identity, exact lookup, cancellation, terminal reconciliation and zero
residual state. It does not prove repeated operation, process supervision,
continuous admission, or autonomous recovery.

## A. Current-state capability matrix

| Capability | Status | Evidence | Gap |
| --- | --- | --- | --- |
| One bounded Testnet LIMIT lifecycle | `VALIDATED` | VAL-04B2 final evidence; `Val04B2ControlledOrderHarness` | No continuous-session semantics |
| Axodus intent to provider request | `PARTIAL` | `ExecutionIntent`, `ExecutionOrchestrator`, provider registry | No durable intent queue or continuous dispatcher |
| Product/governance/risk gate before dispatch | `IMPLEMENTED / NOT VALIDATED` | `ExecutionOrchestrator.authorizeByDomain`, `RiskGateway` | No end-to-end continuous runtime admission test |
| Caller-controlled execution identity | `VALIDATED` | VAL-02A/B, VAL-04B2 | Durable identity must be connected to every continuous request source |
| Durable SubmissionAttempt and CAS | `VALIDATED` | IMP-02C0/02C, PostgreSQL tests | No continuous worker ownership protocol |
| Exact CEX reconciliation | `VALIDATED` | VAL-02B/02C and VAL-04B2 | Runtime adapter is not a general recovery loop |
| Startup recovery discovery | `PARTIAL` | durable `recoveryCandidates()` and `RuntimeRecoveryService` | No service that claims attempts, performs provider lookup and commits recovery transitions on startup |
| Continuous submission loop | `MISSING` | No scheduler/queue/long-lived execution session found | P0 |
| Process health admission | `PARTIAL` | runtime and provider observability/risk evaluators | No single dispatch gate that fails closed on all unhealthy states |
| NEW/acknowledged lifecycle | `VALIDATED` | CEX lifecycle tests and VAL-04B2 | Must be exercised through continuous runtime |
| PARTIALLY_FILLED/FILLED lifecycle | `PARTIAL` | contracts/evidence fields and state event support | Durable CEX lifecycle does not expose a complete fill transition model and venue test coverage |
| CANCELED/REJECTED lifecycle | `PARTIAL` | lifecycle states and controlled cancellation | Rejection, cancel rejection and expired venue states lack end-to-end runtime acceptance |
| Expired/venue terminal equivalents | `MISSING` | No complete venue terminal mapping found in accepted runtime path | P0 |
| Position reconciliation | `PARTIAL` | `PositionReconciliationService`, provider reconciliation services | In-memory findings; no durable position authority and no automatic no-new-risk admission gate |
| Order drift/orphan detection | `PARTIAL` | `OrderReconciliationService`, proposal workflow | Review proposals do not themselves stop dispatch or deterministically remediate |
| Risk order notional/allowlist/outstanding limits | `IMPLEMENTED / NOT VALIDATED` | `TradingExternalSafetyPreflightPolicy` | Session-wide, position-wide and time-window limits are incomplete |
| Exposure, leverage and margin controls | `PARTIAL` | treasury/user risk types and gateways | Venue/account data is not shown as a continuous hard gate |
| Kill switch | `PARTIAL` | preflight flag, global emergency state, provider shutdown API | No unified operator/runtime kill switch wired to every dispatch path |
| Durable audit/outbox | `VALIDATED` | IMP-02C0/02C PostgreSQL primitives | Continuous fill and risk decision evidence is not fully connected |
| Strategy/Agent boundary | `PARTIAL` | strategy and Agent recommendation surfaces plus `ExecutionIntent` | No final contract governing who may create/admit continuous execution intents |
| Intent concurrency control | `PARTIAL` | CAS at attempt level | No symbol/session serialization or duplicate intent admission policy |
| Operational metrics and health events | `IMPLEMENTED / NOT VALIDATED` | telemetry and observability services | No demonstrated continuous alerting, dashboards or operator runbook integration |
| WebSocket correctness dependency | `NOT REQUIRED` | BLOCKER-01 remains open; REST path validated | Streaming remains deferred |

## B. Failure and recovery matrix

| Scenario | Initial state | Expected behavior | Forbidden behavior | Acceptance evidence |
| --- | --- | --- | --- | --- |
| Crash before POST | durable attempt created or submission pending | restart finds attempt; submit decision is explicit and policy-gated | implicit duplicate submission | durable attempt and recovery decision |
| Crash immediately after POST | submission in progress/unknown | exact lookup by `executionClientOrderId` | second POST | same attempt resolves to found/not-found/indeterminate |
| POST timeout | submission ambiguous | persist `execution-unknown`, reconcile | blind retry | typed unknown state and zero duplicate POST |
| Accepted response lost | provider has order, local ack missing | exact lookup, persist provider ID and state | create new attempt | provider/client identity association |
| Partial fill before cancel | active order with fills | persist fill evidence, reconcile remaining state, cancel if safe | compensating order | fill and cancel evidence with no hidden exposure |
| Full fill before cancel | order terminal filled | classify filled, reconcile position | assume cancellation succeeded | terminal order plus position evidence |
| Cancel fails/rejected | cancel requested | remain unresolved/rejected and stop new risk | mark canceled without evidence | cancellation evidence and admission block |
| Network loss during reconciliation | reconciling | remain indeterminate and retry reconciliation under governed recovery | resubmit order | durable indeterminate state |
| Restart with open order | non-terminal attempt | discover and exact-lookup order | forget order or submit replacement | recovery worker and CAS evidence |
| Restart with existing position | provider position differs or is unexpected | position reconciliation blocks new risk and requests review | auto-offset or trade to repair | position divergence finding and kill gate |
| Duplicate execution request | same intent/idempotency key | reject or return existing attempt | create second attempt/order | durable uniqueness conflict |
| Concurrent intents | same symbol/session | serialize or reject according to policy | last-write-wins risk admission | concurrency decision and CAS result |
| Stale market data | old observation | reject before dispatch | trade using stale price | stale-data violation |
| Risk ceiling violation | order/exposure exceeds policy | reject and audit | rely on venue filter only | policy rejection event |
| Database unavailable | dispatch state cannot persist | fail closed; no provider mutation | call provider without durable state | database failure and zero new risk |
| Unexpected venue state | provider order/position not expected | freeze dispatch, reconcile and escalate | infer local state is authoritative | divergence record and operator action |

Every row requires deterministic fault-injection tests before continuous Testnet
readiness can be accepted. None authorizes a second order during recovery.

## C. Risk-control matrix

| Control | Current state | Required before continuous Testnet | Eventual Mainnet classification |
| --- | --- | --- | --- |
| Venue/environment allowlist | Implemented and Testnet validated | Keep exact endpoint assertion | Future review only |
| Symbol allowlist | Implemented in controlled preflight | Session-level enforcement | Future review only |
| Max order notional | Implemented (`250 USDT` ceiling in accepted path) | Apply to every continuous request | Re-qualify independently |
| Max outstanding orders | Implemented for controlled run | Durable session/account enforcement | Re-qualify independently |
| Max position notional | Not demonstrated as hard runtime gate | Required | Required if ever considered |
| Aggregate exposure | Partial treasury/user primitives | Required across intents and sessions | Required |
| Orders/time and frequency | Missing | Required | Required |
| Leverage and position mode | Partial type support | Explicit account/venue policy and validation | Required |
| Reduce-only/close-only | Not demonstrated in continuous path | Required for position-reduction workflows | Required |
| Stale market data | Not demonstrated as dispatch gate | Required with timestamp/age bound | Required |
| Price deviation/slippage | Partial conservative LIMIT behavior | Explicit policy separate from venue validity | Required |
| Balance/margin availability | Provider reads exist in interface; continuous gate unproven | Required before dispatch | Required |
| Session/daily loss boundary | Not demonstrated | Required before autonomous operation | Required |
| Kill switch | Partial | Central, durable, operator-visible and fail closed | Required |
| Credential scope | Testnet read/trade validated, withdrawal excluded | Continuous rotation/revocation and health handling | Separate approval only |
| Unexpected order/position | Findings/proposals exist | Immediate no-new-risk gate | Required |

Venue validity is only an input. It cannot substitute for Axodus policy
approval, session exposure, account state or operator authority.

## D. Architecture and ownership map

```text
Agent / Strategy
      │ creates proposal only
      ▼
TradingIntent + idempotency key
      │
      ▼
Intent Admission / Governance / Product
      │
      ▼
Risk and Health Gate
      │  no-new-risk on unknown, stale, divergent or unhealthy state
      ▼
Continuous Execution Runtime
      │ owns queue, serialization, attempt creation and recovery scheduling
      ▼
Durable SubmissionAttempt + transactional outbox
      │
      ▼
ExecutionProvider / Hummingbot HTTP adapter
      │ operational evidence only
      ▼
Binance Futures Testnet
      │ orders, fills, positions
      ▼
Exact Order + Position Reconciliation
      │
      ├── CAS lifecycle transition
      ├── durable evidence/event
      └── health/risk admission update
```

Ownership decisions:

- Strategy/Agent owns proposal generation, never credentials, signing or venue calls.
- Governance/product owns whether a strategy/runtime is admitted.
- Risk/health gate owns whether a request may create new risk.
- Continuous Execution Runtime owns queueing, attempt creation, serialization,
  recovery scheduling and stopping dispatch.
- Durable Trading state owns canonical intent, attempt, lifecycle, evidence,
  provider identity and audit records.
- Provider adapter owns transport and provider evidence; it does not decide
  Axodus lifecycle truth or resubmission permission.
- Reconciliation owns comparison of external orders/positions to durable state.
- Operator controls own kill switch and review of unresolved divergence.

## E. Gap register

| ID | Priority | Gap | Required outcome |
| --- | --- | --- | --- |
| REQ14-G01 | P0 | No continuous execution runtime/queue with health-gated dispatch | One durable, supervised runtime for repeated intents |
| REQ14-G02 | P0 | Continuous lifecycle lacks complete fill, reject, cancel-reject and expiry acceptance | Venue-state mapping and durable transition coverage |
| REQ14-G03 | P0 | Startup recovery is not connected to provider exact lookup and durable attempt CAS | Recovery worker resolves non-terminal attempts without resubmission |
| REQ14-G04 | P0 | Position/order divergence does not universally block new risk | Durable no-new-risk gate for unexpected external state |
| REQ14-G05 | P0 | Continuous risk envelope lacks position, aggregate, frequency, stale-data and loss controls | Every intent passes complete policy evaluation |
| REQ14-G06 | P0 | Kill switch is not a single dispatch boundary | Operator/runtime stop blocks every new order and records evidence |
| REQ14-G07 | P0 | Failure-injection acceptance is limited to controlled lifecycle cases | VAL-05 proves process, provider and database failure windows |
| REQ14-G08 | P1 | Strategy/Agent intent admission is not a durable continuous contract | Strategy cannot bypass admission or create provider calls |
| REQ14-G09 | P1 | Symbol/session concurrency and duplicate intent policy is incomplete | Explicit serialization, idempotency and conflict semantics |
| REQ14-G10 | P1 | Continuous account balance/margin and position-mode validation is unproven | Account state is a pre-dispatch dependency |
| REQ14-G11 | P1 | Credential health, rotation and revocation during a session are unproven | Credential failure stops new risk and enters recovery |
| REQ14-G12 | P2 | Metrics, alerts and operator runbooks are not validated as an operating surface | Operators can detect and act without log inspection |
| REQ14-G13 | P2 | Durable fill/risk/reconciliation evidence is not fully connected to telemetry | Reconstructable audit trail for every continuous decision |

## F. Proposed implementation sequence

No implementation is authorized by REQ-14. The following sequence is a
proposal for CTO review and reuses existing execution, PostgreSQL, CAS,
reconciliation, risk and telemetry primitives.

### IMP-05A — Continuous Execution Admission & Runtime Supervisor

- **Scope:** durable intent intake, queue/session ownership, health gate,
  operator stop, single dispatch boundary and graceful shutdown.
- **Depends on:** IMP-02C/VAL-02C, REQ-13, REQ-14 acceptance.
- **Acceptance:** repeated mock intents are serialized, unhealthy/unknown state
  blocks new risk, one provider path is used, restart preserves queue/attempts.
- **Tests:** duplicate intents, concurrent intents, kill switch, provider/database
  degradation, shutdown and resume.
- **Boundary:** no new external order authority beyond the existing Testnet gate.

### IMP-05B — Durable Order/Position Recovery Worker

- **Scope:** startup scan, claim/CAS, exact order lookup, fill/cancel state
  mapping, position lookup, orphan detection and no-new-risk escalation.
- **Depends on:** IMP-05A, existing durable attempt repository and provider
  reconciliation capability.
- **Acceptance:** failure matrix scenarios 1–10 pass with no blind submission.
- **Tests:** crash windows, partial/full fills, cancel ambiguity, restart and
  unexpected positions.
- **Boundary:** no compensating orders and no DEX/WebSocket dependency.

### IMP-05C — Continuous Risk Envelope & Session Limits

- **Scope:** position/aggregate exposure, rate/frequency, stale market data,
  slippage/deviation, balance/margin, leverage/position mode and loss limits.
- **Depends on:** IMP-05A and live provider read contracts.
- **Acceptance:** every policy violation rejects before provider mutation and
  produces durable evidence.
- **Tests:** each risk row in the matrix plus kill-switch races.
- **Boundary:** preserve the `250 USDT` ceiling; do not increase it.

### IMP-05D — Strategy-to-Execution Intent Boundary

- **Scope:** durable intent schema, idempotency, strategy permissions, result
  delivery and concurrency admission.
- **Depends on:** IMP-05A and IMP-05C.
- **Acceptance:** Agent/strategy has no credential/provider access and cannot
  bypass governance, risk or recovery.
- **Tests:** unauthorized intent, duplicate intent, conflicting symbol intents,
  terminal result delivery.
- **Boundary:** no autonomous external execution until later validation.

### IMP-05E — Operational Observability & Runbooks

- **Scope:** metrics/events for submission, fills, cancellations, divergence,
  provider errors, latency, risk rejection, unknown state and kill switch.
- **Depends on:** IMP-05A–D.
- **Acceptance:** operator can identify every new-risk block and unresolved
  external state without raw log inspection.
- **Tests:** event completeness and alert routing with redacted data.
- **Boundary:** no secret or signed-request telemetry.

### VAL-05 — Continuous Testnet Failure-Recovery Acceptance

- **Scope:** real Testnet session under explicit CTO authorization after all
  implementation gates pass.
- **Acceptance:** controlled repeated operation, restart/recovery, risk stops,
  position/order reconciliation, cleanup and zero blind resubmission.
- **Tests:** complete matrix A–P above with one mutation per separately approved
  scenario and no automatic retries.
- **Boundary:** Testnet only; no mainnet, no WebSocket correctness dependency,
  no operational capital authority.

## G. Final readiness classification

| Surface | Classification | Evidence |
| --- | --- | --- |
| Controlled Testnet execution | `READY` | VAL-04B2 completed one bounded lifecycle with cleanup |
| Continuous Testnet trading | `NOT READY` | No continuous supervisor, complete recovery worker or complete risk envelope |
| Autonomous Agent trading | `NOT READY` | Strategy/Agent intent and authority boundary is partial; no autonomous admission runtime |
| Mainnet trading | `OUT OF SCOPE` | Explicitly excluded by REQ-14 and all accepted boundaries |

## CTO decisions required

1. Accept or revise the P0/P1/P2 gap register.
2. Approve or reject the proposed `IMP-05A` through `IMP-05E` sequence.
3. Select whether continuous Testnet readiness requires a real provider-backed
   position/fill adapter in `IMP-05B` before risk-envelope work in `IMP-05C`.
4. Confirm the operator/kill-switch authority and session limits before any
   future continuous Testnet authorization.

No decision in this REQ authorizes a new order, continuous execution,
autonomous Agent trading, credential expansion or Mainnet activity.
