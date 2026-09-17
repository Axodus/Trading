# AXODUS-TRADING-REQ-07 — Provider Order Identity Propagation & Reconciliation Feasibility

Status: `AUDIT COMPLETE / DEPENDENCY BASELINE UNCHANGED / IMP-02 REMAINS BLOCKED`

Classification: `IDENTITY PROPAGATION NOT RELIABLE / IMP-02 REMAINS BLOCKED`

Date: 2026-09-17

## Objective and authority

This record audits the materialized source at the current REQ-04 baseline to determine whether an Axodus-controlled execution identity can cross the current Hummingbot path and return as exact provider evidence. The audit was read-only. No Hummingbot, client, connector, adapter, credential, exchange or runtime changes were made.

The selected technical direction remains `AXODUS-CONTROLLED CLIENT ORDER ID PROPAGATION`. This record does not select an implementation mechanism or authorize an upstream change.

## Sources reviewed

- `trading-core/services/trading-core/src/execution/providers/hummingbot/HummingbotHttpExecutionProvider.ts`
- `trading-core/packages/trading-contracts/src/execution/types.ts`
- `hummingbot-api-client/hummingbot_api_client/routers/trading.py`
- `hummingbot-api-client/hummingbot_api_client/models/trading.py`
- `hummingbot-api/models/trading.py`
- `hummingbot-api/routers/trading.py`
- `hummingbot-api/services/accounts_service.py`
- `hummingbot-api/services/trading_service.py`
- `hummingbot-api/services/unified_connector_service.py`
- `hummingbot-api/database/models.py`
- Hummingbot API order and trade repository surfaces
- `condor/pyproject.toml`
- `condor/handlers/cex/trade.py`
- `condor/handlers/cex/orders.py`
- `condor/handlers/cex/positions.py`
- `condor/mcp_servers/hummingbot_api/tools/history.py`
- current Git submodule metadata and repository state

The Hummingbot Core connector package is not materialized in this workspace. Hummingbot API imports it as an external `hummingbot` package and `environment.yml` installs that package without a frozen source revision. Local Python import validation therefore cannot inspect concrete connector implementations.

## Revision and provenance state

The current materialized baseline remains unchanged from REQ-04:

| Component | Current workspace revision | REQ-03 historical reference | Delta |
|---|---|---|---|
| Condor | `d89e74f2e3e273bea102c64e4977118e6a88084f` | `2105d27d94189c3207d6f8fb5d76e754bde3fa65` | `ADVANCED / REQ-04 baseline preserved` |
| Hummingbot API client | `v1.5.9`, `dae015a3c513879ed06a55cf2b2c10e5772c0962` | `1.4.1` wheel baseline | `ADVANCED / superseded by REQ-04` |
| Hummingbot API | `2494e847538bb7b819495cbc30eb4ef828feaacd` | `e85562515e4ded407595fc80d4c19fdc2e57de21` | `ADVANCED / REQ-04 baseline preserved` |
| Hummingbot Core connectors | not materialized | not materialized | `UNKNOWN` |

The Trading gitlinks and checked-out revisions remain aligned. This REQ does not change the dependency baseline.

## Identity trace

### Axodus adapter

The Axodus execution contract permits `clientOrderId` at the domain boundary. `HummingbotHttpExecutionProvider` currently maps the admitted request to the Hummingbot `TradeRequest` body with account, connector, pair, side, amount, order type and optional price. It does not transmit `clientOrderId` or an idempotency key to `POST /trading/orders`.

The provider returns the upstream `order_id` as `providerOrderId`. That value is provider evidence and is not an Axodus canonical execution identity.

### API client

The materialized client `place_order` method accepts account, connector, pair, trade type, amount, order type, price and position action. Its request body has no caller-supplied client-order identity or idempotency field. The client supports cancellation by a provider `client_order_id`, and it can enumerate/search orders and trades, but its search filters do not provide an exact Axodus identity lookup.

### Hummingbot API

The materialized `TradeRequest` has no caller-supplied client-order ID. The trading router passes the request to `accounts_service.place_trade`. That service and `trading_service` call connector `buy` or `sell` without an order ID argument. The returned value is the connector-assigned client order ID.

The server persistence model stores a unique `client_order_id` and an optional `exchange_order_id`, and repository helpers can look up rows by the internally generated client ID. This is exact lookup of Hummingbot-owned state after creation; it does not establish continuity from an Axodus-generated identity.

### Connector abstraction and concrete venues

