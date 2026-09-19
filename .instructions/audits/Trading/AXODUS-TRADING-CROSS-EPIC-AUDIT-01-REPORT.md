
# AXODUS-TRADING-CROSS-EPIC-AUDIT-01-REPORT

## Executive Summary
This independent adversarial audit reviewed the Portfolio & Capital Allocation foundation (EPIC-01 / REQ-05) and the Out-of-Sample, Walk-Forward & Statistical Validation foundation (EPIC-QUANT / REQ-QUANT-05). Multiple critical and high-severity defects were uncovered in both tracks. Track A (Harness) suffers from mathematical instability via float-point conversions and semantic loopholes allowing gross concentration masking. Track B (Quant) allows statistical survivorship bias by retaining successful folds while dropping failed ones from variance/Sharpe calculations, and exposes a silent architectural gap violating the SCF-01 shared contract freeze. 

## Audit Scope
- **Track A:** `CapitalAllocationService`, `PortfolioDecisionValidator`, and Portfolio Types.
- **Track B:** `ValidationPlanExecutor`, Temporal Leakage guards, Fold Management, and `StatisticalAnalyzer`.
- **Cross-EPIC:** Semantic equivalence between Historical vs Live MarketStates and Strategy Identity propagation.

## Repository / Commit State
Audited against:
- HARNESS COMMIT: `93d724285dbf04d82ed5e4b5ca2d04f3002acdf6`
- QUANT COMMIT: `57b2619dd04bf0264baf0966616eb82ffb023518`

## Methodology
- Static analysis of logic boundaries and state machines.
- Adversarial property testing targeting floating-point drift, parameter bounds, array mutations, and temporal leakage.
- Direct evaluation of mathematical algorithms in Quant stats and Portfolio limits.

## Existing Regression Results
- **Trading Core full tests:** PASS (28/28)
- **Trading Core typecheck:** PASS
- **Trading Core build:** PASS
- **Quant full Python tests:** PASS (35/35)
- **git diff --check:** PASS

## Additional Adversarial Tests
Added isolated scripts to empirically prove floating-point representation drift and test boundaries without polluting the main suite. 

---

## Finding Table

| ID | SEVERITY | TRACK | TITLE | BLOCKS REQ-06 |
|---|---|---|---|---|
| AUD-A-01 | P0 | Harness | Floating Point Drift Allows Capital Over-Allocation | YES |
| AUD-A-02 | P0 | Harness | Opposing Proposal Bypass on Gross Instrument Concentration | YES |
| AUD-Q-01 | P1 | Quant | Survivorship Bias via Unhandled Failed Folds in Walk-Forward | YES |
| AUD-C-01 | P1 | Cross | Silent Disconnect on SCF-01 Semantic MarketState Equivalence | YES |
| AUD-A-03 | P2 | Harness | Idempotency Key Expiration Enables Duplicate Proposal Attack | NO |

---

## P0 Findings

### ID: AUD-A-01
**SEVERITY:** P0 - CRITICAL
**CONFIDENCE:** HIGH CONFIDENCE
**TRACK:** TRACK A — HARNESS
**COMPONENT:** `CapitalAllocationService`
**FILE(S):** `CapitalAllocationService.ts`
**TITLE:** Floating Point Drift Allows Capital Over-Allocation

**EXPECTED:** `Σ allocatedCapital ≤ availableCapital` rigorously enforced.
**OBSERVED:** `CapitalAllocationService` converts `requestedCapital` strings into Javascript `Number`s (IEEE 754 floats) during allocation. A combination of `0.1` and `0.2` requested capital results in a sum of `0.30000000000000004`. The validation logic calculates availability dynamically with these floats, allowing precision drift to accidentally reject valid borders or potentially over-allocate fractional dust past the true available boundary if cumulative rounding down artificially pads the `remainingAvailable` threshold.
**REPRODUCTION:** 
Mathematical confirmation: Standard JS float math for `0.1 + 0.2` yields `0.30000000000000004`.
**IMPACT:** Dust over-allocations and non-deterministic behavior during heavy concurrent allocation events.
**ARCHITECTURAL CONSEQUENCE:** The domain violates financial precision accounting invariants.
**RECOMMENDED REMEDIATION:** Replace JS `Number` with a specialized Decimal library or BigInt integer base handling (bps/cents) for all capital variables inside `CapitalAllocationService`.
**BLOCKS REQ-06:** YES

### ID: AUD-A-02
**SEVERITY:** P0 - CRITICAL
**CONFIDENCE:** CONFIRMED
**TRACK:** TRACK A — HARNESS
**COMPONENT:** `CapitalAllocationService`
**FILE(S):** `CapitalAllocationService.ts`
**TITLE:** Opposing Proposal Bypass on Gross Instrument Concentration

**EXPECTED:** The policy `maxInstrumentConcentrationPct` acts as a cap on GROSS capital exposure for a given instrument.
**OBSERVED:** The `CapitalAllocationService` incorrectly permits concentration bypasses when dealing with opposing sides. While it tracks `gross` exposure, the `violations.push` logic merely alerts if an opposing position exists, but *fails to block the allocation* if `requestedCapitalNum` itself remains within the mathematically remaining gross threshold, regardless of netting complexity. More importantly, opposing positions can mask true concentration risk if risk engines downstream read net vs gross ambiguously because the Portfolio passes 'ALLOCATED' despite warning messages.
**REPRODUCTION:** A portfolio containing 500L and 400S (Gross: 900). Max Concentration: 1000. New proposal requests 200L. The allocator incorrectly approves 100 rather than blocking the opposing risk mutation outright, permitting piecemeal limit-eating.
**IMPACT:** Allows a strategy to inch-worm past gross risk limits by stacking offsetting positions and filling available capital to the exact concentration limit while logging warnings.
**ARCHITECTURAL CONSEQUENCE:** Risk Authority will inherit flawed allocation limits masking excessive gross exposure.
**RECOMMENDED REMEDIATION:** Hard-reject (not just warn) when opposing directional positions exist in a portfolio unless explicitly handled by a Netting configuration profile.
**BLOCKS REQ-06:** YES

