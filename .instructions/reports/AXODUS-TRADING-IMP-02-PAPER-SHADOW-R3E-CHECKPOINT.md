# AXODUS-TRADING-IMP-02 — PAPER SHADOW R3E Checkpoint

**Status:** `PARTIAL / EXPANDED PAPER / INSUFFICIENT EVIDENCE`  
**Updated:** `2026-09-21T20:58:17Z`  
**Baseline:** `fc65d5f8d3ffea7320976c0141d7d8735629e7de`  
**Commit:** `NOT AUTHORIZED`  
**Push:** `NOT AUTHORIZED`

## Scope

R3E continues the accepted R3 design without changing model, question set, sampling, horizon, reference price, features, or comparator thresholds. This checkpoint records a live PAPER/read-only expansion, not final statistical closure.

## Frozen Identity

```yaml
model: jev-1.13.0
questionSet: jev-paper-r2-market-reader@1
samplingPolicy: paper-r2-sampling@1
outcomeHorizonPolicy: outcome-horizons@1
referencePricePolicy: candle-close@1
deterministicComparator: deterministic-market-comparator@1
features: [reference_close, candle_return_1m, candle_range_ratio, candle_body_ratio, volume]
```

## Collection Summary

```yaml
windows: 8
principalObservations: 32
completedOutcomes: 32
stabilityObservations: 66
providerFailures: 3
outcomeCoverage: "32 / 32"
disposition: COLLECTION_CONTINUES_INSUFFICIENT_DIVERSITY_AND_N
```

## Window Table

| Window | Principal N | Completed Outcomes | First t0 | Last t0 |
| --- | ---: | ---: | --- | --- |
| r3-window-a-20260921 | 4 | 4 | 2026-09-21T17:08:59.999Z | 2026-09-21T17:11:59.999Z |
| r3-window-b-20260921 | 4 | 4 | 2026-09-21T17:18:59.999Z | 2026-09-21T17:21:59.999Z |
| r3-window-c-20260921 | 4 | 4 | 2026-09-21T17:24:59.999Z | 2026-09-21T17:27:59.999Z |
| r3e-window-d-20260921 | 4 | 4 | 2026-09-21T20:16:59.999Z | 2026-09-21T20:19:59.999Z |
| r3e-window-e-20260921 | 4 | 4 | 2026-09-21T20:26:59.999Z | 2026-09-21T20:29:59.999Z |
| r3e-window-f-20260921 | 4 | 4 | 2026-09-21T20:32:59.999Z | 2026-09-21T20:35:59.999Z |
| r3e-window-g-20260921 | 4 | 4 | 2026-09-21T20:40:59.999Z | 2026-09-21T20:43:59.999Z |
| r3e-window-h-20260921 | 4 | 4 | 2026-09-21T20:48:59.999Z | 2026-09-21T20:51:59.999Z |


The cohort improved from the accepted R3 preliminary result but remains below the planned 100-200 principal observations. Treat results as descriptive only.

## Combined Distributions

```yaml
jevRegime: {"failure": 2, "noisy": 1, "range": 18, "uncertain": 11}
jevDirectionalPressure: {"downward": 11, "failure": 2, "neutral": 2, "upward": 17}
deterministicRegime: {"high_volatility": 6, "range": 20, "trending": 6}
deterministicDirectionalPressure: {"downward": 5, "neutral": 19, "upward": 8}
```

## Comparator Comparison

```yaml
1m: {"bothCorrect": 3, "deterministicAbstentions": 7, "deterministicCorrect": 3, "deterministicOnlyCorrect": 0, "deterministicPredictions": 5, "directionalOutcomes": 12, "horizonMinutes": 1, "jevAbstentions": 1, "jevCorrect": 8, "jevOnlyCorrect": 0, "jevPredictions": 11, "jointPredictions": 5, "neitherCorrect": 2}
3m: {"bothCorrect": 4, "deterministicAbstentions": 14, "deterministicCorrect": 4, "deterministicOnlyCorrect": 0, "deterministicPredictions": 7, "directionalOutcomes": 21, "horizonMinutes": 3, "jevAbstentions": 1, "jevCorrect": 11, "jevOnlyCorrect": 0, "jevPredictions": 20, "jointPredictions": 7, "neitherCorrect": 3}
```

These values do not establish incremental information. They show the combined read model is functioning and preserving Jev/comparator/future-outcome relationships.

## Integrity Finding

The first R3 aggregator accepted only `r3-window-*` files and would have omitted R3E windows. The filter was corrected to include both `r3-window-*` and `r3e-window-*` files under the same policy identity validation. This is a dataset-integrity fix, not an experimental semantic change.

## Safety

```yaml
AXODUS_TRADING_ALLOW_TESTNET_MUTATION: not enabled
exchangeTestnetOrderPost: 0
exchangeTestnetOrderDelete: 0
exchangeTestnetOtherMutation: 0
exchangeMainnetOrderPost: 0
exchangeMainnetOrderDelete: 0
exchangeMainnetOtherMutation: 0
realCapitalMutation: 0
productionCredentialsUsed: 0
customerCredentialsUsed: 0
privateKeysUsed: 0
secretsExposed: false
```

## Disposition

`CONTINUE_PAPER`. Continue with distributed windows until materially larger and more temporally diverse data exists. Do not promote to Testnet, do not expand features, and do not tune comparator thresholds inside this cohort.
