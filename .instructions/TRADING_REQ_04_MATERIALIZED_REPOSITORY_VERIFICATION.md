# AXODUS-TRADING-REQ-04

## Hummingbot / Condor Materialized Repository Verification & Baseline Reconciliation

**Status:** `CURRENT BASELINE VERIFIED WITH LIMITATIONS / IMP-01 CONDITIONALLY READY`

**Decision state:** audit complete; implementation remains on hold pending explicit IMP-01 authorization.

**Scope:** source, Git, dependency, interface, security-boundary and market-data verification of the three repositories materialized in the Trading workspace. No source, dependency revision, adapter or runtime was changed.

## Repositories verified

| Component | `.gitmodules` URL | Actual origin | Trading gitlink | Checked-out SHA | State |
|---|---|---|---|---|---|
| Condor | `https://github.com/Axodus/condor` | same | `d89e74f2e3e273bea102c64e4977118e6a88084f` | same | `main`, clean |
| Hummingbot API | `https://github.com/Axodus/hummingbot-api` | same | `2494e847538bb7b819495cbc30eb4ef828feaacd` | same | `main`, clean, `v2.1.0-961-g2494e84` |
| Hummingbot API Client | `https://github.com/Axodus/hummingbot-api-client` | same | `dae015a3c513879ed06a55cf2b2c10e5772c0962` | same | `main`, clean, `v1.5.9` |

All three `.gitmodules` URLs match their actual repository origins. All three Trading gitlinks match the checked-out commit. The root and all three audited submodules were clean at inspection time.

## Provenance, identity and licensing

- **Condor:** package `condor`, version `0.1.0`, Python `>=3.12`, MIT license with Hummingbot Foundation copyright. Its current lockfile pins `hummingbot-api-client==1.5.9`.
- **Hummingbot API:** Axodus repository fork, current commit `2494e847…`, 961 commits after the `v2.1.0` tag. The application declares API surface version `1.0.1`; the immutable Git SHA is the meaningful source baseline. MIT license with Hummingbot Foundation copyright.
- **Hummingbot API Client:** package `hummingbot-api-client`, version `1.5.9`, Python `>=3.8`, Apache-2.0. The checked-out origin is the Axodus fork, while package metadata and project URLs retain the upstream Hummingbot client identity. This fork/provenance distinction is recorded and must remain explicit.

No release tag was found for the current Condor commit or Hummingbot API commit. The client has the `v1.5.9` tag.

## Current revision matrix

| Component | REQ-03 previous verified baseline | Current workspace | Delta |
|---|---|---|---|
| Condor | `2105d27d94189c3207d6f8fb5d76e754bde3fa65` | `d89e74f2e3e273bea102c64e4977118e6a88084f` | `ADVANCED` |
| API client | `1.4.1` wheel, SHA `37e8b442…` | source `1.5.9`, `dae015a3…`, tag `v1.5.9` | `ADVANCED` |
| Hummingbot API | `e85562515e4ded407595fc80d4c19fdc2e57de21` | `2494e847538bb7b819495cbc30eb4ef828feaacd` | `ADVANCED` |

REQ-03 remains valid historical provenance. REQ-04 supersedes its dependency baseline for the current workspace. The current Condor lockfile and client source now agree on `1.5.9`.

## Condor findings

Condor is a combination of external agent runtime, user-facing orchestration application and Hummingbot API integration adapter. The current source contains agent identity/configuration, tool allowlists, provider/model configuration, persistence and lifecycle loops; Telegram commands for portfolio, trade, agents, servers, keys, Gateway and executors; MCP/API wrappers for accounts, market data, portfolio, trading, executors, backtesting, bot orchestration and Gateway; and local risk/dry-run controls.

The materialized Condor can reach direct trade, credentials, Gateway/wallet, positions, portfolio, executor and bot lifecycle surfaces. Those paths are `REJECT / DISABLE / ISOLATE` for Axodus. Only reasoning, proposal and permission-scoped orchestration may pass through a future Axodus Condor Adapter.

## Hummingbot API Client findings

The client is an async `aiohttp` binding with HTTP Basic authentication, a default 300-second timeout, explicit session initialization/close and routers for accounts, connectors, market data, trading, portfolio, executors, backtesting, bot orchestration, Gateway and related surfaces. It contains request wrappers and response handling rather than Axodus strategy or risk semantics.

It provides HTTP market-data, candles, historical candles, order books, prices, rates and diagnostics; trading orders, cancellation, positions, trades, leverage and funding; executor, performance, positions, logs and bot-status surfaces; Gateway, AMM, CLMM, swap, wallet and key-related surfaces; and WebSocket wrappers for candles, order books, trades and executor channels.

The client is an API transport/binding layer and must remain inside an Axodus adapter. Its portfolio, position, executor, Gateway, credentials and trading models do not become Axodus authority. The client contract test validates 337 route/path/query/body calls against its vendored `hummingbot-api-openapi.json`; this is not a live server contract test.

