# AXODUS-TRADING-RESEARCH-REQ-01A

## Market Data and Research Capability Audit

**Audit date:** 2026-09-17  
**Program:** Axodus Trading — System One Trading Feasibility  
**Classification:** Research / non-normative  
**Status:** Complete — repository audit only

This report records only capabilities evidenced in the local Axodus Trading repository. Trading is a development-stage nucleus in this workspace, and no real market-data benchmark corpus is present. It does not authorize System One calls, data acquisition, strategy implementation, paper trading, live trading, capital movement, or changes to ACS.

## STATUS

`COMPLETE / RESEARCH AUDIT`

The repository audit is complete. The evidence supports candle-level research planning and operational/backtest review. It does not support a claim that the repository contains a reconstructable historical order book, tick-level trade flow, queue dynamics, cancellation history, or L3 data.

## REPOSITORIES REVIEWED

- `/opt/Axodus/Trading` — repository root and local instructions.
- `trading-core/` — TypeScript/Node.js Trading Core, shared contracts, runtime, strategy, risk, governance, telemetry, and replay-oriented persistence.
- `backend-api/` — Python/FastAPI service for Hummingbot management, candle retrieval, backtesting, performance and local bot data.
- `backend-api/bots/instances/hummingbot-whiterabbit_test-2025.01.14_11.26/data/whiterabbit_test-2025.sqlite` — local test database.
- `backend-api/bots/instances/hummingbot-whiterabbit_test-2025.01.14_11.26/data/v2_with_controllers.sqlite` — local test database.

The configured submodules (`condor`, `hummingbot-api`, `mcp`, `quants-lab`, and `tradingbot`) were identified from `.gitmodules`; their contents were not treated as audited local data unless represented by the parent repository's checked-in files.

## CURRENT TRADING ARCHITECTURE

Trading Core is a headless operational nucleus. It normalizes execution context, runtime state, orders, fills, positions, portfolios, provider state, audit history, and telemetry. Provider-specific effects remain behind execution-provider adapters.

The observed layers are:

- `trading-core/packages/trading-contracts` — shared normalized contracts.
- `trading-core/services/trading-core` — execution orchestration, provider registry, runtime lifecycle, risk, governance, strategy products, telemetry, reconciliation, persistence, and replay services.
- `backend-api` — Hummingbot instance management and market-data/backtesting endpoints.
- Hummingbot connectors/controllers — venue access and controller-level strategy/backtest behavior.

The architecture preserves simulation/paper and local validation boundaries. The repository instructions state that production trading, real exchange credentials, withdrawals, treasury actions, and live execution remain blocked.

## DATA SOURCES

### AVAILABLE

- Hummingbot `CandlesFactory` is used for real-time and historical candle requests.
- Local SQLite test artifacts contain operational tables including `MarketData`, `Order`, `OrderStatus`, `TradeFill`, `Executors`, and `Controllers`.
- Trading Core accepts market candles and normalized market snapshots in contracts and strategy fixtures.

### PARTIAL

- Market data is available through an API path and through test artifacts, but the repository does not establish a durable, broad historical market-data archive suitable for research.
- Operational order/fill tables exist, but the inspected test databases contain no order or fill rows.

The API capability is an implementation surface, not evidence that real market data has been collected or that a benchmark corpus exists locally.

### UNKNOWN

- Retention, completeness, provenance, clock synchronization, and coverage of any external Hummingbot candle history not stored in this checkout.
- Whether other environments or uninitialized submodules contain additional datasets.

No new market data was downloaded for this audit.

## VENUES

### AVAILABLE / CONFIGURED

The backend API defaults to the Hummingbot connector `binance_perpetual`. The repository also names Binance, Bybit, OKX, and Kraken as exchange categories/examples in exchange documentation.

### UNKNOWN

The audit does not establish that historical research data exists for every named venue. The presence of a connector or documentation example is not evidence of a local historical dataset.

## INSTRUMENTS

### AVAILABLE / REFERENCED

- `BTC-USDT` is the default historical-candle pair and is the dominant market in Trading Core fixtures and tests.
- `BNB-USDT` and `USDC-USDT` appear in backend connector/pair references.

### UNKNOWN

The repository does not provide a validated inventory of instruments with historical coverage, per-venue retention, or continuous timestamps.

## DATA TYPES

