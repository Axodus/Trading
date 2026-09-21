# 16 — Risks / Unknowns / Blockers

## Risks

| ID | Risk | Current control | Promotion impact |
| --- | --- | --- | --- |
| JEV-R-01 | Apparent value caused by look-ahead or label leakage | immutable t0 snapshot, time split, preregistration | blocks conclusions until disproven |
| JEV-R-02 | Miscalibrated probabilities/confidence | empirical reliability/Brier analysis per version | blocks Advisory candidacy |
| JEV-R-03 | Model alias or question drift | pinned model and versioned question sets | starts new cohort |
| JEV-R-04 | Provider latency/failure bias | retain failures, explicit deadlines and operational metrics | may reject low-latency roles |
| JEV-R-05 | Authority leakage during future implementation | asynchronous one-way side branch and non-bypass tests | P0 / stop |
| JEV-R-06 | Sensitive state retention | minimization, legal review, ZDR assessment | blocks broader data use |
| JEV-R-07 | Counterfactual selection bias for baseline rejections | separate market/simulated labels from actual execution | limits causal claims |
| JEV-R-08 | Testnet behavior mistaken for production edge | explicit environment segmentation | blocks production inference |
| JEV-R-09 | Multiple comparisons and prompt tuning | primary endpoints, holdout, versioning | blocks cherry-picked promotion |

## Unknowns

- Axodus-observed live API latency, cost, response stability and error behavior.
- Ordinary-plan data retention, processing region/subprocessors, SLA and support terms.
- Calibration on Axodus market/proposal states.
- Sample availability by strategy revision and regime.
- Whether existing persisted market observations support complete future-horizon labels for rejected proposals.
- Whether L2 depth retention is adequate for execution-advisor/adverse-selection questions.

## Blockers

There is no blocker to completing research or designing SHADOW. Before implementing/running SHADOW:

1. CTO must authorize a separate implementation request.
2. Stage 0 provider characterization and legal/privacy review must be accepted.
3. Exact state allowlist, question set, label policy, model pin and cost/deadline limits must be frozen.
4. Persistence must prove that shadow enablement/failure cannot affect baseline decisions.

Any need to change Portfolio, Risk, Harness authority, give Jev execution capability, use Mainnet/real capital/production credentials, purchase data or create material infrastructure returns `BLOCKED / CTO REVIEW REQUIRED`.

## Preserved external conclusions/debt

- System One / Evidence Judgment: `PROVIDER NO-GO`, unchanged and independent.
- `DEBT-AUD-A-03`: `OPEN`; non-blocking for research/Testnet SHADOW and blocking for future real capital.
