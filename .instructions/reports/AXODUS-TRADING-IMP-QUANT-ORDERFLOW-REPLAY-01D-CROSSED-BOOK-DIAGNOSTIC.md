# AXODUS-TRADING-IMP-QUANT-ORDERFLOW-REPLAY-01D — Crossed Book Diagnostic

## Status

`DIAGNOSTIC_INCOMPLETE`

The previous 01C run reported a reconstructed crossed book, but the bounded 01D reconstruction did not reproduce that state consistently. The cause remains `UNRESOLVED`. The provider is not classified as corrupt.

```text
RECONSTRUCTED_BOOK_CROSSED: YES
PROVIDER_BOOK_PROVEN_CROSSED: NO
OOS_ACCESSED: NO
MUTATIONS: 0
JEV_CALLS: 0
```

## First reported invalid state

The prior 01C evidence identifies the earliest alleged causing update as:

```text
timestamp: 2026-06-23T00:38:07.235Z
partition: normalized/canonical/2026-06-23/00/BTCUSDT_orderbook.parquet
event_type: update
first_update_id: 10870485568957
final_update_id: 10870485587889
prev_final_update_id: 10870485568887
```

The prior run reported:

```text
before: best bid 63958.2, best ask 63958.3
after:  best bid 63958.2, best ask 63957.8
logical rows: 71
```

Direct Parquet filtering for the same `event_time` returns 343 rows. This difference is material: timestamp equality does not establish logical event identity, and the grouping discrepancy must be resolved before attributing the state to the provider.

## Classification

```text
EVENT_GROUPING: FAIL / RECONCILIATION REQUIRED
EVENT_ORDERING: UNRESOLVED
BOOTSTRAP_STATE: PARTIAL
DELETE_SEMANTICS: UNRESOLVED
REFERENCE_REPLAY: FAIL — same state not established
ROOT CAUSE CLASSIFICATION: UNRESOLVED
DATASET QUALIFICATION IMPACT: REVIEW_REQUIRED
BUILDER FIX REQUIRED: NOT YET DETERMINED
PERFORMANCE OPTIMIZATION: DEFERRED
```

The bounded diagnostic was stopped after repeated non-reproduction of the prior crossed state. No claim of `PROVIDER_DATA_DEFECT` is permitted under the frozen rule because grouping, sequence ordering, snapshot reconciliation, and independent reference replay have not all reproduced the same crossed state.

## Safety and validation

The 01C existing baselines remain the applicable regression evidence:

```text
focused orderflow suite: 43 passed
builder/replay tests: 6 passed
full suite: 88 passed
```

No OOS strategy evaluation, strategy parameter change, trading mutation, Jev call, commit, or push occurred during 01D.

## Required next action

Resolve the canonical event identity for the 343 raw rows at `2026-06-23T00:38:07.235Z`, then rerun only the bounded diagnostic with one grouping definition shared by the optimized and slow reference paths. Do not continue to full IS replay until that reconciliation passes.
