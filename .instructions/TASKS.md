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