| Data type | Classification | Evidence and limitation |
| --- | --- | --- |
| OHLCV candles | `AVAILABLE / DERIVABLE` | Hummingbot candle factory endpoints and strategy candle contracts exist. |
| Mid price / best bid / best ask snapshots | `PARTIAL` | SQLite `MarketData` schema contains these fields; local row counts are insufficient for a research series. |
| Historical L1 | `PARTIAL` | Snapshot fields exist, but no validated historical coverage was found. |
| Historical L2 | `UNAVAILABLE` for the audited local research archive | No local depth-level historical series or incremental book storage was evidenced. |
| Historical L3 | `UNAVAILABLE` | No message-level order book or queue-order representation was found. |
| Trades / ticks | `UNAVAILABLE` for the audited historical archive | `TradeFill` records execution fills, not a historical market trade tape; inspected tables contain zero rows. |
| Aggressor side | `UNKNOWN` / not evidenced | No checked-in historical trade stream with aggressor flags or a documented inference method was found. |
| Sequence IDs | `UNKNOWN` | No local schema or research artifact demonstrated exchange message sequence tracking. |
| Funding payments | `PARTIAL` | SQLite schema includes `FundingPayment`, but inspected row counts were zero. |
| Orders and fills | `PARTIAL` | Schemas and ETL code exist; inspected test databases contain zero rows. |

## TEMPORAL RESOLUTION

### AVAILABLE

- Candle API defaults are `3m` for historical candle requests and `1m` for backtesting resolution.
- Strategy and paper fixtures use minute-like timestamps and candle arrays.
- Operational latency is represented in milliseconds in Trading Core telemetry.

### UNAVAILABLE / UNSUPPORTED

The audited repository does not establish subsecond or tick-level historical resolution. A 100 ms, 10 ms, microsecond, or low-millisecond market hypothesis cannot be evaluated from the evidenced local dataset without acquiring and validating a new data source, which is outside this gate.

## BOOK RECONSTRUCTION CAPABILITY

`UNAVAILABLE` for historical L2/L3 reconstruction.

The `MarketData` SQLite schema has an `order_book` field and best-price fields, but the inspected artifacts do not provide a documented event sequence, depth schema, timestamps sufficient for reconstruction, or meaningful row volume. A field named `order_book` alone is not evidence of reconstructable depth history.

Queue position, queue depletion, depth imbalance over time, and message-level book transitions are therefore unsupported findings for this audit.

## TRADE / AGGRESSOR INFORMATION

`UNAVAILABLE / UNKNOWN` for the target research use.

The repository contains `TradeFill` schemas for executions generated by Hummingbot, including trade type and exchange trade ID fields. That is operational fill history, not a venue-wide historical trade tape. No checked-in aggressor-side field, tick archive, or validated buy/sell inference procedure was found.

## CANCELLATION / REPLENISHMENT CAPABILITY

`UNAVAILABLE`.

Order status and order tables describe the system's own orders and lifecycle state. They do not evidence all venue cancellations, replenishment events, hidden liquidity, or queue behavior. Cancellation forecasting, replenishment detection, and queue-dynamics studies are not currently supported.

## HISTORICAL COVERAGE

`UNAVAILABLE for local benchmarking / UNKNOWN outside this workspace`.

Trading is still a development-stage nucleus and this workspace contains no real market-data benchmark corpus. The backend exposes a historical-candle request with example Unix timestamps, but that endpoint is not evidence of locally collected data. The checkout does not include a coverage manifest, persisted real candle archive, venue-by-instrument date ranges, missingness report, or verified dataset snapshot. The two inspected SQLite files are test artifacts: one has 3 `MarketData` rows and the other has 0; both have 0 rows for orders, order status, trade fills, executors, and funding payments.

The repository therefore cannot support claims about real-data availability, years of coverage, continuity, survivorship, benchmark quality, or out-of-sample availability.

## DATA QUALITY

### AVAILABLE EVIDENCE

- Candle responses remove duplicate timestamps in the real-time endpoint.
- Local test databases have explicit timestamp columns in operational schemas.
- Trading Core has normalized state, event persistence, replay, and local validation paths.

### UNKNOWN / GAPS

- Exchange timestamp versus receipt timestamp.
- Clock drift and synchronization.
- Duplicate, missing, stale, or out-of-order market records in a research archive.
- Symbol migrations, contract rolls, funding and mark-price treatment.
- Corporate or venue-specific adjustments.
- Data licensing and reproducibility metadata.

No data-quality profile over a research corpus was available in the repository.

