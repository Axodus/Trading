# AXODUS-TRADING-IMP-01 — Restricted Baseline Implementation Authorization

Status: `COMPLETE / CTO ACCEPTED / RESTRICTED HTTP SUBSTRATE ESTABLISHED / PUBLISHED`

Progress: `IMP-01A COMPLETE / IMP-01B COMPLETE / IMP-01C COMPLETE / IMP-01D-HTTP COMPLETE / BLOCKER-01 OPEN`

## Purpose

Translate the accepted REQ-04 materialized baseline into the first bounded implementation increment without importing Hummingbot or Condor semantics into Axodus Trading Core.

## Accepted dependency baseline

```text
Condor              d89e74f2e3e273bea102c64e4977118e6a88084f
API client          v1.5.9 / dae015a3c513879ed06a55cf2b2c10e5772c0962
Hummingbot API      2494e847538bb7b819495cbc30eb4ef828feaacd
```

The revisions are inherited from REQ-04. Changing any revision requires a new compatibility validation.

## Authorized increments

### IMP-01A — Dependency and contract foundations

Freeze the baseline programmatically and define the minimal Axodus interfaces required to protect Trading Core from upstream implementation details. Axodus contracts remain authoritative for `ExecutionProvider`, order intent, risk-approved requests, normalized results, errors, lifecycle and audit context.

### IMP-01B — HTTP ExecutionProvider adapter

Implement only the deterministic HTTP path from a risk-approved Axodus order intent through the Axodus adapter to the admitted Hummingbot API client/server surface. The adapter does not own strategy, risk, credentials, capital authority or canonical positions/portfolio/accounting.

The adapter is not a generic wrapper for all Hummingbot API routes. Direct trade, credential/key, Gateway/wallet, executor and other authority-sensitive surfaces remain excluded unless separately admitted by Axodus contracts.

### IMP-01C — Offline contract validation

Validate fixtures and mocks for serialization, request/response mapping, errors, timeouts, authentication injection boundaries, lifecycle and upstream failure mapping. Tests must prove that unauthorized calls cannot escape the Axodus boundary. Tests remain offline and must not use credentials, exchanges, orders or capital.

### IMP-01D-HTTP — Admitted HTTP market-data read boundary

Implement only a read/feed substrate after the required transport is explicitly admitted. Hummingbot feed data must be normalized at the Axodus boundary before any future Trading Data Store integration. Research-grade persistence, provenance, deduplication, gap detection/recovery and replay remain separate capabilities.

## Explicitly blocked or deferred

- Hummingbot API client WebSocket path: `BLOCKED / DO NOT USE`; tracked in `AXODUS-TRADING-BLOCKER-01`
- Condor integration: later milestone; Condor cannot control execution directly
- upstream source changes, dependency upgrades/downgrades and compatibility shims: unauthorized by this record
- real credentials, direct trading, real orders, Gateway/wallet authority, paper/shadow/live trading, production, System One and capital authority: unauthorized

## Decision state

This document records the completed and CTO-accepted IMP-01A/B/C and IMP-01D-HTTP increments. It preserves the WebSocket blocker and does not claim production readiness.

## IMP-01A implementation result

`IMP-01A` is complete. The code now exposes the frozen dependency baseline, admits HTTP as the only current Hummingbot transport, and defines Axodus-owned authorization and upstream-failure contracts. The implementation remains independent of Hummingbot and Condor runtime imports.

Validation passed with `npm run typecheck` and `npm test` from `trading-core/services/trading-core`. The next increment is `IMP-01B`, the minimal HTTP `ExecutionProvider` adapter.

## IMP-01B implementation result

`IMP-01B` is complete. The implementation adds a minimal Axodus-owned HTTP adapter for `POST /trading/orders`, with explicit request/response mapping, correlation and authorization-header propagation, typed upstream HTTP/transport/protocol failures, and exact dependency-baseline enforcement. Hummingbot client DTOs, exceptions and models are not exposed to Trading Core callers.

The adapter admits only market and limit order intents. Credential/key, wallet/Gateway, executor, lifecycle and direct strategy surfaces remain outside the implementation boundary. The client WebSocket path remains blocked under `AXODUS-TRADING-BLOCKER-01`.

Validation passed with `npm run typecheck`, `npm test`, `npm run build` and `git diff --check` from the Trading workspace. `IMP-01C` is the next authorized increment for offline contract and integration validation.

## IMP-01C implementation result

`IMP-01C` is complete for the restricted HTTP execution boundary. Offline adversarial validation covers serialized Axodus requests, representative Hummingbot response fixtures, success normalization, malformed responses, HTTP 4xx/5xx mapping, timeout and transport failures, correlation propagation, authorization-header injection, baseline drift, forbidden capabilities, upstream-field isolation and the absence of a WebSocket execution path.

Transport failure after order submission is represented as `PROVIDER_EXECUTION_UNKNOWN` with `retryable: false`; the adapter performs one HTTP attempt and does not blindly retry an outcome that may already have reached Hummingbot.

Validation passed with `npm run typecheck`, `npm test` (`4 passed, 0 failures`), `npm run build`, `git diff --check` and the materialized Hummingbot API Client contract suite (`337 passed`). No credentials, exchange connectivity, order, collector, Condor integration or upstream source change was used. `IMP-01D-HTTP` is accepted for the restricted HTTP read boundary; `AXODUS-TRADING-BLOCKER-01` remains open for WebSocket authentication. CTO acceptance is recorded by the accepted implementation commits.

## IMP-01D-HTTP implementation result

`IMP-01D-HTTP` is complete for the admitted HTTP market-data read boundary. The Axodus-owned `MarketDataProvider` normalizes candles, historical candles, prices, tickers, rates, funding and order-book snapshots while keeping Hummingbot DTOs and exceptions inside the adapter.

Validation passed with `npm run typecheck`, `npm test` (`5 test files / 5 suites / 0 failures`), `npm run build` and `git diff --check`. Snapshot reads do not claim streaming, sequencing, losslessness, gap recovery or replayability. WebSocket, incremental order-book, trade streams, collection and Trading Data Store work remain deferred.

The next authorized architecture record is `AXODUS-TRADING-REQ-06 — Execution State, Reconciliation & Idempotency Freeze`.
