# AXODUS-TRADING-IMP-QUANT-ORDERFLOW-PIPELINE-01 / BOOTSTRAP-01 — Cross-Symbol Replay Evidence

Status: **CROSS-SYMBOL HISTORICAL IS REPLAY COMPLETE / DETERMINISTIC REPLAY PASS**

This report consolidates the canonical event-atomic frame reconstruction and frozen strategy replays across the multi-symbol research cohort (`ZECUSDT`, `SUIUSDT`, `WLDUSDT`) on qualified In-Sample historical market data (`2026-06-23` to `2026-07-02`).

---

## 1. Research Protocol & Temporal Causality Classification

- **Cohort Classification**: `CROSS_SYMBOL_RESEARCH / FORWARD_SELECTED_COHORT`
- **Selection Source**: 2026-09-27 live scanner smoke test cohort (`ZECUSDT`, `SUIUSDT`, `WLDUSDT`, `SOLUSDT`).
- **Temporal Leakage Guard**: This historical replay evaluates cross-asset microstructure kernel generalization, InstrumentSpec scaling, and strategy adapter behavior. It **must not** be construed as a historical scanner claim.
- **In-Sample Window**: `2026-06-23T00:00:00Z` through `2026-07-02T23:59:59.999Z` (10 calendar days).
- **Out-of-Sample (OOS)**: `2026-07-03` to `2026-07-06` remains **SEALED / UNTOUCHED** (0 events consumed, 0 strategy evaluations).
- **Strategy Parameters**: **FROZEN / UNCHANGED** (0 tuning, 0 optimization).
- **External Mutations / Real Capital / Jev Calls**: **0** (Safe local research only).

---

## 2. Bootstrap Provenance & Causal Window Qualification

| Symbol | Bootstrap Status | Qualified Window | Observation Minutes | Causal Coverage % | Frame Stream Hash | Crossed / Empty Books | Future Violations |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| **ZECUSDT** | `BOOTSTRAP_QUALIFIED` | `2026-06-23T00:00:00Z` -> `2026-07-02T23:59:59.999Z` | 14,400 | 100.0000% | `1dde0c1ca03efa8e...` | 0 / 0 | 0 / 0 |
| **SUIUSDT** | `BOOTSTRAP_PARTIAL` | `2026-06-23T18:20:00Z` -> `2026-07-02T23:59:59.999Z` | 13,300 | 92.3641% | `1197a6e4fc5c7241...` | 0 / 0 | 0 / 0 |
| **WLDUSDT** | `BOOTSTRAP_PARTIAL` | `2026-06-23T18:20:00Z` -> `2026-07-02T23:59:59.999Z` | 13,300 | 92.3641% | `b9a78009184f929e...` | 0 / 0 | 0 / 0 |

> **Note on Partial Windows**: SUIUSDT and WLDUSDT lacked pre-window snapshots prior to `2026-06-23T18:20:00Z`. In compliance with `RETROACTIVE_SYNTHESIS = 0`, the first 1,100 minutes (18h20m) were excluded without synthetic fabrication. Replay is evaluated strictly over the 13,300 qualified causal frames.

---

## 3. Multi-Symbol Strategy Replay Matrix (10-Day IS / Qualified Windows)

### A. ZECUSDT (14,400 frames / 100.0% coverage / $100 Notional)
- **Momentum Aggression Scalper** (`orderflow.momentum.aggression`):
  - Trades: 142 (60 Wins / 82 Losses / 0 Flat) | Win Rate: 42.25%
  - Gross PnL: `+$4.9059` | Fees: `-$14.2000` (Taker 5 bps) | Net PnL: **`-$9.2941`**
  - Expectancy: `-$0.0655 / trade` | Profit Factor: `1.2088` (Gross) | Max Drawdown: `$11.9020`
  - Disposition: `IS_EVIDENCE_NEGATIVE`, `ECONOMICALLY_FRAGILE` | Determinism: **PASS**
- **Absorption Fade** (`orderflow.absorption.fade`):
  - Trades: 2 (0 Wins / 2 Losses / 0 Flat) | Win Rate: 0.00%
  - Gross PnL: `-$0.4458` | Fees: `-$0.0800` (Maker assumed 2 bps) | Net PnL: **`-$0.5258`**
  - Expectancy: `-$0.2629 / trade` | Profit Factor: `0.0` | Max Drawdown: `$0.5258`
  - Disposition: `VERY_LOW_SAMPLE`, `EXECUTION_MODEL_LIMITATION` | Determinism: **PASS**
- **CVD Divergence Reversal** (`orderflow.cvd.divergence.reversal`):
  - Trades: 332 (123 Wins / 209 Losses / 0 Flat) | Win Rate: 37.05%
  - Gross PnL: `+$0.0235` | Fees: `-$33.2000` (Taker 5 bps) | Net PnL: **`-$33.1765`**
  - Expectancy: `-$0.0999 / trade` | Profit Factor: `1.0003` (Gross) | Max Drawdown: `$35.6887`
  - Disposition: `IS_EVIDENCE_NEGATIVE`, `ECONOMICALLY_FRAGILE` | Determinism: **PASS**

