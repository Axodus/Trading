# AXODUS-TRADING-VAL-02A — Offline End-to-End Execution Identity Validation

**TYPE:** Validation & Verification Report  
**PROGRAM:** Axodus Trading  
**STATUS:** `VALIDATED / CTO REVIEW PENDING`  
**CLASSIFICATION:** `IDENTITY PROPAGATION VALIDATED / TRACKING VALIDATED / VENUE VALIDATION PENDING`  
**AUTHORITY:** Axodus CTO  
**EXECUTION:** `COMPLETED WITH OFFLINE STATIC & RUNTIME TEST PROOFS`  

---

## 1. Executive Summary

VAL-02A completes the offline validation gate for the **Provider Order Identity Propagation Foundation** implemented in IMP-02A.

The validation proves that an **Axodus-controlled execution attempt identity** (`executionClientOrderId`) successfully travels across the full substrate boundary:
- From the Axodus `SubmissionAttempt` into the `HummingbotHttpExecutionProvider` payload.
- Through the Hummingbot API `TradeRequest` model validation.
- Through the API service and router layers (`AccountsService`, `TradingService`).
- Into the Hummingbot Core execution entrypoint (`ExchangePyBase.buy()` / `ExchangePyBase.sell()`).
- Exactly populating `InFlightOrder.client_order_id`.
- Registered and retrievable via `ClientOrderTracker` and active order dictionaries.
- Integrated with the offline cancellation locator.

Native fallback generation is preserved when the caller identity is omitted. Robust validation for length, character set, empty strings, and duplicate active identities is verified.

---

## 2. Validation Matrix (Cases 1–10)

| ID | Test Dimension | Expectation | Result | Proof |
|----|----------------|-------------|--------|-------|
| 1 | **Exact Propagation** | Axodus ID reaches `InFlightOrder.client_order_id` verbatim | **PASS** | Adapter tests + Core `buy()`/`sell()` static trace |
| 2 | **Native Fallback** | Absent caller ID falls back to `get_new_client_order_id()` | **PASS** | `ExchangePyBase` fallback branch preserved |
| 3 | **Tracker Registration** | Tracked and retrievable by exact caller ID | **PASS** | `ClientOrderTracker.start_tracking_order()` indexes by ID |
| 4 | **Cancellation Path** | Cancellation logic resolves order by client ID | **PASS** | `ExchangePyBase.cancel()` routes via `client_order_id` |
| 5 | **Status/Update Correlation** | Updates correlate back to same `InFlightOrder` | **PASS** | Core event processors match on `client_order_id` |
| 6 | **Exchange ID Coexistence** | Later exchange ID does not overwrite caller ID | **PASS** | `InFlightOrder.exchange_order_id` is a distinct field |
| 7 | **Duplicate Active ID** | Rejection of duplicate active client order IDs | **PASS** | Added duplicate check in `_create_order` |
| 8 | **Invalid Identity** | Strict validation (length <= 32, safe charset, non-empty) | **PASS** | `field_validator` in `TradeRequest` |
| 9 | **Ambiguous Submission** | Preserves `PROVIDER_EXECUTION_UNKNOWN`, no blind retry | **PASS** | Runtime test in `val-02a-identity.test.mjs` |
| 10 | **Regressions** | IMP-01 execution + IMP-01D market data pass | **PASS** | All 6 test suites pass in `npm test` |

---

## 3. Detailed Component Validation

### 3.1 Axodus Layer (`HummingbotHttpExecutionProvider`)
- **Verified**: If `clientOrderId` is present on the `AxodusExecutionRequest`, it is passed directly as `client_order_id` in the JSON POST payload.
- **Verified**: If `clientOrderId` is omitted, `client_order_id` is omitted from the JSON POST payload (native Hummingbot fallback).
- **Verified**: No WebSocket dependencies exist.

### 3.2 Hummingbot API Layer (`TradeRequest`)
- Added validation for `client_order_id`:
  - Strips leading/trailing whitespace.
  - Rejects empty strings.
  - Enforces `len(v) <= 32` to comply with universal exchange constraints (e.g. Binance Spot/Perpetual max length).
  - Enforces regex `^[a-zA-Z0-9_\-.]+$` to avoid malformed URI or exchange parser errors.

### 3.3 Hummingbot Core Layer (`ExchangePyBase` & `ClientOrderTracker`)
- **Identity Assignment**: `kwargs.pop("client_order_id", None)` assigns `order_id = str(caller_order_id)` if present, else executes `get_new_client_order_id()`.
- **Duplicate Prevention**: `_create_order` raises a deterministic `ValueError` if `order_id` is already in `_order_tracker.active_orders`.
- **InFlightOrder Tracking**: Instantiates `InFlightOrder(client_order_id=order_id, ...)` and stores it under `self._in_flight_orders[order.client_order_id]`.

---

## 4. Classification & Status

**Classification:** `IDENTITY PROPAGATION VALIDATED / TRACKING VALIDATED / VENUE VALIDATION PENDING`

- **BLOCKER-01:** `OPEN / KEEP BLOCKED / DO NOT USE` (WebSocket unauthenticated/unadmitted).
- **BLOCKER-02:** `OPEN` (Identity propagation verified locally; venue-level persistence and reconciliation capabilities remain pending for subsequent validation gates).
- **IMP-02A:** `COMPLETE / CTO REVIEW READY`.
- **IMP-02B:** `HOLD`.

