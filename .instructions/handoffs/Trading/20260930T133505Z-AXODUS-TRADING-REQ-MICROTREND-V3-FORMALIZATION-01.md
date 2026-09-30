# AXODUS-TRADING-REQ-MICROTREND-V3-FORMALIZATION-01 — Architecture / Quantitative Handoff

- Workspace: Trading / quants-lab with Condor as Jev-contract owner
- Handoff ID / time: AXODUS-TRADING-REQ-MICROTREND-V3-FORMALIZATION-01 / 2026-09-30T13:35:05Z
- Request / branch / HEAD: REQ-MICROTREND-V3-FORMALIZATION-01; Trading `dev` at `de9226ddd08b3c65a0fbc7b2cf4870a0e18045de`; quants-lab `main` at `8cef99678521dcff613f0c163943bf128d81ac9d`; Condor at `044a51522c93b7524e8a918129cf28df0f85ed37`
- Scope: Read-only formalization of moving-average direction, proximity, EMA9 divergence, structural validity, Jev pullback qualification, and cooldown integration needed before a Microtrend v3 implementation request.
- Local status: CTO_REVIEW_READY / IMPLEMENTATION_NOT_AUTHORIZED
- Validation: Condor Jev/orderflow contract tests: `11 passed in 2.56s`. Quants focused suite was environment-blocked at collection: system Python has neither `optuna` nor `pyarrow`; no project virtual environment was found. No source or dependency changes made.
- Changed local records: `.instructions/handoffs/Trading/20260930T133505Z-AXODUS-TRADING-REQ-MICROTREND-V3-FORMALIZATION-01.md` only.
- Dependencies: Quants-Lab owns candle/research strategy and microstructure snapshots; Condor owns `CandidateTriggerV1 -> JevDecisionV1`; a future Microtrend implementation needs a bounded closed-trade feedback extension for the fixed loss-streak gate.
- Blockers / risks: Existing Jev protocol has only `NO_ACTION`, `SIGNAL_REJECTED`, and `SIGNAL_QUALIFIED`, with unbounded reason codes and no confidence field. It cannot currently enforce typed `CONTINUATION`, `REVERSAL_RISK`, `NEUTRAL`, and `INVALID` semantics. `StrategySimulator.decide(state, position_quantity)` has no closed-trade net-PnL feedback, so the two-net-loss cooldown cannot be faithfully owned by a strategy alone.
- Priority impact: Current priority unchanged; CTO should freeze the two narrow interface decisions before authorizing an IMP.
- Portfolio action: Root coordinator should record this REQ as CTO review ready; no maturity or execution authority change.
- Boundaries preserved: No implementation, backtest, optimization, paper/live mutation, credential access, remote order, real capital, commit, push, merge, or deployment.

## Formalization recommendation

### Closed candle and initialization

All moving-average and proximity transitions use completed 1-minute candles only. Require at least 50 completed candles before evaluating EMA9, EMA21, and WMA50. Candle close is the sole proximity price; intrabar high/low and wick touches are not entry or Jev triggers.

### Moving-average direction

For MA `m` and completed candle `t`, define `step_bps(m,t) = (m[t] - m[t-1]) / m[t-1] * 10000` with positive finite denominator. With calibratable `ma_flat_epsilon_bps`:

- UP: `step_bps >= +epsilon`
- DOWN: `step_bps <= -epsilon`
- FLAT: otherwise

Arming requires two consecutive compatible closed-candle steps: EMA9, EMA21, and WMA50 must each be UP over `t-2 -> t-1` and `t-1 -> t` for LONG; each must be DOWN over both steps for SHORT. Ordering is also required at `t-2`, `t-1`, and `t`.

### Proximity

Use Decimal bps distance: `distance_bps(close, ma) = abs(close - ma) / ma * 10000`. Four independent nonnegative calibratable contracts are required: `ema9_entry_proximity_bps`, `ema21_entry_proximity_bps`, `ema21_pullback_proximity_bps`, and `wma50_pullback_proximity_bps`. The legacy ATR feature is pandas/float-oriented and is not established as canonical fixed-decimal simulation input, so it should not be reused as authoritative proximity semantics.

### EMA9 state

For a LONG regime, structural validity is only `EMA21 > WMA50`; for SHORT it is only `EMA21 < WMA50`, preserving the approved design. EMA9 is ALIGNED when it remains on its trend side of EMA21 and its current step has the regime direction. One opposite/flat step is WEAKENING and blocks entries. Two consecutive opposite-direction steps, or loss of the EMA9/EMA21 directional ordering, is DIVERGED and transitions to PULLBACK_WAIT. Two consecutive original-direction steps while EMA9 has recovered its side of EMA21 are RECONVERGING then ARMED; entries remain blocked until the second confirming step. Structural invalidation returns to UNARMED and requires a fresh three-candle arm.

### Jev trigger and outcomes

Jev is invoked once per pullback episode when a completed candle enters (outside-to-inside) the EMA21 or WMA50 pullback zone after DIVERGED. If both zones are entered on the same close, EMA21 is the canonical reference. A new pullback episode begins only after price has left both zones and a new divergence occurs.

Candidate evidence should carry the latest causal canonical microstructure snapshots through an empirically derived observation window: `signed_queue_imbalance_L1`, `normalized_OFI_L5`, `normalized_weighted_pressure`, `aggression_imbalance`, `signed_volume_velocity`, optional sweep/absorption evidence, and book-validity/sequence/staleness metadata. No Jev-local recalculation of market microstructure is warranted.

For regime direction `d` (`+1` LONG, `-1` SHORT), an observation supports continuation if at least `minimum_agreement_features` sign-normalized canonical features meet their separately empirically derived thresholds. It supports reversal risk if the opposing sign does so. Over one fixed causal window, continuation/reversal require `valid_observation_count >= min_observations` and corresponding support fraction `>= min_persistence_ratio`; otherwise the result is NEUTRAL. Invalid book, stale/invalid feature state, gap/crossed/empty-book state, missing required values, or insufficient valid observations is INVALID. Confidence is `NONE_V1`; no unsupported pseudo-probability is permitted.

Current `JevDecisionV1` cannot express those results as a typed field. A future IMP needs a narrow Condor-owned reason-code enum/mapping: `CONTINUATION_*`, `REVERSAL_RISK_*`, `NEUTRAL_*`, `INVALID_*`, mapped to the frozen outer decision contract without creating a second Jev API. Invalid must originate locally from data-quality failure and fail closed.

### Cooldown

The independent rule remains: after two consecutive closed trades with net PnL `< 0`, block new entries for 15 minutes; market processing, Jev processing, and exit management remain active. Net PnL `> 0` resets the streak. Break-even semantics remain CTO_FREEZE_REQUIRED. A new evaluation segment/backtest resets streak and cooldown. Current `StrategySimulator` exposes only market state and position quantity, not closed-trade net PnL; a future IMP must add bounded generic closed-trade feedback or place the cooldown in an existing simulation risk/controller boundary. It must not infer losses from price alone.
