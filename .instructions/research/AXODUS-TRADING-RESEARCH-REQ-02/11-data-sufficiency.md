# 11 — Data Sufficiency Assessment

| Experiment | Available inputs/outcomes | Sufficiency | Gap |
| --- | --- | --- | --- |
| Proposal validation for executed baseline trades | MarketState, proposal, Portfolio/Risk, canonical fills, diagnostics, PnL | `SUFFICIENT` for a bounded pilot | Sample count and regime coverage unknown |
| State-sufficiency/abstention | freshness, completeness, sequence/quality, validation refs | `SUFFICIENT` | Need frozen label policy |
| Coarse regime classification | MarketState features and later observations | `PARTIAL` | Current feature set and independent regime labels must be inventoried per strategy |
| Baseline-rejected counterfactuals | proposal/decision plus later market series | `PARTIAL` | No actual fills; simulation assumptions and selection bias |
| Adverse selection | canonical fills plus post-fill prices | `PARTIAL` | Requires synchronized reference-price series at fixed horizons |
| Execution advisor / microstructure | some bid-ask/order-book observations and diagnostics | `INSUFFICIENT` for strong L2 claims | Durable L2 depth, trades, sequence, event-time synchronization and retention |
| Sustainable alpha / production value | Paper/Testnet facts only | `INSUFFICIENT` | Mainnet market impact, production liquidity, long regimes and real operational costs unavailable |

## If L2 collection is later authorized

Required fields:

- exchange event time and local receive time;
- sequence/update identifiers and reconnect boundaries;
- best bid/ask and depth by level with price/quantity;
- trades with aggressor side where available;
- instrument, venue, environment and schema version;
- retention sufficient for preregistered horizons plus audit replay.

Collection frequency must preserve native updates or a documented lossless-enough aggregation. A commercial dataset would improve rejected-trade and microstructure counterfactuals, but no purchase is authorized and no cost/benefit case can be finalized before the pilot defines the unanswered question.

## Data handling decision

Start with legitimately available Axodus Paper/Testnet data. Report `INSUFFICIENT_DATA` rather than extending scope or purchasing data. Testnet collection may improve engineering evaluation but cannot establish production profitability.
