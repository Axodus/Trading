# AXODUS-TRADING-EPIC-01 / REQ-10 — FINAL HANDOFF

**STATUS:** `COMPLETE / CTO REVIEW REQUIRED`  
**BASELINE:** `7aaa2bbe41811dc4d7ec386e1b6c1f7d6f77dd31`  
**FINAL WORKTREE:** Clean / Ready for Commit  
**COMMIT:** (Pre-authorized) `feat(trading): implement execution diagnostics and pnl attribution`  
**DEPENDENCY CLASSIFICATION:**
- `REQ-06` (Risk Authority): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-07A` (Strategy Promotion, Health & Risk Integration Boundary Freeze): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-07B` (Strategy Lifecycle Authority): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-07C` (Strategy Health Authority & Operational Snapshot): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-07D` (Canonical TradingIntent & Pre-Execution Authorization): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-07D-PG` (PostgreSQL Durable Pre-Execution Acceptance): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-08` (ExecutionIntent & Execution Boundary): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-08-PG` (PostgreSQL Execution Boundary Acceptance): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `REQ-09` (Controlled Execution Lifecycle, Order State & Reconciliation Boundary): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-09-PG` (PostgreSQL Execution Lifecycle Acceptance): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `VAL-09-TESTNET` (Binance Futures Testnet Provider Execution & Reconciliation Certification): `COMPLETE / CTO ACCEPTED / PERSISTED`
- `SHARED CONTRACT FREEZE (SCF-01)`: `FROZEN / PRESERVED`
- `DEBT-AUD-A-03`: `OPEN / PARTIALLY REMEDIATED`

---

## 1. Domain & Architecture Boundaries

- **RECONNAISSANCE CLASSIFICATION:**
  - Canonical Execution Contracts (`ExecutionIntent`, `ExecutionAttempt`, `CanonicalOrder`, `CanonicalFill`, `ExecutionResult`): `REUSE`
  - FixedDecimal Exact Arithmetic: `REUSE`
  - Transactional Postgres Client & Outbox: `REUSE`
  - Economic Feedback Contracts & Authorities: `EXTEND / ADDITIVE`
