# Trading Validation

Last updated: 2026-09-17

## Known Commands

Root `package.json`: NOT_PRESENT

Known validation evidence is documented in Trading-specific runbooks, including:

- `.instructions/TRADING_REQUEST_03_LOCAL_E2E_ENVIRONMENT.md`
- `.instructions/TRADING_PHASE_17B_LOCAL_POSTGRES_E2E_RUNBOOK.md`

## PORTFOLIO-REQ-01 Validation Scope

Safe documentation checks:

- `.instructions/STATUS.md` exists.
- `.instructions/TRADING_MATURITY_ASSESSMENT.md` exists.
- no live trading, exchange execution, withdrawal, credential, treasury or production claim is introduced.

## Current Validation Status

Status: PASS

Current product validation includes the documented local E2E path.

PORTFOLIO-REQ-01 result:

- Root `package.json`: not present.
- Product validation commands were not run from root.
- No dependency installation was performed.

PORTFOLIO-REQ-02 commands:

```bash
cd trading-core/services/trading-core
npm run typecheck
npm test
```

PORTFOLIO-REQ-02 results:

- Typecheck: PASS
- Tests: PASS, 240 passed / 1 skipped
- Skipped: real local Postgres E2E test

Remaining validation:

- Production or staging validation remains forbidden until explicitly approved.

## TRADING-REQ-04 Local Postgres E2E

Command:

```bash
cd trading-core/services/trading-core
npm run trading:local:e2e -- --json --cleanup
```

Result: PASS

Summary:

- `ok: true`
- `status: passed`
- `environment: local`
- `cleanup: true`
- `mock: true`
- `simulationOnly: true`
- `liveTradingEnabled: false`
- `productionReady: false`

Passed steps:

- local safety validation
- docker compose up
- wait for postgres
- run migrations
- seed local data
- database health
- schema validation
- repository readiness and replay smoke
- docker compose down

Validation evidence:

- `.instructions/TRADING_E2E_REVALIDATION_EVIDENCE.md`
- `.instructions/reports/TRADING_REQ_04_SAFE_LOCAL_POSTGRES_E2E_REVALIDATION.md`

## AXODUS-TRADING-REQ-02 Documentation Audit

Result: COMPLETE / DOCUMENTATION VALIDATED / IMPLEMENTATION HOLD

Validation performed:

- Trading instructions, architecture, decisions, roadmap, tasks, security, risk, agent, runtime, implementation inventory and Hummingbot backend ownership records reviewed
- Trading Core Hummingbot adapter and selected nested backend API market-data/backtesting surfaces reviewed
- declared submodule state checked; Condor and Hummingbot API submodule source checkouts are absent in this working tree
- Core and Institutional authority terms checked for conflicting ownership statements
- System One REQ-01A–A4 records read for impact only; no research re-executed
- documentation diff checked with `git diff --check`

Findings:

- Hummingbot is canonical as an execution substrate behind Axodus `ExecutionProvider`
- Condor is now explicitly documented as a bounded external agent runtime/orchestration adapter
- Axodus retains strategy, signal, market judgment, risk, order intent, canonical state, portfolio, credentials, audit, accounting and capital authority
- candle/backtest and normalized event replay are present in evidence; historical L2/L3 microstructure replay is not
- REQ-01A–A4 conclusions remain unchanged except for boundary clarifications

Evidence:

- `.instructions/TRADING_REQ_02_CANONICAL_ARCHITECTURE_AUDIT.md`

## AXODUS-TRADING-REQ-03 Implementation Baseline Audit

Result: `COMPLETE / DEPENDENCY BASELINE FROZEN / IMPLEMENTATION HOLD`

Evidence:

- `.gitmodules` declares `condor` and `hummingbot-api`, but `git ls-tree` and history contain no recoverable gitlinks
- controlled inspection materialized Condor `2105d27d94189c3207d6f8fb5d76e754bde3fa65`
- Hummingbot API `v2.1.0` resolved to `c908a1dcda7512445c11d32a9230fdbf6ba7b87e`; it lacks the modern route families used by Condor
- Hummingbot API `main` was inspected at `e85562515e4ded407595fc80d4c19fdc2e57de21`; its server routes structurally match the observed Condor surface
- Condor declares `hummingbot-api-client==1.4.1`; the materialized wheel SHA-256 `37e8b442c15bc3a5cf42fa9f40e9efdd74ec1d8e40d39d0ee01264e0db94a4fe` matches `uv.lock`
- static client/server comparison verified route families, HTTP Basic authentication, WebSocket token authentication and audited market-data/order-book schemas against Hummingbot `e85562515e4ded407595fc80d4c19fdc2e57de21`
- Condor credentials, direct trading, positions, executors, Gateway and bot lifecycle capabilities were classified as isolated behind Axodus boundaries
- modern Hummingbot market data includes candles, historical candles, order-book snapshots and WebSocket feed surfaces; durable Axodus historical L2/L3 persistence was not established
- both audited sources expose MIT licenses; no upstream source was changed

Implication:

- `v2.1.0` is rejected as the Condor server baseline
- `e855625…` plus the pinned client artifact is the frozen REQ-03 implementation planning baseline; it is not a production activation decision
- client source commit provenance and live/fixture-backed contract validation remain recorded limitations
- no further REQ-03 dependency decision is required; any replacement requires a new compatibility review before IMP-01
- no adapter, runtime, credential, exchange or trading implementation was performed
- System One REQ-01A–A4 was assessed only for impact and remains unchanged materially

## AXODUS-TRADING-REQ-04 Materialized Repository Verification

Result: `COMPLETE / CTO ACCEPTED / CURRENT BASELINE FROZEN / PUBLISHED`

Evidence:

- `.gitmodules` URLs match the actual origins for Condor, Hummingbot API and Hummingbot API Client
- Trading gitlinks match the checked-out SHAs: Condor `d89e74f…`, Hummingbot API `2494e847…`, client `dae015a3…`
- all three audited submodule worktrees were clean and on `main`; the client is tagged `v1.5.9` and the server describes as `v2.1.0-961-g2494e84`
- Condor's current metadata and lockfile pin `hummingbot-api-client==1.5.9`; the source checkout is the Axodus fork with package metadata retaining upstream Hummingbot URLs
- `pytest -q test/test_calls_match_api_spec.py` in the client passed: `337 passed in 1.33s`
- Condor surface test was skipped because `aiohttp` is absent; Hummingbot API focused tests failed collection because `pandas` and `fastapi` are absent; dependencies were not installed
- current server WebSocket authentication accepts Basic headers or the `hummingbot-auth` subprotocol, while the current client connects with a query `token`; this path is incompatible and remains unresolved
- current Hummingbot market data supports candles, historical candles, top-level order-book snapshots and buffered trade events, but does not establish durable sequence/gap/replay persistence for research-grade collection
- Condor direct trading, credentials, Gateway/wallet, positions and executor surfaces remain isolated behind Axodus boundaries

Implication:

- REQ-03 remains historical evidence; REQ-04 is the current materialized baseline record
- the current baseline is accepted for `IMP-01A/B/C` on the restricted HTTP surface
- the client WebSocket path is blocked and tracked as `AXODUS-TRADING-BLOCKER-01`; no workaround or upstream change was introduced
- `IMP-01D-HTTP` is complete for the admitted HTTP read boundary; streaming remains deferred
- no adapter, runtime, credential, exchange or trading implementation was performed
- REQ-01A–A4 remain materially unchanged; prospective collection is still relevant to LTDI, historical seed remains required for Path M, `HYBRID` remains the candidate and BUY remains `HOLD`

## AXODUS-TRADING-IMP-01 Authorization

Result: `COMPLETE / CTO ACCEPTED / RESTRICTED HTTP SUBSTRATE ESTABLISHED / PUBLISHED`

The accepted scope covered `IMP-01A/B/C` and the subsequent `IMP-01D-HTTP` increment: dependency and contract foundations, the minimal HTTP `ExecutionProvider` adapter, offline contract validation and the Axodus-owned HTTP market-data read boundary. WebSocket market data remains blocked by `AXODUS-TRADING-BLOCKER-01`.