The API source calls the generic Hummingbot connector abstraction and tracks `in_flight_orders` by provider client order ID. The concrete Hummingbot Core package is not present, so the audit cannot prove which connectors accept caller-supplied IDs, preserve them at the venue, return them through status/trade lookup, or impose venue-specific constraints.

The current API path is therefore already insufficient before venue-specific behavior is considered: no caller identity reaches the connector call.

## Compatibility and feasibility result

| Boundary | Finding | Classification |
|---|---|---|
| Axodus adapter → API client | Axodus `clientOrderId` is currently dropped from the HTTP body | `INCOMPATIBLE for propagation` |
| API client → API request model | Client and server request models have no caller ID field | `INCOMPATIBLE for propagation` |
| API service → connector buy/sell | Service calls do not pass caller identity | `INCOMPATIBLE for propagation` |
| Connector → venue | Concrete Core source/revision is absent | `UNVERIFIED` |
| Venue → status/trade lookup | No universal evidence; venue behavior is unverified and API filters lack Axodus identity | `UNVERIFIED / UNSUITABLE` |
| Condor → client | Condor consumes provider-generated IDs and can invoke direct trading surfaces | `OUTSIDE / REJECTED for Axodus authority` |

Final result: `IDENTITY PROPAGATION NOT RELIABLE / IMP-02 REMAINS BLOCKED`.

Propagation may be technically possible after a reviewed extension of the request, service, connector and lookup surfaces, but the current baseline does not prove it and no connector-level guarantee can be inferred. A future targeted implementation must first materialize and freeze the Hummingbot Core revision and define the smallest reviewed propagation contract.

## Connector and venue matrix

The matrix is intentionally conservative. `UNKNOWN` means the current source does not provide evidence; it is not permission to assume support.

| Connector or venue class | Caller ID accepted by current API path | Preserved by concrete connector/venue | Exact lookup available through current API | Reconciliation suitability |
|---|---:|---:|---:|---|
| CEX spot, representative `binance` | no | unknown; Core absent | provider-generated ID only; no Axodus ID filter | none under current baseline |
| CEX spot, representative `kraken` | no | unknown; Core absent | provider-generated ID only; no Axodus ID filter | none under current baseline |
| CEX perpetual, representative `*_perpetual` | no | unknown; Core absent | provider-generated ID only; no Axodus ID filter | none under current baseline |
| Non-Gateway DEX connectors, e.g. `hyperliquid`, `lighter`, `dexalot`, `vertex` | no | unknown; Core absent and semantics may differ | no Axodus ID filter | none under current baseline |
| Gateway/AMM surface | no caller identity in current trade request; separate Gateway path | unknown; Gateway Core absent | transaction/order evidence is not mapped to Axodus identity | none under current baseline |

The connector names above are evidence that the API recognizes or configures connector classes, not evidence that any venue accepts or preserves an Axodus-supplied identifier.

## Condor findings

- `condor/pyproject.toml` pins `hummingbot-api-client==1.5.9`.
- CEX handlers call `client.trading.place_order` through the direct Hummingbot API surface.
- Order handlers read `client_order_id` or `order_id` from provider responses and use those values for cancellation/display.
- Positions and trade handlers can reach direct placement paths.
- Condor therefore consumes provider identity after Hummingbot creates it; the audited source does not show Condor originating an Axodus `SubmissionAttempt` identity.
- These direct trading, credential, executor, portfolio and Gateway/wallet surfaces remain `REJECT / DISABLE / ISOLATE` for the Axodus execution path.

Condor remains a future external agent runtime/limited orchestration adapter. It does not own Trading lifecycle, reconciliation, risk or capital authority.

## Ownership and required boundary

| Capability | Current source | Axodus owner | Current classification | Required boundary |
|---|---|---|---|---|
| `OrderIntent` | Trading Core | Axodus | preserve | domain contract |
| `SubmissionAttempt` identity | REQ-06 contract; no provider propagation | Axodus | `NEW / BLOCKED` | attempt-scoped identity before provider submission |
| caller-supplied client order ID | absent from client/server request path | Axodus-controlled | `NEW / REQUIRES REVIEWED EXTENSION` | explicit admitted field, validation and persistence |
| provider client order ID | Hummingbot connector/API | Hummingbot evidence | `REUSE AS EVIDENCE` | never replace Axodus identity |
| exchange order ID | connector/database evidence | Axodus records evidence | `REUSE AS EVIDENCE` | preserve provenance and uncertainty |
| exact provider lookup | repository lookup by Hummingbot-generated ID; no Axodus HTTP filter | Axodus lifecycle | `NEW / BLOCKED` | lookup by propagated identity or governed evidence map |
| idempotency | not provided by current API path | Axodus | `NEW / BLOCKED` | no retry permission by itself |
| lifecycle and reconciliation | REQ-06 contract | Axodus | preserve | state machine and reconciliation service |
| connector order generation | Hummingbot Core | Hummingbot operational substrate | `PROTECT / UNVERIFIED` | only through admitted provider boundary |
| credentials, keys, wallets, Gateway | Hummingbot/Condor surfaces | Axodus authority and security boundary | `ISOLATE / REJECT` | never enter this identity path implicitly |
| strategy, risk, capital authority | Axodus domain | Axodus | preserve | no upstream ownership transfer |