- **EXECUTION DIAGNOSTICS AUTHORITY:** Single canonical authority (`ExecutionDiagnosticsAuthority`) that validates reconciled execution facts, calculates fill quality, realized prices, directional slippage, fee structures, and latency taxonomy without mutating upstream state.
- **DIAGNOSTICS POLICY:** Versioned, immutable (`DEFAULT_EXECUTION_DIAGNOSTICS_POLICY_V1`) defining reference price semantics, slippage basis, latency taxonomy, and quality thresholds.
- **DIAGNOSTICS IDENTITY:** Deterministic `diagnosticsId` bound to `canonicalOrderId` and content digest.
- **INPUT DIGEST:** Stable SHA-256/JSON representation over participating intent, attempt, order, fills, and policy revision.
- **REALIZED EXECUTION PRICE:** Exact 12-decimal volume-weighted calculation: `Σ(p_i * q_i) / Σ(q_i)`. Returns `undefined` (never 0) on zero filled quantity.
- **FILLED QUANTITY:** Canonical sum of fill quantities: `Σ(CanonicalFill.quantity)`.
- **REMAINING QUANTITY:** Authorized quantity minus filled quantity: `ExecutionIntent.executionQuantity - filledQuantity`.
- **FILL RATIO:** Exact decimal: `filledQuantity / authorizedQuantity`.
- **FEE SEMANTICS:** Raw asset preservation in `feeBreakdown`. Naïve summation across different assets is strictly prohibited.
- **FEE ASSETS:** Preserves native fee assets (e.g. USDT, BNB, BTC).
- **FEE NORMALIZATION:** Converts to accounting currency only when a valid conversion rate is explicitly supplied; otherwise sets `quality = 'PARTIAL'`.
- **ACCOUNTING CURRENCY:** Explicit per-policy currency (default `USDT`).
- **SLIPPAGE POLICY:** Computes basis points and quote currency slippage amount using explicit reference price.
- **REFERENCE PRICE:** Bound from intent constraints/decision context; if absent, slippage is `undefined` (never 0).
- **BUY SLIPPAGE:** Side-aware: `fillPrice > referencePrice` is adverse (positive slippage amount).
- **SELL SLIPPAGE:** Side-aware: `fillPrice < referencePrice` is adverse (positive slippage amount).
- **PARTIAL-FILL SLIPPAGE:** Calculated strictly on filled quantity; cancelled quantity has zero economic slippage.
- **LATENCY TAXONOMY:** Differentiates `decisionToIntent`, `intentToAttempt`, `submissionLatency`, `ackLatency`, `firstFillLatency`, `completionLatency`, `cancelLatency`, and `reconciliationLatency`.
- **CLOCK DOMAIN & CLOCK ANOMALIES:** Rejects cross-clock distortion; negative latency flagged as `CLOCK_OR_SEQUENCE_ANOMALY` without absolute-value masking.
- **REJECTION DIAGNOSTICS:** Categorizes rejections (e.g. `PROVIDER_REJECTED`, `BELOW_MIN_QUANTITY`, `INSUFFICIENT_MARGIN`, `EXECUTION_HALT`).
- **CANCELLATION DIAGNOSTICS:** Tracks cancel request, ACK, duration, and filled-before-cancel versus cancelled quantities.
- **RECONCILIATION DIAGNOSTICS:** Records observation counts, duplicate counts, out-of-order occurrences, and recovery duration.
- **DIAGNOSTICS QUALITY:** Classified as `COMPLETE`, `PARTIAL`, `UNRESOLVED`, or `INVALID`.
- **PNL ATTRIBUTION AUTHORITY:** Canonical deterministic authority (`PnLAttributionAuthority`) computing realized gross PnL, fee/cost deductions, and realized net PnL.
- **PNL POLICY:** Versioned (`DEFAULT_PNL_ATTRIBUTION_POLICY_V1`) defining realization matching rules and accounting currency.
- **PNL ATTRIBUTION IDENTITY:** Bound deterministically to canonical order and execution result.
- **POSITION ACCOUNTING:** Multi-strategy, multi-revision, multi-venue isolated position ledger (`PositionAccountingService`).
- **POSITION MATCHING POLICY:** Supports `FIFO` and `WEIGHTED_AVERAGE_COST` lot matching.
- **SPOT & FUTURES ACCOUNTING:** Explicitly models direction, entry price, exit price, contract multipliers, and financing.
- **HEDGE MODE:** Preserves independent long and short positions under explicit netting/hedge configuration.
- **POSITION REVERSALS:** `Long 5 + Sell 8 -> Closes Long 5 (realized PnL), Opens Short 3 (new cost basis)`.
- **REALIZED VS UNREALIZED PNL:** Realized PnL strictly separated; entry fill creates cost basis inventory, never premature profit.
- **GROSS PNL & NET PNL:**
  - `RealizedGrossPnL = (exitPrice - entryPrice) * closedQuantity` (for longs)
  - `RealizedNetPnL = RealizedGrossPnL - CanonicalFees - FinancingCosts - OtherCosts`