## AXODUS-TRADING-IMP-01A — Dependency and Contract Foundations

Result: `COMPLETE`

Evidence:

- `AXODUS_HUMMINGBOT_DEPENDENCY_BASELINE` records the accepted REQ-04 Condor, API client and API server revisions
- `AXODUS_HUMMINGBOT_ADMITTED_TRANSPORTS` admits HTTP only; WebSocket remains blocked
- Axodus execution authorization and upstream failure contracts are defined independently from Hummingbot DTOs
- baseline drift, transport admission and failure normalization tests pass offline

Validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 3 test files / 3 suites / 0 failures
- no credentials, exchange connectivity, orders or external operations used

## AXODUS-TRADING-IMP-01B — HTTP ExecutionProvider Adapter

Result: `COMPLETE`

Evidence:

- `HummingbotHttpExecutionProvider` exposes only the Axodus `executeOrder` contract
- the adapter maps Axodus order intents to the admitted Hummingbot `POST /trading/orders` request shape
- upstream `order_id` and status are normalized into Axodus `ExecutionResult`
- HTTP, timeout, transport and invalid-response failures become typed `ExecutionProviderBoundaryError` failures
- correlation and authorization headers are injected through an explicit boundary provider
- baseline drift and unsupported order capabilities are rejected before crossing HTTP
- Hummingbot-specific client DTOs/models/exceptions are confined to the adapter implementation

Validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 4 tests / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS
- no credentials, exchange connectivity, orders or external operations used

Next:

- `IMP-01C` offline contract and integration validation

## AXODUS-TRADING-IMP-01C — Offline Contract / Integration Validation

Result: `COMPLETE / CTO ACCEPTED / PUBLISHED`

Scope:

- validate the restricted HTTP adapter offline against Axodus contracts and materialized upstream evidence
- attempt to break the boundary without adding capabilities or operational connectivity

Evidence:

- serialized Axodus requests map deterministically to the admitted `POST /trading/orders` payload
- representative upstream success responses normalize to the minimal Axodus result, including isolation of extra upstream fields
- malformed success responses produce typed `PROVIDER_PROTOCOL_ERROR` failures
- HTTP `422` maps to non-retryable `PROVIDER_REJECTED`; HTTP `503` maps to retryable `PROVIDER_UNAVAILABLE`
- timeout and non-timeout transport failures map to non-retryable `PROVIDER_EXECUTION_UNKNOWN`, with one call and no blind retry
- correlation and intent identifiers propagate through the header/auth boundary; provider does not store credential fields
- dependency drift and unsupported capabilities are rejected before HTTP
- the provider exposes no WebSocket execution path
- callers receive Axodus result/error contracts without upstream DTOs, models or exceptions

Validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 4 test files / 4 suites / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS
- `python3 -m pytest test/test_calls_match_api_spec.py` in `hummingbot-api-client`: PASS, 337 tests

Boundaries:

- no credentials, exchange connectivity, orders, Condor integration, collector, WebSocket or upstream source modification
- `IMP-01D-HTTP` is complete for the admitted HTTP read boundary; streaming remains deferred
- `AXODUS-TRADING-BLOCKER-01` remains `OPEN / WEBSOCKET BLOCKED / DO NOT USE`

## AXODUS-TRADING-REQ-05 — Market Data Transport & Read-Boundary Freeze

Result: `COMPLETE / CTO ACCEPTED / PUBLISHED / IMP-01D HTTP-SAFE / STREAMING DEFERRED`

Evidence:

- the materialized client exposes HTTP methods for candles, historical candles, prices, tickers, rates, funding information and order-book snapshots
- the materialized server exposes matching `/market-data` routes with typed candle, price, ticker and order-book response models
- no audited HTTP market-data route provides incremental order-book updates or trades; those capabilities are only represented by the blocked WebSocket surface
- Condor already consumes the HTTP market-data methods for prices, candles, historical candles, connector discovery, rates and ticker pools
- HTTP polling can support a bounded read boundary but cannot prove sequence integrity, gap recovery, losslessness, replayability or research-grade provenance

Decision:

