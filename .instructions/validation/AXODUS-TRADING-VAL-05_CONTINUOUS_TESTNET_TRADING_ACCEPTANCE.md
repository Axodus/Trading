# AXODUS-TRADING-VAL-05 — Continuous Testnet Trading Acceptance

**Status:** `BLOCKED / G3 LIVE RUNTIME INTEGRATION GAP`  
**Date:** 2026-09-18  
**Baseline requested:** `353a340d63b06069f5863a8ed7bcfb3cf3f27947`  
**HEAD audited:** `e00ad8f3aa78faf812d2531e7ce9ff5133abd076`  
**Environment:** `binance_perpetual_testnet`  
**Mainnet:** `PROHIBITED`

## Result

VAL-05 stopped before mutation at G3. The requested baseline is an ancestor of
the audited HEAD, which contains the IMP-05A–05E implementation and tests. Local
validation passed with 20/20 test suites, typecheck, build, built-runner
verification and `git diff --check`.

The public and authenticated venue gates passed, but the continuous runtime
could not be connected to Binance without creating a new integration layer.
`ContinuousExecutionRuntime` currently accepts abstract mutation,
reconciliation and cancellation providers. The repository has no live adapter
that binds those interfaces to the approved Binance Testnet transport, exact
lookup, cancellation and position-reconciliation paths. The existing
`Val04B2ControlledOrderHarness` is a separate single-order lifecycle and cannot
be substituted for the VAL-05 canonical continuous runtime.

## Gate evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| G0 baseline | `PASS` | `353a340d` is an ancestor of `e00ad8f`; branch `dev`; `origin/dev` aligned; clean before validation |
| G0 regression | `PASS` | typecheck, build, `git diff --check`, 20/20 suites |
| G1 public preflight | `PASS` | Testnet HTTPS; BTCUSDT `TRADING/PERPETUAL`; tick `0.1`; step `0.0001`; minQty `0.0001`; minNotional `50`; reference price `80974.10690217`; candidate notional `56.68187`; credentials `0`; POST/DELETE `0` |
| G2 account read | `PASS` | authenticated account read; `canTrade=true`; 8 assets; one private read; mutation `0`; WebSocket `0` |
| G2 initial orders | `PASS` | `GET openOrders` HTTP 200; BTCUSDT open orders `0` |
| G2 initial position | `PASS` | `GET positionRisk` HTTP 200; BTCUSDT `0.0000`, `BOTH` |
| G3 runtime health | `BLOCKED` | no live ContinuousExecutionRuntime provider composition for Binance Testnet |
| G4–G7 | `NOT REACHED` | mutation correctly withheld |

## Safety accounting

```yaml
credentialsLoaded: 1 for authenticated reads only
privateReads: 3
POST order: 0
DELETE order: 0
ordersSubmitted: 0
blindRetries: 0
ambiguousMutations: 0
websocketUsed: false
mainnetCalls: 0
secretsExposed: false
residualActiveOrders: 0
residualPosition: 0
```

## Required follow-up

This result requires a separate implementation milestone to provide the
approved live provider/reconciliation/cancellation/position adapter and a
canonical VAL-05 runner. No new order authorization is implied by this record.