- **FEES, FUNDING & BORROW INTEREST:** Separated into typed components (`FEE`, `FUNDING`, `BORROW_INTEREST`, `OTHER`). Missing values are `undefined`, never defaulted to zero.
- **SLIPPAGE DOUBLE-COUNT PROTECTION:** Mandatory invariant: slippage is an execution quality metric and is **never** subtracted from Net PnL because fill price already dictates Realized Gross PnL.
- **FEE DOUBLE-COUNT PROTECTION:** Fees accounted only through explicit canonical components.
- **STRATEGY & REVISION ATTRIBUTION:** Strict isolation: `r1` economics never leak to `r2`; strategy A never leaks to strategy B.
- **VENUE & INSTRUMENT ATTRIBUTION:** Segregated by venue (e.g. Binance vs Bybit) and canonical instrument.
- **ENVIRONMENT ATTRIBUTION:** Strictly distinguishes `SIMULATED`, `DRY_RUN`, and `TESTNET`.
- **PERFORMANCE AGGREGATOR:** Canonical read-model authority (`TradingPerformanceAggregator`) aggregating metrics across strategy, revision, venue, instrument, and time window with strict currency isolation.
- **ATTRIBUTION CORRECTIONS:** Corrections to reconciled facts create versioned, append-only records referencing `supersedesId`.
- **ACS EVIDENCE & PROVENANCE:** Emits ACS-compatible Evidence envelopes tracing `StrategyRevision -> TradeProposal -> PortfolioDecision -> RiskDecision -> TradingIntent -> ExecutionIntent -> ExecutionAttempt -> CanonicalOrder -> CanonicalFill -> ExecutionResult -> ExecutionDiagnostics -> PnLAttribution`.
- **TRADING FEEDBACK SNAPSHOT:** Immutable snapshot (`TradingFeedbackSnapshot`) packaging diagnostics, attributions, performance aggregates, and divergence metrics.
- **STRATEGY HEALTH / QUANT / AGENT BOUNDARY:** Feedback is exposed for consumption; Health, Quant, and Agents are read-only observers and cannot mutate accounting facts.
- **EXPECTED VS OBSERVED DIVERGENCE:** Computes slippage divergence, fee divergence, latency divergence, and fill ratio divergence. Missing expectations produce `undefined` divergence, never zero.
- **POSTGRESQL DURABILITY:** Full PostgreSQL migration `0009_execution_diagnostics_pnl_attribution.sql` with tables `execution_diagnostics`, `pnl_attributions`, `pnl_attribution_components`, `position_ledger_entries`, `trading_feedback_snapshots`, and `attribution_corrections`.
- **IDEMPOTENCY & CAS:** Deduplication by `canonical_order_id` and `input_digest`; conflicting digest throws `EconomicIdempotencyConflictError`.
- **TRANSACTIONAL ATOMICITY:** Diagnostics/Attributions commit atomically with outbox events (`ExecutionDiagnosticsCreated`, `PnLAttributionCreated`, `TradingFeedbackSnapshotCreated`).
- **RESTART & FAILURE INJECTION:** State survives client pool disconnect/reconnect and service restart; transaction failures rollback with zero orphan rows.

---

## 2. External Mutation & Safety Accounting

```yaml
exchangeTestnetOrderPost: 0
exchangeTestnetOrderDelete: 0
exchangeMainnetOrderPost: 0
exchangeMainnetOrderDelete: 0
dexTransactionSigning: 0
hummingbotProductionExecution: 0
condorProductionExecution: 0
webSocketLiveExecution: 0
liveExecutionIntentEmission: 0
mainnetMutation: 0
realCapital: 0
productionCredentialsUsed: 0
customerCredentialsUsed: 0
privateKeysUsed: 0
secretsExposed: false
blindRetries: 0
```

---

## 3. Regression & Verification Evidence

- **Typecheck:** `npm --prefix trading-core/services/trading-core run typecheck` -> **PASS**
- **Build:** `npm --prefix trading-core/services/trading-core run build` -> **PASS**
- **Trading Core Test Suite:** `npm --prefix trading-core/services/trading-core test` -> **614/614 PASS (96 suites, 0 failed, 1 skipped)**
- **REQ-10 Behavioral Suite:** `node --test test/epic01-req10-execution-diagnostics-pnl.test.mjs` -> **14/14 PASS**
- **PostgreSQL Acceptance (VAL-10-PG):** `node --test test/val-10-postgres-acceptance.test.mjs` -> **12/12 PASS**
- **Quant Lab Regression:** `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` -> **45/45 PASS**
- **Git Diff Checks:** `git diff --check` & `git -C quants-lab diff --check` -> **CLEAN (0 whitespace/formatting issues)**

---

## 4. Contract Classification & Shared Contract Freeze

- **SCF-01 SEMANTIC CHANGE REQUIRED:** `NO`
- **Contract Changes:** Strictly additive shared contracts in `trading-contracts` (`execution/economicFeedback.ts`).

---

## 5. Residual Risks & Debt

- **DEBT-AUD-A-03:** Remains `OPEN / PARTIALLY REMEDIATED`. The durable economic attribution layer ensures downstream idempotency and prevents double-attribution on replay, but root portfolio-level tombstone expiration remains scheduled for dedicated remediation.
- **RESIDUAL RISKS:** Cross-currency fee normalization without explicit exchange rate feeds correctly marks quality as `PARTIAL`; live rate feeds will be attached in subsequent telemetry/data-feed milestones.

---

## 6. Next Gate Recommendation

Recommend advancing to **AXODUS-TRADING-EPIC-01 / REQ-11** (Strategy Performance Evaluation, Drift Detection & Controlled Revalidation) to operationalize continuous feedback consumption in Strategy Health and Quant Revalidation without violating domain sovereignty.
