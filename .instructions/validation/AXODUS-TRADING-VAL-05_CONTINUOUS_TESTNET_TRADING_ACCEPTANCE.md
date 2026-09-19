# AXODUS-TRADING-VAL-05 — Continuous Testnet Trading Acceptance

**Status:** `COMPLETE / PASS / CTO ACCEPTED`
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

## VAL-05-FIX-01 — Exact reconciliation correction and A/B revalidation

**Status:** `COMPLETE / CTO ACCEPTED`

The reconciliation gap was isolated to `provider-acknowledged` being treated
as terminal by both the durable lifecycle service and the continuous runtime.
The correction removes that state from terminal classification and allows an
acknowledged execution to enter `reconciling` using its persisted
`executionClientOrderId`.

Targeted regression coverage now passes for acknowledged `NEW`,
`PARTIALLY_FILLED`, `FILLED`, `CANCELED`, `REJECTED`, and `EXPIRED` provider
states, lookup failure, repeated reconciliation, persisted identity, and zero
blind resubmission.

### Live read-only evidence

Session: `val-05-live-session-1789779945562`
Environment: `binance_perpetual_testnet`
Symbol: `BTCUSDT`

| Execution | Client identity | Provider order | Pre-state | Exact lookup | Provider state | Post-state |
| --- | --- | --- | --- | --- | --- | --- |
| A | `ax-intent-val05-a-1789779946479` | `28591022090` | `cancelled` | `found` | `CANCELED` | `cancelled` |
| B | `ax-intent-val05-b-1789779950732` | `28591022133` | `cancelled` | `found` | `CANCELED` | `cancelled` |

Both historical attempts were already terminal in durable state. Runtime
reconciliation therefore correctly reported `terminal-no-op`; the runner then
performed an explicit read-only exact provider lookup using each persisted
client identity. No new execution identity was generated.

Position reconciliation: `MATCH`, venue quantity `0`.
Durable session budget: `submissions=2`, `activeOrders=0`, `durable=true`.

```yaml
postOrderCalls: 0
deleteOrderCalls: 0
blindRetries: 0
duplicateSubmissions: 0
mainnetCalls: 0
websocketUsed: false
secretsExposed: false
cleanupPassed: true
```

The fixed acknowledged-state transition is proven by the offline regression;
the live A/B evidence independently confirms venue state without mutation.

## CTO Acceptance

**Final disposition:** `COMPLETE / PASS / CTO ACCEPTED`
**Evidence commit:** `ded3f85d2acc3f2f6d6d9e1337bf1dcafc123710`

```yaml
externalSafety: PASS
residualOrders: 0
residualPosition: 0
blindRetries: 0
duplicateSubmissions: 0
mainnetCalls: 0
secretsExposed: false
cleanup: PASS
```

VAL-05 acceptance unblocks REQ-15 sovereign architecture planning. No live trading,
mainnet mutation, real credentials, or production execution is authorized.
