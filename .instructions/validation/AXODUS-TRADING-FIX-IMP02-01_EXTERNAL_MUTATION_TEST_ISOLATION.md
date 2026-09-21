# AXODUS-TRADING-FIX-IMP02-01 — External-Mutation Test Isolation

## Status

IMPLEMENTED / VALIDATION IN PROGRESS

## Incident Preserved

Source incident record: `.instructions/handoffs/Trading/2026-09-21T-paper-shadow-blocked-testnet-scope-violation.md`.

The incident remains preserved as a valid scope-violation record. This remediation does not rewrite it as compliant execution.

## Root Cause

The previous service-level default regression command compiled tests and executed `node --test test/*.test.mjs`. That glob included `val-09-testnet-certification.test.mjs`, which performs real Binance Futures Testnet order submission and controlled cancellation when credentials are available.

Credential availability was therefore sufficient for the generic local regression graph to reach a mutating Testnet acceptance suite. This violated the invariant that credential availability is not execution authorization.

## Test Capability Classification

| Test / suite | Command | Side effect | Classification | Default before | Default after | Guard |
| --- | --- | --- | --- | --- | --- | --- |
| `val-09-testnet-certification.test.mjs` | `npm run test:testnet:acceptance` | Real Testnet order submit/cancel and residual-state checks | `TESTNET_MUTATING` | Yes | No | Classified runner + `AXODUS_TRADING_ALLOW_TESTNET_MUTATION=true` + suite guard |
| `val:04b2:r4:execute` | `npm run val:04b2:r4:execute` | Real controlled Testnet order lifecycle | `TESTNET_MUTATING` script | No | No | Explicit command + R4 confirmation + `AXODUS_TRADING_ALLOW_TESTNET_MUTATION=true` |
| `val:04b2:r4:public` | `npm run val:04b2:r4:public` | Public exchange-info and premium-index reads | `NETWORK_READONLY` script | No | No | Explicit command; zero credential/private/write calls |
| `val:05:fix01:reconcile` | `npm run val:05:fix01:reconcile` | Authenticated read-only reconciliation | `NETWORK_READONLY` script | No | No | Explicit command; no submit/cancel path |
| Other current `*.test.mjs` files in the manifest | `npm test` / `npm run test:safe` | Mocks, fixtures, local DB and deterministic assertions | `SAFE` | Yes | Yes | Manifest drift detection |

## Default Test Path

Before:

```text
npm test -> tsc -p tsconfig.test.json -> node --test test/*.test.mjs
         -> included VAL-09-TESTNET
```

After:

```text
npm test -> npm run test:safe -> classified SAFE graph only
         -> TESTNET_MUTATING tests excluded
```

## Explicit Testnet Mutation Command

`npm --prefix trading-core/services/trading-core run test:testnet:acceptance`

It fails closed without `AXODUS_TRADING_ALLOW_TESTNET_MUTATION=true`. Credential presence is not authorization.

## Defense in Depth

1. Default `npm test` no longer uses broad `test/*.test.mjs` discovery.
2. `run-classified-tests.mjs` fails if a discovered test is unclassified or a manifest entry is stale.
3. The mutating class requires explicit runtime capability before loading the suite.
4. `VAL-09-TESTNET` checks the capability before loading credentials.
5. `val:04b2:r4:execute` checks the same capability in addition to its historical confirmation token.
6. Existing Testnet-only endpoint guards continue to reject Mainnet endpoints.

## Developer Test Matrix

| Class | Actual command | Network | External mutation | Default safe |
| --- | --- | ---: | ---: | ---: |
| SAFE | `npm test` / `npm run test:safe` | local only | No | Yes |
| NETWORK_READONLY | `npm run val:04b2:r4:public`, `npm run val:05:fix01:reconcile` | Yes | No intentional mutation | No |
| TESTNET_MUTATING | `npm run test:testnet:acceptance`, `npm run val:04b2:r4:execute` | Yes | Yes | No |
| MAINNET_MUTATING | None authorized or discovered as a normal test command | N/A | Prohibited | Never |

## Agent Safety Rule

Before executing a previously unclassified test command, inspect its package script, runner and test-discovery path for external mutation capability. Never infer authorization from available credentials. Mutation-capable acceptance tests require explicit task authorization in addition to repository runtime gates.

## Validation Log

Completed results are recorded in the final FIX-IMP02-01 handoff.
