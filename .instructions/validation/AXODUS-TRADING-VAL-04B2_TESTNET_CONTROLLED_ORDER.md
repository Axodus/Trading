# AXODUS-TRADING-VAL-04B2 — First Controlled Testnet Order Acceptance

Status: `INCOMPLETE / EXTERNAL NETWORK BLOCKED / SAFE ABORT VALIDATED`

Classification: `CONTROLLED ORDER HARNESS VALIDATED OFFLINE / LIVE ATTEMPT BLOCKED BEFORE MUTATION BY CONTAINER NETWORK RESTRICTION / MUTATION GATE CLOSED`

Date: 2026-09-18

## 4B. VAL-04B2-R1 Network Preflight — 2026-09-18

The authorized public network preflight was executed without credentials and
without private or mutating requests. The sandbox execution host could not
resolve `testnet.binancefuture.com`:

- DNS: `BLOCKED` — resolver/socket operations returned `Operation not permitted`
  and `Temporary failure in name resolution`.
- TCP/TLS `:443`: `NOT REACHED` because hostname resolution failed.
- Public `GET /fapi/v1/exchangeInfo`: `NOT REACHED`; curl returned error 6,
  `Could not resolve host`.
- authenticated calls: `0`.
- orders/cancellations: `0`.
- WebSocket: `0`.
- mainnet contact: `0`.
- secrets exposed: `NO`.

An escalated attempt to run the same read-only diagnostics with network access
was rejected by the execution approval layer. No workaround or indirect network
path was used. This is environment evidence only; it does not establish that
Binance Testnet itself is unavailable.

R1 result: `BLOCKED / DNS OR SANDBOX NETWORKING / SAFE STOP`.
`VAL-04B2` mutation authority remains consumed and closed. No new order
authorization is inferred from this preflight.

## 4C. VAL-04B2-R2 Public Network Qualification Attempt — 2026-09-18

CTO issued execution authorization for `VAL-04B2-R2` covering external public
network qualification (DNS -> TCP/TLS -> public `GET /fapi/v1/exchangeInfo` for
`BTCUSDT` with zero credentials, zero private calls, and zero order mutations).

Within the current execution runtime, un-escalated commands are blocked from
socket/DNS access by the default sandbox isolation. An attempt to request
escalated network execution was rejected by the automated approval reviewer due
to an upstream evaluator limitation (`google cloud-code-assist structured output
is not implemented by opencodex`).

In strict adherence to governance and security instructions, no workaround,
indirect execution, or sandbox circumvention was attempted.

Result: `BLOCKED / SANDBOX NETWORK ISOLATION & APPROVAL REVIEWER LIMITATION / SAFE STOP`.

- Public DNS/TLS/HTTP: `NOT REACHED`
- Credentials loaded: `NONE`
- Private calls made: `0`
- Orders submitted: `0`
- Cancellations requested: `0`
- WebSocket initialized: `NO`
- Mainnet contact: `NO`
- Secret exposure: `NO`
- `VAL-04B2` order mutation authority remains: `CLOSED / NOT AUTHORIZED`

## 4D. VAL-04B2-R3 Host Runtime Public Qualification — 2026-09-18

Status: `READY / HOLD — REQUIRES EXECUTION ON NETWORK-CAPABLE HOST`

Per CTO review, no further attempts will be made within the sandboxed
environment. The next execution gate (`VAL-04B2-R3`) will be performed directly
on an outbound network-capable host/WSL runtime using the same frozen codebase.

Scope for R3:
- Target: `https://testnet.binancefuture.com`
- Protocol: Public REST only (`GET /fapi/v1/exchangeInfo?symbol=BTCUSDT`)
- Derivation: Validate `BTCUSDT` filters (tickSize, stepSize, minQty, minNotional)
- Stop condition: Immediately upon public filter validation
- Credentials: `MUST NOT BE LOADED`
- Private calls, orders, cancellations, WebSocket, mainnet: `PROHIBITED`

## 4E. VAL-04B2-R3 Host Runtime Qualification Attempt — 2026-09-18

Baseline verification passed:

