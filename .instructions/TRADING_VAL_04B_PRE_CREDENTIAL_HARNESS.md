# AXODUS-TRADING-VAL-04B — Pre-Credential External CEX Harness

**STATUS:** `PRE-CREDENTIAL HARNESS COMPLETE / EXTERNAL EXECUTION HOLD`
**CLASSIFICATION:** `RUNTIME-DERIVED ORDER PREPARATION / GATE CLOSED BY DEFAULT`

## Scope

This artifact implements only the offline preparation stage authorized after
`VAL-04B0`. It does not create, load, validate, or transmit Binance keys; it
does not make private calls; and it does not submit testnet orders.

The frozen envelope is `binance_perpetual_testnet`, REST-only, `BTC-USDT`
subject to runtime validation, `LIMIT` only, one simultaneous Axodus order,
no position intent, no blind retry, and mandatory later cleanup/reconciliation.

## Implemented boundary

`Val04BPreCredentialHarness` accepts an injected `exchangeInfo` fixture or a
public HTTP response and:

- verifies that `BTCUSDT` is present and trading;
- derives `tickSize`, `stepSize`, `minQty`, `maxQty`, and `minNotional` from
  runtime symbol filters;
- derives a minimum valid LIMIT order from a supplied reference price;
- applies an Axodus notional ceiling after venue rules are derived;
- preserves the frozen `LIMIT`, `NONE` position-intent and REST-only envelope;
- rejects any credential capability during pre-credential preparation;
- reports `privateCallsMade: false` and `websocketUsed: false` as explicit
  evidence fields.

No venue filter is hardcoded in the implementation. The fixture values belong
to the test input and are parsed as runtime source data.

## External execution gate

`ExternalExecutionGate` starts in `CLOSED` state. The pre-credential harness
cannot submit an order while it is closed. Opening requires the separate
explicit approval token `VAL-04B-EXTERNAL-EXECUTION-APPROVED`; the token is
not present in configuration defaults and is not used by the current tests.

This gate is a safety boundary, not credential storage. The later credential
and external-execution review must remain a separate CTO decision.

## Validation

- `npm run typecheck`: PASS
- `npm test`: PASS, 12 test files / 12 pass / 0 fail
- New tests cover runtime filter derivation, hard-ceiling rejection, closed
  gate behavior, credential rejection, public exchange-info timeout/status,
  and absence of private/WebSocket activity.
- No Binance credentials, private calls, external orders, WebSocket, capital,
  or production activity were used.

## Remaining boundary

The next authorized step is a CTO credential-provisioning and external
execution gate. Until that decision, the public verification and order-plan
preparation remain usable only as offline/pre-credential evidence.