- `IMP-01D HTTP-SAFE / STREAMING DEFERRED`
- propose a minimal Axodus-owned `MarketDataProvider`; do not expose the generic Hummingbot client or upstream models
- keep WebSocket-dependent market data under `AXODUS-TRADING-BLOCKER-01`
- keep Trading Data Store, collector, normalization persistence, recovery and replay as later Axodus work

Validation:

- source inspection completed for materialized client market-data routers, server routes/models, Condor HTTP fetchers and WebSocket evidence
- no source, dependency, adapter, collector, credential, network, exchange or runtime change was made

Record:

- `.instructions/TRADING_REQ_05_MARKET_DATA_TRANSPORT_READ_BOUNDARY_FREEZE.md`

## AXODUS-TRADING-BLOCKER-01 — WebSocket Remediation Design

Result: `COMPLETE / CTO ACCEPTED / PUBLISHED / KEEP BLOCKED`

Evidence:

- `hummingbot-api-client v1.5.9` constructs WebSocket URLs with `?token=...` and has no authentication-mode configuration hook
- Hummingbot API `2494e847…` authenticates WebSocket handshakes with `Authorization: Basic` or `hummingbot-auth` subprotocol and deliberately excludes query-string authentication
- Condor calls the client market-data and executor WebSocket surfaces and adds reconnect/backoff behavior, but cannot repair a handshake rejected by the server
- `CONFIGURE` is insufficient for the current source; an Axodus-owned transport is the preferred future candidate, while dependency update and upstream fix require separate compatibility decisions
- WebSocket-dependent market data remains blocked; HTTP execution remains admitted; research-grade persistence, gap recovery, provenance and replay remain outside this design

Validation:

- source and test inspection completed for client, server and Condor WebSocket paths
- no credentials, network WebSocket session, exchange, order, dependency update or upstream modification used

Record:

- `.instructions/TRADING_BLOCKER_01_REMEDIATION_DESIGN.md`

## AXODUS-TRADING-IMP-01D-HTTP — Market Data Read Boundary

Result: `COMPLETE / CTO ACCEPTED / PUBLISHED / HTTP-SAFE / STREAMING DEFERRED`

Evidence:

- `MarketDataProvider` is Axodus-owned and exposes only admitted read capabilities: candles, historical candles, prices, tickers, rates, funding and order-book snapshots
- Hummingbot-specific models, DTOs and exceptions are confined to the adapter implementation
- observations preserve venue, instrument, observed time, receipt time, correlation and optional source timestamps/references
- snapshot metadata explicitly does not claim continuous, lossless, sequenced, gap-recovered or replayable semantics
- malformed protocol responses, timeout/transport failures, baseline drift and invalid requests become typed Axodus failures
- no incremental order-book, trade, WebSocket or generic Hummingbot capability is exposed

Validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 5 test files / 5 suites / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS

Boundaries:

- no collector, Trading Data Store, persistence, gap recovery, deduplication, replay, historical MVRD acquisition, Condor, credentials, exchange connectivity, orders, production or capital
- `AXODUS-TRADING-BLOCKER-01` remains open; streaming is deferred

Record:

- `.instructions/TRADING_IMP_01D_HTTP_MARKET_DATA_BOUNDARY.md`

## AXODUS-TRADING-REQ-06 — Execution State, Reconciliation & Idempotency Freeze

Result: `COMPLETE / CTO ACCEPTED / PUBLISHED / IMP-02 BLOCKED`

Scope:

- inspect materialized Axodus execution contracts and Hummingbot HTTP client/server source
- verify submit requests have no caller-supplied client order ID or idempotency field
- verify active-order, historical-order and trade searches lack exact order-ID lookup filters
- verify cancellation accepts active in-flight IDs and returns initiation evidence rather than terminal cancellation
- freeze the Axodus lifecycle, identity/attempt model, ambiguity semantics, reconciliation algorithm and durable recovery requirements
- classify the current provider identity/reconciliation gap as blocking operational `IMP-02`

Findings:

- `PROVIDER_EXECUTION_UNKNOWN` remains distinct from `FAILED` and never authorizes blind submission retry
- Hummingbot provider IDs are external evidence; they do not replace Axodus `OrderIntentId` or idempotency identity
- current provider-side idempotency is `NOT AVAILABLE / UNVERIFIED`
- current exact unknown-outcome reconciliation is `PARTIAL / UNSAFE`; no direct provider lookup by Axodus identity is available
- cancellation is `PARTIAL / UNSAFE` for unknown state because the provider only initiates cancellation for active in-flight IDs

Non-goals:

- no lifecycle implementation, persistence changes, credentials, exchange connectivity, orders, paper/shadow/live trading, Condor integration, WebSocket work or upstream modification

Decision state:

- `IMP-02`: `BLOCKED` for operational lifecycle pending CTO decision on the identity/reconciliation gap
- `AXODUS-TRADING-BLOCKER-01`: preserved open and independent

Record:

- `.instructions/TRADING_REQ_06_EXECUTION_STATE_RECONCILIATION_IDEMPOTENCY_FREEZE.md`

## AXODUS-TRADING-REQ-07 — Provider Order Identity Propagation & Reconciliation Feasibility

Result: `COMPLETE / CTO ACCEPTED / PUBLISHED / IMP-02 REMAINS BLOCKED`

Validation scope:

- traced the current identity path from Axodus execution adapter through the client and Hummingbot API to connector calls;
- inspected Condor direct trading and provider-ID consumption surfaces;
- inspected persistence fields for provider client and exchange order IDs;
- inspected dependency/source metadata for the concrete Hummingbot Core connector package.

Findings:

- Axodus `clientOrderId` is currently dropped before `POST /trading/orders`;
- client/server request models have no caller-supplied client-order ID or idempotency key;
- API services call connector `buy/sell` without caller identity;
- provider-generated `client_order_id` and optional `exchange_order_id` are evidence, not Axodus identity continuity;
- exact repository lookup exists for provider-generated IDs, but no current HTTP lookup by Axodus identity exists;
- concrete connector source is not materialized or revision-pinned, so venue-level acceptance/preservation/lookup is unverified;
- Condor remains outside the Axodus execution path and cannot own identity or lifecycle semantics.

Classification: `IDENTITY PROPAGATION NOT RELIABLE / IMP-02 REMAINS BLOCKED`.

Tests:

- no runtime/upstream tests executed; this was a read-only source audit and the concrete Hummingbot Core package is unavailable locally;
- no credentials, network exchange calls, orders or external operations;
- repository/source inspection and documentation diff validation completed.

Boundaries:

- no Hummingbot/client/connector modification;
- no adapter, shim, heuristic reconciliation or retry implementation;
- `PROVIDER_EXECUTION_UNKNOWN` remains distinct from `FAILED` and never authorizes blind retry;
- `BLOCKER-01` remains independent and open.

Record:

- `.instructions/TRADING_REQ_07_PROVIDER_ORDER_IDENTITY_PROPAGATION_FEASIBILITY.md`

## AXODUS-TRADING-REQ-08 — Hummingbot Core & Connector Execution Baseline Audit

Result: `COMPLETE / CORE BASELINE UNRESOLVED / IMP-02 BLOCKED`

Validation scope:

- compared `.gitmodules` declarations with actual remotes and checked-out gitlinks for Condor, Hummingbot API client and Hummingbot API;
- inspected API manifests, Dockerfile, Compose, setup script, CI workflow, startup compatibility guard and Git history;
- searched the workspace for Hummingbot Core source, wheels, lockfiles and installed package;
- inspected the API's Core-facing connector and Gateway boundaries;
- did not materialize an arbitrary upstream Core revision because no current immutable provenance was recoverable.

Findings:

- current API environment installs `hummingbot` without a version or revision;
- current Docker and workflow records do not identify the Core artifact or image digest;
- `main.py` checks only the current Core attribute surface, whose required list is empty;
- an old `hummingbot==20241125` pin exists in API history but is not the current baseline;
- local `hummingbot` import fails because the package is not installed;
- Core-level `ClientOrderTracker`, `InFlightOrder`, ID generation, Binance connector behavior and Gateway/DEX preservation remain unverified.

Classification: `CORE BASELINE UNRESOLVED`.

