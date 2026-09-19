# AXODUS-TRADING-VAL-05 — Continuous Testnet Trading Acceptance

**Status:** `BLOCKED / G3 DURABLE RUNTIME UNAVAILABLE`
**Date:** 2026-09-18  
**Baseline requested:** `353a340d63b06069f5863a8ed7bcfb3cf3f27947`  
**HEAD audited:** `7e5d8cbed64038333583825c3ab841342c926500`
**Environment:** `binance_perpetual_testnet`  
**Mainnet:** `PROHIBITED`

## Result

VAL-05 resumed on the accepted IMP-05F baseline and stopped before mutation at
G3. Local validation passed with 21/21 test suites, typecheck, build and
`git diff --check`.

The live provider composition from IMP-05F is present and its offline
integration suite passes. G3 still cannot pass because the local PostgreSQL
runtime required by the durable session budget and execution repository is not
available: `pg_isready` returned no response on `/var/run/postgresql:5433`.
The safety invariant `NO DURABLE EXECUTION -> NO POST` therefore stopped the
session before mutation.

## Gate evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| G0 baseline | `PASS` | accepted HEAD `7e5d8cb`; branch `dev`; IMP-05F present |
| G0 regression | `PASS` | typecheck, build, `git diff --check`, 21/21 suites |
| G1 public preflight | `PASS` | Testnet HTTPS; BTCUSDT `TRADING/PERPETUAL`; tick `0.1`; step `0.0001`; minQty `0.0001`; minNotional `50`; reference price `80974.10690217`; candidate notional `56.68187`; credentials `0`; POST/DELETE `0` |
| G2 account/read-only state | `PASS` | account `canTrade=true`, 8 assets; open orders `0`; BTCUSDT position `0.0000 BOTH`; private reads `3`; mutation `0` |
| G2 initial orders | `PASS` | `GET openOrders` HTTP 200; BTCUSDT open orders `0` |
| G2 initial position | `PASS` | `GET positionRisk` HTTP 200; BTCUSDT `0.0000`, `BOTH` |
| G3 runtime health | `BLOCKED` | PostgreSQL `/var/run/postgresql:5433` unavailable; durable session accounting cannot be established |
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

Database evidence:

```text
pg_isready /var/run/postgresql:5433 -> no response
```

## Required follow-up

This result requires the approved PostgreSQL runtime to be started and
health-checked before G3 can be retried. No new order authorization is implied
by this record.
