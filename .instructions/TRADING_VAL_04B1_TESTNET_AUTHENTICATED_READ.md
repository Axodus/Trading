# AXODUS-TRADING-VAL-04B1 — Testnet Credential & Authenticated Read

**STATUS:** `IMPLEMENTATION READY / AUTHENTICATED READ BLOCKED ON CREDENTIAL INJECTION`

**CLASSIFICATION:** `TESTNET REST READ HARNESS VALIDATED / MUTATION GATE CLOSED`

## Scope

This increment prepares the first authenticated Binance USDⓈ-M Futures Testnet
read without authorizing an order, cancellation, WebSocket, mainnet access or
capital activity.

The runtime boundary is fixed to:

- environment: `binance_perpetual_testnet`;
- base URL: `https://testnet.binancefuture.com`;
- transport: HTTPS REST `GET` only;
- admitted private path: `/fapi/v2/account`;
- required metadata scopes: `account-info` and `futures-trading`;
- prohibited scopes: withdrawal and transfer variants.

## Credential boundary

`Val04B1CredentialSource` receives only credential metadata publicly. Secret
material is resolved ephemerally inside the authenticated adapter and is never
returned in the result, telemetry, evidence or documentation. The harness does
not read `.env` files and does not create one.

The production wiring must supply the material through the approved credential
boundary. Process-environment injection may be used by a controlled runner only
when the secret manager/runtime supplies it ephemerally; values must not be
committed, logged or pasted into chat.

## Safety properties

- non-testnet or non-HTTPS endpoints are rejected before transport;
- missing, mismatched or forbidden credential scopes are rejected;
- only the exact authenticated account-read route is admitted;
- the transport has no `POST`, `DELETE`, WebSocket or order method;
- withdrawal and transfer authority are rejected;
- the result exposes only sanitized account metadata and counts;
- API key material is injected as a header and secret material is used only to
  produce the request signature;
- mutating authority remains closed independently of credential capability.

## Offline validation

The deterministic harness validates:

- signed testnet account-read request construction;
- fixed domain/path and timeout propagation;
- sanitized account summary mapping;
- mainnet rejection;
- forbidden and incomplete scope rejection;
- incomplete secret rejection before transport;
- redaction behavior;
- absence of a mutating transport surface.

Validation performed:

- `npm run typecheck`: PASS;
- `npm test`: PASS, 13 test files / 13 pass / 0 fail;
- `npm run build`: PASS;
- `git diff --check`: PASS;
- injected credential presence in the current process: ABSENT;
- external authenticated request: NOT EXECUTED;
- Binance credentials, private calls, orders, cancellation, WebSocket and
  mainnet: NOT USED.

## Current decision state

The B1 implementation is ready for a controlled authenticated-read run, but
the B1 external acceptance is not complete because no testnet credential pair
was injected into the process. The external execution gate remains closed.

`VAL-04B2` remains HOLD and cannot be inferred from this artifact.