## Hummingbot API findings

The current server exposes the modern families used by the current client and Condor, including accounts, connectors, portfolio, trading, executors, controllers, bot orchestration, backtesting, market data, Gateway and WebSockets. HTTP routes use HTTP Basic authentication. WebSockets authenticate before accepting the connection and support `Authorization: Basic` or the `hummingbot-auth` subprotocol with base64url credentials.

The server market-data implementation provides candles, historical candles, prices, tickers, rates, order-book snapshots and trade events, plus diagnostics and feed lifecycle operations. Its application version is `1.0.1`; the source revision is `2494e847…`.

## Compatibility triangle

| Link | Evidence | Classification |
|---|---|---|
| Condor → client | Condor declares and locks `hummingbot-api-client==1.5.9`; current client is source version `1.5.9` | `COMPATIBLE` for observed HTTP usage |
| Client → server HTTP | 337 client contract tests pass against the vendored OpenAPI specification; static route families match current server routers | `COMPATIBLE WITH LIMITATIONS` |
| Client → server WebSocket | Client sends `?token=...`; server accepts header Basic auth or `hummingbot-auth` subprotocol and does not authenticate query credentials | `INCOMPATIBLE` |
| Condor expectations → server through client | Observed HTTP paths are represented; full runtime and WebSocket behavior are not fixture/live verified | `COMPATIBLE WITH LIMITATIONS` |

The triangle is not fully compatible. No shim or source change was introduced. A future adapter must avoid the affected client WebSocket path until a separate compatibility decision resolves it.

## Architecture conformance and ownership

| Capability | Source | Upstream behavior | Axodus owner | Classification / boundary |
|---|---|---|---|---|
| Strategy / signal / market judgment | Condor agents and Hummingbot controllers | can reason, configure and run strategies | Axodus Trading Core | `REJECT / ADAPT`; proposal only |
| Risk policy and gates | Condor local risk plus upstream controls | dry-run, limits and operational checks | Axodus Risk | `PROTECT / NEW`; Condor controls are supporting |
| Order intent | client/server trading and executor routes | accepts operational requests | Axodus Trading Core | `NEW`; provider cannot create authority |
| Execution | Hummingbot API/connectors/executors | submits/cancels and tracks venue operations | Axodus `ExecutionProvider` | `ADAPT / PROTECT` |
| Positions / portfolio / accounting | Hummingbot trading, executor and portfolio | reports provider-side state and PnL | Axodus Core | `ADAPT / PROTECT` |
| Credentials / exchange keys | Hummingbot accounts and Condor key surfaces | stores/uses credentials | Axodus Credential Vault | `REJECT / ISOLATE` |
| Gateway / wallets | Hummingbot Gateway and Condor handlers | DEX/wallet and swap operations | Axodus governed execution path | `REJECT / ISOLATE` |
| Market and historical data | Hummingbot feeds/API | live snapshots, candles and trades | mixed: acquisition upstream, store Axodus | `REUSE / ADAPT / EXTEND` |
| Agent runtime | Condor | lifecycle, tools, loops and persistence | Condor behind Axodus adapter | `REUSE / ISOLATE` |
| Audit / economic accounting | upstream logs and reports | operational evidence and provider PnL | Axodus | `NEW / EXTEND` |
| Capital authority | none of the external components | may expose capital-moving operations | Axodus governance/treasury | `REJECT` outside explicit gates |

## Security-sensitive surfaces

Condor and Hummingbot can expose real-trading operations and credential/key storage. Hummingbot authentication is an operational access control, not Axodus authorization. The future adapter must prevent direct Condor access to trade, credentials, Gateway/wallet, positions, executors and raw bot lifecycle operations. No credentials were read or configured.

## Market-data capabilities and prospective collection

The substrate supports live operational acquisition of configurable-depth order-book snapshots, Hummingbot candles and historical candles, buffered trade events, prices, tickers, rates, funding and volume/price queries. WebSockets provide subscription acknowledgements, periodic polling, heartbeat and disconnect cleanup.

It is not research-grade collection by itself: order-book and candle frames carry service/local timestamps inconsistently preserving exchange timestamps; order-book frames are top-level snapshots rather than an append-only delta journal; WebSocket payloads expose no durable sequence/gap/replay contract; trade buffering is in-memory and drained in batches; reconnect is application responsibility; and persistence, provenance, deduplication, clock quality, gap detection, retention and multi-venue storage remain Axodus responsibilities.

Classification: **live operational market data** `AVAILABLE WITH LIMITATIONS`; **research-grade prospective collection** `SUITABLE AS A FEED SUBSTRATE ONLY`; **historical MVRD** `UNRESOLVED / NOT PROVIDED`.

REQ-01A–A4 remain materially unchanged: prospective collection remains relevant to LTDI, historical seed remains required for Path M, `HYBRID` remains the candidate architecture and BUY remains `HOLD`.

