# AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3 — Final Resumed Implementation Handoff

This receipt supersedes the interrupted/partial receipts:
- `20260930T142501Z-AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3-start.md`
- `20260930T163000Z-AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3-complete.md`
- `20260930T174500Z-AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3-final.md`

### Global Coordination Handoff

- Workspace: Trading; implementation owners are `quants-lab` and `condor` submodules.
- Handoff ID / time: `AXODUS-TRADING-IMP-MICROTREND-SCALPER-V3` / `2026-09-30T18:00:00Z`
- Request / branch / HEAD: Trading `dev` at `fb6178506c79d40bc8aaf7ab50e43fa4224ffa46` (with `quants-lab` and `condor` submodules containing uncommitted work); Quants-Lab `main` at `8cef99678521dcff613f0c163943bf128d81ac9d`; Condor `main` at `044a51522c93b7524e8a918129cf28df0f85ed37`; all worktree changes uncommitted.
- Scope: Canonical Microtrend Scalper v3 implementation; exact Decimal WMA50; generic fee-aware closed-trade feedback; typed Jev reason-code integration; strategy registration; deterministic unit/regression coverage; partial position close audit and cost basis reproduction.
- Local status: `LOCAL_VALIDATED_PENDING_CTO_REVIEW`.
- Validation:
  - Quants-Lab focused suites: `58 passed, 5 subtests passed` in `0.76s` (`test_quant_microtrend_scalper.py`, `test_quant_simulation_closed_trade.py`, `test_quant_simulation.py`, `test_quant_foundations.py`, `test_quant_baseline_microprice_strategy.py`).
  - Quants-Lab non-parquet research suites: `31 passed` in `0.80s` (`test_quant_data.py`, `test_quant_validation.py`, `test_quant_robustness.py`, `test_quant_promotion.py`).
  - Condor relevant Jev/orderflow suites: `27 passed` in `5.99s` (`test_jev_orderflow_integration.py`, `test_orderflow_orchestrator.py`, `test_real_jev_client.py`, `test_quant_deployment_gate.py`).
  - Environment Limitation: Full Quants-Lab test collection in the default environment is interrupted by missing non-standard dependencies (`pyarrow`, `optuna`) which were not pre-installed into the system Python. No ad-hoc packages were injected into system Python.
- Changed local records: this handoff receipt.
- Dependencies: Quants-Lab strategy consumes generic closed-trade results from `SimulationEngine` and produces `CandidateTriggerV1` towards Jev; Condor maps `MicrotrendJevReasonCode` to/from `JevDecisionV1` while preserving orderflow compatibility.
- Blockers / risks: None. Strategy, accounting, and Jev contracts are intact and verified by deterministic unit and regression tests.
- Priority impact: Current priority unchanged.
- Portfolio action: CTO review of uncommitted implementation.
- Boundaries preserved: No commit, push, merge, deployment, paper/live activation, remote orders, credentials, or real capital.

## 1. Partial diff reconciliation

All existing uncommitted changes in `quants-lab` and `condor` were inspected, classified, and retained:
- `quants-lab/core/quant_strategies/indicators.py`: VALID_IMP_WORK (exact Decimal WMA, EMA, step_bps, distance_bps).
- `quants-lab/core/quant_strategies/microtrend/*`: VALID_IMP_WORK (Microtrend state machine, regime tracking, Jev integration, registry identity).
- `quants-lab/core/quant_optimization/strategy.py`: VALID_IMP_WORK (bounded strategy registry integration).
- `quants-lab/core/quant_simulation/models.py`: VALID_IMP_WORK (generic `ClosedTradeResult`, optional callback protocol, simulation result metrics).
- `quants-lab/core/quant_simulation/engine.py`: VALID_IMP_WORK (lifecycle invocation after fee-aware economics finalization).
- `quants-lab/core/quant_simulation/__init__.py`: VALID_IMP_WORK (public export of `ClosedTradeResult`).
- `quants-lab/tests/test_quant_simulation_closed_trade.py`: VALID_IMP_WORK (lifecycle ordering, partial-close cost-basis tests, and partial reduction followed by position addition).
- `quants-lab/tests/test_quant_microtrend_scalper.py`: VALID_IMP_WORK (full functional, causality, cooldown, and determinism test matrix).
- `condor/condor/jev_qualification.py`: VALID_IMP_WORK (backward-compatible `MicrotrendJevReasonCode` mapping).
- `condor/tests/test_jev_orderflow_integration.py`: VALID_IMP_WORK (typed Jev contract roundtrip and fail-closed tests).

## 2. Partial position close review

- Invariant tested: an ordinary reduction of an existing position without crossing zero must preserve the residual average entry price and cost basis.
- Reproduction result: `DEFECT_REPRODUCED: NO`. Both LONG and SHORT partial reductions maintain `position.average_entry` unchanged while realizing PnL solely on closed quantity. Subsequent additions adjust average entry as a weighted average of remaining basis and new fill price.
- Generic simulation fix: `NOT_APPLIED` (current canonical `SimulationEngine._apply_fill` is mathematically correct for reductions; explicit tests added in `tests/test_quant_simulation_closed_trade.py`).

## 3. Microtrend v3 contract delivery

- Completed 1m candles only; 50-candle warmup required for WMA50; exact Decimal arithmetic throughout.
- Initial arming requires 3 consecutive completed candles with identical ordering and non-flat direction.
- Normal entries occur only when candle close is within proximity of EMA9 or EMA21 while EMA9 remains aligned.
- EMA9 weakening blocks new entries; two opposing steps or crossover into EMA21 transitions to `PULLBACK_WAIT`.
- Pullback crossing into EMA21 or WMA50 triggers Jev at most once per episode, giving EMA21 priority if both match.
- Jev consumes existing canonical microstructure features; invalid/stale/gapped/insufficient/future data fails closed.
- Closed trades emit fee-aware `net_pnl`; 2 consecutive net losses trigger an exact 15-minute non-blocking cooldown; break-even preserves the streak.

## 4. Safety boundaries preserved

- `microstructure-v1.1` unchanged.
- `microprice-disp-v1` unchanged.
- Legacy EMA historical provenance unchanged.
- Condor orderflow strategy semantics unchanged.
- Remote exchange orders: 0; real capital: 0.
