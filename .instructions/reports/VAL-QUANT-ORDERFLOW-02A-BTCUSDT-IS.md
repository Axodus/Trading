# AXODUS-TRADING-VAL-QUANT-ORDERFLOW-02A — Canonical Evidence Handoff

Status: **CANONICAL REPLAY COMPLETE — VAL-02A FORMAL CLOSURE READY**

The historical Order Flow research pipeline has achieved full canonical closure on real qualified BTCUSDT L2 Parquet and Trade Tape data. Legacy/synthetic MarketTick approximations have been completely replaced across all three frozen strategies by event-atomic C++ kernel streaming reconstruction and deterministic canonical ledgers.

---

## 1. Scope & Safety Invariants

- **Dataset**: `orderflow-binance-futures-14d-20260623-20260706-v1`, revision `v1`
- **Pair**: `BTCUSDT` (100.0% causal qualification, 0 true sequence gaps)
- **In-Sample Period**: `2026-06-23T00:00:00Z` through `2026-07-02T23:59:59.999Z` (10 contiguous UTC days)
- **Out-of-Sample (OOS)**: `2026-07-03` to `2026-07-06` — **SEALED / PROHIBITED** (0 events consumed, 0 strategy evaluations)
- **ETHUSDC**: **OUT OF SCOPE / NOT USED**
- **Strategy Parameters**: **FROZEN / UNCHANGED** (0 parameter sweeps, 0 optimization)
- **External Trading / Mutations / Real Capital / Jev**: **0**
- **Secrets Exposed**: **false**

---

## 2. Canonical Frame Stream Generation

- **Expected 1-Minute Frames**: 14,400 (10 days × 1,440 min/day)
- **Generated Frames**: 14,400
- **Missing / Rejected Frames**: 0
- **Crossed / Empty Books**: 0
- **Future L2 / Future Tape Violations**: 0
- **First Frame**: `2026-06-23T00:00:59.999Z`
- **Last Frame**: `2026-07-02T23:59:59.999Z`
- **Frame Stream Hash**: `fae40ba4190bd13a9a0fb89c3b6f5a8d953de0c8a604ff3c7e5e174a3997ddbf`
- **Frame Determinism**: **PASS** (14,400 / 14,400 exact match across independent runs)

---

## 3. Strategy Replay Results & Canonical Matrix

### Strategy 1: Aggression Momentum Scalper (`orderflow.momentum.aggression`)
- **Run ID**: `momentum-btcusdt-is-fae40ba4190bd13a`
- **Signals / Orders / Fills / Trades**: 192 / 139 / 139 / 139 (68 Long, 71 Short)
- **Wins / Losses / Flat**: 51 / 88 / 0 (Win Rate: 36.69%)
- **Gross PnL**: `+$1.8126`
- **Fees**: `-$139.0000` (Taker 0.05% entry + Taker 0.05% exit = $1.00/trade @ $1,000 notional)
- **Net PnL**: `-$137.1874`
- **Expectancy**: `-$0.9870 / trade`
- **Profit Factor**: `1.0096` (Gross)
- **Max Drawdown**: `$137.1874`
- **Sample Classification**: `SUFFICIENT_OBSERVATIONS` (139 trades)
- **Research Disposition**: `IS_EVIDENCE_NEGATIVE`, `ECONOMICALLY_FRAGILE`
- **Deterministic Replay**: **PASS** (Run 1 hash == Run 2 hash)
- **Legacy Reconciliation**: **Outcome C** (Legacy reported 84 trades, Net -$92.50; superseded by canonical real L2+tape causal replay)

### Strategy 2: Absorption Fade (`orderflow.absorption.fade`)
- **Run ID**: `absorption-btcusdt-is-fae40ba4190bd13a`
- **Signals / Orders / Fills / Trades**: 1 / 1 / 2 / 1 (1 Long, 0 Short)
- **Wins / Losses / Flat**: 0 / 1 / 0 (Win Rate: 0.00%)
- **Gross PnL**: `-$2.6716`
- **Fees**: `-$0.4000` (Maker assumed 0.02% entry + Maker assumed 0.02% exit = $0.40/trade)
- **Net PnL**: `-$3.0716`
- **Expectancy**: `-$3.0716 / trade`
- **Profit Factor**: `0.0`
- **Max Drawdown**: `$3.0716`
- **Sample Classification**: `VERY_LOW_SAMPLE` (1 trade)
- **Research Disposition**: `EXECUTION_MODEL_LIMITATION`, `IS_EVIDENCE_INCONCLUSIVE`
- **Deterministic Replay**: **PASS** (Run 1 hash == Run 2 hash)
- **Legacy Reconciliation**: **Outcome C** (Legacy reported 12 trades, Net -$8.80; superseded by canonical real L2+tape causal replay)

### Strategy 3: CVD Divergence Reversal (`orderflow.cvd.divergence.reversal`)
- **Run ID**: `divergence-btcusdt-is-fae40ba4190bd13a`
- **Signals / Orders / Fills / Trades**: 421 / 198 / 198 / 198 (110 Long, 88 Short)
- **Wins / Losses / Flat**: 67 / 131 / 0 (Win Rate: 33.84%)
- **Gross PnL**: `-$49.7282`
- **Fees**: `-$198.0000` (Taker 0.05% entry + Taker 0.05% exit = $1.00/trade @ $1,000 notional)
- **Net PnL**: `-$247.7282`
- **Expectancy**: `-$1.2512 / trade`
- **Profit Factor**: `0.8509` (Gross)
- **Max Drawdown**: `$250.1990`
- **Sample Classification**: `SUFFICIENT_OBSERVATIONS` (198 trades)
- **Research Disposition**: `IS_EVIDENCE_NEGATIVE`, `ECONOMICALLY_FRAGILE`
- **Deterministic Replay**: **PASS** (Run 1 hash == Run 2 hash)
- **Legacy Reconciliation**: **Outcome C** (Legacy reported 118 trades, Net -$127.72; superseded by canonical real L2+tape causal replay)