Tests and limits:

- repository/provenance inspection completed;
- no Hummingbot Core or connector tests executed because the exact Core dependency is absent;
- no credentials, network exchange calls, orders, dependency changes or upstream modifications;
- REQ-07 identity findings and `AXODUS-TRADING-BLOCKER-02` remain preserved.

Record:

- `.instructions/TRADING_REQ_08_HUMMINGBOT_CORE_CONNECTOR_EXECUTION_BASELINE_AUDIT.md`

## AXODUS-TRADING-REQ-09 — Hummingbot Core Provenance Recovery & Immutable Baseline Freeze

Result: `COMPLETE / PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED / IMP-02 BLOCKED`

Validation scope:

- inspected the API commit history around dependency pins and removals;
- inspected current and historical `environment.yml`, Dockerfile, Compose, setup script and CI workflow;
- inspected API tags, reachable refs and unreachable Git objects;
- verified that no exact Core revision, wheel, lockfile or image digest is available in the current workspace;
- did not select or materialize arbitrary Core HEAD, a same-date commit or a historical package pin as a substitute for immutable provenance.

Findings:

- `hummingbot==20241125` was explicitly pinned at `88400de...` and later removed;
- `hummingbot==20250715` was explicitly pinned at `68367ab...` and later removed;
- current API revision `2494e847...` installs `hummingbot` without version/revision and documents the unpinned state as deliberate;
- no evidence maps either historical package pin to a Core commit or artifact used by the current API baseline;
- the historical evidence is partial and does not support a reproducible Core baseline.

Classification: `PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED`.

Tests and limits:

- repository history and provenance inspection completed;
- no Core or connector runtime tests executed because no immutable Core dependency is available;
- no dependency changes, upstream modifications, credentials, exchange calls or orders;
- REQ-08 and REQ-07 findings remain preserved.

Decision state:

- historical Core reconstruction is not defensible from the workspace evidence;
- a prospective Axodus Core qualification is a separate CTO decision;
- `AXODUS-TRADING-BLOCKER-02` and `IMP-02` remain open/blocked.

Record:

- `.instructions/TRADING_REQ_09_HUMMINGBOT_CORE_PROVENANCE_RECOVERY.md`

## AXODUS-TRADING-VAL-02B — Offline Deterministic CEX Lifecycle & Reconciliation Acceptance

Date: 2026-09-17

Commands:

```bash
cd trading-core/services/trading-core
npm run typecheck
node test/val-02b-cex-lifecycle.test.mjs
npm test
git diff --check
```

Results:

- typecheck: PASS;
- dedicated VAL-02B suite: 12 passed, 0 failed;
- full regression: PASS after validation fixes;
- diff check: PASS;
- no credentials, exchange connectivity, orders, WebSocket or upstream changes.

Coverage includes acknowledged/rejected submission, timeout ambiguity, exact reconciliation, not-found policy, indeterminate evidence, malformed responses, provider failures, partial fills, cancellation ambiguity, terminal protection, connector admission, Gateway/DEX rejection, snapshot recovery and concurrent/repeated operations.

Classification: `CEX RECONCILIATION PARTIALLY VALIDATED / BLOCKER-02 REMAINS OPEN`.

The in-memory repository supports snapshot-equivalent recovery validation. Durable persistence and crash/process recovery remain unvalidated and are not claimed complete.

Record: `.instructions/TRADING_VAL_02B_OFFLINE_CEX_LIFECYCLE_RECONCILIATION.md`.


## AXODUS-TRADING-VAL-02A — Offline End-to-End Execution Identity Validation

Date: 2026-09-17

Commands:

```bash
cd trading-core/services/trading-core
npm run typecheck
npm test
```

Results:

- Typecheck: PASS
- Tests: 6 suites, 6 passed, 0 failed, 0 skipped
- Test suites:
  - execution-orchestrator.test.mjs: PASS
  - imp-01a-foundations.test.mjs: PASS
  - imp-01b-http-adapter.test.mjs: PASS (includes identity propagation test)
  - imp-01d-http-market-data.test.mjs: PASS
  - postgres.e2e.test.mjs: PASS
  - val-02a-identity.test.mjs: PASS