- HEAD: `251ca7f6db8a8a2ce4018e4dedc54a6ded82f6d7`
- branch: `dev`
- working tree before validation: clean
- typecheck: PASS
- tests: `14/14 PASS`
- build: PASS

The authorized public network command was submitted with no credentials and
would have performed only DNS, TLS and unauthenticated
`GET /fapi/v1/exchangeInfo?symbol=BTCUSDT`. The request was rejected before
execution by the automated approval reviewer because the provider returned:
`google cloud-code-assist structured output is not implemented by opencodex`.

No DNS, TCP/TLS or Binance HTTP result was obtained from R3. No workaround,
indirect execution, sandbox modification or alternate mutation path was used.

R3 result: `EXECUTED / BLOCKED / CTO REVIEW REQUIRED`.

- Credentials loaded: `0`
- Authenticated/private calls: `0`
- Orders: `0`
- Cancellations: `0`
- WebSocket: `0`
- Mainnet: `0`
- Secret exposure: `NO`
- BTCUSDT filters: `NOT DERIVED`
- Axodus public preflight: `NOT REACHED`
- Mutation authority: `CLOSED / NOT AUTHORIZED`

## 4F. VAL-04B2-R4-R2 Recovery Implementation & Phase A Revalidation — 2026-09-18

Status: `COMPLETE / CTO REVIEW READY / PHASE B NOT AUTHORIZED`

Per CTO authorization on baseline `49995ba12849306b711b3f00bac7a314e5d9167e`, the
three Phase A runner components were cleanly reconstructed:

1. `trading-core/services/trading-core/src/external/Val04B2CredentialSource.ts`
   - metadata: `binance_perpetual_testnet`, scopes: `['account-info', 'futures-trading']`
   - ephemeral resolution from approved environment variables (`TRADING_BINANCE_API_KEY`, `TRADING_BINANCE_API_SECRET`)
   - zero credential loading during Phase A / public validation
2. `trading-core/services/trading-core/src/external/Val04B2LiveTransport.ts`
   - strict assertion to `https://testnet.binancefuture.com`
   - rejection of non-HTTPS or mainnet endpoints
   - zero automatic retry on POST
3. `trading-core/services/trading-core/src/external/val-04b2-live-runner.ts`
   - explicit public-only entrypoint (`--public` / `runVal04B2PublicQualification`)
   - factory wiring to the canonical `Val04B2ControlledOrderHarness`
   - mutation paths remain closed behind explicit token gates and separate command-line modes

Validation evidence:
- Typecheck: `PASS`
- Test suite: `15/15 files PASS / 0 FAIL` (including new `val-04b2-r4-runner.test.mjs`)
- Build: `PASS`
- `git diff --check`: `PASS`
- `.env.local` ignore check: `PASS` (rule from root `.gitignore`)
- Secret tracking check: `PASS` (zero `.env` or `.env.local` tracked)
- Safety counters:
  - `credentialsLoaded: 0`
  - `privateCalls: 0`
  - `postAttempts: 0`
  - `deleteAttempts: 0`
  - `ordersSubmitted: 0`
  - `websocketUsed: 0`
  - `mainnetCalls: 0`
  - `secretsExposed: false`

Host qualification on native host (`whostler`):
- Public `GET /fapi/v1/ping`: `HTTP 200`
- Public `GET /fapi/v1/exchangeInfo?symbol=BTCUSDT`: `HTTP 200`
- Symbol: `BTCUSDT` (`TRADING`, `PERPETUAL`)
- Dynamic rules derived: `tickSize=0.10`, `stepSize=0.0001`, `minQty=0.0001`, `minNotional=50`

Phase B attempts summary:
- **Phase B attempt #1**: ABORTED — reviewed Phase A artifact unavailable in checkout.
- **Phase B attempt #2**: ABORTED — persisted runner was public-only (`--public` mode only).
- **Orders submitted across both attempts**: `0`.
- **Mutation authority consumed**: `no`.

Phase B status: `HOLD / AWAITING EXPLICIT CTO AUTHORIZATION AFTER R4-R3 COMPLETION`.

## 4A. CTO-Authorized Execution Attempt — 2026-09-18

The local security preflight passed without exposing credential material:

