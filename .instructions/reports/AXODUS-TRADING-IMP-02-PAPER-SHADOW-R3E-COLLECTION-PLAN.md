# AXODUS-TRADING-IMP-02 — PAPER SHADOW R3E Collection Plan

**Status:** `AUTHORIZED / COLLECTION IN PROGRESS / PAPER ONLY`  
**Baseline:** `fc65d5f8d3ffea7320976c0141d7d8735629e7de`  
**Purpose:** complete the R3 statistical expansion without changing semantics.

## Frozen Policies

```yaml
model: jev-1.13.0
questionSet: jev-paper-r2-market-reader@1
samplingPolicy: paper-r2-sampling@1
outcomeHorizonPolicy: outcome-horizons@1
referencePricePolicy: candle-close@1
deterministicComparator: deterministic-market-comparator@1
features:
  - reference_close
  - candle_return_1m
  - candle_range_ratio
  - candle_body_ratio
  - volume
```

No threshold, question wording, model, feature, horizon, reference-price, or comparator change is authorized for R3E.

## Collection Policy

R3E extends the existing R3 result set. It should target approximately 100-200 principal observations, but temporal diversity is the controlling requirement. Avoid a single long consecutive run.

Use small windows with predefined IDs and record actual timestamps. Windows should be operationally scheduled rather than selected because visible market conditions appear interesting.

## Current Baseline Cohort

R3 committed cohort: 12 principal observations across 3 windows.

Initial R3E target for this session: collect only a limited additional checkpoint window unless directed otherwise, then aggregate and report status. Longer collection should run as distributed future windows.

## Boundaries

```yaml
Jev: SHADOW_ONLY
Trading: PAPER
TestnetShadow: NOT_AUTHORIZED
TestnetMutation: NOT_AUTHORIZED
AXODUS_TRADING_ALLOW_TESTNET_MUTATION: MUST_NOT_BE_ENABLED
Mainnet: PROHIBITED
RealCapital: PROHIBITED
R3ECommit: NOT_AUTHORIZED
Push: NOT_AUTHORIZED
```

## Remaining Collection Freeze

The initial same-day checkpoint reached 32 principal observations across eight short windows. It is retained as exploratory evidence, with temporal-correlation and operational-selection limitations explicitly preserved.

Before further collection, the remaining 68 principal observations are frozen as 17 four-observation windows. They must be executed only at or after their listed UTC start times; a missed window is recorded as missed rather than backfilled from historical candles. Each uses the unchanged `paper-r2-sampling@1` internal cadence and the frozen R3E identity above.

| Window | Earliest UTC start | Principal N |
| --- | --- | ---: |
| I | 2026-09-21T23:00:00Z | 4 |
| J | 2026-09-22T02:00:00Z | 4 |
| K | 2026-09-22T06:00:00Z | 4 |
| L | 2026-09-22T10:00:00Z | 4 |
| M | 2026-09-22T14:00:00Z | 4 |
| N | 2026-09-22T18:00:00Z | 4 |
| O | 2026-09-22T22:00:00Z | 4 |
| P | 2026-09-23T02:00:00Z | 4 |
| Q | 2026-09-23T06:00:00Z | 4 |
| R | 2026-09-23T10:00:00Z | 4 |
| S | 2026-09-23T14:00:00Z | 4 |
| T | 2026-09-23T18:00:00Z | 4 |
| U | 2026-09-23T22:00:00Z | 4 |
| V | 2026-09-24T02:00:00Z | 4 |
| W | 2026-09-24T06:00:00Z | 4 |
| X | 2026-09-24T10:00:00Z | 4 |
| Y | 2026-09-24T14:00:00Z | 4 |

This schedule is an ex ante collection plan, not a permission to alter the provider, model, question set, comparator, feature set, horizon, exchange boundary, or execution mode. All windows remain PAPER/read-only and retain the existing no-mutation guard.