## Implementation gap map

| Capability | Current source | Action |
|---|---|---|
| CEX connector mechanics | Hummingbot API substrate | `REUSE / ADAPT` |
| HTTP client binding | API client `1.5.9` | `REUSE / PROTECT` inside adapter |
| WebSocket market data | client/server auth mismatch | `REJECT` until compatibility decision |
| ExecutionProvider | Axodus contracts / adapter surface | `NEW` |
| Risk and capital gates | Axodus Core | `NEW` / preserve ownership |
| Credentials boundary | Hummingbot/Condor surfaces | `ISOLATE / NEW` |
| Market-data normalization/persistence | mixed / missing | `ADAPT / EXTEND / NEW` |
| Agent runtime | Condor | `REUSE / ISOLATE` |
| Condor agent adapter | missing | `NEW` |
| Backtest/replay integration | Hummingbot plus Axodus contracts | `ADAPT / EXTEND` |
| Direct Gateway/wallet access | upstream surfaces | `REJECT / DISABLE / ISOLATE` |

## Proposed implementation sequence

1. Reconfirm the current dependency SHAs at IMP-01 start and preserve the WebSocket incompatibility as a gate.
2. Freeze Axodus `ExecutionProvider`, normalized DTO and credential-boundary contracts.
3. Build read-only Hummingbot health, connector discovery and HTTP market-data adapter paths.
4. Define market-data timestamps, provenance, persistence and recovery contracts.
5. Add paper/simulation execution mapping and normalized fills/positions behind Axodus gates.
6. Add Axodus risk, capital and Order Intent enforcement before operational side effects.
7. Add the Condor adapter with proposal-only, permission-scoped orchestration.
8. Add replay/backtest integration after data contracts are validated.
9. Add operations, reconciliation, audit evidence and recovery handling.

This is a planning result, not implementation authorization.

## REQ-03 findings

**Preserved:** Hummingbot remains an operational substrate; Condor remains bounded external agent/orchestration infrastructure; sensitive direct-authority surfaces remain isolated; Hummingbot remains only a prospective-data candidate; REQ-01A–A4 remain materially unchanged.

**Superseded:** REQ-03's `2105d27… / 1.4.1 wheel / e855625…` planning baseline is superseded for the current workspace by `d89e74f… / 1.5.9 source / 2494e847…`.

**Corrected:** REQ-03's broad client/server compatibility conclusion is narrowed. Current HTTP coverage is supported, but the current client WebSocket authentication path is incompatible with the current server implementation.

## Dependency baseline recommendation

```text
Condor              d89e74f2e3e273bea102c64e4977118e6a88084f
API client          v1.5.9 / dae015a3c513879ed06a55cf2b2c10e5772c0962
Hummingbot API      2494e847538bb7b819495cbc30eb4ef828feaacd
```

Classification: `CURRENT BASELINE VERIFIED WITH LIMITATIONS`.

This baseline is suitable for conditional IMP-01 planning and read-only/HTTP adapter preparation. It is not a fully verified production dependency baseline until the WebSocket authentication path and environment-complete offline server/Condor tests are resolved.

## Tests executed

| Check | Result |
|---|---|
| Client `pytest -q test/test_calls_match_api_spec.py` | `PASS — 337 passed in 1.33s` |
| Condor `pytest -q tests/test_client_surface.py` | `NOT EXECUTED — skipped because aiohttp is absent` |
| Hummingbot API focused tests | `NOT EXECUTED — collection blocked by absent pandas and fastapi; 3 errors, 1 skipped` |
| Static AST/interface inspection | `PASS` |
| Git identity/gitlink checks | `PASS` |

No test used credentials, external exchange connectivity, orders, capital or production services.

## Risks and unresolved questions

- WebSocket client/server authentication is a concrete compatibility blocker.
- The client contract test uses a vendored OpenAPI document and does not prove live server behavior.
- Condor/server focused tests could not run because dependencies are absent; installation was outside authority.
- Hummingbot API is an untagged commit after `v2.1.0`; release provenance is weaker than a tagged server release.
- The client fork's repository identity and package metadata identity differ.
- No durable research-grade market-data persistence, sequence/gap recovery or historical MVRD seed was found.

## Decisions required

**CTO:** approve the current SHA matrix as the conditional REQ-04 baseline and decide whether the WebSocket incompatibility is excluded from IMP-01 scope or must be resolved before implementation.

**CEO:** `NONE`.

**Implementation:** `HOLD`; this audit recommends `IMP-01 CONDITIONALLY READY` only after CTO release with the documented limitations.

**Capital authority:** `NONE`.

## Preserved boundaries

No upstream source was changed. No dependency was upgraded or downgraded. No adapter, collector, runtime, credential path, exchange connection, order, paper/live trading, production service, System One research or capital authority was initiated.
