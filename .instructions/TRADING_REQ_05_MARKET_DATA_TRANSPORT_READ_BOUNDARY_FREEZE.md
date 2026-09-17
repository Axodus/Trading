# AXODUS-TRADING-REQ-05 — Market Data Transport & Read-Boundary Freeze

Status: `COMPLETE / CTO REVIEW PENDING`

Decision classification: `IMP-01D HTTP-SAFE / STREAMING DEFERRED`

Date: 2026-09-17

## Scope

This request audits the materialized REQ-04 baseline to determine which market-data capabilities are available through admitted HTTP, which require the blocked WebSocket path, and what the minimum Axodus read boundary may expose. It does not implement `IMP-01D`, a collector, a Trading Data Store, a WebSocket transport or Condor integration.

Baseline:

```text
Condor              d89e74f2e3e273bea102c64e4977118e6a88084f
Hummingbot client   v1.5.9 / dae015a3c513879ed06a55cf2b2c10e5772c0962
Hummingbot API      2494e847538bb7b819495cbc30eb4ef828feaacd
```

## Evidence

The client exposes HTTP market-data methods for candles, historical candles, available candle connectors, prices, tickers, rates, funding information and order-book snapshots. The server exposes the corresponding `/market-data` routes and typed order-book responses containing trading pair, bids, asks and a service timestamp.

The client also exposes WebSocket wrappers for candles, order books, trades and executors. The current client WebSocket authentication remains incompatible with the server and is governed by `AXODUS-TRADING-BLOCKER-01`; those surfaces are not admitted by this request.

Condor's current market-data fetchers use the HTTP client for prices, candles, historical candles, connector discovery, rates and ticker pools. Condor's streaming modules use the blocked client WebSocket surfaces. This confirms that a useful HTTP read path exists independently of Condor streaming.

## Capability matrix

| Capability | HTTP | WebSocket | Needed for IMP-01D | Needed for prospective LTDI | Classification |
|---|---|---|---|---|---|
| Candles / recent window | available via `/market-data/candles` | available but blocked | yes, restricted read | useful, insufficient alone | `HTTP-SAFE / STREAMING DEFERRED` |
| Historical candles | available via `/market-data/historical-candles` | not required | optional read | seed/supporting context only | `HTTP-SAFE / NOT MVRD` |
| Order-book snapshot | available via `/market-data/order-book` | available but blocked | yes, restricted snapshot | useful snapshots, no continuity proof | `HTTP-SAFE / STREAMING DEFERRED` |
| Order-book incremental updates | unavailable in audited HTTP routes | available but blocked | no for first read boundary | required for continuous L2 continuity | `BLOCKED` |
| Trades | no audited HTTP market-data route | available but blocked | no | required for trade-event collection | `BLOCKED` |
| Ticker / prices / rates | available via HTTP routes | not required | optional | useful low-resolution observations | `HTTP-SAFE / LIMITED` |
| Funding information | available via `/market-data/funding-info` | not required | optional and policy-gated | useful for derivatives context | `HTTP-SAFE / LIMITED` |
| Connector discovery/status | connector discovery and market-data diagnostics are available over HTTP; operational status semantics require separate contract review | streaming lifecycle is blocked | optional health/read metadata | not sufficient for feed integrity | `HTTP-SAFE / LIMITED` |

HTTP market-data calls may cause Hummingbot to fetch or maintain upstream feeds. That makes them operational read capabilities; it does not make the resulting response a durable Axodus observation.

## Minimum Axodus HTTP read boundary

The proposed `IMP-01D-HTTP` surface is a minimal Axodus-owned `MarketDataProvider`, with callers receiving Axodus observations rather than Hummingbot client DTOs or exceptions:

```text
Trading Core / permitted read caller
             │
             ▼
      Axodus MarketDataProvider
             │
             ├── getCandleWindow
             ├── getHistoricalCandleWindow (explicitly non-MVRD)
             ├── getOrderBookSnapshot
             ├── getPrices / getTickerSnapshot
             └── getConnectorReadiness (if separately admitted)
             │
             ▼
      Axodus normalization and provenance boundary
             │
             ▼
      admitted Hummingbot HTTP market-data routes
```

The boundary must define connector, trading pair, interval/depth, observation timestamp, source timestamp when present, request correlation, freshness, partial/error state and source provenance. It must reject credentials, trading, executor, portfolio, Gateway, wallet and lifecycle operations. It must not expose the generic Hummingbot client or forward raw upstream models.

The first implementation may use snapshots and bounded windows. It must not claim sequence continuity, losslessness, replayability or research provenance from a single HTTP response.

## Operational data versus prospective LTDI

`LIVE OPERATIONAL MARKET DATA`: `AVAILABLE WITH LIMITATIONS` through HTTP for candles, historical candles, prices, tickers, rates, funding and order-book snapshots. HTTP polling can support a bounded read boundary when freshness and stale-data behavior are explicit.

`RESEARCH-GRADE PROSPECTIVE COLLECTION`: `PARTIALLY HTTP-SAFE`. HTTP can provide periodic snapshots and bounded windows, but the audited source does not provide incremental order-book updates, trade-event HTTP access, durable sequence numbers, gap detection/recovery, loss observability, event-time guarantees or append-only persistence. Continuous L2/L3 collection therefore remains blocked without an explicitly admitted streaming transport or another separately approved source.

The Hummingbot feed and client do not own Axodus persistence, normalization policy, deduplication, provenance, retention, replay or recovery. Those remain future Axodus responsibilities.

Historical MVRD remains unresolved and still requires the historical seed for Path M. The `HYBRID` candidate and LTDI conclusions remain unchanged.

## Decision and sequence

```text
REQ-05: COMPLETE / CTO REVIEW PENDING
IMP-01D-HTTP: technically viable as a restricted read boundary
WebSocket streaming: deferred under BLOCKER-01
Full prospective LTDI: deferred pending streaming or an approved alternative
Trading Data Store: later Axodus milestone
```

Recommended sequence after CTO review:

1. freeze the minimal `MarketDataProvider` HTTP contract;
2. implement bounded HTTP reads and normalization in a later authorized `IMP-01D-HTTP` increment;
3. validate stale, partial, malformed and upstream failure states offline;
4. keep order-book incremental and trade streaming outside the implementation until `BLOCKER-01` is resolved;
5. design the future Trading Data Store independently of Hummingbot persistence behavior.

## Preserved boundaries

No source, dependency, adapter, collector, Trading Data Store, WebSocket transport, Condor path, credential, exchange connection, order, paper/live activity or capital authority was changed or enabled.

## Evidence reviewed

- `hummingbot-api-client/hummingbot_api_client/routers/market_data.py`
- `hummingbot-api-client/hummingbot_api_client/routers/connectors.py`
- `hummingbot-api/routers/market_data.py`
- `hummingbot-api/models/market_data.py`
- `hummingbot-api/routers/websocket.py`
- `condor/condor/fetchers/market_data.py`
- `condor/mcp_servers/hummingbot_api/tools/market_data.py`
- `.instructions/TRADING_REQ_04_MATERIALIZED_REPOSITORY_VERIFICATION.md`
- `.instructions/TRADING_BLOCKER_01_REMEDIATION_DESIGN.md`
