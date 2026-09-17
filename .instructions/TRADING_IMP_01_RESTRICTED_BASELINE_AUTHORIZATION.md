# AXODUS-TRADING-IMP-01 — Restricted Baseline Implementation Authorization

Status: `IMPLEMENTATION IN PROGRESS / RESTRICTED HTTP BASELINE`

Progress: `IMP-01A COMPLETE / IMP-01B NEXT / IMP-01C PENDING`

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

### IMP-01D — Conditional market-data read boundary

Implement only a read/feed substrate after the required transport is explicitly admitted. Hummingbot feed data must be normalized at the Axodus boundary before any future Trading Data Store integration. Research-grade persistence, provenance, deduplication, gap detection/recovery and replay remain separate capabilities.

## Explicitly blocked or deferred

- Hummingbot API client WebSocket path: `BLOCKED / DO NOT USE`; tracked in `AXODUS-TRADING-BLOCKER-01`
- Condor integration: later milestone; Condor cannot control execution directly
- upstream source changes, dependency upgrades/downgrades and compatibility shims: unauthorized by this record
- real credentials, direct trading, real orders, Gateway/wallet authority, paper/shadow/live trading, production, System One and capital authority: unauthorized

## Decision state

This document records the CTO authorization for IMP-01A/B/C and the conditional status of IMP-01D. It does not claim that implementation has been completed or that the system is production-ready.

## IMP-01A implementation result

`IMP-01A` is complete. The code now exposes the frozen dependency baseline, admits HTTP as the only current Hummingbot transport, and defines Axodus-owned authorization and upstream-failure contracts. The implementation remains independent of Hummingbot and Condor runtime imports.

Validation passed with `npm run typecheck` and `npm test` from `trading-core/services/trading-core`. The next increment is `IMP-01B`, the minimal HTTP `ExecutionProvider` adapter.
