# AXODUS-TRADING-REQ-03

## Hummingbot / Condor Implementation Baseline & Gap Freeze

**Status:** `COMPLETE / DEPENDENCY BASELINE FROZEN / IMPLEMENTATION HOLD`
**Authorized by:** CTO review on 2026-09-17
**Decision state:** `CONDOR + CLIENT + HUMMINGBOT SERVER BASELINE FROZEN FOR IMPLEMENTATION PLANNING; RUNTIME IMPLEMENTATION HOLD`

REQ-03 verifies the concrete source selected for audit against the canonical Axodus Trading architecture in REQ-02. It does not implement adapters, change runtime behavior, install services, configure credentials, connect an exchange, trade, purchase data, or reopen System One research.

## Source materialization and Git history

Trading declares `condor` and `hummingbot-api` in `.gitmodules`, but the repository has never recorded gitlinks for either path. The `.gitmodules` introduction commit `266a6595` contains the declarations only; no earlier path history or recoverable Axodus revision was found. The working-tree entries are broken links to external locations and were preserved.

Controlled inspection copies were created under `/tmp/axodus-trading-req03-source-audit/`:

| Component | Audit revision | Result |
|---|---|---|
| Condor | `2105d27d94189c3207d6f8fb5d76e754bde3fa65` | materialized and audited |
| Hummingbot API release | `v2.1.0` / `c908a1dcda7512445c11d32a9230fdbf6ba7b87e` | materialized and audited; incompatible with observed Condor surface |
| Hummingbot API main candidate | `e85562515e4ded407595fc80d4c19fdc2e57de21` | materialized and audited; structurally compatible candidate |

The Condor README names `hummingbot/condor`, while Trading's `.gitmodules` names `Axodus/condor`. This provenance difference is recorded as a source concern; it was not silently resolved by substituting another repository. Both audited repositories expose MIT license files with Hummingbot Foundation copyright notices. No upstream source was modified.

## Condor baseline audit

Condor at `2105d27…` is a combination of external agent runtime, user-facing interaction/orchestration adapter, and reference implementation of Hummingbot API interactions.

Its declared dependency is `hummingbot-api-client==1.4.1` on Python `>=3.12`. Observed client calls cover prices, candles, historical candles, funding, order books, portfolio state, accounts, credentials, direct trading, positions, executors, backtesting, bot orchestration, Gateway, CEX and DEX operations.

Condor's trading-agent prompt directs agents to use executor creation, and its local risk module has dry-run and direct-order guards. These remain Condor-local controls and do not become Axodus canonical risk. Other Condor surfaces expose direct order, credential, Gateway, wallet, leverage, position and bot lifecycle operations.

**Boundary:** Condor may reason, propose and orchestrate operations exposed by an Axodus-controlled interface. Condor does not own Strategy, Signal, Market Judgment, Risk, Order Intent, Position, Portfolio, Credentials, Audit, Accounting or Capital Authority.

## Hummingbot API audit

### `v2.1.0`

This release is an older Backend API surface. It provides account management, candle feeds, historical candles, broker bot operations and a synchronous backtesting route. It does not expose the modern route families required by the Condor revision: order-book access, trading, executors, portfolio, Gateway, modern backtesting tasks, or the wider bot-orchestration surface.

**Classification:** `REJECT` as the server baseline for this Condor audit revision.

### `e855625…`

This revision contains the route families observed by Condor: `/accounts`, `/market-data`, `/trading`, `/executors`, `/portfolio`, `/backtesting`, `/bot-orchestration`, `/connectors`, `/gateway`, `/gateway/swap`, `/gateway/clmm` and WebSocket routes. The market-data service manages candle and order-book feeds; order-book responses include bids, asks, trading pair and a service-generated timestamp. Historical candles and live feed lifecycle are exposed.

The revision is not a tagged release. The materialized client audit establishes compatibility at the route, authentication and request/response contract level. The server remains pinned by immutable SHA rather than a release tag.

**Classification:** `FROZEN AUDIT / IMPLEMENTATION BASELINE`; production promotion remains outside this REQ.

## Client/server compatibility resolution

Condor's lockfile pins `hummingbot-api-client==1.4.1`. The materialized wheel matches the lockfile artifact:

| Field | Frozen value |
|---|---|
| Package | `hummingbot-api-client==1.4.1` |
| Artifact | `hummingbot_api_client-1.4.1-py3-none-any.whl` |
| SHA-256 | `37e8b442c15bc3a5cf42fa9f40e9efdd74ec1d8e40d39d0ee01264e0db94a4fe` |
| Package source | `hummingbot/hummingbot-api-client` |
| License | `Apache-2.0` |
| Server | `hummingbot-api @ e85562515e4ded407595fc80d4c19fdc2e57de21` |

The wheel has no embedded source commit, so the client is frozen by package version and artifact hash. This is sufficient for the REQ-03 implementation baseline while preserving the provenance limitation for later release management.