### B. SUIUSDT (13,300 qualified frames / 92.36% coverage / $100 Notional)
- **Momentum Aggression Scalper** (`orderflow.momentum.aggression`):
  - Trades: 5 (1 Win / 4 Losses / 0 Flat) | Win Rate: 20.00%
  - Gross PnL: `-$0.6501` | Fees: `-$0.5000` | Net PnL: **`-$1.1501`**
  - Expectancy: `-$0.2300 / trade` | Profit Factor: `0.3645` | Max Drawdown: `$1.1501`
  - Disposition: `VERY_LOW_SAMPLE`, `IS_EVIDENCE_NEGATIVE` | Determinism: **PASS**
- **Absorption Fade** (`orderflow.absorption.fade`):
  - Trades: 20 (7 Wins / 13 Losses / 0 Flat) | Win Rate: 35.00%
  - Gross PnL: `+$0.4670` | Fees: `-$0.8000` | Net PnL: **`-$0.3330`**
  - Expectancy: `-$0.0166 / trade` | Profit Factor: `1.1723` (Gross) | Max Drawdown: `$1.4001`
  - Disposition: `LOW_SAMPLE`, `EXECUTION_MODEL_LIMITATION` | Determinism: **PASS**
- **CVD Divergence Reversal** (`orderflow.cvd.divergence.reversal`):
  - Trades: 242 (85 Wins / 157 Losses / 0 Flat) | Win Rate: 35.12%
  - Gross PnL: `-$4.5594` | Fees: `-$24.2000` | Net PnL: **`-$28.7594`**
  - Expectancy: `-$0.1188 / trade` | Profit Factor: `0.9084` | Max Drawdown: `$29.6712`
  - Disposition: `IS_EVIDENCE_NEGATIVE`, `ECONOMICALLY_FRAGILE` | Determinism: **PASS**

### C. WLDUSDT (13,300 qualified frames / 92.36% coverage / $100 Notional)
- **Momentum Aggression Scalper** (`orderflow.momentum.aggression`):
  - Trades: 5 (1 Win / 4 Losses / 0 Flat) | Win Rate: 20.00%
  - Gross PnL: `-$0.7663` | Fees: `-$0.5000` | Net PnL: **`-$1.2663`**
  - Expectancy: `-$0.2533 / trade` | Profit Factor: `0.3716` | Max Drawdown: `$1.2996`
  - Disposition: `VERY_LOW_SAMPLE`, `IS_EVIDENCE_NEGATIVE` | Determinism: **PASS**
- **Absorption Fade** (`orderflow.absorption.fade`):
  - Trades: 19 (6 Wins / 13 Losses / 0 Flat) | Win Rate: 31.58%
  - Gross PnL: `-$0.5413` | Fees: `-$0.7600` | Net PnL: **`-$1.3013`**
  - Expectancy: `-$0.0685 / trade` | Profit Factor: `0.8537` | Max Drawdown: `$2.7871`
  - Disposition: `LOW_SAMPLE`, `EXECUTION_MODEL_LIMITATION` | Determinism: **PASS**
- **CVD Divergence Reversal** (`orderflow.cvd.divergence.reversal`):
  - Trades: 310 (109 Wins / 201 Losses / 0 Flat) | Win Rate: 35.16%
  - Gross PnL: `-$14.3342` | Fees: `-$31.0000` | Net PnL: **`-$45.3342`**
  - Expectancy: `-$0.1462 / trade` | Profit Factor: `0.8240` | Max Drawdown: `$47.1933`
  - Disposition: `IS_EVIDENCE_NEGATIVE`, `ECONOMICALLY_FRAGILE` | Determinism: **PASS**

---

## 4. Key Quantitative Insights & Cross-Asset Microstructure Findings

1. **Taker Friction Dominance Across All Pairs**:
   - On both `Momentum` and `CVD Divergence`, transaction fees (5 bps in + 5 bps out = 10 bps round-trip) completely exceed the gross edge captured by 1-minute orderflow signals across all 3 altcoin instruments, identical to the pattern observed in BTCUSDT.
   - In `ZECUSDT`, Momentum achieved a positive gross profit of `+$4.9059` (Profit Factor 1.2088), but fees of `-$14.20` resulted in a net loss of `-$9.2941`.
2. **Absorption Observation Scarcity vs Maker Execution Uncertainty**:
   - ZEC generated only 2 Absorption signals (1 trade / 5 days), confirming the structural sparsity of large absorption events at 1-minute resolution.
   - SUI (20 trades) and WLD (19 trades) showed higher frequency, but net outcomes remained negative (`-$0.3330` and `-$1.3013`) even with assumed maker execution.
3. **Determinism & Regression Invariants**:
   - Canonical frame generation and strategy replays achieved **100% deterministic double-run reproduction** across all 9 runs.
   - Quants-Lab test regression: **154 / 154 PASS** (0 failures).
   - BTC canonical frame stream hash (`fae40ba4190bd13a...`) remains exact.

---

## 5. Artifact Provenance & Persisted Ledgers

All run manifests, signal ledgers, order ledgers, fill ledgers, trade ledgers, and aggregate JSON files are persisted under:
`/opt/Axodus/Trading/quants-lab/research_notebooks/orderflow_backtest/runs/option_a_historical_is_verified/{ZECUSDT,SUIUSDT,WLDUSDT}/`

And indexed in:
- `multi_symbol_replay_manifest.json`
- `option_a_backtest_summary.json`
