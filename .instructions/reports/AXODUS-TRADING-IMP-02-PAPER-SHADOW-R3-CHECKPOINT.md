# AXODUS-TRADING-IMP-02 — PAPER SHADOW R3 Checkpoint

**Status:** `CHECKPOINT / COLLECTION CONTINUES / INSUFFICIENT DIVERSITY AND N`
**Date:** 2026-09-21
**Baseline:** `4d98c6311a9f3771acbedf281f26a4984cc7efc7`
**Mode:** `PAPER / JEV SHADOW_ONLY / MARKET_DERIVED_COUNTERFACTUAL`
**Commit status:** `NOT AUTHORIZED FOR R3`

## Purpose

R3 extends accepted R2 by adding a frozen deterministic comparator over the same t0 OHLCV feature snapshot and by collecting multiple small windows instead of one long uninterrupted run.

The technical question is whether Jev probabilities explain future 1m/3m market-derived outcomes better than a simple deterministic t0 baseline. This checkpoint validates the R3 machinery; it does not answer the hypothesis.

## Frozen Policy Identity

```yaml
questionSet: jev-paper-r2-market-reader@1
samplingPolicy: paper-r2-sampling@1
featurePolicy: paper-r2-candle-features@1
collectionPolicy: paper-r3-windowed-collection@1
outcomeHorizonPolicy: outcome-horizons@1
horizonsMinutes: [1, 3]
referencePricePolicy: candle-close@1
requestedModel: jev-1.13.0
resolvedModel: jev-1.13.0
deterministicComparator: deterministic-market-comparator@1
```

No question-set, horizon, feature, model, or comparator threshold changes were introduced during this checkpoint.

## Deterministic Comparator

The comparator is transparent and deliberately non-fitted. It uses only the same t0 features sent to Jev:

```yaml
inputs:
  - candle_return_1m
  - candle_range_ratio
  - candle_body_ratio
  - volume
thresholds:
  directionalPressureThreshold: '0.0002'
  trendingReturnThreshold: '0.0004'
  highVolatilityRangeThreshold: '0.0015'
  outcomeDirectionThreshold: '0.0002'
```

It has no access to future outcomes and is not a learned model. It exists to make the incremental-information question testable.

## Collection Summary

```yaml
windows: 3
principalObservations: 12
completedOutcomes: 12
noDefensibleOutcome: 0
stabilityObservations: 21
jevPaperApiCalls: 33
providerFailures: 1
marketDataReadonlyCalls: 15
```

Window ranges:

| Window | Principal N | Completed outcomes | First t0 | Last t0 |
| --- | ---: | ---: | --- | --- |
| r3-window-a-20260921 | 4 | 4 | 2026-09-21T17:08:59.999Z | 2026-09-21T17:11:59.999Z |
| r3-window-b-20260921 | 4 | 4 | 2026-09-21T17:18:59.999Z | 2026-09-21T17:21:59.999Z |
| r3-window-c-20260921 | 4 | 4 | 2026-09-21T17:24:59.999Z | 2026-09-21T17:27:59.999Z |

This is intentionally treated as a checkpoint. The windows are still concentrated within one short wall-clock period and remain far below the authorized 100-200 target.

## Combined Distributions

```yaml
jevRegime:
  range: 7
  uncertain: 4
  failure: 1
jevDirectionalPressure:
  upward: 8
  downward: 2
  neutral: 1
  failure: 1
deterministicRegime:
  range: 9
  trending: 2
  high_volatility: 1
deterministicDirectionalPressure:
  neutral: 8
  upward: 3
  downward: 1
```

## Comparator Read Model

```yaml
1m:
  directionalOutcomes: 2
  deterministicPredictions: 0
  deterministicCorrect: 0
  deterministicAbstentions: 2
  jevPredictions: 1
  jevCorrect: 1
  jevAbstentions: 1
  jointPredictions: 0
3m:
  directionalOutcomes: 4
  deterministicPredictions: 0
  deterministicCorrect: 0
  deterministicAbstentions: 4
  jevPredictions: 3
  jevCorrect: 2
  jevAbstentions: 1
  jointPredictions: 0
```

