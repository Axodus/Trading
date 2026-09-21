# AXODUS-TRADING-IMP-02 — PAPER SHADOW R3 Expanded Market Reading

**Status:** `COLLECTION IN PROGRESS / PAPER ONLY / CTO AUTHORIZED IN PRINCIPLE`
**Baseline:** `4d98c6311a9f3771acbedf281f26a4984cc7efc7`
**Purpose:** test whether Jev adds descriptive predictive information beyond a frozen transparent comparator using the same t0 OHLCV feature snapshot.

## Frozen Continuity From R2

```yaml
questionSet: jev-paper-r2-market-reader@1
samplingPolicy: paper-r2-sampling@1
featurePolicy: paper-r2-candle-features@1
outcomeHorizonPolicy: outcome-horizons@1
horizonsMinutes: [1, 3]
referencePricePolicy: candle-close@1
requestedModel: jev-1.13.0
```

R3 must create a new cohort rather than silently mix changed policies with R2.

## R3 Additions

```yaml
collectionPolicy: paper-r3-windowed-collection@1
deterministicComparator: deterministic-market-comparator@1
windowSize: 4..24 principal observations
targetCombinedN: 100..200 principal observations
stability: 10..20 representative snapshots, 3..5 calls each across windows
```

The comparator is deliberately transparent and non-fitted. It uses t0 `candle_return_1m`, `candle_range_ratio`, `candle_body_ratio`, and validates the same `volume` feature sent to Jev. It has no learned parameters and no access to future data.

## Collection Rules

- Each command requires an explicit `AXODUS_PAPER_R3_WINDOW_ID`.
- One window is limited to 4–24 consecutive t0 observations.
- Windows must be distributed over materially different wall-clock periods; do not use one long uninterrupted run as the full cohort.
- One principal t0 equals one Jev inference. Stability calls are isolated from principal N.
- Every outcome is calculated only after its 1m/3m horizon matures.
- Testnet mutation, Testnet SHADOW, Mainnet, real capital, Advisory and Gated operation remain prohibited.

## Evaluation Discipline

The combined cohort read model rejects policy-mismatched window files. Its Jev-vs-comparator comparison is descriptive only until the cohort has adequate N, regime diversity and a separately frozen holdout/evaluation plan.

Neither a higher hit count nor lower abstention rate alone proves incremental value.
