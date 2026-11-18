# AXODUS TRADING — ACTIVE TASKS

## Current Task
- **ID:** `AXODUS-TRADING-FIX-IMP02-01`
- **Description:** External-mutation test isolation after the PAPER SHADOW scope violation.
- **Status:** `COMMITTED / CTO REVIEW REQUIRED`.
- **Validation:** Focused guard tests, typecheck, build, safe default regression, diff hygiene and secret scan passed before commit.
- **Commit:** `8418a2cf588cb8727c0a6c369719d40587841205`.
- **Next Task:** CTO review decides publication/push disposition.

## Current Experimental Follow-up
- **ID:** `AXODUS-TRADING-IMP-02 PAPER SHADOW`
- **Status:** `R2 COMPLETE / CTO ACCEPTED`; R3 `AUTHORIZED IN PRINCIPLE / IN PROGRESS`.
- **Result:** R2 accepted at commit `4d98c6311a9f3771acbedf281f26a4984cc7efc7`. R3 target: 100-200 distributed PAPER observations, expanded stability, and deterministic comparator over the same t0 OHLCV feature snapshot. Testnet remains blocked.

## Preserved Closure
- `AXODUS-TRADING-EPIC-01`: `TECHNICALLY COMPLETE / CTO ACCEPTED`.
- `VAL-FINAL-P0-001`: `CLOSED`.
- `DEBT-AUD-A-03`: `RESOLVED / CTO ACCEPTED (FIX-02)`.

## AXODUS-TRADING-VAL-QUANT-ORDERFLOW-OOS-01

- **Status:** `COMPLETE / CTO REVIEW READY`.
- **Scope:** Multi-symbol OOS evaluation for ZECUSDT, SUIUSDT, and WLDUSDT across Momentum Aggression, Absorption Fade, and CVD Divergence Reversal.
- **Validation:** 9/9 deterministic cells; 170/170 Quants-Lab tests; Trading Core SAFE test graph passed; causal frame integrity passed for all symbols.
- **Disposition:** 8 negative cells; WLD Absorption positive under unproven maker queue assumptions; all Testnet/Mainnet routing blocked.
- **Next decision:** CTO review only. No commit or push authorized by this request.

## AXODUS-TRADING-IMP-EXECUTION-AUTHORITY-CONTEXT-01

- **Status:** `ACCEPTED / LOCAL_VALIDATED`; local commit authorized, push prohibited.
- **Scope:** Canonical immutable execution authority context for the protected Trading execution boundary.
- **Delivered:** explicit `executionIntentId`, `tenantId`, `principalRef`, `action`, `resource`, request time, optional Governance/Treasury references, validation, binding checks and ACS propagation.
- **Preserved:** no Governance resolution, Treasury authorization, Core schema change, real order, capital movement, deployment or push.
- **Blocker disposition:** `BLOCKER_GOV_INT_01` resolved at local implementation level; `BLOCKER_GOV_INT_02` remains open for executable Treasury authorization runtime.
- **Integration debt:** `DEBT_TRADING_AUTH_01` remains open until composition boundaries parse wire values into canonical Core/Governance reference types without duplicating those types in Trading.
- **Follow-up:** implement `AXODUS-TREASURY-IMP-EXECUTABLE-AUTHORITY-01`; resume `IMP-GOV-INTEGRATION-01` only after Treasury executable authority is available.

## AXODUS-TRADING-REQ-DEV-OPERATION-PLANNING-01 — Futures P0

- **Status:** `P0_CTO_REVIEW_PENDING / REAL_EXECUTION_HOLD`.
- **Delivered:** [static route inventory and contract proposals](reports/AXODUS-TRADING-DEV-FUTURES-P0.md), plus [account feasibility worksheet](reports/AXODUS-TRADING-DEV-FUTURES-P0-RISK.md).
- **Next decision:** Binance personal account reported; select exact contract excluding ONEUSDT/BTCUSDT and establish jurisdiction, authorized account evidence, usable Futures collateral, capital/risk envelope and host disposition before CTO review. Public filters are not account eligibility. P1/P2/P3 implementation and the real-capital DEV-M0 gate require separate authority.