## EXISTING FEATURES

### AVAILABLE / DERIVABLE

Trading Core and WhiteRabbit code expose or derive:

- Bollinger-band position;
- RSI;
- ATR;
- relative volume;
- candlestick pattern filters;
- volatility score;
- trend strength;
- spread in basis points;
- liquidity score;
- provider health;
- execution latency;
- slippage and fill-quality telemetry where present.

The feature implementations are operational strategy/observability logic. Their research validity, leakage behavior, and out-of-sample performance are not established by this audit.

## EXISTING SIGNALS

### AVAILABLE

`WhiteRabbitSignalPipeline` produces `buy`, `sell`, or `hold` from candle-derived indicators and emits a confidence field plus trace reasons. Hummingbot controllers include directional-trading and market-making controller modules.

### LIMITATION

These are existing product/strategy signals and controller behaviors, not frozen research baselines. Their use in a future experiment would require a separate design and parameter-freeze gate.

## EXISTING STATISTICAL MODELS

`UNKNOWN / NOT EVIDENCED`.

The audit found deterministic indicator calculations and rule-based regime/strategy logic, but no checked-in logistic-regression, generalized linear, econometric, or other statistical research model identified as an evaluated quantitative baseline.

## EXISTING ML MODELS

`UNKNOWN / NOT EVIDENCED`.

No checked-in conventional ML training pipeline, feature store, model registry, temporal split procedure, or quantitative model evaluation report was found in the audited surface. The presence of AI/agent-facing recommendation services does not establish a market-prediction ML capability.

## REPLAY / BACKTEST CAPABILITY

### AVAILABLE

- FastAPI `/run-backtesting` delegates to Hummingbot `BacktestingEngineBase`.
- Backtesting accepts a start/end time, resolution, controller configuration, and `trade_cost`.
- The default backtesting resolution is `1m` and the default trade-cost parameter is `0.0006`.
- Trading Core has local Postgres migrations, event persistence, repository readiness checks, and replay smoke validation.
- WhiteRabbit has simulation and paper-validation services operating on candle fixtures.

### LIMITATION

The available backtest path is candle/controller oriented. It is not evidence of a tick-accurate, order-book-replay engine with queue-aware fills. Existing replay is primarily normalized Trading event replay, not a market microstructure reconstruction facility.

## TRANSACTION-COST DATA

### PARTIAL

- Hummingbot backtesting exposes a configurable `trade_cost`, defaulting to `0.0006` in the backend API.
- Trading Core contracts and telemetry represent spread, slippage, fees, and fill-quality concepts.

### UNKNOWN

The repository does not provide a validated venue-specific fee schedule, maker/taker tier history, spread distribution, market-impact model, adverse-selection model, latency-adjusted slippage calibration, or cost provenance for a research period. Net expectancy after executable costs cannot be claimed from the current audit alone.

## EXECUTION MODEL

### AVAILABLE

Trading Core models simulation, paper execution, Hummingbot provider adapters, orders, fills, positions, risk gates, reconciliation, and provider telemetry. The architecture keeps execution providers behind adapters and preserves governance/risk/runtime boundaries.

### PARTIAL

Backtesting has a trade-cost input and Hummingbot execution abstractions, but the audited code does not establish a calibrated queue-aware fill model or a latency-aware historical execution simulator.

### PROHIBITED IN THIS GATE

No exchange execution, paper trading, strategy implementation, or capital path was used or enabled.

## LATENCY DATA

### AVAILABLE

Trading Core has `ExecutionLatencyTracker` and runtime telemetry fields for millisecond latency, latency thresholds, health states, and latency-spike events. Paper fixtures include example latency and slippage values.

### UNKNOWN

There is no validated System One trading-call latency, market-data ingestion latency distribution, venue round-trip measurement, co-location measurement, or latency-to-fill/price-impact study. ACS PoC latency must not be reused as Trading evidence.

For this audit, horizons below one second are `OPERATIONALLY INFEASIBLE / UNSUPPORTED BY CURRENT EVIDENCE`, pending a separate data and latency capability gate.

## REGIME ANALYSIS CAPABILITY

### AVAILABLE

`MarketRegimeDetector` and `TrinityMarketAnalysisService` classify market state using volatility, spread, liquidity, and trend strength. Observed labels include `calm`, `volatile`, `trending`, and `illiquid`; the code contains thresholds such as 25 bps for a wide/deteriorated spread and 0.35 for thin liquidity.