Python runtime tests: NOT RUN (sandbox pip install blocked by network isolation)

Static validation for Python:
- API TradeRequest.client_order_id field_validator: VERIFIED (source inspection)
- service propagation chain: VERIFIED (source diff)
- Core ExchangePyBase caller ID selection: VERIFIED (source diff)
- Core duplicate ID rejection: VERIFIED (source diff)
- InFlightOrder constructor receives client_order_id: VERIFIED (source inspection)
- ClientOrderTracker indexes by client_order_id: VERIFIED (source inspection)

## AXODUS-TRADING-REQ-12 — Durable Execution State & Recovery Architecture Freeze

Date: 2026-09-17

Validation scope:

- inspected PostgreSQL client, pool, migration runner, database bootstrap and local E2E wiring;
- inspected Trading repositories, event persistence/replay, lifecycle repository and recovery workers;
- inspected existing tests for migration repeatability, PostgreSQL adapters, event persistence and CEX lifecycle behavior;
- did not modify runtime code, run exchange connectivity, use credentials or add dependencies.

Results:

- PostgreSQL connectivity/migration/event foundations: `REUSE CANDIDATE`;
- durable CEX `SubmissionAttempt` aggregate: `NOT PRESENT`;
- atomic aggregate plus evidence plus audit transition: `NOT PROVEN`;
- single-connection transaction abstraction: `NOT PROVEN`;
- durable CAS/version and worker fencing: `NOT FOUND`;
- transactional outbox: `NOT FOUND`;
- crash/process restart and cross-worker validation: `NOT EXECUTED / IMPLEMENTATION NOT PRESENT`.

Classification: `DURABLE ARCHITECTURE PARTIAL / DEPENDENCY DECISION REQUIRED`.

Record: `.instructions/TRADING_REQ_12_DURABLE_EXECUTION_STATE_RECOVERY_ARCHITECTURE_FREEZE.md`.

## AXODUS-TRADING-IMP-02C0 — Durable Execution Persistence Primitives

Date: 2026-09-17

Status: `IMPLEMENTED / VALIDATION READY / CTO REVIEW PENDING`

Commands executed from `trading-core/services/trading-core`:

```bash
npm run typecheck
TRADING_POSTGRES_E2E=1 npm test
npm run build
git diff --check
```

Results:

- typecheck: PASS;
- full service suite: PASS, 9 test files, 0 failures;
- real PostgreSQL C0 coverage: PASS for rollback atomicity, single-connection transaction use, CAS conflict, attempt/evidence/outbox atomic commit and restart visibility;
- build: PASS;
- diff check: PASS.

The test uses local PostgreSQL only and does not use credentials, exchange connectivity, orders, WebSocket or upstream modifications. Full durable lifecycle recovery, worker coordination and crash-window validation remain future `VAL-02C` scope.

Record: `.instructions/TRADING_IMP_02C0_DURABLE_EXECUTION_PERSISTENCE_PRIMITIVES.md`.

## AXODUS-TRADING-IMP-02C — Durable CEX Lifecycle & Crash Recovery

Date: 2026-09-18

Status: `IMPLEMENTED / VALIDATION EVIDENCE READY / CTO REVIEW PENDING`

Validation commands and results:

```bash
npm run typecheck
npm run build
npm test
TRADING_POSTGRES_E2E=1 node --test test/imp-02c-durable-lifecycle.test.mjs test/imp-02c0-durable-persistence.test.mjs
npm run trading:local:e2e -- --json --cleanup
git diff --check
```

Results:

- typecheck: PASS;
- build: PASS;
- full service suite: PASS, 10 test files, 10 passed, 0 failed;
- real PostgreSQL IMP-02C/IMP-02C0 targeted suite: PASS, 7 tests, 0 failed;
- local simulation E2E: PASS, including migration 0003, health, schema validation, repository readiness, replay smoke and cleanup;
- simulation-only safeguards: `mock=true`, `liveTradingEnabled=false`, `productionReady=false`;
- no credentials, exchange connectivity, orders, WebSocket or upstream modifications.

