# AXODUS-TRADING-REQ-13 — External CEX Validation & Paper/Shadow Readiness Freeze

**TYPE:** Architecture & Readiness Freeze  
**PROGRAM:** Axodus Trading  
**STATUS:** `COMPLETE / CTO REVIEW READY`  
**CLASSIFICATION:** `PAPER/SHADOW READINESS FROZEN / EXTERNAL CONNECTIVITY HOLD`  
**AUTHORITY:** Axodus CTO Directive (`AXODUS-TRADING-REQ-13 — GO`)  

---

## 1. Executive Summary

`AXODUS-TRADING-REQ-13` defines the explicit capability, security, and governance boundaries required before Axodus Trading can safely cross the threshold from local simulated execution into external CEX connectivity (Paper/Shadow/Testnet/Sandbox).

**This milestone does not authorize execution, create credentials, nor integrate real exchanges.** It establishes the architecture and acceptance criteria required for the *next* milestone to do so safely.

## 2. Environment & Authority Boundaries

### 2.1 Admissible Environments
The first external validation gate must target **strictly isolated, non-production environments**:
- **Allowed:** Exchange Testnets, Sandbox APIs, or provider-native Paper Trading endpoints.
- **Forbidden:** Production endpoints, mainnet execution, shadow trading against live order books with real funds.

### 2.2 Credential Scope & Storage
- **Scope:** API keys must be strictly generated for the target Testnet/Sandbox only. 
- **Authority:** Keys must be scoped to `READ` and `TRADE` only. `WITHDRAW`, `TRANSFER`, or `UNIVERSAL_TRANSFER` permissions are explicitly forbidden.
- **Storage/Injection:** Real secrets must not be checked into the repository or stored in plaintext. They must be injected into the runtime via environment variables mapped to the established `CredentialVaultService` reference boundaries (currently using `MockEncryptedCredentialVaultAdapter` or similar local secure mock, pending production KMS integration).

### 2.3 Capital & Order Ceilings
- **Capital:** `ZERO_WITHDRAWAL` authority. Absolutely no real capital may be exposed.
- **Limits:** Hardcoded order-size ceilings and frequency limits must be enforced at the Axodus adapter level, independent of provider limits, to prevent runaway loops in the testnet environment.

## 3. Operational Safeguards

### 3.1 Connector & Account Isolation
- Execution must be isolated to a single dedicated Axodus Test Tenant.
- The Hummingbot instance must not share API keys with any other active trading systems or manual users.

### 3.2 Rate Limits & Kill Switch
- **Rate Limits:** Provider rate limits must be respected, with backoff mechanisms active.
- **Kill Switch:** A deterministic, manual kill switch must be available to immediately suspend `ExecutionProvider` dispatch and cancel all tracked `InFlightOrders`.

### 3.3 Cleanup Requirements
- Every test run must conclude with a deterministic cleanup phase: canceling all active test orders and closing open testnet positions. Leaving orphaned orders on the testnet is a test failure.

## 4. Acceptance Criteria for External Validation

The subsequent external validation milestone will only be considered successful if it proves:
1. **Venue Identity Validation:** The Axodus `executionClientOrderId` is correctly transmitted, accepted by the Testnet venue, and visible in venue responses.
2. **External Reconciliation:** Ambiguous submissions (`PROVIDER_EXECUTION_UNKNOWN`) can be deterministically resolved by querying the Testnet venue using the exact caller ID.
3. **Cancellation Acceptance:** Cancellation requests correctly target and terminate the specific order on the venue.
4. **Failure/Timeout Behavior:** Transport drops or provider 5xx errors correctly normalize to Axodus typed errors without triggering blind retries.
5. **Durable Persistence:** The PostgreSQL repository correctly records the venue's acknowledgment and the final reconciled state.

## 5. Architectural Resolutions

### 5.1 BLOCKER-01 (WebSocket)
- **Status:** `OPEN / KEEP BLOCKED / DO NOT USE`.
- **Resolution:** The first external validation gate **must remain entirely HTTP/REST-based**. WebSocket connectivity is explicitly excluded from the required readiness path.

### 5.2 Order History Limitation
- **Status:** `DOCUMENTED NON-CRITICAL LIMITATION`.
- **Resolution:** The order history endpoint timeout observed in `VAL-03` is non-critical for the correctness of submission, cancellation, and exact-identity reconciliation. It does not need to be resolved prior to Paper/Shadow validation.

## 6. Official State & Recommendation

- **External Connectivity:** `HOLD`
- **Credentials:** `HOLD`
- **Orders:** `NOT AUTHORIZED`
- **Capital:** `NONE`
- **Next Recommended Action:** CTO sign-off on this readiness freeze. Following acceptance, authorize a dedicated implementation/validation gate (e.g., `VAL-04`) to perform the first live testnet execution under these exact constraints.