### LIMITATION

This is an available operational classification capability. No historical regime dataset, stability analysis, or research validation demonstrates that the categories are predictive or portable across venues and instruments.

## TESTABLE MARKET JUDGMENTS

Subject to a future design and data-quality gate, the current repository can support research questions based on candles and normalized snapshots:

- next-candle or multi-candle directional classification at minute resolution;
- volatility or regime classification from candle-derived and normalized snapshot features;
- candle-level signal filtering for existing rule-based candidates;
- comparison of deterministic indicators against a statistical or conventional ML model once a dataset is established;
- latency-aware evaluation at candle-scale horizons where timestamps and execution assumptions are documented.

These are `POSSIBLY TESTABLE`, not approved experiments.

## UNTESTABLE / UNSUPPORTED JUDGMENTS

The current evidence does not support:

- queue position or queue survival;
- cancellation forecasting;
- L3 replenishment and hidden-liquidity inference;
- tick-level aggressor-flow prediction;
- microsecond or low-millisecond alpha claims;
- order-book imbalance studies requiring historical depth events;
- venue-wide trade-flow toxicity from a historical tape;
- any economic result requiring a calibrated market-impact or queue-aware fill model.

## DATA GAPS

1. No research dataset manifest with venue, instrument, date range, timezone, schema, licensing, and checksums.
2. No validated historical candle archive in the checkout.
3. No durable tick/trade tape with aggressor-side information.
4. No incremental L2/L3 order-book event archive or sequence IDs.
5. No coverage/missingness/clock-quality report.
6. No frozen statistical or ML quantitative baseline.
7. No documented temporal walk-forward, purged, or embargoed validation harness.
8. No venue-specific fee, spread, slippage, market-impact, adverse-selection, or latency calibration dataset.
9. No verified out-of-sample period reserved for research.
10. No documented reproducible regime-labeling evaluation.

## SECURITY / FINANCIAL BOUNDARIES

The repository's documented boundaries preserve risk, governance, compliance, credential, runtime, treasury, and execution gates. Hummingbot provider controls remain behind adapters; ACS does not call execution providers directly; production credentials, live trading, withdrawals, and treasury actions are blocked.

Any future System One research adapter would be market-intelligence-only and would have no path to an exchange, wallet, order, risk limit, capital, runtime admission, or governance authorization. This audit created no provider call, did not request credentials, and did not inspect or alter secrets.

## RECOMMENDED INITIAL MARKET / INSTRUMENT

`BTC-USDT` on the configured `binance_perpetual` connector is the best future research candidate because it is the repository's default pair and appears repeatedly in Trading Core fixtures and tests. No real-data benchmark currently exists for it in this workspace.

This is a research recommendation only. It does not establish historical coverage or authorize data acquisition or trading.

## RECOMMENDED HORIZONS

- Primary future candidate: `1m` to `15m` candle-level horizons, subject to acquiring or locating an authorized real-data corpus and then verifying coverage and label quality.
- Secondary candidate: `30s` to `60s` only if a validated subminute source is later shown to exist.
- `100ms`, `10ms`, microsecond, and low-millisecond horizons: `OPERATIONALLY INFEASIBLE / UNSUPPORTED` by the current audited evidence.
- `30s` to minutes can be considered only after timestamp, latency, spread, fee, and slippage assumptions are measured.

The `1m` to `15m` recommendation follows the repository's observed candle/backtest resolution and should be revisited if the data audit in a later gate finds a different reliable granularity.

## RECOMMENDED NEXT RESEARCH GATE

`REQ-01B — Microstructure Research Design`, conditional on CTO review.

REQ-01B should first define a candle-level, objective outcome and a temporal evaluation design using only data that can be demonstrated as available. It should explicitly reject unsupported L2/L3 and queue hypotheses unless a separately authorized data audit supplies evidence.

## RISKS

- Building a benchmark around provider prompts before establishing a valid market dataset.
- Mistaking operational order/fill schemas for venue-wide market microstructure history.
- Look-ahead leakage through candle closure, feature windows, or latency handling.
- Overstating performance from a single instrument, venue, regime, or short period.
- Using fixed `0.0006` trade cost as if it were a validated all-in execution cost.
- Treating rule-based regime labels or WhiteRabbit confidence as calibrated predictive probabilities.
- Confusing normalized event replay with market-data replay.
- Data and provider dependencies entering the critical path before economic value is shown.

