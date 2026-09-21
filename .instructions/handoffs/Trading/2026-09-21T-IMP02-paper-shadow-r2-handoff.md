# AXODUS-TRADING-IMP-02 / PAPER SHADOW R2 HANDOFF

## STATUS

`COMPLETE / PRELIMINARY DATASET / INSUFFICIENT EVIDENCE / CTO REVIEW REQUIRED`

## BASELINE

- R2 source baseline: `1bc1e87d` — `feat(trading-core): add stability probe mechanism to paper shadow campaign`.
- External-mutation isolation: `8418a2cf588cb8727c0a6c369719d40587841205`.
- EPIC-01 closure: `21fc5560caa1efca4274bd139ce78e4f80efb708`.

## EXECUTION HEAD

`1bc1e87d` plus uncommitted R2 source, tests, reports and tracking updates.

## COMMIT / PUSH STATUS

R2 commit: not authorized / not performed. Push: not authorized / not performed.

## R2 CAMPAIGN SUMMARY

H2 ran in `PAPER / SHADOW_ONLY`. Twelve snapshots were captured at real closed-candle t0 values, evaluated once by Jev, then joined to later closed-candle outcomes after 1m and 3m maturity. The principal cohort has `12/12` `MARKET_DERIVED_COUNTERFACTUAL` outcomes and `0` `NO_DEFENSIBLE_OUTCOME` records.

## H2 — MARKET-STATE READER

A preliminary usable dataset exists. It is not sufficient for calibration, incremental-value, predictive-value or economic-value claims:

```yaml
principalObservations: 12
completedOutcomes: 12
calibration: NOT_SCORABLE_SMALL_N
incrementalInformation: NOT_DETERMINABLE_SMALL_N_BASELINE_MODEL_NOT_FIT
```

## H1 — TRADE VALIDATOR

`NOT_APPLICABLE_IN_R2_MARKET_READER_COHORT`: zero organic TradeProposal observations; none were manufactured.

## SAMPLING POLICY

```yaml
samplingPolicy: paper-r2-sampling@1
trigger: CLOSED_CANDLE_INTERVAL
actualCadence: 12 principal observations over approximately 12 minutes
featurePolicy: paper-r2-candle-features@1
features: reference_close, candle_return_1m, candle_range_ratio, candle_body_ratio, volume
featureProvenance: timestamped public closed 1m Testnet candles
```

## QUESTION SET / REGIME TAXONOMY / MODEL

```yaml
questionSet: jev-paper-r2-market-reader@1
regimeTaxonomy: trending | range | high_volatility | noisy | uncertain
requestedModel: jev-1.13.0
resolvedModel: jev-1.13.0
```

## OUTCOME HORIZON / REFERENCE PRICE POLICY

```yaml
outcomeHorizonPolicy: outcome-horizons@1
horizonsMinutes: [1, 3]
referencePricePolicy: candle-close@1
referencePriceType: CANDLE_CLOSE
outcomeProvenance: MARKET_DERIVED_COUNTERFACTUAL
```

## FORWARD RETURN / MFE / MAE / VOLATILITY

```yaml
1m:
  meanForwardReturn: '0.000200432058'
  meanMFE: '0.000393974353'
  meanMAE: '-0.000351070805'
  meanRealizedRange: '0.000745045159'
3m:
  meanForwardReturn: '0.000534353274'
  meanMFE: '0.000702601754'
  meanMAE: '-0.000397165026'
  meanRealizedRange: '0.001099766781'
```

Realized volatility proxy is the deterministic high-low range. Spread, liquidity and depth evolution are `INSUFFICIENT_DATA`; OHLCV was not used as a substitute.

## STABILITY_PROBE / TEMPORAL STABILITY

```yaml
stabilitySnapshots: 3
stabilityCalls: 9
providerFailures: 0
maxRegimeProbabilityDelta: [0.08, 0.04, 0.08]
topClassStablePerProbe: true
```

Temporal market-state stability remains descriptive only; R2 has no adequate N or independent comparator to interpret it as evidence of signal value.

## LATENCY / COST / FEASIBILITY

