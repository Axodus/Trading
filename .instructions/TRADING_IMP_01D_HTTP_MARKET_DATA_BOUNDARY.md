# AXODUS-TRADING-IMP-01D-HTTP — Market Data Read Boundary

Status: COMPLETE / CTO REVIEW PENDING

Baseline: REQ-04 restricted HTTP baseline

## Scope

This increment implements the minimum Axodus-owned HTTP `MarketDataProvider` boundary for candles, historical candles, prices, ticker snapshots, rates, funding information and order-book snapshots.

The Hummingbot client remains an implementation detail. Upstream DTOs, models and exceptions do not form part of the Trading Core contract.

## Contract and ownership

Observations carry normalized venue, instrument, observed time, receipt time, correlation and optional source timestamp/reference metadata. Missing upstream timestamps remain missing; the adapter does not fabricate sequence numbers or exchange timestamps.

Snapshot observations explicitly carry false values for continuous, lossless, sequenced, gap-recovered and replayable semantics. Repeated HTTP snapshots do not acquire stream or research-grade meaning.

Upstream failures terminate at the adapter and become typed Axodus market-data failures. Dependency drift and invalid requests are rejected before an HTTP call. The provider exposes no incremental order-book, trade-stream or WebSocket capability.

## Validation

Validated offline:

- candle and historical-candle normalization;
- price, ticker and order-book snapshot normalization;
- malformed protocol responses;
- timeout and transport failures;
- baseline drift;
- invalid request rejection before HTTP;
- absence of WebSocket, incremental-book and trade methods;
- upstream-field and exception isolation.

Commands from `trading-core/services/trading-core`:

- `npm run typecheck`: PASS
- `npm test`: PASS, 5 test files / 5 suites / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS

## Preserved boundaries

WebSocket remains `AXODUS-TRADING-BLOCKER-01 / KEEP BLOCKED / DO NOT USE`. This increment does not implement streaming, collection, Trading Data Store persistence, gap recovery, deduplication, replay, MVRD acquisition, Condor integration, credentials, exchange connectivity, orders, production or capital authority.

HTTP market-data reads are operational substrate access only. Prospective research-grade collection and LTDI remain future Axodus responsibilities and historical MVRD still requires a separate historical seed.

Decision state: `IMP-01D HTTP-SAFE / STREAMING DEFERRED`
