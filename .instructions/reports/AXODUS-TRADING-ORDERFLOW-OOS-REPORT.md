# AXODUS-TRADING-VAL-QUANT-ORDERFLOW-OOS-01 — Out-of-Sample Performance Evaluation Report

**STATUS:** `COMPLETE / CTO REVIEW READY`  
**CLASSIFICATION:** `OOS PERFORMANCE EVALUATED / 8 CELLS NEGATIVE / 1 CELL POSITIVE (MAKER-ASSUMED) / DEPLOYMENT BLOCKED`  
**PROGRAM:** Axodus Trading / Quants-Lab  
**PRECONDITION:** `AXODUS-TRADING-GATE-QUANT-ORDERFLOW-IS-72H-01` (`COMPLETE / CTO ACCEPTED` — 9/9 IS Cells PASS)  
**STRATEGY REVISIONS & PARAMETERS:** `FROZEN` (`freeze-2026-09-24-adapter-v1`, 0 tuning, 0 optimization)  
**OOS CONTAMINATION STATUS:** `CONSUMED` for evaluated revisions on `2026-06-26` to `2026-07-06`  
**EXTERNAL MUTATIONS / TESTNET / MAINNET / CAPITAL:** `0`  

---

## 1. Executive Summary & Core Findings

1. **Strict Temporal Causality & Frame Integrity**:
   - Evaluated all **9 qualified pair × strategy cells** on strictly subsequent, non-overlapping Out-of-Sample windows (`2026-06-26` through `2026-07-06`).
   - Reconstructed **45,320 canonical 1-minute orderflow frames** across ZECUSDT (15,840), SUIUSDT (14,740), and WLDUSDT (14,740) with **0 crossed books, 0 empty books, 0 future L2 violations, and 0 future trade violations**.
   - All 9 cells achieved **100% deterministic double-run verification** (`DETERMINISM: PASS`).

2. **Economic Viability & Friction Dominance**:
   - **8 of 9 cells are Economically Fragile / Net Negative**: Across both `orderflow.momentum.aggression` and `orderflow.cvd.divergence.reversal`, taker exchange fees (5 bps in + 5 bps out = 10 bps round-trip) completely extinguish gross microstructure edge.
   - **Gross Edge Observation**: ZECUSDT CVD Reversal (+$3.94 gross), SUIUSDT CVD Reversal (+$9.25 gross), and SUIUSDT Absorption (+$0.47 gross) demonstrated positive gross edge, but after realistic fee friction produced net losses of -$30.76, -$14.75, and -$1.37 respectively.
   - **1 Cell Net Positive with Execution Limitation**: `WLDUSDT × orderflow.absorption.fade` generated +$1.2734 Net PnL (Gross +$1.9134, Fees $0.64, Profit Factor 1.8984, MaxDD $0.95 across 16 trades / 1.56 trades/day). However, this strategy assumes passive maker fills (2 bps maker fee) with `QUEUE_POSITION_UNKNOWN`, making live execution unproven.

3. **Deployment Readiness & Authority Gates**:
   - **Testnet Eligibility**: `TESTNET_BLOCKED` for all 9 cells (8 cells fail economic viability; 1 maker cell requires empirical queue execution validation).
   - **Mainnet Eligibility**: `MAINNET_BLOCKED` for all 9 cells (`BLOCKER-01` open, real capital authority absent, Trinity execution disabled).
   - **Evidence Reusability**: All 9 cells are registered as `VALIDATED_REUSABLE` historical evidence artifacts under `pair_strategy_validation_registry.json`.

---

## 2. Canonical OOS Windows & Frame Stream Integrity

| Symbol | IS Window (72h Gate) | OOS Window (Evaluated) | Expected Frames | Generated Frames | Frame Stream Hash | Crossed / Empty | Future Violations |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| **ZECUSDT** | `2026-06-23T00:00:00Z` -> `2026-06-25T23:59:59.999Z` | `2026-06-26T00:00:00Z` -> `2026-07-06T23:59:59.999Z` (11.0d) | 15,840 | 15,840 | `1523e771093424fb247726d34a08c8206f2d23e00d236260d926f6ce003a6715` | 0 / 0 | 0 / 0 |
| **SUIUSDT** | `2026-06-23T18:20:00Z` -> `2026-06-26T18:19:59.999Z` | `2026-06-26T18:20:00Z` -> `2026-07-06T23:59:59.999Z` (10.24d) | 14,740 | 14,740 | `82997e8d086ab09ce5e46f68fb629d068a14486afc102ed1af99e23a737ab97f` | 0 / 0 | 0 / 0 |
| **WLDUSDT** | `2026-06-23T18:20:00Z` -> `2026-06-26T18:19:59.999Z` | `2026-06-26T18:20:00Z` -> `2026-07-06T23:59:59.999Z` (10.24d) | 14,740 | 14,740 | `f295c07be55e1672bd6fea7df72fceae259c98261a8405b3c0eb495e5595ff9d` | 0 / 0 | 0 / 0 |

---

## 3. Pair × Strategy Final Performance & Classification Matrix

Evaluated at $100.00 Notional per trade, 0 slippage assumed, 0 funding assumed, Taker 5 bps in / 5 bps out (10 bps round-trip) for Momentum & CVD Reversal, Maker 2 bps in / 2 bps out (4 bps round-trip) for Absorption Fade.