## UNRESOLVED QUESTIONS

- What exact candle history can be retrieved without purchasing new data, and under what terms?
- Which venue/instrument/date ranges are reproducible locally?
- Are timestamps exchange-generated, receipt-generated, or mixed?
- Can `MarketData.order_book` be decoded into a stable schema, and does it contain more than a snapshot? Current artifacts do not establish this.
- Is there any untracked or external research environment with tick/L2/L3 data?
- What fee, spread, slippage, impact, and latency assumptions are acceptable for a future economic test?
- Which deterministic signal should be frozen as baseline A?
- Is a statistical or conventional ML baseline already available outside this checkout, or must REQ-01C define one?
- What temporal split and label embargo are required by the selected horizon?

## IMPLEMENTATION PERFORMED

- Created this documentation-only audit report at `docs/research/system-one/req-01a-market-data-audit.md`.
- Recorded that Trading is development-stage and that no real market-data benchmark is available in this workspace.
- Performed repository, instruction, code, schema, SQLite row-count, and submodule-configuration inspection.
- No production code, ACS code, schema, dependency, provider configuration, credential, dataset, strategy, or execution path was modified.
- No System One call, market-data download, exchange call, paper trading, live trading, or capital action was performed.

## DECISIONS REQUIRED FROM CTO

- Accept or revise the audit findings and the `BTC-USDT` / `binance_perpetual` research recommendation.
- Decide whether to authorize REQ-01B with a candle-level scope and explicit exclusion of unsupported microstructure claims.
- If REQ-01B proceeds, first decide whether an authorized real-data source may be introduced; REQ-01A found no local benchmark corpus.

## DECISIONS REQUIRED FROM CEO

`NONE` for REQ-01A. No capital, execution, provider adoption, or market-data purchase decision is requested by this audit.

## SOURCES REVIEWED

Repository and local evidence:

- `AGENTS.md`
- `.instructions/STATUS.md`
- `.instructions/TRADING_CORE_ARCHITECTURE.md`
- `.instructions/TRADING_IMPLEMENTATION_INVENTORY.md`
- `.instructions/TRADING_RUNTIME_MODEL.md`
- `.instructions/EXCHANGES.md`
- `.instructions/SECURITY.md`
- `.instructions/DECISIONS.md`
- `.instructions/VALIDATION.md`
- `.gitmodules`
- `backend-api/routers/manage_market_data.py`
- `backend-api/routers/manage_backtesting.py`
- `backend-api/utils/etl_databases.py`
- `trading-core/services/trading-core/src/strategies/whiterabbit/WhiteRabbitSignalPipeline.ts`
- `trading-core/services/trading-core/src/agents/trinity/MarketRegimeDetector.ts`
- `trading-core/services/trading-core/src/agents/trinity/TrinityMarketAnalysisService.ts`
- `trading-core/services/trading-core/src/agents/trinity/SpreadAnalysisService.ts`
- `trading-core/services/trading-core/src/agents/trinity/VolatilityAnalysisService.ts`
- `trading-core/services/trading-core/src/telemetry/ExecutionLatencyTracker.ts`
- local SQLite schemas and row counts for the two test artifacts listed above.

External methodology context:

- TypeSafe skill documentation at `/opt/Axodus/.agents/skills/typesafe-ai/SKILL.md`, which directs that live TypeSafe documentation is the source of truth, that judgments should remain narrow and typed, and that application code owns workflow and policy.

## GLOBAL COORDINATION HANDOFF

- **Workspace owner:** `/opt/Axodus/Trading`
- **Scope:** Documentation-only REQ-01A market-data and research-capability audit.
- **Local status:** Complete; awaiting CTO review.
- **Validation:** Read-only repository/code/schema inspection; SQLite profiling completed; no provider or exchange calls.
- **Records changed:** `docs/research/system-one/req-01a-market-data-audit.md`.
- **Dependencies:** CTO decision on REQ-01B; any future data-source authorization.
- **Blockers/risks:** No evidenced historical microstructure archive; no tick/L2/L3 research capability; no validated statistical/ML baseline.
- **Priority impact:** REQ-01B remains on hold pending CTO acceptance.
- **Requested portfolio action:** Review this local handoff and consolidate only validated findings in portfolio records.
- **Preserved boundaries:** No ACS changes, System One calls, provider dependency, data purchase, exchange integration, strategy implementation, paper trading, live trading, or capital authority.
