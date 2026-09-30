# AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3 — Final Implementation Handoff

This receipt supersedes the earlier partial and in-progress handoffs for AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3:
- `20260930T142501Z-AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3-start.md`
- `20260930T163000Z-AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3-complete.md`
- `20260930T174500Z-AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3-final.md`
- `20260930T180000Z-AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3-handoff.md`

### Global Coordination Handoff

- Workspace: Trading; implementation owners are `quants-lab` and `condor` submodules.
- Handoff ID / time: `AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3` / `2026-09-30T19:30:00Z`
- Request / branch / HEAD: Trading `dev` at `fb6178506c79d40bc8aaf7ab50e43fa4224ffa46` (with uncommitted changes in `quants-lab` and `condor`); Quants-Lab `main` at `8cef99678521dcff613f0c163943bf128d81ac9d`; Condor `main` at `044a51522c93b7524e8a918129cf28df0f85ed37`.
- Scope: Implementation of the canonical `trend.microtrend.scalper` (`microtrend-v3`), exact Decimal WMA50, state machine, generic closed-trade lifecycle notification, backward-compatible Jev pullback classification, strategy registry wiring, audit of partial position close cost basis, and full test suite validation.
- Local status: `LOCAL_VALIDATED_PENDING_CTO_REVIEW`.
- Validation:
  - Quants-Lab focused suites: `40 passed, 5 subtests passed in 0.72s` (`tests/test_quant_simulation_closed_trade.py`, `tests/test_quant_microtrend_scalper.py`, `tests/test_quant_simulation.py`).
  - Quants-Lab subsystem validation: `170 passed, 5 subtests passed in 245.19s` (`test_quant_simulation.py`, `test_quant_simulation_closed_trade.py`, `test_quant_microtrend_scalper.py`, `test_quant_baseline_microprice_strategy.py`, `test_quant_foundations.py`, `test_quant_optimization_integration.py`, `test_quant_validation.py`, `test_quant_robustness.py`, `test_quant_promotion.py`, `test_market_microstructure.py`, `test_market_microstructure_quant_integration.py`).
  - Quants-Lab full canonical test suite: `336 passed, 5 subtests passed in 267.86s` (`tests` and `research_notebooks/orderflow_backtest`).
  - Condor full test suite: `5763 passed, 23 skipped in 777.36s`.
- Changed local records: this receipt (`.instructions/handoffs/Trading/20260930T193000Z-AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3-final.md`).
- Dependencies: Quants-Lab owns the strategy state machine, exact Decimal indicators, and closed-trade callback integration; Condor owns `MicrotrendJevReasonCode` mapping into `JevDecisionV1`.
- Blockers / risks: None.
- Priority impact: Current priority unchanged.
- Portfolio action: CTO review of uncommitted implementation.
- Boundaries preserved: No commit, push, merge, deployment, paper/live activation, remote orders, credentials, or real capital.

## 1. Partial diff reconciliation

All uncommitted changes in the worktree were audited, reconciled, and validated:
- `quants-lab/core/quant_strategies/indicators.py` (VALID_IMP_WORK): exact Decimal WMA, EMA, step_bps, distance_bps.
- `quants-lab/core/quant_strategies/microtrend/__init__.py` (VALID_IMP_WORK): public exports and module initialization.
- `quants-lab/core/quant_strategies/microtrend/microtrend_scalper.py` (VALID_IMP_WORK): complete Microtrend v3 state machine, entry proximity, divergence, structural pullback, causal Jev request construction, decision consumption, and cooldown gate.
- `quants-lab/core/quant_optimization/strategy.py` (VALID_IMP_WORK): canonical strategy registration under `trend.microtrend.scalper` / `microtrend-v3` with immutable implementation hash.
- `quants-lab/core/quant_simulation/models.py` (VALID_IMP_WORK): generic `ClosedTradeResult` dataclass and optional `ClosedTradeFeedbackStrategy` protocol.
- `quants-lab/core/quant_simulation/engine.py` (VALID_IMP_WORK): post-fill fee-aware closed-trade finalization, metric recording, and synchronous strategy callback before the next decision.
- `quants-lab/core/quant_simulation/__init__.py` (VALID_IMP_WORK): export of `ClosedTradeResult`.
- `quants-lab/tests/test_quant_simulation_closed_trade.py` (VALID_IMP_WORK): regression tests for partial close cost basis, fee attribution, sequential reductions, and callback timing.
- `quants-lab/tests/test_quant_microtrend_scalper.py` (VALID_IMP_WORK): 40 unit and scenario tests covering indicators, 3-candle arming, proximity, weakening, divergence, structural trend preservation, Jev qualification, loss streak, and determinism.
- `condor/condor/jev_qualification.py` (VALID_IMP_WORK): backward-compatible reason code enum and helper function for Microtrend Jev outcomes.
- `condor/tests/test_jev_orderflow_integration.py` (VALID_IMP_WORK): unit coverage ensuring existing orderflow Jev contracts remain unaffected and reason codes roundtrip deterministically.

## 2. Partial position close review

- The cost-basis behavior was audited in `SimulationEngine._apply_fill`.
- For ordinary reductions (LONG or SHORT) that do not cross through zero:
  - Realized PnL is recognized only on the closed quantity: `closing * (fill.price - position.average_entry) * (1 if old > 0 else -1)`.
  - Cash is credited appropriately with fill fee deducted.
  - `position.average_entry` remains strictly unchanged for the residual position.
  - Subsequent additions correctly compute the weighted average between remaining basis and the new fill.
  - Only a true reversal crossing zero closes the active trade, clears previous basis, and initializes the opposite position at the execution price.
- Finding: `DEFECT_REPRODUCED: NO`. Canonical accounting already preserves cost basis on partial reductions.
- Dedicated regression tests were added to `tests/test_quant_simulation_closed_trade.py` to guarantee this invariant permanently.

## 3. Microtrend Scalper v3 contract compliance

- Structural Moving Averages: EMA9, EMA21, and exact Decimal WMA50; completed 1m candles only; 50-candle warmup required.
- Three-Candle Arming: requires 3 consecutive closed candles with uniform ordering and directional slope (`step_bps >= +epsilon` for LONG, `<= -epsilon` for SHORT).
- Normal Entry Proximity: evaluated on completed candle close against EMA9 or EMA21 using exact bps distance; no intrabar or wick execution.
- Weakening & Divergence: one non-aligned candle weakens; two opposing steps or crossover into EMA21 marks divergence and suspends new entries.
- Structural Pullback: `EMA21 > WMA50` (LONG) or `EMA21 < WMA50` (SHORT) maintains the regime; invalidation resets to UNARMED.
- Jev Integration: invoked at most once per pullback episode upon causal crossing into EMA21 or WMA50 bands; consumes existing canonical microstructure features; invalid/stale/future data fails closed.
- Closed-Trade Cooldown: two consecutive net losses trigger an exact 15-minute non-blocking cooldown based on canonical `net_pnl`; break-even preserves the streak.

