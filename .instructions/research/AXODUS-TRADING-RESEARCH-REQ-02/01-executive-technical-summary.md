# 01 — Executive Technical Summary

## Finding

Jev is technically compatible with a removable, asynchronous SHADOW observation path. The strongest initial hypotheses are trade-proposal validation, regime classification, and abstention/data-sufficiency detection. The study does not find evidence of profitable edge, production suitability, or authority fitness.

## Recommendation

Disposition: `SHADOW-IMPLEMENTATION CANDIDATE`.

Authorize a separate, bounded implementation request only if it preserves these controls:

1. `DecisionProvider` is Axodus-owned and provider-neutral.
2. Jev observes an immutable snapshot after canonical `TradeProposal` creation and before Portfolio evaluation.
3. Jev output is written only to shadow evidence; Portfolio, Risk, `TradingIntent`, `ExecutionIntent`, Harness and provider inputs remain byte-for-byte independent of the result.
4. Provider failure degrades shadow evidence and never blocks the baseline Trading path.
5. Exact arithmetic, timestamps, freshness, identities, limits and all economic invariants remain deterministic code.
6. A pinned model version, question-set revision, state-schema revision and input digest are mandatory.
7. Testnet outcomes remain engineering evidence and are not production profitability evidence.

## Why this is plausible

- `DOCUMENTED FACT`: Jev accepts structured state and typed Choice, Score and Noul questions and returns probability-bearing structured answers ([TypeSafe introduction](https://docs.typesafe.ai/introduction), [primitives](https://docs.typesafe.ai/primitives)).
- `REPOSITORY OBSERVATION`: Axodus already preserves canonical `MarketState`, `TradeProposal`, Portfolio/Risk decisions, execution facts, economic attribution, drift, governance, safety and end-to-end correlation.
- `PUBLIC THIRD-PARTY CLAIM`: public implementations show that Jev can be called inside trading-related loops, but they generally couple model output more directly to order behavior than Axodus permits.

## What is not known

- No Axodus live API call, latency benchmark, calibration study or repeated-state test was performed.
- No evidence establishes incremental value over Strategy/Quant.
- Provider retention for the plan Axodus would use, support/SLA, regional processing, and contractual availability remain unresolved.
- Existing data is partial for rejected-trade counterfactuals and insufficient for high-frequency L2 execution-advice claims.

## Initial experiment

Run a preregistered PAPER-first then TESTNET-correlated SHADOW study. Record baseline and Jev judgments against the same point-in-time state. Score calibration and conditional outcome differences by regime. Do not tune thresholds on the final holdout and do not promote from SHADOW under this request.

## Authority conclusion

Jev can be removed without changing canonical Trading behavior if the proposed event-driven side branch is used. Any design in which Jev can suppress, enlarge, approve, submit or cancel an economic action is rejected by this research.