## Constraints and unresolved technical questions

The following remain unanswered and require a later, explicit implementation decision:

1. Which Hummingbot Core revision is compatible with the current API and can accept a caller-supplied ID without changing unrelated behavior?
2. Which canonical CEX connectors support caller IDs, preserve them, and expose exact lookup/status/trade evidence?
3. What identifier constraints apply by venue: length, charset, uniqueness scope, case handling and reuse rules?
4. Can a single propagation contract cover CEX spot/perpetual, non-Gateway DEX connectors and Gateway/transaction-based execution, or must it be capability-specific?
5. Which minimal surfaces need changes: client model, API request, API service, connector abstraction, concrete connectors and lookup endpoints?
6. Should the change be maintained in an Axodus Hummingbot extension/fork or proposed upstream after a source-level compatibility review?
7. How should unknown outcomes be reconciled when a venue accepts an order but does not return a caller ID or provide exact lookup by that ID?

Heuristic matching on timestamp, pair, side, amount or price remains non-canonical and is not a resolution.

## REQ-06 reconciliation

### Preserved

- `PROVIDER_EXECUTION_UNKNOWN` is distinct from `FAILED`.
- Unknown outcome requires reconciliation and never authorizes blind resubmission.
- `cancel requested` is not `cancelled`.
- Hummingbot/provider IDs are evidence and do not replace Axodus identity.
- Axodus owns lifecycle, idempotency, reconciliation, risk, accounting and capital authority.
- `BLOCKER-01` remains independent and open.

### Superseded

- The assumption that the current API path might support a caller identity through an unexposed field is superseded by source evidence: the current client model, server request model and service call do not carry one.

### Invalidated

- None of the REQ-06 lifecycle invariants are invalidated.
- `IMP-02` remains blocked; this REQ does not provide design readiness.

## Tests and validation

No runtime or upstream tests were executed because this is a documentation/source audit and the concrete Hummingbot Core package is not installed in the workspace. No network, credential, exchange or order activity occurred.

Validation performed:

- repository and submodule status inspection;
- source-level trace across adapter, client, API models/routes/services, persistence and Condor handlers;
- search for caller-ID and idempotency fields/methods;
- confirmation that the current client/server request path lacks caller identity;
- confirmation that concrete connector source is not materialized;
- `git diff --check` after documentation changes.

## Decision state

- `AXODUS-TRADING-BLOCKER-02`: `OPEN / IMP-02 BLOCKING`.
- `AXODUS-TRADING-REQ-07`: `COMPLETE / DOCUMENTATION FREEZE PROPOSED / CTO REVIEW PENDING`.
- `IMP-02`: `HOLD / BLOCKED`.
- Direction retained: `AXODUS-CONTROLLED CLIENT ORDER ID PROPAGATION`.
- No adapter, shim, upstream change, connector change or dependency revision change authorized by this record.

## Global Coordination Handoff

- Workspace: `/opt/Axodus/Trading`
- Scope: REQ-07 feasibility audit for provider order identity propagation and reconciliation readiness
- Local status: audit complete; dependency baseline unchanged; `BLOCKER-02 OPEN`; `IMP-02 BLOCKED`; CTO review pending
- Validation: source trace and repository inspection completed; no runtime/external tests; documentation diff check required
- Local records changed: REQ-07 record, blocker register, status, tasks, roadmap, validation and this handoff
- Dependencies: materialized/pinned Hummingbot Core connector source; reviewed propagation contract; venue-specific evidence
- Blockers or risks: caller identity is dropped before connector invocation; exact Axodus lookup is unavailable; venue behavior is unverified; Condor direct surfaces remain outside authority boundary
- Priority impact: do not open operational `IMP-02`; plan a source-materialization and targeted identity-extension design gate
- Requested portfolio action: record `REQ-07 NOT RELIABLE / IMP-02 BLOCKED` and preserve `BLOCKER-01` independently
- Preserved boundaries: no credentials, orders, exchange connectivity, paper/live trading, Condor execution authority, WebSocket, capital or upstream modification

