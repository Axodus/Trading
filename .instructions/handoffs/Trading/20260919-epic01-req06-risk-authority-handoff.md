# AXODUS-TRADING-EPIC-01 / REQ-06  14 FINAL HANDOFF

**TYPE:** REQ / HARNESS IMPLEMENTATION HANDOFF  
**EPIC:** AXODUS-TRADING-EPIC-01  14 Trading Harness Foundations  
**STATUS:** COMPLETE / CTO REVIEW REQUIRED  
**BASELINE COMMIT:** 2b3e65492e76f9d3b8417dc6dbbe3c09b0a1a0ec  
**TRADING REMEDIATION BASELINE:** 04db712fc98ac5c72f663082320104403ae692fb  
**QUANTS-LAB REMEDIATION BASELINE:** 304de8e0862b392c024a8b7de05f1a9e19058ed6  
**FINAL WORKTREE:** DIRTY (validated files present, host manual commit required due to read-only sandbox)  
**SHARED CONTRACT FREEZE:** AXODUS-TRADING-CROSS-EPIC-SCF-01  
**SCF-01 SEMANTIC CHANGE REQUIRED:** NO  
**EPIC-01 REQ-07 READY:** YES  

---

## 1. Executive Summary

REQ-06 establishes the canonical deterministic, non-agentic **Risk Authority** for Axodus Trading. It sits strictly between `PortfolioDecision` and future `TradingIntent`:

```text
MarketObservation
        !93
Normalization
        !93
MarketState
        !93
Opportunity
        !93
StrategyContext
        !93
Strategy Specialist
        !93
TradeProposal
        !93
Portfolio / Capital Allocator
        !93
PortfolioDecision
        !93
%0c%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%00%10
%02       RISK AUTHORITY        %02
%02                             %02
%02 deterministic               %02
%02 policy-driven               %02
%02 fail-closed                 %02
%02 evidence-producing          %02
%02 non-agentic authority       %02
%14%00%00%00%00%00%00%00%00%00%00%00%00%00%00%2c%00%00%00%00%00%00%00%00%00%00%00%00%00%00%18
               !93
          RiskDecision
               !93
      [FUTURE BOUNDARY]
               !93
          TradingIntent (STOP  14 OUT OF SCOPE)
```

The Risk Authority is non-agentic authority. Agents propose risk, Portfolio allocates capital, but only Risk Authority may authorize exposure.

---

## 2. Dependency Classification

- `FixedDecimal` (12 decimal places, BigInt-backed): **REUSE** (preserves AUD-A-01 exact financial arithmetic).
- `RiskDecision` / `RiskDecisionOutcome` (from `@axodus/trading-contracts`): **REUSE** (conforms to frozen SCF-01 contracts).
- `validateRiskDecision`: **REUSE** (pure schema and invariant validator).
- `validateRiskEvaluationContext` / `validateRiskDecisionProperties`: **NEW** (validates evaluation context, monotonicity, and kill-switch consistency).
- `RiskAuthorityService`: **NEW** (canonical deterministic policy evaluation engine).
- `TradingIntent` / Execution Adapters: **REJECT / OUT OF SCOPE** (strictly stopped at RiskDecision).

---

## 3. Architecture & Core Invariants

1. **Deterministic Disposition Precedence:**
   Evaluates rules deterministically with precedence: `HALT > REJECT > MODIFY > ALLOW`.
2. **Explicit Halt Scopes:**
   Supports typed halt scopes: `PROPOSAL`, `STRATEGY`, `INSTRUMENT`, `PORTFOLIO`, `SYSTEM`. Kill switch engages `SYSTEM` halt; portfolio inconsistency engages `PORTFOLIO` halt.
3. **Exact Arithmetic (AUD-A-01):**
   All financial values, limits, and exposures are evaluated via `FixedDecimal`. Zero IEEE-754 floating-point drift.
4. **Risk Monotonicity:**
   `effectiveCapital <= portfolioApprovedCapital` and `effectiveLeverage <= upstreamLeverage`. Risk Authority can only reduce or reject risk, never inflate it.
5. **Gross vs Net Exposure (AUD-A-02):**
   Gross exposure is tracked independently of net exposure; netting cannot hide gross concentration.
6. **Opposing Position Fail-Closed (AUD-A-02):**
   Opposing directional trades fail closed unless explicitly enabled by `policy.allowOpposingPositions`.
7. **StrategyHealth Gate:**
   - `SUSPENDED` / `RETIRED`: Strictly rejected fail-closed.
   - `UNKNOWN` / `REVALIDATION_REQUIRED`: Strictly rejected fail-closed.
   - `DEGRADED`: Handled deterministically per policy (`MODIFY` with capital scale factor or `REJECT`).
8. **Temporal Determinism & Freshness:**
   Injected evaluation timestamp avoids hidden `Date.now()` drift; stale/expired `MarketState` and `PortfolioDecision` fail closed.
9. **Durable Proposal Tombstones (DEBT-AUD-A-03):**
   Retained as partially remediated (service-level tombstone active; durable database persistence remains open debt prior to production mainnet).

---

## 4. Test & Validation Results

### A. TypeScript Typecheck & Build
```bash
npm --prefix trading-core/services/trading-core run typecheck
# Output: PASS (0 errors)

npm --prefix trading-core/services/trading-core run build
# Output: PASS (0 errors)
```

### B. Unit & Regression Tests
```bash
npm --prefix trading-core/services/trading-core test
# Output: 29 suites pass, 0 fail (all 18 REQ-06 risk tests pass)
```

### C. Quant Cross-EPIC Regression
```bash
PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py'
# Output: 45 tests pass, 0 fail
```

### D. Audit & Conformance Regressions
- `AUD-A-01`: PASS (Exact BigInt arithmetic verified at boundary units `10^-12`).
- `AUD-A-02`: PASS (Gross exposure not hidden by net; opposing position fail-closed verified).
- `AUD-C-01`: PASS (TypeScript and Python MarketState validation intact).
- `git diff --check`: PASS (0 whitespace/formatting errors).

---

## 5. External Mutation Accounting

```text
Exchange order POST = 0
Exchange order DELETE = 0
DEX transaction signing = 0
Hummingbot live execution = 0
Condor live execution = 0
WebSocket live execution = 0
Mainnet mutation = 0
Real capital = 0
Production credentials used = 0
Customer credentials used = 0
Secrets exposed = false
```

---

## 6. Files Created & Modified

### Created:
- `trading-core/services/trading-core/src/risk/RiskTypes.ts`
- `trading-core/services/trading-core/src/risk/RiskDecisionValidator.ts`
- `trading-core/services/trading-core/src/risk/RiskAuthorityService.ts`
- `trading-core/services/trading-core/test/epic01-req06-risk-authority.test.mjs`
- `.instructions/handoffs/Trading/20260919-epic01-req06-risk-authority-handoff.md`

### Modified:
- `trading-core/services/trading-core/src/index.ts` (exported risk types & service)
- `.instructions/STATUS.md`
- `.instructions/TASKS.md`
- `.instructions/ROADMAP.md`
