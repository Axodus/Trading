# AXODUS-TRADING-REQ-06 — Execution State, Reconciliation & Idempotency Freeze

Status: `GO / DOCUMENTATION FREEZE / IMPLEMENTATION HOLD`

Date: 2026-09-17

## Objective

Freeze the Axodus execution-lifecycle contracts required after the published IMP-01 restricted HTTP substrate and before any operational execution path or `IMP-02` implementation.

This record formalizes ownership and behavior for client order identity, idempotency, submission state, provider order identity, reconciliation, status transitions, duplicate prevention, restart recovery and cancellation semantics. It does not implement those capabilities.

## Preserved baseline and boundaries

The current dependency baseline remains the REQ-04 materialized baseline:

```text
Condor              d89e74f2e3e273bea102c64e4977118e6a88084f
Hummingbot client   v1.5.9 / dae015a3c513879ed06a55cf2b2c10e5772c0962
Hummingbot API      2494e847538bb7b819495cbc30eb4ef828feaacd
```

IMP-01 remains complete and published for the admitted HTTP execution and market-data read boundaries. `AXODUS-TRADING-BLOCKER-01` remains open; WebSocket is not admitted. Condor remains outside the first execution path.

This request authorizes documentation and contract reconciliation only. It does not authorize code implementation, persistence changes, credentials, exchange connectivity, orders, paper/shadow/live trading, production, capital authority or upstream changes.

## Canonical lifecycle candidate

The lifecycle to be frozen is Axodus-owned and begins before the Hummingbot adapter:

```text
Order Intent
    │
    ▼
authorization / risk-approved boundary
    │
    ▼
submission attempt
    │
    ├── known provider result ──────► normalized lifecycle transition
    │
    └── transport ambiguity ────────► PROVIDER_EXECUTION_UNKNOWN
                                             │
                                             ▼
                                      reconciliation required
                                             │
                                  ┌──────────┴──────────┐
                                  ▼                     ▼
                           provider order found   no order proven
                                  │                     │
                                  ▼                     ▼
                           continue lifecycle    recovery decision
```

The proposed state vocabulary is a freeze candidate for CTO review, not an implementation instruction until accepted:

```text
INTENT_ACCEPTED
SUBMISSION_PENDING
SUBMITTED
PARTIALLY_FILLED
FILLED
CANCEL_REQUESTED
CANCELLED
REJECTED
EXPIRED
PROVIDER_EXECUTION_UNKNOWN
RECONCILIATION_PENDING
RECONCILED
RECOVERY_REQUIRED
TERMINAL_FAILURE
```

The exact transition table must be implemented only after this contract is accepted. A provider order status is evidence for a transition; it is not the canonical Axodus state machine.

## Ownership matrix

| Capability | Axodus Trading Core | Hummingbot substrate | Condor | Classification |
|---|---|---|---|---|
| Client order identity | owns canonical identity | may receive a mapped client reference | no authority | `PRESERVE / NEW CONTRACT` |
| Idempotency key | generates, persists and validates | provider support to be verified | cannot generate authority for Core | `AXODUS-OWNED` |
| Submission state | owns state machine and audit | reports operational outcome | cannot submit directly | `AXODUS-OWNED` |
| Provider order identity | maps and stores as external reference | supplies provider identifier | read-only through controlled interfaces | `ADAPT` |
| Reconciliation | owns policy, evidence and final classification | supplies provider observations | later adapter only | `NEW / AXODUS-OWNED` |
| Duplicate prevention | owns decision and idempotency enforcement | may enforce provider-side behavior if available | no authority | `NEW / AXODUS-OWNED` |
| Restart recovery | owns durable recovery workflow | may expose current provider state | no authority | `NEW / AXODUS-OWNED` |
| Cancellation semantics | owns authorization and lifecycle transition | performs admitted operational request | cannot cancel directly | `ADAPT / AXODUS-OWNED` |
| Strategy, risk and capital authority | owns | does not own | does not own | `PRESERVE` |
| Audit and accounting | owns canonical record | provides evidence only | no authority | `PRESERVE` |

Hummingbot may provide submission mechanisms, provider order IDs and status observations. It must not become the owner of Axodus order identity, risk approval, lifecycle truth, reconciliation policy, portfolio state or capital authority.

