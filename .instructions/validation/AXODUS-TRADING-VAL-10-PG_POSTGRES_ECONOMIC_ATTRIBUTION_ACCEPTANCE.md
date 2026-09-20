# AXODUS-TRADING-VAL-10-PG — Real PostgreSQL Durable Economic Feedback & PnL Attribution Acceptance

**Status:** `COMPLETE / PASS / CTO REVIEW REQUIRED`  
**Date:** 2026-09-20  
**Parent Gate:** `AXODUS-TRADING-EPIC-01 / REQ-10` (Controlled Continuous Feedback, Execution Diagnostics & PnL Attribution)  
**PostgreSQL Target:** Real containerized PostgreSQL 18 (`127.0.0.1:55433`, database `axodus_trading_local`)  
**Environment:** Local Integration / Testnet Guarded / Simulated Transport  
**Live Order Submission:** `PROHIBITED`  
**Mainnet:** `PROHIBITED`  
**Real Capital:** `PROHIBITED`  
**Production/Customer Credentials:** `PROHIBITED`  

---

## 1. Executive Summary

This validation gate certifies the durable canonical Economic Feedback, Execution Diagnostics, and PnL Attribution Authority for `REQ-10` by executing an end-to-end 12-gate acceptance test suite against the **real PostgreSQL container** (`NodePostgresClient` on port `55433`). It empirically proves:
1. Clean application of migration `0009_execution_diagnostics_pnl_attribution.sql` creating tables `execution_diagnostics`, `pnl_attributions`, `pnl_attribution_components`, `position_ledger_entries`, `trading_feedback_snapshots`, and `attribution_corrections`.
2. Exact column mapping and durable persistence for `ExecutionDiagnostics` with exact realized execution price, directional slippage (BUY vs SELL side-aware), unnormalized fee asset preservation, and latency metrics.
3. Durable persistence and relational querying of `PnLAttribution` with detailed multi-component breakdowns (`GROSS_PNL`, `FEE`, `FUNDING`, `BORROW_INTEREST`, `OTHER`).
4. Durable idempotent replay returning existing diagnostic and attribution records on identical input digests without row duplication.
5. Idempotency conflict detection throwing typed `EconomicIdempotencyConflictError` when an altered input digest is submitted for an existing canonical order.
6. Strict multi-strategy, multi-revision, and multi-venue position ledger isolation, preventing economic pollution across revisions (`r1` vs `r2`) or venues (`binance` vs `bybit`).
7. Transaction rollback on simulated failure injection during diagnostics insertion leaving zero partial state in PostgreSQL.
8. Transactional outbox atomicity emitting `ExecutionDiagnosticsCreated` and `TradingFeedbackSnapshotCreated` events into `trading_execution_outbox`.
9. Connection pool disconnect/reconnect state survival across pool restarts.
10. Process and repository restart persistence, enabling service reconstruction without loss of lookup or replay capabilities.
11. Empirical mathematical verification of the **Slippage vs PnL Double-Counting Invariant**: slippage is strictly an execution-quality diagnostic and is never subtracted from Realized Net PnL because actual fill price already determines Realized Gross PnL.
12. Continuous feedback snapshot generation and Expected vs Observed divergence tracking (`expectedSlippageBps`, `expectedFee`, `expectedFillRatio`, `expectedLatencyMs`, `expectedPnl`) stored durably in PostgreSQL.

Zero in-memory mocks were used for this database acceptance suite.

---

## 2. Gate-by-Gate Verification Matrix

