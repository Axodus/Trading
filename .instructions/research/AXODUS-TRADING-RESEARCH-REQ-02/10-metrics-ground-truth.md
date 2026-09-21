# 10 — Metrics & Ground Truth Specification

## Decision quality

- Baseline acceptance/rejection/modify rates.
- Jev agreement, disagreement and abstention rates.
- Conditional directional accuracy only for a frozen direction/horizon question.
- False acceptance/rejection under the declared label policy.
- Abstention precision: error/adverse-outcome concentration among abstained cases.

## Calibration

- Reliability table/diagram with frozen bins.
- Brier score for binary Noul/derived binary questions.
- Multiclass Brier or log loss for Choice distributions where defensible.
- Expected calibration error as descriptive, with bin count and sample-size caveats.
- Calibration by model version, question revision and major regime.

Provider `confidence` is not itself a calibration score. Calibration compares returned probability with observed frequency.

## Economic metrics

For executed baseline proposals only, use canonical REQ-10 facts:

- net/gross PnL and expectancy;
- drawdown and risk-adjusted summaries where sample size supports them;
- fees, funding, slippage, turnover;
- maximum adverse/favorable excursion with a specified price source and horizon;
- fill ratio and adverse selection.

Raw PnL is not the sole criterion and testnet PnL is not production evidence.

## Operational metrics

- request throughput, completed/timeout/rate-limit/schema-error/provider-error rates;
- queue, network/provider, validation, persistence and total shadow latency;
- p50/p95/p99 only with sample count and method;
- input tokens and cost per decision;
- repeated-state agreement/distribution distance under pinned model and schema.

## Ground truth by question

| Question | Ground truth | Quality rule |
| --- | --- | --- |
| Future direction | Price change from t0 reference to exact horizon, with tie band frozen in policy | Missing endpoint or stale/gapped series => unavailable |
| Proposal quality | Canonical net outcome, MAE/MFE and policy label for an actual execution | Reconciliation/accounting incomplete => partial/unavailable |
| Adverse selection | Side-aware post-fill mid/reference move over exact horizon | No canonical fill/reference => unavailable |
| Regime | Independently implemented deterministic/statistical regime classifier | Jev's own regime answer cannot label itself |
| Execution quality | Diagnostics: slippage, fill ratio, latency, rejection/reconciliation quality | Expected and observed semantics must be compatible |
| State sufficiency | Objective missingness, freshness, sequence and quality fields plus downstream label availability | Lack of error does not imply sufficient state |

## Multiple testing

Primary endpoints and question families must be preregistered. Secondary metrics are exploratory. If hypothesis tests are used across many metrics/regimes, report multiplicity handling and do not promote on an isolated uncorrected result.
