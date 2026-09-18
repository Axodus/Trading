# AXODUS-TRADING-VAL-04B1 — Testnet Credential & Authenticated Read

Status: `COMPLETE / R2 PASS / AUTHENTICATED READ ACCEPTED / EXTERNAL EXECUTION CLOSED`

Classification: `TESTNET REST READ HARNESS VALIDATED / MUTATION GATE CLOSED`

Date: 2026-09-18 (R2 PASS: 2026-09-18)

## Scope

This gate prepares authenticated read validation for the Binance USDⓈ-M Futures
Testnet only. The admitted environment is the exact HTTPS domain
`testnet.binancefuture.com`, and the admitted path is the authenticated GET
account read `/fapi/v2/account`.

The harness requires a credential reference identified as Binance Futures
Testnet with account-read and futures-trading capability. Withdrawal,
transfer, mainnet, WebSocket, order submission, cancellation, position
creation, and capital authority remain outside this gate.

## Credential boundary

Raw keys are not read from or written to `.env`, Git, documentation, logs,
validation evidence, or handoffs. The runtime boundary accepts an ephemeral
credential source that provides metadata and short-lived material only for the
authenticated request. The result exposes sanitized account metadata and never
returns key or secret material.

Credential capability does not constitute execution authority. The external
execution gate remains closed until a separate CTO decision authorizes a
mutating testnet sequence.

## Implemented surface

- exact testnet HTTPS domain assertion;
- mainnet endpoint exclusion;
- exact read-only path admission;
- provider/environment and scope validation;
- withdrawal and transfer scope rejection;
- ephemeral HMAC request signing;
- bounded request timeout;
- sanitized account response mapping;
- secret redaction marker and no-secret result surface;
- explicit `mutatingCallsMade: false` and `websocketUsed: false` results;
- environment report that remains `BLOCKED` until an explicitly constructed
  authenticated runtime is invoked.

## Validation evidence

| Surface | Result |
| --- | --- |
| Typecheck | PASS |
| Build | PASS |
| Trading Core tests | 13/13 test files PASS |
| Git diff check | PASS |
| Testnet domain assertion | PASS |
| Mainnet exclusion | PASS |
| Credential scope validation | PASS |
| Read-only path admission | PASS |
| Redaction validation | PASS |
| Mutating transport surface | ABSENT |
| WebSocket surface | ABSENT |
| Credential material in current process | ABSENT |
| Authenticated external read | FAILED — HTTP 401 / Binance `-2015` |
| Testnet order/cancellation | NOT AUTHORIZED |

The authorized runtime used `TRADING_BINANCE_API_KEY` and
`TRADING_BINANCE_API_SECRET` from the existing `.env.local` without printing or
persisting either value. Both values had 64 characters and no surrounding
whitespace or quotes. The request reached the exact testnet account endpoint,
which returned HTTP 401 with Binance code `-2015` (`Invalid API-key, IP, or
permissions for action`). No mutating request was made.

The `.env.local` file is currently mode `0777`. It was not changed because the
authorized procedure prohibited modifying the file; this was corrected during
`VAL-04B1-R1` to mode `0600`.

`VAL-04B1-R1` confirmed that `.env.local` is ignored and untracked by Git, and
repeated the same single read-only request after the permission correction. The
retry still returned HTTP 401 due to credential provenance mismatch (old testnet key).

`VAL-04B1-R2` was authorized by CTO after the operator refreshed the Binance
USDⓈ-M Futures Testnet API key pair in `.env.local`. A single `GET /fapi/v2/account`
call to `testnet.binancefuture.com` returned HTTP 200 with the following sanitized evidence:

- httpStatus: 200
- environment: binance_perpetual_testnet
- domain: testnet.binancefuture.com
- mainnetExcluded: true
- authenticated: true
- canTrade: true
- assetCount: 8
- mutatingCallsMade: false
- websocketUsed: false
- secretRedacted: true

The ephemeral executor at `/tmp/axodus-val04b1-r2.mjs` was zeroed after use.
No credentials were logged or committed.

## Decision state

`VAL-04B1-R2` passed authenticated-read acceptance. The Binance USDⓈ-M Futures
Testnet account was successfully authenticated; `canTrade: true` and 8 assets are
confirmed in the testnet account. The credential source is valid, the domain
assertion is correct, and all mutation, WebSocket, and mainnet boundaries held.
`VAL-04B2` remains `HOLD` pending separate CTO authorization.

Preserved boundaries: no mainnet, no real funds, no testnet order, no
cancellation, no WebSocket, no Condor, no DEX, no capital authority.