```yaml
latencyMs: { n: 21, min: 267, p50: 781, p95: 1229, p99: 1229, max: 1328 }
inputTokens: 29199
outputTokens: 3722
estimatedUsd: '0.00122636'
estimatedUsdPerObservation: '0.00005840'
observationsPerHourObserved: '~60'
projectedUsdPerDayObservedCadence: '0.1656'
projectedUsdPer30DaysObservedCadence: '4.97'
continuousMarketReadingFeasibility: PARTIAL
```

Latency is below the selected minute horizons, but the sample is too small to establish reliability, information persistence or a continuous-monitoring recommendation.

## DATASET / TEMPORAL INTEGRITY

- Provider input contained immutable t0 feature state only.
- Outcomes were computed only after each frozen horizon matured.
- A first finalization-order defect was identified before final reporting, corrected to bind maturity to the final principal record, and the outstanding labels were finalized by two extra public read-only calls. No Jev inference or exchange action was repeated.
- All principal records now have future-candle source references and deterministic outcome digests.

## AUTHORITY / ASYNC / REMOVAL

Existing authority-isolation, asynchronous-isolation and removal-equivalence proofs remain in force. R2 adds only experimental snapshots/outcomes; Jev cannot affect Portfolio, Risk, intents, Harness, Execution or exchange behavior.

## SECURITY / TEST SAFETY

`AXODUS_TRADING_ALLOW_TESTNET_MUTATION` remained unset. `.env.local` stayed ignored. No credential values were logged or recorded. The only network activity was authorized Jev PAPER inference and public Testnet `GET /fapi/v1/klines` reads.

## VALIDATION

Build passed after the temporal runner correction. Focused R2 tests, typecheck, SAFE regression, diff check and secret scan remain pending final rerun on the complete worktree.

## EXTERNAL MUTATION COUNTERS

```yaml
jevPaperApiCalls: 21
marketDataReadonlyCalls: 15
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

## FILES CREATED / MODIFIED

- `trading-core/services/trading-core/src/shadow/MarketReadingSnapshot.ts`
- `trading-core/services/trading-core/src/shadow/MarketDerivedOutcome.ts`
- `trading-core/services/trading-core/src/shadow/ShadowQuestionSets.ts`
- `trading-core/services/trading-core/src/shadow/index.ts`
- `trading-core/packages/trading-contracts/src/shadow/decisionProvider.ts`
- `trading-core/services/trading-core/scripts/jev-paper-shadow-r2-campaign.mjs`
- `trading-core/services/trading-core/test/imp-02-paper-shadow-r2-outcomes.test.mjs`
- `trading-core/services/trading-core/test/test-classification.manifest.json`
- R2 reports, tracking records and this handoff.

## BLOCKERS / UNKNOWNS / RESIDUAL RISKS

- N=12, sequentially correlated observations and no prefit deterministic comparator.
- No H1 proposal sample.
- Calibration is not scorable.
- Spread/depth/liquidity labels are unavailable from the chosen source.
- No Testnet SHADOW evidence exists or is authorized.

## RECOMMENDED SAMPLE / HORIZON / DISPOSITION

`EXPANDED_PAPER_CANDIDATE`: collect a larger, temporally diversified cohort with these frozen 1m/3m policies; predeclare baseline comparison and holdout handling before interpreting incremental information. Do not advance to Testnet automatically.

## GIT STATUS

Uncommitted R2 implementation/evidence changes remain for CTO review. No commit or push was performed.

## Global Coordination Handoff

- Workspace: `Trading`
- Handoff ID/time: `2026-09-21T-IMP02-PAPER-R2 / 2026-09-21 America/Sao_Paulo`
- Request: `AXODUS-TRADING-IMP-02-PAPER-SHADOW-R2`
- Local status: `LOCAL_COMPLETE / CTO REVIEW REQUIRED`
- Dependencies: CTO decision for R2 commit or any expanded PAPER/Testnet scope
- Portfolio action: none before CTO review
- Preserved boundaries: SHADOW only; no Testnet/Mainnet mutation, real capital, production credentials or push
