# AXODUS-TRADING-BLOCKER-01 — Hummingbot WebSocket Authentication Remediation Design

Status: `REMEDIATION DESIGN COMPLETE / CTO REVIEW PENDING`

Current classification: `KEEP BLOCKED / DO NOT USE`

Date: 2026-09-17

## Scope

This record investigates the materialized Hummingbot WebSocket authentication mismatch. It does not modify Condor, the Hummingbot API, the API client, Trading Core or dependency revisions.

Audited baseline:

```text
Condor              d89e74f2e3e273bea102c64e4977118e6a88084f
Hummingbot client   v1.5.9 / dae015a3c513879ed06a55cf2b2c10e5772c0962
Hummingbot API      2494e847538bb7b819495cbc30eb4ef828feaacd
```

## Observed compatibility facts

The client in `hummingbot-api-client/hummingbot_api_client/ws.py`:

- opens `/ws/market-data` and `/ws/executors` through `aiohttp`;
- base64 encodes `username:password` and appends it as `?token=...`;
- has no configuration switch for an authorization header or WebSocket subprotocol;
- maps closed/error frames to `ConnectionError` and has no reconnect loop in the client router;
- exposes candle, order-book, trade and executor stream wrappers.

The server in `hummingbot-api/routers/websocket.py`:

- authenticates before accepting the handshake;
- accepts `Authorization: Basic ...`;
- accepts `Sec-WebSocket-Protocol: hummingbot-auth, <base64url credentials>` and echoes `hummingbot-auth`;
- deliberately excludes query-string authentication because request paths can enter logs, traces or browser history;
- serves market-data and executor streams with connected, heartbeat, subscription and data messages.

The current client handshake therefore does not satisfy the current server authentication contract. This is structural, not a missing runtime setting.

## Condor impact

Condor uses `HummingbotAPIClient` for HTTP and calls `client.ws.market_data()` and `client.ws.executors()` from its streaming modules. Its reconnect/backoff skeleton runs after a connection attempt, so it cannot repair a handshake rejected by the server. Condor direct execution, executor control, credentials, Gateway/wallet and portfolio surfaces remain outside the Axodus execution path.

## Option assessment

| Option | Assessment | Result |
|---|---|---|
| `CONFIGURE` | No current client setting selects Basic headers or the `hummingbot-auth` subprotocol. | `REJECT FOR CURRENT SOURCE` |
| `ADAPT AXODUS TRANSPORT` | A future Axodus-owned transport can send an admitted header/subprotocol and define lifecycle, reconnect and failure semantics at the boundary. | `PREFERRED CANDIDATE / NOT SELECTED` |
| `UPDATE DEPENDENCY` | A later client revision may add a compatible mode, but requires source and triangle validation against the frozen server. | `CANDIDATE / DECISION REQUIRED` |
| `UPSTREAM FIX` | Aligning the client to the server is direct technically, but requires an explicitly reviewed upstream change and revision freeze. | `CANDIDATE / DECISION REQUIRED` |
| `KEEP BLOCKED` | Preserves the safe state until a compatible transport is explicitly admitted and validated. | `CURRENT DECISION` |

The recommendation is to keep the capability blocked now and prefer an Axodus-owned transport adaptation if streaming is required before a validated client/server alignment exists. This is a future proposal, not implementation authorization.

## Security and failure semantics

The query-token path is inadmissible because it exposes credential material through the URL. Any future admitted transport must use an explicit secret boundary, avoid logging or persisting secrets, keep them outside market-data records, and never treat Condor as financial authority.

The current client provides no durable sequence numbers, gap recovery, replay, persistence or research provenance. Condor reconnect/backoff is operational recovery only. A future transport decision must define handshake authentication, heartbeat and subscription lifecycle, timestamps, reconnect/backoff, duplicate and gap observability, stale-feed signaling and normalization before any Trading Data Store.

HTTP read capabilities remain separately usable where already admitted. WebSocket-dependent market-data streaming remains blocked. Historical MVRD remains a separate historical-seed problem and the `HYBRID` System One assessment is unchanged.

## Decision state

```text
BLOCKER-01: OPEN / WEBSOCKET BLOCKED / DO NOT USE
Current classification: KEEP BLOCKED
Preferred future candidate: ADAPT AXODUS TRANSPORT
IMP-01D: HOLD / CONDITIONAL
```

No option authorizes WebSocket implementation, a compatibility shim, a dependency update, an upstream change, Condor integration, a collector or Trading Data Store work.

## Evidence reviewed

- `hummingbot-api-client/hummingbot_api_client/ws.py`
- `hummingbot-api-client/hummingbot_api_client/client.py`
- `hummingbot-api/routers/websocket.py`
- `hummingbot-api/services/websocket_manager.py`
- `hummingbot-api/test/test_websocket_auth_channels.py`
- `condor/mcp_servers/hummingbot_api/hummingbot_client.py`
- `condor/condor/web/streams/hummingbot_ws.py`
- `.instructions/TRADING_REQ_04_MATERIALIZED_REPOSITORY_VERIFICATION.md`

## Boundaries preserved

No upstream source, dependency revision, adapter, credential, exchange connection, order, paper/live activity, Condor execution path, collector or capital authority was changed or enabled.
