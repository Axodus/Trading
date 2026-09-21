# 07 — SHADOW Architecture

## Proposed flow

```text
MarketState t0 -> Opportunity -> TradeProposal (baseline)
                                |             |
                                |             +-> Portfolio -> Risk -> Intent -> Execution
                                |
                                +-> ShadowSnapshotCreated (durable outbox)
                                      |
                                      v
                              Shadow Evaluation Worker
                                      |
                               DecisionProvider
                                      |
                              Jev adapter/API
                                      |
                         ShadowDecisionObservation
                                      |
                                      +---- no return path to authorities

Execution/feedback facts -> ShadowOutcomeLinker -> ShadowDecisionEvaluation
```

## Semantics

- `t0` is the immutable cut used by both the recorded baseline proposal and Jev input.
- Shadow execution is asynchronous and bounded. The baseline does not wait.
- A timeout, invalid response or outage creates a typed degraded shadow record.
- The outcome linker references later canonical facts. It never edits the original observation.
- Baseline-rejected proposals may receive market-horizon labels, but must not be represented as executed-trade outcomes.

## Environment

- Allowed: `PAPER`, `TESTNET`.
- Rejected before provider call: `MAINNET`, production, real-capital or unclassified environment.
- Jev has no exchange endpoint, exchange credential, `TradingIntent` constructor or provider-mutation dependency.

## Persistence

A future implementation should add dedicated append-only shadow tables only if needed, with:

- deterministic input identity and conflicting replay error;
- transactional outbox for snapshot/result events;
- CAS for mutable processing projections;
- unique provider request identity;
- restart/replay-safe outcome linking.

This is not a cross-domain transaction. Domain facts remain in their current repositories and are referenced by ID.

## Operational failure

```text
Jev timeout/error/invalid/stale
             |
             v
shadow status = DEGRADED/FAILED
baseline path = unchanged
```

No fallback model should silently substitute for Jev in the main experiment. A fallback would create a different provider treatment and contaminate the evaluation cohort.
