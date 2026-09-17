# AXODUS-TRADING-REQ-11 — Connector Identity Preservation & Reconciliation Capability Freeze

**TYPE:** Architecture & Capability Freeze  
**PROGRAM:** Axodus Trading  
**STATUS:** `COMPLETE / CTO REVIEW READY`  
**CLASSIFICATION:** `CONNECTOR CAPABILITY FROZEN / PROVENANCE RECORDED`  
**AUTHORITY:** Axodus CTO Directive (`AXODUS-TRADING-REQ-11 — GO`)  
**BASELINE:** `HUMMINGBOT_BASELINE_V1` (Frozen)  

---

## 1. Executive Summary

`AXODUS-TRADING-REQ-11` performs a structural code and capability audit across the Hummingbot Core connector surfaces to assess how caller-controlled execution attempt identities (`executionClientOrderId`) are preserved, transmitted to external venues, tracked, queried, and reconciled across lifecycle transitions.

The audit analyzed three representative connector architectures in the materialized `HUMMINGBOT_BASELINE_V1` (`tradingbot@2bfaccc48dd49e71a5b6d9b3011808e127dd00cd`):
1. **Binance Spot** (`hummingbot/connector/exchange/binance/`)
2. **Binance Perpetual** (`hummingbot/connector/derivative/binance_perpetual/`)
3. **Gateway / DEX** (`hummingbot/connector/gateway/`)

### Key Findings
- **Binance Spot** exhibits **`STRONG`** reconciliation strength. The venue natively accepts caller identity (`newClientOrderId`), preserves it in order responses and user data streams, and permits status queries and cancellations indexed directly by `origClientOrderId`.
- **Binance Perpetual** exhibits **`STRONG`** reconciliation strength. It mirrors Spot semantics via `newClientOrderId` and `origClientOrderId` with a 32-character maximum constraint and full REST status query support.
- **Gateway / DEX** exhibits **`NONE` / `UNSUPPORTED`** caller identity propagation in its current baseline implementation. Gateway generates internal synthetic IDs (`create_market_order_id`), ignores caller ID kwargs, and maps execution identity directly to on-chain transaction hashes (`tx_hash`), where client order IDs do not exist on-chain.

---

## 2. Connector Audit Breakdown

### 2.1 Binance Spot Connector

- **Base Class:** Inherits from `ExchangePyBase` (which now incorporates the IMP-02A caller ID propagation and active duplicate prevention).
- **Venue Submission Parameter:**
  - POST `/api/v3/order` transmits `"newClientOrderId": order_id`.
  - Prefix: `x-MG43PCSN` (when Hummingbot-generated; overridden by Axodus caller identity).
  - Max Length: 32 characters (strictly enforced by our API `field_validator`).
  - Charset: Alphanumeric, underscores, dashes, dots.
- **Venue Return & Preservation:**
  - Response returns `clientOrderId` verbatim alongside exchange-assigned `orderId`.
  - User Stream / WebSocket `executionReport` maps `c` (active client ID) or `C` (canceled client ID).
- **Status Lookup & Polling:**
  - GET `/api/v3/order` accepts `"origClientOrderId": tracked_order.client_order_id`.
  - Supports query by caller ID without requiring prior knowledge of `orderId`.
- **Cancellation:**
  - DELETE `/api/v3/order` accepts `"origClientOrderId": order_id`.
- **Reconciliation Strength:** **`STRONG`**
  - Axodus can unambiguously correlate ambiguous submissions (`PROVIDER_EXECUTION_UNKNOWN`) by querying GET `/api/v3/order?origClientOrderId=${executionClientOrderId}`.

---

### 2.2 Binance Perpetual Connector

- **Base Class:** Inherits from `ExchangePyBase` / `DerivativePyBase`.
- **Venue Submission Parameter:**
  - POST `/fapi/v1/order` transmits `"newClientOrderId": order_id`.
  - Max Length: 32 characters.
  - Broker ID Prefix: `x-nbQe1H39` (used only during native fallback).
- **Venue Return & Preservation:**
  - REST response returns `clientOrderId`.
  - WebSocket order updates map `clientOrderId` back to the in-flight order.
