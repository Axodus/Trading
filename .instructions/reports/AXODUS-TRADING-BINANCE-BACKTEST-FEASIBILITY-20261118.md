# Binance Futures Backtest — Trading feasibility assessment

- Date: 2026-11-18. Classification: `PUBLIC_TOOL_EVALUATED / SUPPLEMENTARY_RESEARCH_ONLY`.
- Trading branch `dev` inspected at `8f9d33d8cef46832595a8543f5110ad269cc6a36`; Quants-Lab `148c27da84c1ab1ee861be14a7a41d067000ee49`; Condor `3e3c5fd57d98a4ab5561967613d188831e7837c1`. The untracked Mainnet read-check receipt was preserved.
- Purpose: assess an external visualization and secondary candle-based comparator for research. No implementation, production credentials, live orders, account operation, funding, transfer, deployment, commit or push. No proprietary Axodus strategy or customer data was submitted to Binance.

## Executive determination

**Useful for discretionary visual inspection and carefully controlled candle-only comparisons; unsuitable as the canonical Axodus execution/economic/OOS validator or as proof that the 50x isolated-margin DEV probe can run.** The tool is marked Beta. Current Binance FAQ says USDⓈ-M Futures, Cross Margin and Multi-Assets only. The UI inspected did not expose isolated margin, leverage or transaction-cost controls. Thus the existing source does not establish an isolated-margin, 50x liquidation or account-specific simulation. Treat the FAQ as the vendor's currently published claim, not as proof of all backend behavior.

## Evidence: actual public workspace

Using an unauthenticated browser on 2026-11-18, inspected the original BTCUSDT link without running it, then selected XRPUSDT (neither `ONEUSDT` nor `BTCUSDT`, both excluded by the owner). The Binance-supplied example code was left unchanged; it is a generic synthetic demo, not an Axodus strategy. The UI displayed Strategy Editor, Parameters Config, Performance and List of Trades; Open/Save/Save as/Import/Export labels were visible for scripts. Import/export operation, file format, access requirements and result-data export were **not tested**.

For the demonstration, the UI defaults were 2026-10-18 to 2026-11-18, daily candles and simulated initial amount 1,000 USDT. `Start Backtest` completed without logging in; the result showed performance metrics and a paginated simulated trade list. This was a historical simulation, not a trade, order submission, strategy validation or proof of account access. A single trial does not establish determinism, reproducibility or the correct execution model. No conclusions from its PnL are warranted.

The default example computed `sma(close,10)` but the actual entry conditions compared candle `open` to `close`, not price against the calculated average. Binance's FAQ describes a moving-average rule yet displays this same example. Do not adopt examples as a specification without inspecting the actual expression.

The trade list displayed `0.0100 XRP` example fills and rounded individual fees `0.0000`; the account summary showed total fee `0.0007 USDT`. The separate public exchangeInfo snapshot recorded in `AXODUS-TRADING-DEV-FUTURES-P0-RISK.md` showed an XRPUSDT quantity step and minimum of `0.1` at `2026-11-18T09:55:18.531Z`; this is not historical filter evidence for each demo trade. Nevertheless the apparent mismatch is a concrete reason to test point-in-time filter enforcement rather than assume simulated fills pass live venue constraints. The example left a simulated position open; it does not certify a closed and reconciled round trip.

## Observed and documented capabilities

| Capability | Finding and boundary |
|---|---|
| Editor | Binance-specific script syntax resembling, but not established to be compatible with, Python or Pine. The example uses `strategy.order` with long/short and `when`. Arbitrary Python or importing Axodus modules is not established. |
| Inputs | Vendor custom-indicator documentation lists `open`, `high`, `low`, `close`, `time`, `volume`; `ema`, `wma`, `prev`, conditionals and other functions are documented. This list does not establish an external custom-data or order-book interface. |
| UI parameters | Dates, 1m/5m/15m/1h/4h/1d, initial amount and selected symbol were visible. Availability/history limits, data version, timezone and candle finalization semantics were not independently tested. |
| Results | UI displays estimated profit, fee, cumulative PnL, annualized rate, max drawdown, graph, simulated positions and trade rows. Full precision, machine-readable export, complete model and long-run persistence were not established. |
| API | A search of public Binance USDⓈ-M developer documentation and support FAQ located market/trading APIs and a manual workspace workflow, but no documented programmatic backtest submission/results API. This is not proof such an API cannot exist. Undocumented/internal endpoints and UI scraping are not accepted integrations. |
| Data/IP | Inserting a strategy into a third-party web editor can disclose it to the provider. Client-side versus server-side processing, storage, retention, terms, and manual import/export were not established. No private strategy should be submitted without an explicit IP decision. |