---

## 4. Daily Net PnL Decomposition (Derived Exclusively from Trade Ledgers)

| Date | Momentum Net PnL | Absorption Net PnL | Divergence Net PnL |
|---|---:|---:|---:|
| 2026-06-23 | -$30.0744 | $0.0000 | -$29.4813 |
| 2026-06-24 | -$0.7552 | -$3.0716 | -$36.9326 |
| 2026-06-25 | -$9.8015 | $0.0000 | -$19.8387 |
| 2026-06-26 | -$2.8684 | $0.0000 | -$47.6755 |
| 2026-06-27 | -$4.1961 | $0.0000 | -$12.0347 |
| 2026-06-28 | -$13.7136 | $0.0000 | -$7.2497 |
| 2026-06-29 | -$10.2831 | $0.0000 | -$24.6074 |
| 2026-06-30 | -$19.5929 | $0.0000 | -$9.6475 |
| 2026-07-01 | -$16.4355 | $0.0000 | -$38.3013 |
| 2026-07-02 | -$29.4667 | $0.0000 | -$21.9597 |
| **Daily Sum** | **-$137.1874** | **-$3.0716** | **-$247.7282** |
| **Aggregate Net PnL** | **-$137.1874** | **-$3.0716** | **-$247.7282** |
| **Accounting Discrepancy** | **$0.0000** | **$0.0000** | **$0.0000** |

---

## 5. Canonical Artifact Provenance & Hashes

All runs were persisted to disk before aggregation with immutable SHA-256 ledgers:

| Strategy | Run ID | Signal Hash | Order Hash | Fill Hash | Trade Hash | Manifest Hash |
|---|---|---|---|---|---|---|
| **Momentum** | `momentum-btcusdt-is-fae40ba4190bd13a` | `cb5f00c6...` | `0a9af338...` | `eaf30b93...` | `2161e7f3...` | `c0a2ff9b...` |
| **Absorption** | `absorption-btcusdt-is-fae40ba4190bd13a` | `4c7875e6...` | `5650265b...` | `24f4da63...` | `e12492b8...` | `fb0458ff...` |
| **Divergence** | `divergence-btcusdt-is-fae40ba4190bd13a` | `cee4965b...` | `427b0087...` | `a776c237...` | `6ceed5c6...` | `c5b7a2b3...` |

Full hashes:
- **Momentum Signals**: `cb5f00c6f49b2e09ebd148c42b6e7909ca6657225fcfede8d0c89506083508a0`
- **Momentum Orders**: `0a9af338d17fc541a177b0d199759bf2d25f3166ac5f15843552d72a1b5c2887`
- **Momentum Fills**: `eaf30b935b00be181468fb6ce148abc58e27f0385f60c1da7e100a69600c13e3`
- **Momentum Trades**: `2161e7f393e7c83f5dabfbe276ec87c21e956f27b5e69ea25bf6c6472aa74875`
- **Momentum Manifest**: `c0a2ff9bf35c699551ba66d1d8ce630311deeb622ecb66c2df14d9f03b1032d3`
- **Absorption Signals**: `4c7875e679299e24fdf968eac38a560b9a5b5a76aaa42d7c3d982075862f09cd`
- **Absorption Orders**: `5650265bd7e9dd5d54a3b31bc68df74f1938a901a9d0e2bbd8bb06919a058868`
- **Absorption Fills**: `24f4da6318d2353d38431f8c4ae255c17498411525b4d0a13b430db93d4002e0`
- **Absorption Trades**: `e12492b81ac687b308097d3fca2d939517c32a4a3ee0b703aa46aec3fc29a0b6`
- **Absorption Manifest**: `fb0458ff73c32730d94e07bc62a0d2272770ff323361081c9942e1098f55c101`
- **Divergence Signals**: `cee4965b219627e18d59f712699b742e04f03fa965f86a303de45aa789ad5bf3`
- **Divergence Orders**: `427b00871442adef6e5300eeda70f897e715db13e3e61b7f82d03c1310996863`
- **Divergence Fills**: `a776c2375a2c128c6092a4f45e0ca8e1958e110a0cac0b4259ab8225787c9146`
- **Divergence Trades**: `6ceed5c6a80eb11fff17a4121f83ad799c9da1914dbd84a577ca3399e6e1d950`
- **Divergence Manifest**: `c5b7a2b3e932af38d767153e69a6ff8904fee4cf5ba581a74b763848c375086e`

---

## 6. Test Suite & Validation

- **Quants-Lab Full Suite**: **102 passed, 0 failed** in 2.10s
- `git diff --check`: **PASS**

---

## 7. Final Gate Disposition

`VAL_02A_FORMAL_CLOSURE_READY: YES`
`HARD_EXTERNAL_BLOCKER: NONE`

All 3 strategies have completed canonical In-Sample replay on real BTCUSDT historical Order Flow data. The evidence is complete, exact, reproducible, and ready for CTO review and decision.