- **Status Lookup & Polling:**
  - GET `/fapi/v1/order` accepts `"origClientOrderId": tracked_order.client_order_id`.
- **Cancellation:**
  - DELETE `/fapi/v1/order` accepts `"origClientOrderId": order_id`.
  - Handles `code: -2011` ("Unknown order sent") deterministically.
- **Reconciliation Strength:** **`STRONG`**
  - Unambiguous correlation and recovery via REST query on `origClientOrderId` are fully supported.

---

### 2.3 Gateway / DEX Connector

- **Base Class:** `GatewayBase` / `GatewayInFlightOrder`.
- **Execution Mechanism:** Calls Gateway middleware via `execute_swap()` / `execute_quote()` over local HTTP/JSON-RPC.
- **Caller Identity Ingress:**
  - `buy()` and `sell()` call `self.place_order(is_buy, trading_pair, amount, price, **kwargs)`.
  - `place_order` explicitly calls `order_id = self.create_market_order_id(side, trading_pair)` and **discards** any `client_order_id` supplied in `kwargs`.
- **Venue Preservation (On-Chain):**
  - Blockchains (EVM, Solana, etc.) do not have a native "client order ID" field in DEX swap transactions; they use transaction hashes (`tx_hash`) and nonce tracking.
  - Gateway tracks orders in `GatewayInFlightOrder` using internal synthetic IDs until a transaction hash is returned, after which tracking is keyed by `creation_transaction_hash` or `exchange_order_id`.
- **Status Lookup & Polling:**
  - Queries Gateway transaction status by `transaction_hash`.
- **Reconciliation Strength:** **`NONE`** (for caller-controlled client order IDs).
  - DEX reconciliation requires on-chain transaction hash receipt, wallet nonce tracking, or Gateway quote ID correlation, not CEX-style client order IDs.

---

## 3. Comparative Capability Matrix

| Capability Dimension | Binance Spot | Binance Perpetual | Gateway / DEX |
|---|---|---|---|
| **Caller ID Propagation** | Supported (`IMP-02A`) | Supported (`IMP-02A`) | **Not Supported** (Hardcoded generator) |
| **Venue Parameter** | `newClientOrderId` | `newClientOrderId` | N/A (On-chain tx payload) |
| **Max ID Length** | 32 chars | 32 chars | N/A |
| **Venue Identity Return** | `clientOrderId` (exact) | `clientOrderId` (exact) | `signature` / `tx_hash` |
| **Lookup by Caller ID** | `GET /api/v3/order` (`origClientOrderId`) | `GET /fapi/v1/order` (`origClientOrderId`) | **None** (Requires `tx_hash`) |
| **Cancel by Caller ID** | `DELETE /api/v3/order` (`origClientOrderId`) | `DELETE /fapi/v1/order` (`origClientOrderId`) | N/A (Cancel on DEX requires replacement tx) |
| **Restart / State Recovery** | InFlightOrder reload + query by caller ID | InFlightOrder reload + query by caller ID | SQLite / JSON cache reload |
| **Reconciliation Strength** | **`STRONG`** | **`STRONG`** | **`NONE`** |

---

## 4. Architectural Impact on BLOCKER-02 & IMP-02B

1. **CEX Venues (Binance Spot & Perpetual):**
   - End-to-end identity continuity is fully supported down to the exchange level.
   - For CEX execution, `BLOCKER-02` is reduced to the implementation of the **Canonical Lifecycle & Reconciliation Engine** (`IMP-02B`).
2. **DEX / Gateway Venues:**
   - On-chain execution cannot rely on `executionClientOrderId` propagation into the venue.
   - DEX reconciliation must be designed as a distinct adapter pattern based on deterministic wallet nonces or quote hashes.
   - Gateway is therefore **EXCLUDED** from the immediate CEX reconciliation path.

---

## 5. Official State & Recommendation

- **`BLOCKER-02`**: `OPEN` (CEX path proven capable of `STRONG` reconciliation; DEX path requires separate design).
- **Next Milestone**: `AXODUS-TRADING-IMP-02B — Canonical Lifecycle & Reconciliation Engine (CEX Focus)`.