These counts are descriptive only. The deterministic comparator abstained on every directional outcome in this small checkpoint, so there is no joint basis for claiming incremental edge. The result currently says more about comparator conservatism and small-N distribution than Jev value.

## Stability

```yaml
stabilitySnapshots: 7
stabilityCalls: 21
topClassStableSnapshots: 6
maxMarketRegimeProbabilityDelta: 0.09
```

This is consistent with the R2 CTO interpretation: Jev may vary probabilities without frequently changing the dominant class. The sample is still too small for generalization.

## Latency and Cost

```yaml
latencyMs:
  n: 32
  min: 270
  p50: 385
  p95: 1187
  p99: 1332
  max: 1353
usage:
  inputTokens: 44462
  outputTokens: 5675
  totalTokens: 50137
  estimatedUsd: '0.00186740'
  estimatedUsdPerSuccessfulObservation: '0.00005836'
```

Latency remains technically compatible with 1m/3m tactical reading and inappropriate for raw-book/HFT interpretation.

## H2 / H1 Disposition

```yaml
H2_MARKET_STATE_READER: PIPELINE_VALID / INSUFFICIENT_EVIDENCE
H1_TRADE_VALIDATOR: NOT_EVALUATED
calibration: NOT_SCORABLE_SMALL_N
incrementalInformation: NOT_DETERMINABLE_SMALL_N_AND_NO_HOLDOUT
recommendedDisposition: CONTINUE_PAPER
```

## Safety and Authority Boundaries

```yaml
JevAuthority: NONE
PortfolioAffected: false
RiskAffected: false
TradingIntentAffected: false
ExecutionIntentAffected: false
HarnessAffected: false
ExchangeAffectedByJev: false
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

## Files

Primary generated R3 artifacts:

- `.instructions/reports/AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3-EXPERIMENT-DESIGN.md`
- `.instructions/reports/AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3-r3-window-a-20260921-RESULTS.json`
- `.instructions/reports/AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3-r3-window-b-20260921-RESULTS.json`
- `.instructions/reports/AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3-r3-window-c-20260921-RESULTS.json`
- `.instructions/reports/AXODUS-TRADING-IMP-02-PAPER-SHADOW-R3-COMBINED-COHORT.json`
- `trading-core/services/trading-core/src/shadow/DeterministicMarketComparator.ts`
- `trading-core/services/trading-core/src/shadow/PaperR3ComparatorAnalysis.ts`
- `trading-core/services/trading-core/scripts/jev-paper-shadow-r3-window.mjs`
- `trading-core/services/trading-core/scripts/jev-paper-shadow-r3-aggregate.mjs`
- `trading-core/services/trading-core/test/imp-02-paper-shadow-r3-comparator.test.mjs`

## Recommended Next Collection

Continue R3 in distributed windows until reaching a materially more diverse cohort. Use the same frozen policies unless a separate CTO-reviewed cohort version is created.

Suggested next safe command template:

```bash
cd /opt/Axodus/Trading/trading-core/services/trading-core
AXODUS_PAPER_R3_WINDOW_ID=r3-window-<unique-id> \
AXODUS_PAPER_R3_PRINCIPAL_COUNT=4 \
AXODUS_PAPER_R3_STABILITY_SNAPSHOTS=3 \
AXODUS_PAPER_R3_STABILITY_REPEATS=3 \
node scripts/jev-paper-shadow-r3-window.mjs
node scripts/jev-paper-shadow-r3-aggregate.mjs
```

Do not enable `AXODUS_TRADING_ALLOW_TESTNET_MUTATION=true` for PAPER.

## Validation Checkpoint

```yaml
typecheck: PASS
build: PASS
focusedR3Comparator: '6 passed / 0 failed'
safeRegression: '809 passed / 0 failed / 1 skipped'
externalMutationDuringValidation: 0
```

The complete regression was executed through `npm test`, which routes to `test:safe` and the classified `SAFE` graph. It did not select `TESTNET_MUTATING` tests.