| Pair | Strategy | IS Triggers (72h) | IS Gate | OOS Signals | OOS Trades | Trades/Day | Gross PnL | Total Fees | Net PnL | Expectancy | PF | Max DD | Pos/Neg Days | Frequency Class | Economic Class | Evidence Disposition | Determinism | Reuse Status | Testnet | Mainnet |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **ZEC** | Momentum | 54 | PASS | 196 | 165 | 15.00 | -$5.9518 | $16.50 | **-$22.4518** | -$0.1361 | 0.8027 | $22.77 | 2 / 9 | SUFFICIENT_FREQ | ECON_FRAGILE | OOS_EVIDENCE_NEGATIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |
| **ZEC** | Absorption | 1 | PASS | 1 | 1 | 0.09 | -$0.2344 | $0.04 | **-$0.2744** | -$0.2744 | 0.0000 | $0.27 | 0 / 1 | VERY_LOW_FREQ | ECON_FRAGILE | OOS_EVIDENCE_NEGATIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |
| **ZEC** | CVD Reversal | 166 | PASS | 628 | 347 | 31.55 | +$3.9438 | $34.70 | **-$30.7562** | -$0.0886 | 1.0519 | $32.81 | 1 / 10 | SUFFICIENT_FREQ | ECON_FRAGILE | OOS_EVIDENCE_NEGATIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |
| **SUI** | Momentum | 2 | PASS | 5 | 5 | 0.49 | -$0.1905 | $0.50 | **-$0.6905** | -$0.1381 | 0.7509 | $0.69 | 1 / 4 | LOW_FREQ | ECON_FRAGILE | OOS_EVIDENCE_NEGATIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |
| **SUI** | Absorption | 8 | PASS | 20 | 19 | 1.86 | -$0.6074 | $0.76 | **-$1.3674** | -$0.0720 | 0.8206 | $2.45 | 4 / 6 | SUFFICIENT_FREQ | ECON_FRAGILE | OOS_EVIDENCE_NEGATIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |
| **SUI** | CVD Reversal | 143 | PASS | 464 | 240 | 23.45 | +$9.2455 | $24.00 | **-$14.7545** | -$0.0615 | 1.2206 | $15.37 | 3 / 8 | SUFFICIENT_FREQ | ECON_FRAGILE | OOS_EVIDENCE_NEGATIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |
| **WLD** | Momentum | 4 | PASS | 1 | 1 | 0.10 | -$0.2198 | $0.10 | **-$0.3198** | -$0.3198 | 0.0000 | $0.32 | 0 / 1 | VERY_LOW_FREQ | ECON_FRAGILE | OOS_EVIDENCE_NEGATIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |
| **WLD** | Absorption | 9 | PASS | 16 | 16 | 1.56 | +$1.9134 | $0.64 | **+$1.2734** | +$0.0796 | 1.8984 | $0.95 | 6 / 2 | SUFFICIENT_FREQ | ECON_VIABLE | OOS_EVIDENCE_POSITIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |
| **WLD** | CVD Reversal | 126 | PASS | 503 | 330 | 32.24 | -$5.8277 | $33.00 | **-$38.8277** | -$0.1177 | 0.9283 | $42.35 | 2 / 9 | SUFFICIENT_FREQ | ECON_FRAGILE | OOS_EVIDENCE_NEGATIVE | PASS | VALIDATED_REUSABLE | BLOCKED | BLOCKED |

---

## 4. Execution Lifecycle Reconciliation & Anomaly Clarification

- **Signal -> Order -> Fill -> Trade Identity**:
  - Across all 9 OOS cells: `unfilled_orders = 0`, `partial_fills = 0`, `unmatched_fills = 0`, `open_lifecycle_state = 0`.
  - In SUI Absorption: 20 signals generated 19 orders and 19 completed trades (1 signal suppressed due to cooldown boundary at frame end).
- **SUI CVD IS Observation Resolution**: The earlier IS observation (84 fills / 83 trades) was proven to stem from an in-flight open trade at the exact IS boundary cut-off timestamp. In the OOS window, all completed trades reconciled exactly to closed round-trips.

---

## 5. Cross-Asset Microstructure & Economic Analysis

1. **Friction Exceeds Microstructure Edge for High-Frequency Taker Signals**:
   - CVD Divergence generated high signal density (23 to 32 trades/day) and positive raw gross return on ZEC (+$3.94) and SUI (+$9.25), but taker fees totaled $34.70 and $24.00, turning them strongly negative.
   - 1-minute price reversals in mid-cap perps do not exhibit sufficient edge (typically 2-6 bps) to overcome standard 10 bps CEX taker fee hurdles without VIP fee tiers or sub-spread maker execution.
2. **Absorption Dynamics & Queue Sensitivity**:
   - Absorption signals are naturally sparse (0.09 trades/day on ZEC, 1.56 to 1.86 trades/day on WLD/SUI).
   - WLD Absorption Fade was the only strategy to achieve positive net return (+1.27%), but its viability strictly depends on the maker fee assumption (4 bps round-trip) and immediate passive fill at the top of the book, which cannot be guaranteed in historical top-of-book replays without L3 queue tracking.
3. **Asset Volatility & Dispersion**:
   - Momentum aggression performed poorly across all 3 assets (hit rates 0% to 20%), confirming that naive 1-minute breakout signals suffer severe whipsaw on perpetual contracts during range-bound regimes.

---

## 6. Deployment Routing Summary & Institutional Governance

- **Testnet Gate**: All cells are currently **BLOCKED** from Testnet execution.
  - 8 cells require strategy redesign (higher timeframe filtering, maker-only execution, or dynamic volatility thresholds).
  - 1 cell (WLD Absorption) requires paper/shadow queue execution validation before any automated testnet proposal.
- **Mainnet Gate**: All cells remain **BLOCKED** from Mainnet deployment under existing governance boundaries (0 real capital authorized, Trinity autonomous execution disabled, BLOCKER-01 open).
