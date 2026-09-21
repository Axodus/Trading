# 03 — Public Jev Trading Implementation Audit

Repositories were inspected at their public HEADs on 2026-09-21. Their behavior is research input, not Axodus validation.

Inspected revisions: `jev-trader@b587759e459ea049590102e54a0b07800864cdc3`, `jev-trade@2d5f002e3c77a60c25187143180e5e2a345be123`, `Jev-Trades@01fb18e4484d626f03345eaff2b93b641677b786`, and `QuantDinger@1c29efd04a79d23267d15ee5610d19ee907abc3b`.

## Implementation matrix

| Implementation | Market/state and questions | Decision/execution | Measurement/failure | Axodus classification |
| --- | --- | --- | --- | --- |
| [jarrodwatts/jev-trader](https://github.com/jarrodwatts/jev-trader) | Kuru MON-USDC L2/book, trades, position and recent mids; asks higher/lower over a block horizon | One decision per Monad block; direct buy/sell drives post-only cancel/replace | Logs model/loop latency, fills, position and PnL; one loop in flight; late decision holds; missing receipt becomes `lost`; dry-run without private key | `ADAPT` state/latency/event trace; `REJECT` direct model-to-order authority and local accounting as canonical truth |
| [aowang-ai/jev-trade](https://github.com/aowang-ai/jev-trade) | Hyperliquid book/tape/position across isolated asset sleeves; long/short then open/close/hold | Jev output drives ALO entry/IOC exit; testnet default but mainnet switch exists | Per-loop decisions and trading state; credentials/private keys used for live paths | `REFERENCE` for typed multi-step questions; `REJECT` execution coupling, mainnet route and credential boundary |
| [zadescoxp/Jev-Trades](https://github.com/zadescoxp/Jev-Trades) | Yahoo one-minute candles and indicators; typed paper decisions | Jev decisions update a simulated portfolio; no broker API | JSONL request/response log, paper fills/PnL; warns that multiple collectors duplicate decisions | `ADAPT` paper fixtures and trace fields; `REJECT` shared in-memory portfolio/key and non-durable deduplication |
| [OpenByteInc/QuantDinger](https://github.com/OpenByteInc/QuantDinger) | Entry order, strategy, market, exposure, positions and budget; data quality, alignment, regime, risk, execution and final entry questions | Optional PASS/REJECT gate immediately before entry; exits/protective actions bypass; LLM fallback and fail-open entries | PostgreSQL decision trace, confidence, probabilities and latency | `ADAPT` audit schema and question decomposition; `REJECT` as Axodus architecture because Jev is an authoritative pre-trade gate and fallback changes decision behavior |

## Detailed observations

### Jev Trader / Monad Kuru

- Decision frequency is tied to approximately 300 ms blocks; the public README describes a 100-block forecast horizon and post-only quoting one tick inside touch.
- The model call disables retries and the loop explicitly treats a late result as no quote, useful for measuring deadline misses.
- Fire-and-forget transaction submission, receipt lag and `lost` status demonstrate why provider intent, acknowledgement and canonical reconciliation must remain separate.
- Numeric and PnL logic uses ordinary numbers in places and cannot be imported as Axodus accounting authority.

### Jev Trade / Hyperliquid

- Isolated wallets reduce cross-asset operational coupling but do not provide Axodus authority isolation.
- The repository demonstrates a provider adapter and dry-run/testnet path, yet still makes model output directly actionable.
- Mainnet configurability and key possession conflict with REQ-02.

### Jev Trades / paper dashboard

- It supplies useful deterministic paper inputs, explicit confidence policies and request/response visibility.
- One shared process owns portfolio/key state and local JSONL records. This is unsuitable for durable, multi-worker Axodus experiments.

### QuantDinger

- Its six atomic questions are a useful starting taxonomy.
- Its final `entry_decision`, fallback LLM and fail-open live entry behavior are specifically not reusable under SHADOW. Axodus baseline must be unaffected whether Jev succeeds, fails or disagrees.

## Cross-implementation conclusion

The public work establishes technical feasibility for structured trading-related calls. It does not establish calibration, incremental value, sustainable alpha, safe authority design or production suitability. No public architecture is copied wholesale.