| Gate | Target Capability | Result | Real PostgreSQL Evidence |
|---|---|---|---|
| **Gate 1** | Migration 0009 Application & Table Existence | `PASS` | Tables `execution_diagnostics`, `pnl_attributions`, `pnl_attribution_components`, `position_ledger_entries`, `trading_feedback_snapshots`, `attribution_corrections`, and indexes confirmed in `information_schema.tables`. |
| **Gate 2** | ExecutionDiagnostics Persistence & Column Mapping | `PASS` | Persisted `ExecutionDiagnostics` with realized execution price `60100.000000000000`, adverse slippage amount `100.000000000000`, normalized total fee `6.010000000000`, and `quality: COMPLETE`. Verified direct SQL column round-trip. |
| **Gate 3** | PnL Attribution & Component Breakdown Persistence | `PASS` | Persisted `PnLAttribution` with 3 components: `FEE` (`6.000000000000`), `FUNDING` (`-2.500000000000`), and `BORROW_INTEREST` (`1.200000000000`). Relational join query verified exact child components. |
| **Gate 4** | Durable Idempotent Replay | `PASS` | Re-submitting identical diagnostics and PnL attribution returned existing records without duplicating rows in `execution_diagnostics` or `pnl_attributions`. |
| **Gate 5** | Idempotency Conflict Detection | `PASS` | Attempting to save diagnostics with modified `inputDigest` for the same `canonicalOrderId` threw typed `EconomicIdempotencyConflictError` with `code: ECONOMIC_IDEMPOTENCY_CONFLICT`. |
| **Gate 6** | Multi-Strategy, Revision & Venue Position Isolation | `PASS` | Distinct entries for `strat-iso-1:r1` on Binance, `strat-iso-1:r2` on Binance, and `strat-iso-1:r1` on Bybit persisted to `position_ledger_entries` with zero cross-contamination. |
| **Gate 7** | Transaction Rollback & Failure Injection | `PASS` | Injected failure before transaction commit triggered full rollback. Direct SQL confirmed 0 rows persisted for the failed order ID. |
| **Gate 8** | Outbox Atomicity | `PASS` | `ExecutionDiagnosticsCreated` and `PnLAttributionCreated` events committed atomically in `trading_execution_outbox` within the same transaction as diagnostic/attribution rows. |
| **Gate 9** | Disconnect & Reconnect Pool Survival | `PASS` | Database connection pool was completely closed and re-created. Existing diagnostics query verified full persistence across pool lifecycle. |
| **Gate 10** | Process / Repository Restart Persistence | `PASS` | A completely new instance of `PostgresEconomicAttributionRepository` was instantiated. Existing diagnostic and PnL records queried successfully by order ID. |
| **Gate 11** | Realized PnL vs Slippage Double-Counting Protection | `PASS` | With adverse slippage of `200.000000000000` and fee of `10.000000000000`, Gross PnL was `0.000000000000`, Fees was `10.000000000000`, and Net PnL was `-10.000000000000`. Slippage was **not** double-subtracted from Net PnL. |
| **Gate 12** | Continuous Feedback Snapshot & Divergence Persistence | `PASS` | Generated `TradingFeedbackSnapshot` with aggregated fees and divergence (`feeDivergence: 1.000000000000`). Persisted and verified round-trip in PostgreSQL with atomic outbox event `TradingFeedbackSnapshotCreated`. |

---

## 3. Core Invariant Validations

1. **Reconciled Facts Only:** PnL Attribution requires reconciled execution facts (`order.state !== UNKNOWN && order.state !== SUBMITTED_UNKNOWN`). Unreconciled orders return `quality: PENDING_RECONCILIATION` without fabricating PnL.
2. **Exact Arithmetic:** All price, quantity, fee, funding, and PnL fields use `FixedDecimal` with exact 12-decimal precision. Zero IEEE-754 floating-point numbers are used in financial calculations.
3. **Fill Quantity Conservation:** `Σ(CanonicalFill.quantity) == order.cumulativeFilledQuantity`. Any mismatch throws `ExecutionDiagnosticInvariantError`.
4. **Currency Isolation:** Fees in non-accounting assets without an explicit conversion rate are preserved in `feeBreakdown` without naïve addition into `normalizedTotalFee`, marking quality as `PARTIAL`.
5. **Side-Aware Directional Slippage:**
   - **BUY orders:** adverse slippage = `fillPrice > referencePrice` (positive slippage amount = paid more than expected).
   - **SELL orders:** adverse slippage = `fillPrice < referencePrice` (positive slippage amount = received less than expected).
6. **No Slippage Double-Counting:** Slippage measures execution quality against reference prices. Realized Gross PnL is determined by `(exitPrice - entryPrice) * closedQuantity`. Slippage is never subtracted again in Net PnL.
7. **Position Ledger & Reversals:** Partial closes, scale-ins, scale-outs, and reversals (`Long 5 + Sell 8 -> Closes Long 5, Opens Short 3`) are computed deterministically.

---

## 4. External Mutation & Safety Accounting

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

## 5. Verification Command & Regression

```bash
cd trading-core/services/trading-core
npm run build
tsc -p tsconfig.test.json
node --test test/val-10-postgres-acceptance.test.mjs
```

**Result:** 12/12 PASS (0 failed, 0 cancelled).