Static contract comparison found the client route families represented by the server: accounts and credentials, connectors, market data and order-book queries, trading/orders/positions/funding, executors, portfolio, backtesting tasks, bot orchestration, Gateway, Gateway swap/CLMM, controllers, scripts, archived bots and Docker. The client uses HTTP Basic authentication for HTTP requests; the WebSocket client sends a base64 `user:password` token and the server accepts that form. Request payload names and the observed order-book response fields (`trading_pair`, `bids`, `asks`, `timestamp`) align for the audited market-data path.

The comparison also identified non-blocking compatibility details: FastAPI trailing-slash redirects are used by a small number of list routes, and the server exposes additional routes not wrapped by the client. These do not invalidate the selected baseline. No live API, exchange, credentials or runtime service was used.

## Compatibility result

| Check | Result | Action |
|---|---|---|
| Condor revision | exact revision authorized and inspected | `FREEZE AUDIT BASELINE` |
| Hummingbot `v2.1.0` route coverage | missing required modern families | `REJECT` |
| Hummingbot `e855625…` route coverage | observed Condor/client families are present | `FREEZE SERVER BASELINE` |
| `hummingbot-api-client==1.4.1` package compatibility | wheel hash, routes, auth and audited schemas verified statically | `FREEZE ARTIFACT BASELINE` |
| Production Hummingbot revision | immutable SHA selected; release provenance remains a later concern | `HOLD PROMOTION` |

REQ-03 freezes the audit evidence, client artifact and server SHA as the implementation planning baseline. This does not authorize runtime activation, production deployment or IMP-01.

## Security-sensitive capabilities

| Capability | Upstream surface | Axodus classification |
|---|---|---|
| direct order placement/cancellation | Condor trade handlers; Hummingbot `/trading` | `REJECT / DISABLE / ISOLATE` behind `ExecutionProvider` |
| leverage, position mode and positions | Condor trading client; Hummingbot `/trading` | `REJECT / DISABLE / ISOLATE` behind Axodus Risk |
| executor creation and stop | Condor executor tools; Hummingbot `/executors` | `ADAPT` only through approved Order Intent |
| exchange credentials and API servers | Condor config manager; Hummingbot `/accounts` | `REJECT / ISOLATE`; Axodus Credential Vault owns binding |
| Gateway wallets, swaps and CLMM | Condor Gateway handlers; Hummingbot Gateway routes | `REJECT / DISABLE / ISOLATE` until separately authorized |
| bot deploy/start/stop/update | Condor orchestration; Hummingbot bot routes | `ADAPT` only through Trading Core lifecycle gates |
| local Condor risk and dry-run checks | Condor `risk.py` | `PROTECT`; supporting control, not canonical authority |

Hummingbot owns operational connector and execution mechanisms. It does not own Axodus strategy, risk, capital authority, accounting or canonical state. Condor owns neither those domains nor the provider boundary.

## Market-data architecture

```text
Hummingbot connectors / feeds
        -> Hummingbot API market-data service
        -> Axodus market-data adapter
        -> Trading Data Store / normalized market events
        -> Research, Strategy, Risk and Audit consumers
```

The modern Hummingbot candidate can supply live candles, historical candles, order-book snapshots, price/volume queries and WebSocket feed surfaces. Its order-book service obtains snapshots from connector trackers or a fresh data source and stamps the API response with service time. This is suitable as a prospective collection substrate after Axodus defines persistence, schema, clock, provenance, deduplication and recovery rules.

It does not provide the Axodus historical MVRD seed or prove durable institutional L2/L3 history. Historical seed remains necessary for Path M; prospective collection remains relevant to LTDI; System One results are unchanged.

## Ownership and action matrix

| Capability | Owner | Source/evidence | Action |
|---|---|---|---|
| Strategy | Axodus | REQ-02 / Trading Core | `PRESERVE` |
| Signals and market judgment | Axodus | REQ-02 / Trading Core | `PRESERVE` |
| Risk policy and gates | Axodus | Trading Core risk boundary | `PRESERVE / EXTEND` |
| Order Intent | Axodus | Trading Core contracts | `PRESERVE / EXTEND` |
| ExecutionProvider | Axodus | Trading Core provider boundary | `NEW / EXTEND` |
| CEX connector mechanics | Hummingbot | modern API and connector services | `REUSE / ADAPT` |
| DEX Gateway mechanics | Hummingbot/Gateway substrate | Gateway routes and clients | `PROTECT / REJECT UNTIL AUTHORIZED` |
| Order submission and fill mechanics | Hummingbot | `/trading`, executors | `ADAPT` |
| Position and portfolio normalization | Axodus | canonical ownership; provider observations | `NEW / ADAPT` |
| Credentials and key binding | Axodus | Credential Vault boundary | `PRESERVE / ISOLATE` |
| Market data acquisition | mixed | Hummingbot feeds plus Axodus store | `REUSE / ADAPT / EXTEND` |
| Historical data authority | Axodus | Trading Data Store requirement | `NEW` |
| Agent runtime | Condor | agent runtime and lifecycle | `REUSE / ISOLATE` |
| Agent-to-Trading adapter | Axodus | absent in inspected source | `NEW` |
| Backtesting substrate | Hummingbot plus Axodus | Hummingbot backtesting routes; Axodus contracts | `ADAPT / EXTEND` |
| Audit and economic accounting | Axodus | Trading Core state and audit boundaries | `PRESERVE / EXTEND` |
| Capital authority | Axodus governance/treasury boundary | REQ-02 | `PRESERVE` |

