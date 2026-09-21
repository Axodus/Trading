# 09 — Counterfactual Evaluation Design

## Unit of analysis

One immutable `TradeProposal` at `t0`, bound to exact strategy revision, market state, environment, instrument, venue, question set and model version.

## Cohorts

After preregistered mapping of Jev outputs to `ACCEPT`, `REJECT` or `ABSTAIN` for analysis only:

| Baseline | Jev | Interpretation |
| --- | --- | --- |
| ACCEPT | ACCEPT | agreement; observed execution outcome may be available |
| ACCEPT | REJECT | primary avoided-loss/false-rejection hypothesis; observed outcome available if baseline executed |
| REJECT | ACCEPT | only a simulated/market counterfactual unless an independent baseline execution exists |
| REJECT | REJECT | agreement; market-horizon label may be available, execution label is not |

Jev classification never changes the baseline action during the experiment.

## Outcome policy

- Freeze prediction horizon before collection.
- Direction labels use future canonical market observations over that horizon.
- Trade-quality labels use canonical execution, fees and PnL only for actually executed proposals.
- Rejected-trade outcomes are clearly marked `SIMULATED_COUNTERFACTUAL` or `MARKET_ONLY`; they cannot borrow actual fills.
- Partial/invalid reconciliation and missing fee/conversion data produce partial or unavailable labels, never zero.

## Incremental-value test

1. Establish baseline outcome metrics without Jev.
2. Evaluate Jev calibration independently.
3. Compare conditional outcomes across the four cohorts and abstentions.
4. Control or stratify by strategy revision, instrument, venue, environment, volatility, liquidity and time.
5. Estimate uncertainty using preregistered bootstrap/confidence intervals where sample size supports it.
6. Report effect size and uncertainty, not only significance.

The null hypothesis is that Jev adds no decision information beyond baseline features and decisions.

## Bias controls

- Time-ordered train/tuning/holdout split; final holdout is evaluated once.
- Question text, criteria, thresholds, horizon and exclusions are versioned before holdout scoring.
- No future fields in the t0 snapshot.
- No dropping provider failures or abstentions from operational metrics.
- Report all instruments/regimes, including negative cohorts.
- Corrections create new evaluation versions; historical results remain immutable.
- Any question revision starts a new cohort.

## Limits

Shadow observation is not randomized treatment. It can estimate information association and counterfactual policy value under assumptions, not prove causal trading alpha. Promotion requires prospective evidence and a separate authorization.