Condor remains a later external agent runtime and bounded adapter. It may reason or propose through controlled interfaces after separate authorization; it may not submit, retry, reconcile, cancel or mutate execution state directly.

## Invariants to freeze

1. `PROVIDER_EXECUTION_UNKNOWN` is not `FAILED`.
2. An unknown result requires reconciliation before a resubmission or cancellation decision.
3. No automatic blind retry is permitted after a submission attempt with unknown outcome.
4. Axodus owns the canonical client order identity and idempotency semantics.
5. A Hummingbot provider order ID is an external reference and never replaces the Axodus identity.
6. Correlation and intent references must survive submission, provider observation, reconciliation and audit events.
7. State transitions are explicit, auditable and monotonic with respect to the evidence available; a late provider observation must not silently rewrite history.
8. Restart recovery begins from durable Axodus state and reconciliation evidence, not from an in-memory adapter assumption.
9. Cancellation of an unknown submission is not assumed safe until the provider state is reconciled or a separately accepted provider capability proves the operation safe.
10. Retry policy for reads and lifecycle queries is distinct from order-submission retry policy. No submission retry is introduced by this request.

## Hummingbot baseline assessment

IMP-01B/C proves that the current adapter can submit an Axodus order intent over the admitted HTTP path, normalize a provider order ID and status, and map a post-submission transport failure to `PROVIDER_EXECUTION_UNKNOWN` without retry.

The current evidence does not yet freeze a complete client-order-id or provider-side idempotency guarantee. The Hummingbot client/server surfaces must be checked in the next implementation planning step for:

- accepted client order identity fields and their propagation;
- provider order lookup by client identity and provider identity;
- status freshness and terminal-state semantics;
- cancellation behavior when the result of submission is unknown;
- whether the provider guarantees duplicate suppression or merely accepts an optional reference;
- behavior across server or connector restart.

Until those questions are evidenced, Axodus must treat provider idempotency as unverified and retain ownership of duplicate prevention and reconciliation.

## Required contract outputs before IMP-02

The REQ-06 freeze is complete only when its accepted contract provides:

- a canonical Axodus order identity and idempotency model;
- a submission-attempt record with correlation and authorization evidence;
- a state-transition table for known results, unknown results, reconciliation and terminal outcomes;
- a reconciliation evidence model and provider lookup requirements;
- duplicate-prevention and restart-recovery rules;
- cancellation rules for known, unknown and reconciled orders;
- an explicit mapping between Hummingbot evidence and Axodus states;
- an implementation gap map for `IMP-02` without expanding the published IMP-01 surface.

## Proposed implementation sequence

```text
REQ-06 contract acceptance
        ↓
Axodus durable lifecycle record
        ↓
idempotency and client-identity enforcement
        ↓
provider lookup / reconciliation boundary
        ↓
known and unknown state transitions
        ↓
restart recovery and cancellation policy
        ↓
offline adversarial validation
        ↓
IMP-02 operational lifecycle implementation
```

The sequence is a proposal for the next implementation milestone. It does not authorize any step before CTO acceptance of this freeze.

## Risks and unresolved questions

- The current Hummingbot baseline may not provide sufficient client-order identity or duplicate suppression guarantees.
- A transport failure can leave provider state unknown even when the adapter has correctly preserved the ambiguity.
- Durable Axodus state is required for safe restart recovery and cannot be inferred from Hummingbot runtime state alone.
- Cancellation may be ambiguous for an order whose submission result is unknown.
- No real exchange or credential-backed lifecycle behavior has been tested or authorized.

## Decision state

`AXODUS-TRADING-REQ-06` is authorized as a documentation and contract-freeze milestone. CTO review is required before `IMP-02` implementation. CEO decision required: `NONE`.

Related records:

- `.instructions/TRADING_IMP_01_RESTRICTED_BASELINE_AUTHORIZATION.md`
- `.instructions/TRADING_IMP_01D_HTTP_MARKET_DATA_BOUNDARY.md`
- `.instructions/TRADING_BLOCKER_01_REMEDIATION_DESIGN.md`
- `.instructions/BLOCKER_REGISTER.md`
