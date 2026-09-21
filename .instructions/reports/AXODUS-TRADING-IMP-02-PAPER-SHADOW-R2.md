# AXODUS-TRADING-IMP-02 — PAPER SHADOW R2 Outcome-Labeled Market Reading

**Status:** `COMPLETE / PRELIMINARY DATASET / INSUFFICIENT EVIDENCE / CTO REVIEW REQUIRED`  
**Date:** 2026-09-21  
**Baseline:** `1bc1e87d (dev)`  
**Mode:** `PAPER / JEV SHADOW_ONLY / MARKET_DERIVED_COUNTERFACTUAL`

## Campaign Summary

R2 produced the first temporally valid, outcome-labeled H2 dataset. Each principal immutable snapshot was captured at a real closed-candle t0, sent once to Jev, and finalized only after the frozen future horizon matured. Outcomes use later closed candles and never enter Jev input.

```yaml
principalObservations: 12
completedOutcomes: 12
principalNoDefensibleOutcome: 0
stabilityProbes: 9
providerFailures: 0
abstentions: 5
jevPaperApiCalls: 21
marketDataReadonlyCalls: 15
```

The first implementation pass exposed an outcome-finalization ordering defect before reporting: stability records changed the last-record reference. It was corrected to bind maturation to the final **principal** snapshot. Two additional public read-only calls then finalized pending labels; no Jev call or exchange operation was repeated.

## Frozen Policies

```yaml
experiment: jev-paper-shadow-r2-outcome-labeled-market-reading@1
samplingPolicy: paper-r2-sampling@1
featurePolicy: paper-r2-candle-features@1
questionSet: jev-paper-r2-market-reader@1
outcomeHorizonPolicy: outcome-horizons@1
horizonsMinutes: [1, 3]
referencePricePolicy: candle-close@1
referencePriceType: CANDLE_CLOSE
outcomeCalculationVersion: market-derived-outcome@1
requestedModel: jev-1.13.0
resolvedModels: [jev-1.13.0]
```

The 1m and 3m horizons were selected before collection because the available source is closed 1m candles. The repository has no defensible sub-minute local market dataset for the proposed 5s or 30s horizons.

## Data and Temporal Provenance

```yaml
source: Binance USD-M Futures Testnet public klines
endpoint: GET /fapi/v1/klines
networkClass: NETWORK_READONLY
instrument: BTCUSDT
interval: 1m
principalT0: 2026-09-21T15:35:59.999Z .. 2026-09-21T15:46:59.999Z
outcomeLastClose: 2026-09-21T15:49:59.999Z
```

Every principal result is `MARKET_DERIVED_COUNTERFACTUAL`: deterministic candle-close behavior after t0, not an observed trade, simulated fill, or Testnet SHADOW execution. Spread/depth/liquidity evolution remains `INSUFFICIENT_DATA`; it was not inferred from OHLCV or represented as zero.

## H2 — Market-State Reader

```yaml
regimeDistribution:
  range: 7
  uncertain: 5
directionalPressure:
  upward: 6
  downward: 5
  neutral: 1
```

```yaml
forwardOutcomes:
  1m:
    n: 12
    positive: 8
    negative: 3
    meanForwardReturn: '0.000200432058'
    meanMFE: '0.000393974353'
    meanMAE: '-0.000351070805'
    meanRealizedRange: '0.000745045159'
    regimeOutcome: { UPWARD: 2, DOWNWARD: 1, RANGE: 9 }
    directionalPressureDirectionalOnly: '2/11'
  3m:
    n: 12
    positive: 9
    negative: 3
    meanForwardReturn: '0.000534353274'
    meanMFE: '0.000702601754'
    meanMAE: '-0.000397165026'
    meanRealizedRange: '0.001099766781'
    regimeOutcome: { UPWARD: 6, RANGE: 6 }
    directionalPressureDirectionalOnly: '4/11'
```

These are descriptive pilot statistics only. `N=12`, no fitted deterministic comparator, correlated consecutive time samples, and no held-out rule prevent a calibration or incremental-value claim.

```text
H2 = PRELIMINARY OUTCOME-LABELED DATASET CREATED
Calibration = NOT_SCORABLE_SMALL_N
Incremental information = NOT_DETERMINABLE_SMALL_N_BASELINE_MODEL_NOT_FIT
```

## H1 — Trade Validator

No organic TradeProposal was created or manufactured. H1 is `NOT_APPLICABLE_IN_R2_MARKET_READER_COHORT`.

## Stability and Provider Operations

Three immutable principal snapshots were each called three times as a separate stability cohort. The principal cohort retained the single-inference rule.

```yaml
stability:
  snapshots: 3
  observations: 9
  topClassStable: true
  maxMarketRegimeProbabilityDelta: [0.08, 0.04, 0.08]
providerLatencyMs:
  n: 21
  min: 267
  p50: 781
  p95: 1229
  p99: 1229
  max: 1328
usage:
  inputTokens: 29199
  outputTokens: 3722
  totalTokens: 32921
  estimatedUsd: '0.00122636'
  estimatedUsdPerObservation: '0.00005840'
```

Observed principal cadence was 12 observations over roughly 12 minutes. The generated batch-wall-clock projections (`USD/day: 0.1656`, `USD/30 days: 4.97`) are illustrative only; they are not a continuous-operation plan or authorization.

## Safety and Boundaries

```yaml
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
AXODUS_TRADING_ALLOW_TESTNET_MUTATION: not enabled
```

Jev remained asynchronous SHADOW evidence. It did not create or alter Portfolio, Risk, TradingIntent, ExecutionIntent, Harness, or exchange state.

## Recommendation

`EXPANDED_PAPER_CANDIDATE`.

R2 meets its dataset objective: 12/12 principal observations have reproducible outcome provenance. It does not support an H2 value claim or a Testnet recommendation. A next cohort should preserve these policies, collect materially more and less temporally concentrated observations, predeclare evaluation mappings/holdout handling, and add a deterministic baseline comparator before assessing incremental information.