## Strategy suitability and ownership

| Trading use | Feasibility | Limitation |
|---|---|---|
| Generic moving-average or synthetic-candle hypothesis | Candidate for controlled manual comparison | Freeze rules and exact timestamps and compare indicator warmup, decision bar and fills against local engine. |
| `trend.microtrend.scalper` / `microtrend-v3` | Partial, MA-only proxy | EMA9/EMA21/WMA50 and some state logic may be expressible, but the source also constructs causal microstructure snapshots, Jev confirmation and net closed-trade cooldown. The published editor interface does not establish those feeds or identical state semantics. A proxy is a distinct research variant, not canonical Microtrend v3. |
| `microstructure.microprice_displacement.scalper` / `microprice-disp-v1` | No demonstrated equivalent | Strategy requires microprice displacement, signed queue imbalance, spread and book validity; candle OHLCV is insufficient. |
| Orderflow Momentum, Absorption and CVD Reversal | No demonstrated equivalent | Trade aggression, book/depth and CVD evidence are not established as available to this editor. Candle-only approximations cannot be relabelled as the canonical orderflow strategies. |
| DEV M0 at isolated 50x / minimum order | Not qualified | Binance FAQ states cross/multi-assets; observed controls do not demonstrate the requested mode, account bracket, actual lot filters, partial fills, close-only behavior or liquidation controls. Backtests do not establish account permissions or legal eligibility. |

Quants-Lab remains the canonical source of strategy identity, data lineage, optimization/selection, holdout governance and evidence. Its current `ExecutionAssumptionProfile` explicitly exposes fee/spread/slippage/latency/fill-ratio/leverage knobs, with zero fee/spread/slippage and 1x defaults; a profile must be specified and validated, and these fields alone do not prove full Futures funding/liquidation realism. `quant_validation/plan.py` contains temporal holdout and walk-forward paths and leakage checks; actual dataset suitability must still be audited. Existing consumed OOS windows remain consumed. Do not cherry-pick assets or parameters by a Binance PnL, call reused data fresh OOS, or promote a simulated result to execution readiness.

## Proposed non-production evaluation protocol

1. Use an invented non-proprietary OHLCV strategy and an owner-permitted symbol (`ONEUSDT`/`BTCUSDT` excluded). Record exact script and digest, bar interval, UTC window, data provenance/version or `UNKNOWN`, amount, all visible settings, tool date and screenshot/manual observation. Never submit private Axodus strategies or account-specific information.
2. Freeze the matching local experiment and dataset before execution. Run same logic twice in each engine. First compare candle timestamps/values, MA warmup and per-bar signals; only then compare position transitions, fills and PnL after matching known assumptions. Any unobservable assumption is `UNKNOWN`, not zero.
3. Probe fee precision, entry timing, historical filter compliance, gap and intrabar ordering, short/long reversals, partial fills and time ranges. Treat unsupported or ambiguous behavior as model mismatch. Test leverage, isolated margin, liquidation, funding and account filters only if Binance documents and exposes them; otherwise explicitly mark `NOT_VALIDATED`.
4. A divergence produces a documented finding, not a forced numerical match. Capture observations as externally sourced research evidence; do not overwrite canonical results. For a fresh final economic/OOS evaluation, first freeze universe and strategy, reserve a genuinely unused holdout and follow the existing validation governance.

The user did not authorize building an adapter, uploading a proprietary script, using real account credentials for this investigation, or issuing an order. A separate approved implementation would be necessary for any integration. Current independent Binance account authentication is also unresolved (`-2015` in prior read-only check), which this browser demonstration does not address.

## Sources

- Binance support FAQ, published 2023-01-12 and updated 2026-01-19: https://www.binance.com/en/support/faq/detail/38fa5e0dc2904c19b7fe3b58461610f2
- Binance custom-indicator reference: https://www.binance.com/en/customindicator/doc
- Binance USDⓈ-M developer documentation: https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/Introduction
- Workspace actually inspected: https://www.binance.com/en/backtest/futures/workspace/XRPUSDT
- Local code: `quants-lab/core/quant_strategies/microtrend/microtrend_scalper.py`, `quants-lab/core/quant_strategies/microstructure/microprice_displacement.py`, `quants-lab/core/quant_simulation/{models,execution}.py`, `quants-lab/core/quant_validation/plan.py`, `quants-lab/core/quant_optimization/runner.py`.