## Implementation status and gap map

| Capability | Status | Implementation implication |
|---|---|---|
| Trading Core gates, normalized state and audit skeleton | already implemented in repository evidence | preserve and expose provider contract |
| Hummingbot operational substrate | external, concrete candidate inspected | wrap behind Axodus adapter |
| Condor runtime | external, concrete audit baseline inspected | isolate behind controlled agent interface |
| `ExecutionProvider` integration | Axodus-owned boundary; adapter not verified as implemented | `NEW` / `ADAPT` after freeze |
| Credentials boundary | Axodus-owned policy and vault surfaces exist | prevent upstream direct access |
| market-data persistence and provenance | partial | implement Axodus collection/storage boundary later |
| historical MVRD seed | missing | external data gate remains open |
| agent adapter and permission mapping | missing | implement only after Condor/API freeze |
| release-grade compatibility test | missing | materialize client package or run approved contract fixture |
| live trading | intentionally not implemented/authorized | preserve HOLD |

## Proposed implementation sequence

1. Freeze the `ExecutionProvider` adapter contract and DTO isolation rules.
2. Implement Hummingbot substrate health and read-only connector discovery.
3. Implement Axodus market-data adapter and prospective persistence path.
4. Implement paper/simulation execution mapping and normalized fills/positions.
5. Add Axodus risk and capital gates at the Order Intent boundary.
6. Add Condor agent adapter with proposal-only and permission-scoped orchestration.
7. Add backtest/replay integration after data contracts are validated.
8. Add operations, reconciliation and recovery evidence.

This sequence does not authorize exchange connectivity, credentials, paper/live execution or production activation. It is a proposed engineering order pending the dependency decision.

## System One REQ-01A–A4 impact assessment

| Premise | Assessment |
|---|---|
| BUILD/COLLECT effort | `CLARIFIED`: Hummingbot can reduce future connector/feed construction; Axodus persistence and controls remain required |
| Binance integration assumptions | `UNCHANGED`: no integration or credential work authorized |
| prospective market-data collection | `CLARIFIED`: modern Hummingbot is a plausible feed substrate |
| replay/backtest capabilities | `UNCHANGED`: available candle/backtest surfaces do not establish historical L2/L3 replay |
| Hummingbot data availability | `CLARIFIED`: live candles/order-book snapshots observed; durable institutional history unproven |
| LTDI | `UNCHANGED`: prospective collection remains relevant |
| historical seed | `UNCHANGED`: still required for Path M |
| `HYBRID` recommendation | `UNCHANGED`: remains the candidate architecture |
| `BUY` gate | `UNCHANGED`: remains `HOLD` |

No System One research was re-executed.

## Documentation changes and remaining gaps

REQ-03 now records the materialized revisions, source-history result, concrete interfaces, sensitive capabilities, ownership matrix, compatibility result, market-data suitability, implementation map and proposed sequence. This document remains the SPEC-adjacent audit record; it does not replace the canonical REQ-02 architecture, Trading Core contracts or the roadmap.

Remaining gaps are explicit:

- Hummingbot server revision is frozen by SHA but is not a tagged release.
- The client wheel has no embedded source commit; provenance is version + artifact hash + upstream repository metadata.
- No live or fixture-backed client/server contract test has been run.
- Condor upstream provenance differs between its README and Trading's `.gitmodules`.
- No Axodus adapter has been implemented or validated.
- No durable Hummingbot-to-Axodus market-data persistence contract exists yet.

## Decisions required

**CTO:** no further REQ-03 decision required; the audited baseline is frozen for implementation planning. Any replacement of the pinned server/client artifacts requires a new compatibility decision.
**CEO:** `NONE`.
**Implementation:** `HOLD`.
**Capital authority:** `NONE`.

## Validation and preserved boundaries

- verified `.gitmodules`, index/tree history and absence of historical gitlinks;
- verified exact audit revisions in temporary inspection worktrees;
- inspected Condor dependencies, client calls, agent/risk behavior and sensitive routes;
- inspected Hummingbot `v2.1.0` and `e855625…` routers/services/configuration;
- compared observed Condor surface with both Hummingbot server surfaces;
- ran documentation hygiene checks after edits;
- did not run services, exchange calls, credentials, trading, production activation, upstream mutation or System One research.