- `.env.local` mode: `0600`
- `.env.local` Git-ignored: `YES`
- `.env.local` tracked: `NO`
- target: `binance_perpetual_testnet`
- mainnet fallback: `NOT CONFIGURED`

The mandatory public `GET /fapi/v1/exchangeInfo` preflight could not resolve
`testnet.binancefuture.com` in the current execution host. The observed failure
was DNS `EAI_AGAIN`. The harness therefore aborted before private credentials,
order submission, cancellation, or cleanup calls.

Sanitized result:

- `VAL-04B2`: `EXECUTED / FAILED / CTO REVIEW REQUIRED`
- mutation gate: `CLOSED`
- orders submitted: `0`
- cancellation requests: `0`
- WebSocket: `NO`
- mainnet contact: `NO`
- blind retries: `0`
- secrets exposed: `NO`
- external cleanup required: `NO ORDER WAS CREATED`

## 1. Scope & Objective

This gate implements and validates the first controlled Binance USDⓈ-M Futures Testnet order lifecycle under CTO execution authorization:

`preflight → submit → exact lookup → identity verification → cancel → terminal reconciliation → cleanup`

The authorized execution envelope is strictly:
- Environment: `binance_perpetual_testnet` (`https://testnet.binancefuture.com`)
- Instrument: `BTC-USDT` (`BTCUSDT`)
- Order type: `LIMIT`
- Maximum new orders: **1**
- Maximum concurrent validation orders: **1**
- Position intent: **NONE**
- Quantity/notional: minimum venue-valid amount compatible with Axodus hard ceiling ($250 USDT ceiling, ~0.001 BTC @ 20% discount below market)
- Transport: **REST only** (WebSocket strictly prohibited under `BLOCKER-01`)
- Automatic retry: **PROHIBITED** (`PROVIDER_EXECUTION_UNKNOWN ≠ FAILED`, `NOT_FOUND ≠ SAFE_TO_RESUBMIT`)
- Mainnet fallback: **PROHIBITED**
- Real capital: **NONE**

## 2. Implemented Architecture & Harness Surface

The implementation lives in `trading-core/services/trading-core/src/external/Val04B2ControlledOrderHarness.ts` and is exported from the core package root:

1. **Gate Verification**: Explicit requirement for approval token `VAL-04B-EXTERNAL-EXECUTION-APPROVED`; fails closed if omitted or invalid.
2. **Domain & Environment Assertion**: Validates exact HTTPS endpoint `testnet.binancefuture.com` and strictly rejects mainnet or non-HTTPS URLs.
3. **Credential & Scope Verification**: Validates testnet metadata and requires `account-info` and `futures-trading` scopes while strictly prohibiting `withdraw` and `transfer`.
4. **Runtime Filter Derivation**: Dynamically parses `PRICE_FILTER` (`tickSize`), `LOT_SIZE` (`stepSize`, `minQty`), and `MIN_NOTIONAL` from public `GET /fapi/v1/exchangeInfo` without hardcoded fallbacks.
5. **Reference Price & Conservative LIMIT Calculation**: Fetches mark price via `GET /fapi/v1/premiumIndex` and derives a LIMIT price 20% below market to avoid intentional fills while remaining within venue tick bounds.
6. **Canonical Client Order ID**: Generates a unique `executionClientOrderId` (`axd_v04b2_<timestamp>_<random>`, length ≤ 32 chars) preserving the relation:
   `SubmissionAttempt → executionClientOrderId → newClientOrderId → provider evidence`.
7. **Axodus Safety Preflight Evaluation**: Evaluates `TradingExternalSafetyPreflightPolicy` against instrument, notional ceiling, session/tenant isolation, zero-withdrawal scopes, and active order limits before dispatch.
8. **Single LIMIT Order Submission**: Dispatches exactly one signed `POST /fapi/v1/order` with `timeInForce: GTC`. Enforces that any network ambiguity throws a typed boundary error prohibiting resubmission.
9. **Exact REST Lookup & Identity Verification**: Dispatches signed `GET /fapi/v1/order` with `origClientOrderId` to verify `returnedClientOrderId === executionClientOrderId`.
10. **Single Order Cancellation**: Dispatches signed `DELETE /fapi/v1/order` with `origClientOrderId` to request cancellation.
11. **Terminal Reconciliation**: Performs exact signed `GET /fapi/v1/order` to verify terminal status `CANCELED`.
12. **Mandatory Cleanup Verification**: Queries `GET /fapi/v1/openOrders` and `GET /fapi/v2/positionRisk` to confirm:
    - `residualActiveOrdersCount === 0`
    - `residualPositionAmount === 0`