The evidence covers durable restart using new service/repository instances, concurrent CAS-safe recovery, exact reconciliation, cancellation ambiguity and no-blind-resubmission behavior. It does not yet prove OS-level crash injection or complete failure-window A–J acceptance. `VAL-02C` remains next and `BLOCKER-02` remains open.

Record: `.instructions/TRADING_IMP_02C_DURABLE_CEX_LIFECYCLE_CRASH_RECOVERY.md`.

## AXODUS-TRADING-VAL-02C — Durable Crash Recovery Acceptance

Date: 2026-09-18

Status: `COMPLETE / CTO ACCEPTED`

Classification: `DURABLE CEX LIFECYCLE & CRASH RECOVERY VALIDATED / BLOCKER-02 CLOSURE ACCEPTED`.

Accepted evidence:

- typecheck: PASS;
- build: PASS;
- full service suite: 10/10 test files passed;
- targeted IMP-02C/IMP-02C0 PostgreSQL suite: 7/7 passed;
- local simulated E2E with migrations, health/schema/readiness/replay smoke and cleanup: PASS;
- `git diff --check`: PASS;
- restart with new service/repository instances, exact reconciliation, ambiguous submission/cancellation recovery and stale-worker CAS protection: PASS.

Boundary: this validates the Axodus-controlled simulated/provider path. It does not validate a real exchange, real credentials, real orders or production behavior. `BLOCKER-02` was closed by CTO review on 2026-09-18; `BLOCKER-01` remains open and WebSocket remains prohibited from the correctness path.

## AXODUS-TRADING-VAL-03 — Hummingbot Runtime & CEX Provider Integration Acceptance

Date: 2026-09-18

Status: `IN PROGRESS / FULL CONTROLLED RUNTIME EVIDENCE / CTO REVIEW PENDING`

Current evidence:

- isolated Python 3.12.14 environment created;
- materialized API imports with `hummingbot==20260901` installed only in the isolated environment;
- `hummingbot-api-client/test/test_calls_match_api_spec.py`: 337 passed;
- API service tests that import `TradingService` require the controlled service dependency/runtime surface and are not yet accepted as a complete VAL-03 result;
- no credentials, exchange connectivity, orders, WebSocket, Condor, DEX or capital used.

Additional evidence collected on 2026-09-18:

- Python 3.12.14 isolated runtime;
- Core compatibility: 5/5 passed;
- API order synchronization: 6/6 passed;
- API reconciliation batching: 7/7 passed;
- client contract suite under Python 3.12: 337/337 passed;
- Trading Core typecheck, build and 10/10 test files: PASS;
- history pagination service test: bounded 30-second run exceeded timeout and remains unaccepted;
- the earlier broad API service test batch was interrupted after entering service/database-dependent execution and is not reported as passing.

The temporary `hummingbot==20260901` installation is validation-only. It is not a new Axodus dependency baseline and does not replace the frozen repository gitlinks.

The full controlled lifespan layer is now complete for the accepted scope; final VAL-03 status remains pending CTO review of the isolated order-history timeout.

Controlled harness update on 2026-09-18: PASS for health, submission identity preservation, exact lookup, cancellation, malformed request rejection before provider invocation, provider rejection, transport failure normalization, no blind retry after transport ambiguity and service reconstruction over a controlled local store. The full lifespan harness additionally passed real startup/shutdown hooks, PostgreSQL schema/repository wiring, Core import/initialization in the service process, controlled connector submission/lookup/cancellation, restart visibility and deterministic cleanup. It used no external provider or WebSocket.

The materialized API validation handler was minimally corrected to stringify exception values in Pydantic validation context before JSON serialization. The order-history cursor test remains `NOT ACCEPTED` after a finite 30-second timeout. Source inspection indicates order history is outside submission, exact reconciliation, cancellation and crash-recovery correctness paths; it is proposed as a documented non-critical limitation, pending CTO review. The temporary `hummingbot==20260901` installation is validation-only.

Record: `.instructions/TRADING_VAL_03_HUMMINGBOT_RUNTIME_CEX_PROVIDER_ACCEPTANCE.md`.