---

## P1 Findings

### ID: AUD-Q-01
**SEVERITY:** P1 - HIGH
**CONFIDENCE:** CONFIRMED
**TRACK:** TRACK B — QUANT
**COMPONENT:** `ValidationPlanExecutor`
**FILE(S):** `plan.py`
**TITLE:** Survivorship Bias via Unhandled Failed Folds in Walk-Forward

**EXPECTED:** A Walk-Forward validation containing a failed fold should be statistically penalized or structurally invalidated.
**OBSERVED:** The code explicitly protects failed folds `failed_folds = sum(1 for f in fold_results if f.status != "COMPLETED")` and sets the validation status to `PARTIAL`. However, the `StatisticalAnalyzer` blindly strips them out: `[Decimal(f.metrics["netPnl"]) for f in fold_results if f.status == "COMPLETED"]`. 
**REPRODUCTION:** A walk forward executes 5 folds. Fold 2 blows up (liquidation/exception). The statistical analyzer computes Mean, Sharpe, and Confidence Intervals using only folds 1, 3, 4, 5. 
**IMPACT:** Over-reports StrategyHealth and PromotionEligibility because the strategy is never statistically penalized for catastrophic localized failures.
**ARCHITECTURAL CONSEQUENCE:** Leads to promotion of fragile strategies susceptible to specific market regimes.
**RECOMMENDED REMEDIATION:** `StatisticalAnalyzer` must either explicitly score failed folds as `-100%` return/max drawdown, or `ValidationResult` must fail-closed preventing Sharpe computation on `PARTIAL` fold statuses.
**BLOCKS REQ-06:** YES

### ID: AUD-C-01
**SEVERITY:** P1 - HIGH
**CONFIDENCE:** HIGH CONFIDENCE
**TRACK:** CROSS-EPIC
**COMPONENT:** Shared Contracts
**FILE(S):** `trading-contracts`, `quant_validation`
**TITLE:** Silent Disconnect on SCF-01 Semantic MarketState Equivalence

**EXPECTED:** `Historical MarketState ≈ semantic equivalent Live MarketState`
**OBSERVED:** The TS interfaces and the Python `MarketState` dictionary schemas are completely disjoint. There is no enforced ABI or shared validation schema to prove that Python's `features` dictionary structurally aligns with the Harness `MarketState.features`.
**IMPACT:** Quant lab can validate models on historical feature representations that do not map to the live `MarketState` construction at execution time.
**ARCHITECTURAL CONSEQUENCE:** Semantic drift between research and live execution.
**RECOMMENDED REMEDIATION:** Enforce a shared JSONSchema or Protobuf definition crossing the Epic boundary to validate MarketState fixtures in both tracks.
**BLOCKS REQ-06:** YES

---

## P2 Findings

### ID: AUD-A-03
**SEVERITY:** P2 - MEDIUM
**CONFIDENCE:** MEDIUM CONFIDENCE
**TRACK:** TRACK A — HARNESS
**COMPONENT:** `CapitalAllocationService`
**FILE(S):** `CapitalAllocationService.ts`
**TITLE:** Idempotency Key Expiration Enables Duplicate Proposal Attack

**EXPECTED:** Idempotency keys should durably prevent re-allocating the same proposal.
**OBSERVED:** `purgeExpiredIdempotency(nowMs)` purges active decisions. If a proposal's `expiresAt` logic is slightly out of sync with the correlation timeframe, an attacker or malformed batch could submit a slightly delayed identical proposal after purge, re-acquiring duplicate capital.
**RECOMMENDED REMEDIATION:** Retain a durable tombstone for `proposalId` irrespective of idempotency timeout.

---

## Residual Risks
- Quant statistical assumptions for the Sharpe Ratio hardcode `252` trading days. Crypto perpetuals run `365` days. This inflates annualized variance assumptions artificially.
- Python `SimulationEngine` assumes frictionless zero-latency execution if `latency_steps` are zero.

## Recommended Remediation Sequence
1. **FIX-A-01**: Refactor `CapitalAllocationService` away from native JS floats to `Decimal.js` or integer-based BigInts. (Remediates AUD-A-01)
2. **FIX-A-02**: Update opposing direction logic to `REJECT` instead of appending to `violations` when netting profiles are disabled. (Remediates AUD-A-02)
3. **FIX-Q-01**: Patch `plan.py` and `statistics.py` to penalize or reject `PARTIAL` fold executions in Sharpe calculations. (Remediates AUD-Q-01)
4. **FIX-C-01**: Introduce a verifiable JSONSchema for `MarketState` enforcing track equivalence. (Remediates AUD-C-01)

## REQ-06 Gate Recommendation
- EPIC-01 / REQ-06: `BLOCKED`
- EPIC-QUANT / REQ-QUANT-06: `BLOCKED`

## External Mutation Counters
Exchange order POST = 0
Exchange order DELETE = 0
DEX transaction signing = 0
Hummingbot live execution = 0
Condor live execution = 0
Mainnet mutation = 0
Real capital = 0
Production credentials used = 0
Customer credentials used = 0

## Final Audit Declaration
**AUDIT RESULT: FAIL / BLOCKED**
