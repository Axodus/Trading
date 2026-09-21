# AXODUS-TRADING-EPIC-01 / FIX-FINAL-01 — Exact Arithmetic Remediation

**Status:** `REMEDIATED / REVALIDATION REQUIRED`
**Date:** 2026-09-20
**Baseline:** `eae4a57`
**Source finding:** `VAL-FINAL-P0-001`
**Scope:** `TradingHarnessCoordinator` Risk `MODIFY` defense-in-depth checks

## Root Cause

The Harness converted canonical decimal capital strings to JavaScript `Number` before comparing Portfolio-approved capital with TradeProposal-requested capital. Values differing by one canonical atom above the IEEE-754 safe integer range can collapse to the same binary float.

## Remediation

`TradingHarnessCoordinator` now retains economic values in canonical `FixedDecimal` form for applicable Risk `MODIFY` conservation checks. The Harness verifies, without creating a new authority:

```text
Portfolio-approved capital <= proposal-requested capital
Risk-effective capital <= Portfolio-approved capital
TradingIntent-approved capital <= Risk-effective capital
ExecutionIntent-execution capital <= ExecutionIntent-authorized capital <= TradingIntent-approved capital
```

It applies the same exact, fail-closed pattern to applicable quantity and leverage propagation fields. Malformed, non-string, and negative canonical economic values fail with `HarnessAuthorityBypassAttemptError`; absent optional fields are not converted to zero.

## Numeric Audit

| Location | Classification | Result |
|---|---|---|
| `TradingHarnessCoordinator.ts` economic monotonicity | Authoritative economic | `FixedDecimal` only |
| `PostgresTradingHarnessRepository.ts` lease tokens | Non-economic concurrency metadata | `Number` retained |
| Harness run/stage metadata | Non-economic orchestration metadata | no authoritative economic float comparison |

No migration or shared-contract semantic change is required.

## Required Regression Coverage

`val-final-epic01-technical-closure.test.mjs` preserves the original P0 evidence and now covers:

- `Number.MAX_SAFE_INTEGER - 1`, `Number.MAX_SAFE_INTEGER`, and values above it;
- one whole-unit and one 12-decimal-atom capital enlargements;
- equality and lower-value acceptance;
- Risk → TradingIntent and ExecutionIntent capital propagation;
- ExecutionIntent quantity and leverage propagation;
- permitted downstream quantity reduction below a Risk MODIFY authorization;
- malformed and negative canonical values.

## Gate Status

Current validation: focused Harness regression `33 passed, 0 failed, 0 skipped`; full Trading regression `785 passed, 0 failed, 1 skipped`; Quant regression `45 passed`. `VAL-FINAL-P0-001` is **not closed**: `VAL-FINAL-R1` must independently revalidate closure-critical invariants before EPIC-01 can close.

## Preserved Boundaries

- `RiskAuthority` remains the risk decision authority.
- `PortfolioAuthority` remains the allocation authority.
- The Harness remains an orchestration and conformance boundary only.
- No database migration, provider call, Testnet order, Mainnet activity, real capital, or production credential use is part of this remediation.
- `DEBT-AUD-A-03` remains `OPEN / PARTIALLY REMEDIATED`.
