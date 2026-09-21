# 05 — Jev Candidate Role Matrix

| Role | Initial value hypothesis | Ground truth | Data | Decision |
| --- | --- | --- | --- | --- |
| D1 Strategy Validator | Detect mismatch between validated assumptions and current point-in-time context | Later canonical performance/drift plus exact revision/evidence lineage | `PARTIAL` | `DEFER`: too broad for first experiment; decompose into narrower questions |
| D2 Trade Validator | Identify proposals with materially different outcome distributions from baseline-accepted proposals | Horizon return, MAE/MFE, canonical execution/economics where executed | `SUFFICIENT/PARTIAL` | `EVALUATE FIRST` in SHADOW |
| D3 Market Regime Classifier | Add semantic regime probabilities complementary to deterministic features | Independently frozen regime methodology and later market observations | `PARTIAL` | `EVALUATE FIRST`, never use self-label as truth |
| D4 Risk Signal | Surface contextual warnings absent from deterministic rules | Subsequent adverse outcomes and existing Risk/portfolio facts | `PARTIAL` | `SECONDARY SHADOW`; call it context risk, never RiskDecision |
| D5 Execution Advisor | Anticipate spread/liquidity/adverse selection and timing quality | canonical slippage, fill ratio, latency and post-fill movement | `INSUFFICIENT/PARTIAL` | `DEFER` until synchronized L2/trade data is adequate |
| D6 Abstention / uncertainty | Identify incomplete, conflicting or out-of-distribution states | missingness/quality facts plus conditional error/outcome rate | `SUFFICIENT` for data quality; `PARTIAL` for OOD | `EVALUATE FIRST` |

## Recommended first question set

Questions are atomic and versioned. Criteria must include `unknown` or `insufficient` where the state may not support judgment.

1. `state_sufficiency` — Choice: `sufficient`, `partial`, `insufficient`, `conflicting`.
2. `proposal_alignment` — Choice: `supportive`, `mixed`, `contradictory`, `insufficient`.
3. `market_regime` — Choice with a frozen Axodus regime taxonomy and `unknown`.
4. `adverse_selection_risk` — Score: `low`, `moderate`, `high`, `indeterminate`; only when quote/trade inputs are present.
5. `proposal_success_probability` — Noul tied to one preregistered horizon and label definition; use only when that definition is defensible.

## Rejected first-stage questions

- “Should Axodus trade?” combines authorities and has no single stable ground truth.
- Capital, quantity, leverage and order parameters are prohibited outputs.
- “Is this strategy profitable?” is underspecified and invites causal/long-horizon overreach.
- Free-form explanations are unnecessary for the typed evaluation and cannot become causal evidence.
