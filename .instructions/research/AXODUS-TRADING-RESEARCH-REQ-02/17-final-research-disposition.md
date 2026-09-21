# 17 — Final Research Disposition

## Disposition

`SHADOW-IMPLEMENTATION CANDIDATE`

This means the provider boundary and evaluation design are sufficiently coherent to justify a separately authorized implementation/experiment. It does not mean Jev is integrated, useful, calibrated, profitable, approved for Advisory, approved for Gated operation, or authorized to trade.

## Answers to the research questions

1. **Potential contribution:** typed probabilities for proposal alignment, regime and uncertainty that may add information to existing Strategy/Quant outputs.
2. **Architectural location:** asynchronous side branch from immutable `MarketState` + `Opportunity` + `TradeProposal`, before Portfolio chronologically but outside its input.
3. **Excluded authority:** capital, quantity, leverage, Portfolio, Risk, intents, execution, exchange mutation, accounting, governance and safety.
4. **Removal:** yes, if implemented behind `DecisionProvider` and shadow events; canonical behavior must remain identical without the adapter.
5. **Observed state:** allowlisted point-in-time market/proposal/strategy evidence with exact revision, environment, freshness and provenance.
6. **Questions:** state sufficiency, proposal alignment, independently labeled regime, and later adverse-selection/proposal-success hypotheses where data supports them.
7. **Ground truth:** question-specific market horizon, canonical execution/economics, diagnostics or an independent regime methodology; unavailable when evidence is incomplete.
8. **Incremental value:** calibration plus conditional outcome differences versus baseline across same-state cohorts, with holdout and regime controls.
9. **Data:** sufficient for a bounded trade-validator/abstention pilot; partial for regime/rejected counterfactuals; insufficient for strong L2 or production-alpha claims.
10. **Risks:** authority leakage, injection, stale/replayed/malformed results, model drift, provider outage, retention and experimental bias.
11. **Latency:** full state-to-outcome timeline matters; provider round trip is only one component.
12. **Next experiment:** Stage 0 characterization followed by PAPER offline/live SHADOW and then bounded TESTNET correlation if gates pass.
13. **Advisory evidence:** prospective incremental value, calibration, robustness, operational reliability, removal/non-bypass proof and separate CTO+CEO authorization.

## Recommended next request

`AXODUS-TRADING-RESEARCH-REQ-03 / JEV SHADOW PROVIDER IMPLEMENTATION & EXPERIMENTAL CHARACTERIZATION`

Proposed scope:

- additive provider-neutral shadow contracts and repository;
- Jev adapter with pinned model, strict schema and no retries for primary latency characterization;
- deterministic mock provider and replay fixtures;
- PAPER-first shadow collection;
- explicit non-influence tests comparing baseline digests with provider enabled, disabled, timed out and malformed;
- no Advisory/Gated path and no exchange mutation caused by Jev.

## Final boundaries

`JEV_AUTHORITY = NONE`

`ADVISORY_MODE = NOT AUTHORIZED`

`GATED_MODE = NOT AUTHORIZED`

`MAINNET = PROHIBITED`

`REAL_CAPITAL = PROHIBITED`

`COMMIT = NOT AUTHORIZED PENDING CTO REVIEW`