## 3. Offline Validation Results

Targeted offline test suite: `trading-core/services/trading-core/test/val-04b2-controlled-order-harness.test.mjs`

| Test / Check | Result |
| --- | --- |
| Client order ID generation (format & length ≤ 32) | PASS |
| Query signing (HMAC-SHA256 signature verification) | PASS |
| Full 7-phase controlled order lifecycle | PASS |
| Fail-closed token gate (rejection without explicit token) | PASS |
| Identity mismatch rejection (integrity violation detection) | PASS |
| Ambiguous network failure on submit (no blind retry) | PASS |
| Trading Core typecheck (`npm run typecheck`) | PASS |
| Trading Core build (`npm run build`) | PASS |
| Trading Core test suite (`npm test`) | 14/14 test files PASS (0 failures) |
| Git diff formatting check (`git diff --check`) | PASS |

## 4. Live Testnet Execution Attempt & Findings

An authorized single-execution run was initiated using credentials from `.env.local` (`TRADING_BINANCE_API_KEY` and `TRADING_BINANCE_API_SECRET`, file mode `0600`, Git-ignored).

### Observed Execution Sequence
1. `.env.local` credential boundary preflight: PASS (mode `0600`, untracked, valid 64-char key/secret pair).
2. Base URL assertion (`https://testnet.binancefuture.com`): PASS.
3. Preflight public exchangeInfo fetch:
   - Command: `fetch('https://testnet.binancefuture.com/fapi/v1/exchangeInfo')`
   - Result: **FAILED** — `TypeError: fetch failed (cause: getaddrinfo EAI_AGAIN testnet.binancefuture.com)`
   - Cause: Outbound internet DNS resolution is restricted inside the current sandboxed agent execution environment.
4. Fail-closed safety boundary response:
   - Mutation gate held: **CLOSED**
   - Order submission attempted: **0**
   - Cancellation requests: **0**
   - Residual active orders: **0**
   - Residual position: **0**
   - Blind retries: **0**
   - WebSocket initialized: **NO**
   - Mainnet endpoints contacted: **NO**
   - Secrets logged or emitted: **NO**

## 5. Execution Summary Table

| Metric / Boundary | Target / Rule | Observed Value | Evaluation |
| --- | --- | --- | --- |
| Environment | `binance_perpetual_testnet` | `binance_perpetual_testnet` | PASS |
| Instrument | `BTC-USDT` | `BTC-USDT` | PASS |
| Order Type | `LIMIT` only | `LIMIT` only | PASS |
| Orders Submitted | Exactly 1 (or 0 on preflight fail) | **0** (halted at preflight) | PASS (Fail-Closed) |
| Active Residual Orders | Exactly 0 | **0** | PASS |
| Residual Position | Exactly 0 | **0** | PASS |
| Blind Retries | 0 | **0** | PASS |
| WebSocket Usage | 0 (`BLOCKER-01`) | **0** | PASS |
| Mainnet Contact | 0 | **0** | PASS |
| Secrets Exposed | 0 | **0** | PASS |
| Offline Test Suite | 14/14 files | 14/14 PASS | PASS |
| Live Network Status | Testnet reachability | Blocked by container DNS | FAILED (HOST RESTRICTION) |

## 6. Decision State & CTO Recommendation

- Harness & offline contracts: **COMPLETE / FULLY VALIDATED**.
- Live network execution: **EXECUTED / FAILED / CTO REVIEW REQUIRED** due to execution container sandbox network restrictions.
- All safety policies, fail-closed gates, and zero-residual-mutation boundaries held without exception.
- Preserved boundaries: no mainnet, no real capital, no live trading, no WebSocket, no Condor, no DEX, no unmanaged credentials.
