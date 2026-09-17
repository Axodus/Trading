# Trading Tasks

## REQ-04 — Materialized Repository Verification & Baseline Reconciliation

Status: COMPLETE / CTO ACCEPTED / CURRENT BASELINE FROZEN / PUBLISHED

Completed:
- verified `.gitmodules` URLs, actual origins, Trading gitlinks, checked-out SHAs and clean worktrees for Condor, Hummingbot API and Hummingbot API Client
- reconciled the current source revisions against the REQ-03 historical baseline
- audited Condor agent lifecycle, orchestration, direct trading, credentials, Gateway, portfolio, positions and executor surfaces
- audited the API client HTTP/WebSocket bindings, models, authentication, market data and sensitive operational routes
- verified 337 client route/path/query/body contracts against the vendored OpenAPI specification
- identified the current WebSocket authentication incompatibility: client query token versus server header/subprotocol authentication
- classified ownership, security boundaries, market-data suitability and implementation gaps without changing source
- preserved REQ-03 provenance and updated the current baseline record

Next gate:
- execute `IMP-01A/B/C` against the restricted HTTP baseline with Axodus-defined contracts and boundaries
- keep `IMP-01D` conditional on an explicitly admitted market-data transport
- track the WebSocket incompatibility as `AXODUS-TRADING-BLOCKER-01`; do not use the client WebSocket path
- Condor integration remains later work and is outside the first implementation path

## IMP-01 — Restricted Baseline Implementation Authorization

Status: AUTHORIZED / IMPLEMENTATION GO / RESTRICTED BASELINE

Progress: `IMP-01A COMPLETE / IMP-01B COMPLETE / IMP-01C COMPLETE / IMP-01D-HTTP COMPLETE / BLOCKER-01 OPEN`

Scope:
- `IMP-01A`: freeze the current dependency SHAs and establish minimal Axodus contracts
- `IMP-01B`: implement the minimal HTTP `ExecutionProvider` adapter surface
- `IMP-01C`: validate fixtures, mocks, serialization, errors, timeouts, auth injection boundaries and upstream failure mapping offline
- `IMP-01D-HTTP`: implement only the Axodus-owned HTTP read boundary; streaming and the Trading Data Store remain deferred

Boundaries:
- Axodus retains Strategy, Signal, Market Judgment, Risk, Order Intent, Position, Portfolio, Credentials, Audit, Accounting and Capital Authority
- Hummingbot provides operational substrate capabilities only through the Axodus adapter
- Condor is not in the first execution path and cannot control execution directly
- credentials, Gateway/wallets, direct trade, real orders, paper/shadow/live trading, production and capital remain unauthorized

### IMP-01A result

Status: COMPLETE

Delivered:
- frozen programmatic dependency baseline for Condor, Hummingbot API Client and Hummingbot API
- explicit admitted transport list containing HTTP only
- Axodus-owned execution request authorization contract
- Axodus-owned upstream failure classification and `ExecutionProviderBoundaryError`
- offline tests for baseline drift, transport admission and failure shape

Validation:
- `npm run typecheck`: PASS
- `npm test`: PASS, 3 test files / 3 suites / 0 failures

Next:
- `IMP-01B` minimal HTTP `ExecutionProvider` adapter

### IMP-01B result

Status: COMPLETE

Delivered:
- minimal Axodus HTTP `ExecutionProvider` adapter for the admitted `POST /trading/orders` surface
- request mapping for market and limit order intents
- response normalization without Hummingbot DTO leakage
- correlation and authorization-header propagation through injected boundary dependencies
- typed mapping for upstream HTTP, timeout, transport and protocol failures
- dependency-baseline enforcement before any HTTP request
- offline tests for valid mapping, response mapping, failures, forbidden capabilities and revision drift

Validation:
- `npm run typecheck`: PASS
- `npm test`: PASS, 4 tests / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS

Next:
- `IMP-01C` offline contract and integration validation

### IMP-01C result

Status: COMPLETE / CTO REVIEW PENDING

Delivered:
- adversarial offline validation for serialized Axodus requests and representative Hummingbot response fixtures
- deterministic success normalization, malformed-response rejection and HTTP 4xx/5xx failure mapping
- explicit timeout and transport-failure handling as `PROVIDER_EXECUTION_UNKNOWN` with no blind retry
- correlation propagation, authorization-header injection boundary, baseline drift rejection and forbidden-capability rejection
- evidence that upstream response fields, DTOs and exceptions do not cross into Trading Core callers
- evidence that WebSocket is absent from the execution path

Validation:
- `npm run typecheck`: PASS
- `npm test`: PASS, 4 tests / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS
- Hummingbot API Client `test/test_calls_match_api_spec.py`: PASS, 337 tests

Boundaries preserved:
- no new ExecutionProvider capability
- no WebSocket, Condor, credentials, exchange connectivity, orders, collector or Trading Data Store

### IMP-01D-HTTP result

Status: COMPLETE / CTO REVIEW PENDING

Delivered:
- Axodus-owned `MarketDataProvider` contracts for candles, historical candles, prices, tickers, rates, funding and order-book snapshots
- Hummingbot HTTP adapter with normalized observations, source/receipt metadata and typed failure mapping
- explicit false stream/replay semantics and no WebSocket, incremental-book or trade capabilities
- offline validation for success, malformed data, timeout/transport failures, baseline drift, pre-HTTP rejection and upstream isolation

Validation:
- `npm run typecheck`: PASS
- `npm test`: PASS, 5 test files / 5 suites / 0 failures
- `npm run build`: PASS
- `git diff --check`: PASS

Boundaries:
- `AXODUS-TRADING-BLOCKER-01` remains `OPEN / KEEP BLOCKED / DO NOT USE`
- no collector, persistence, gap recovery, replay, MVRD acquisition, Condor, credentials, exchange or trading operations

Next:
- CTO review of the implementation commit
- separate future milestone for admitted streaming or LTDI work

## AXODUS-TRADING-BLOCKER-01 — WebSocket Authentication Remediation Design

Status: COMPLETE / CTO REVIEW PENDING

Completed:
- verified the client query-token handshake against the server Basic/subprotocol authentication contract
- verified that current client configuration cannot select a compatible authentication mode
- assessed Axodus transport adaptation, dependency update, upstream fix and continued block
- recorded Condor's client WebSocket callers and reconnect limitation
- preserved the separation between operational streaming and research-grade collection

Decision state:
- current classification: `KEEP BLOCKED / DO NOT USE`
- preferred future candidate: `ADAPT AXODUS TRANSPORT`, pending explicit implementation decision
- `IMP-01D` remains conditional; no transport or collector implementation is authorized

Record:
- `.instructions/TRADING_BLOCKER_01_REMEDIATION_DESIGN.md`

## AXODUS-TRADING-REQ-05 — Market Data Transport & Read-Boundary Freeze

Status: COMPLETE / CTO REVIEW PENDING

Result:
- `IMP-01D HTTP-SAFE / STREAMING DEFERRED`
- HTTP supports bounded reads for candles, historical candles, prices, tickers, rates, funding and order-book snapshots
- incremental order-book updates and trades remain blocked because they require the inadmissible WebSocket path
- HTTP responses do not establish sequence integrity, gap recovery, losslessness, replay or research-grade provenance

Record:
- `.instructions/TRADING_REQ_05_MARKET_DATA_TRANSPORT_READ_BOUNDARY_FREEZE.md`

Next:
- CTO review of the minimal Axodus `MarketDataProvider` contract
- no collector, Trading Data Store or WebSocket implementation

## REQ-03 — Implementation Baseline & Gap Freeze

Status: COMPLETE / DEPENDENCY BASELINE FROZEN / IMPLEMENTATION HOLD

Completed:
- materialized and audited Condor `2105d27…`
- compared Hummingbot API `v2.1.0` with `e855625…`
- rejected `v2.1.0` for the audited Condor client surface
- verified `hummingbot-api-client==1.4.1` from Condor's lockfile by materialized wheel hash
- froze Hummingbot API `e855625…` as the server baseline after static client/server compatibility review
- recorded Condor direct-authority risks and Axodus ownership boundaries
- recorded market-data capabilities and the missing durable historical L2/L3 boundary
- produced the implementation gap map and proposed sequence

Next gate:
- CTO selects or verifies the Hummingbot API server/client baseline before opening IMP-01
- no adapter or runtime implementation is authorized by this record

# Phase 0 - Trading Architecture and Product Economy

Status: IN PROGRESS

Objectives:
- define sovereign Trading Core architecture
- define Trading Core as a headless operational nucleus
- define Trading Product Layer architecture
- separate Treasury Trading from User Trading
- define product, marketplace, access, runtime, billing, security, and compliance boundaries
- define risk ownership and execution-domain gates
- define event model and shared TypeScript contracts

Deliverables:
- `TRADING_CORE_PLAN.md`
- `TRADING_CORE_ARCHITECTURE.md`
- `TRADING_PRODUCT_ECONOMY.md`
- `TRADING_MONETIZATION.md`
- `TRADING_RUNTIME_MODEL.md`
- `TRADING_SECURITY_MODEL.md`
- `TRADING_COMPLIANCE_MODEL.md`
- `trading-core/packages/trading-contracts`
- `trading-core/services/trading-core`
- `trading-core/services/trading-product`
- event contracts for execution, product, runtime, security, and compliance
- documented non-goals for deep Hummingbot runtime work
- documented non-goal for generic public AxodusAPP `/trading` route

---

# Phase 3A - Headless Trading Core Decision

Status: IN PROGRESS

Objectives:
- formalize Trading Core as background operational infrastructure
- document governed APIs and ACS workflows as the operational access path
- document WhiteRabbit as the first UI-accessible Strategy Product
- prevent generic public Trading frontend planning by default
- prevent direct user exposure of provider and Hummingbot controls

Deliverables:
- updated `DECISIONS.md`
- updated `TRADING_CORE_ARCHITECTURE.md`
- updated `TRADING_PRODUCT_ECONOMY.md`
- updated `TRADING_RUNTIME_MODEL.md`
- updated `TASKS.md`
- updated `ROADMAP.md`

Non-goals:
- no public Trading frontend routes
- no AxodusAPP pages
- no provider controls for users
- no direct Hummingbot controls

---

# Phase 1 — Execution Foundation

Status: IN PROGRESS

Objectives:
- implement the first functional Trading Core execution skeleton
- prove execution gate ordering before provider calls
- route approved executions to `SimulationProvider`
- preserve `correlationId` through the flow
- keep Hummingbot out of deep runtime scope

Deliverables:
- `TradingCore`
- `ExecutionOrchestrator`
- `ExecutionProviderRegistry`
- `SimulationProvider`
- `ProductExecutionGate`
- `StrategyAccessService`
- `TokenGateEvaluator`
- `EntitlementEvaluator`
- `RuntimeQuotaEvaluator`
- `GovernanceExecutionGuard` placeholder
- `RiskGateway` placeholder
- `TradingEventBus`
- repository interfaces
- gate-order tests for user, treasury, risk, provider lookup, correlation, and simulation execution
- product access tests for missing entitlement, token gate failure, suspended runtime, quota exhaustion, expired trial, and DAO-only rejection
- governance and sovereign risk tests for governance rejection, treasury policy rejection, emergency shutdown, domain separation, and federation strategy restrictions

---

# Phase 2 — Strategy Infrastructure

Status: PLANNED

Objectives:
- implement modular strategy systems

Deliverables:
- strategy framework
- isolated strategy execution
- strategy telemetry
- strategy lifecycle management
- allocation controls

---

# Phase 2A - Hummingbot Provider Adapter Foundation

Status: IN PROGRESS

Objectives:
- register Hummingbot as a real execution provider adapter
- preserve Trading Core sovereignty
- normalize Hummingbot runtime data into Axodus contracts
- emit provider health and connector telemetry
- keep Hummingbot DTOs inside adapter boundaries

Deliverables:
- `HummingbotProvider`
- `HummingbotRuntime`
- `HummingbotTelemetryAdapter`
- `HummingbotConfigMapper`
- `HummingbotHealthService`
- tests for registry resolution, health events, fill normalization, emergency shutdown, and DTO isolation

---

# Phase 2B - WhiteRabbit Productization and Multi-Tenant Runtime

Status: IMPLEMENTED

Objectives:
- package WhiteRabbit as the first official `StrategyProduct`
- provision independent user runtime instances for the same strategy product
- enforce runtime quota before provisioning
- model runtime suspension and recovery
- establish tenant-scoped runtime telemetry
- preserve simultaneous treasury and user strategy use

Deliverables:
- `WhiteRabbitStrategyProvider`
- `WhiteRabbitProductAdapter`
- `WhiteRabbitRuntimePolicy`
- `WhiteRabbitTelemetryProfile`
- `UserRuntimeProvisioner`
- `RuntimeLifecycleService`
- `RuntimeIsolationPolicy`
- tests for multi-user runtime isolation, quota exhaustion, runtime suspension, recovery, tenant telemetry, and treasury/user dual use

---

# Phase 3A - Headless Trading Core Decision

Status: IMPLEMENTED

Objectives:
- formalize Trading Core as a headless operational nucleus
- keep user-facing access in WhiteRabbit, Marketplace, DeFi, DEX, Academy, Governance, or ACS surfaces
- mark generic public `/trading` routes as non-goal unless scoped for internal admin or observability

Deliverables:
- architecture decision updates
- product economy updates
- runtime model updates
- roadmap/task updates

---

# Phase 3B - Trading State Infrastructure

Status: IMPLEMENTED

Objectives:
- introduce authoritative normalized state boundaries
- derive execution state from normalized events
- derive runtime state from lifecycle events
- represent provider health, degraded, offline, and suspended states
- prevent anonymous state mutation without tenant, runtime, DAO, or provider context

Deliverables:
- `TradingStateService`
- `ExecutionStateService`
- `RuntimeStateService`
- `PositionStateService`
- `PortfolioStateService`
- `ProviderStateService`
- `TradingAuditService`
- `ProviderStateRepository`
- structural tests for execution, runtime, provider, audit, and mutation preconditions

---

# Phase 3C - Event Persistence and Audit Trail Skeleton

Status: IMPLEMENTED

Objectives:
- add in-memory event persistence adapter
- add audit query layer
- reconstruct ordered correlation traces
- preserve rejection/provider audit metadata
- keep user and treasury traces separated
- guarantee failed subscribers do not prevent event persistence

Deliverables:
- `InMemoryTradingEventRepository`
- `TradingEventQueryService`
- `CorrelationTraceService`
- extended `TradingAuditService`
- tests for persistence, trace reconstruction, rejection audit, provider audit, user/treasury separation, and failed subscriber persistence

---

# Phase 4A - ACS Tenant Operator Boundary

Status: IMPLEMENTED

Objectives:
- define ACS as operator interface, not authority layer
- add ACS trading and runtime command contracts
- route ACS execution intents through normal Trading Core gate pipeline
- allow runtime pause/resume/stop commands through Trading Core only
- return normalized runtime inspection state only
- record recommendations without granting execution authorization

Deliverables:
- `AcsTradingIntent`
- `AcsRuntimeCommand`
- `AcsSupervisionRequest`
- `AcsTradingRecommendation`
- `AcsRuntimeInspectionRequest`
- `AcsTradingFeedbackEvent`
- `AcsTradingAccessService`
- ACS event types
- tests for provider isolation, tenant context, gate pipeline, pause events, normalized inspection, and recommendation non-authorization

---

# Phase 4B - WhiteRabbit Product Surface Contract

Status: IMPLEMENTED

Objectives:
- define WhiteRabbit as the only initial user-facing Trading product surface
- keep Trading Core headless
- expose safe normalized WhiteRabbit read models
- block runtime enablement without disclosure, credential binding, or entitlement
- make forbidden user actions explicit
- keep risk and compliance language visible

Deliverables:
- `WhiteRabbitProductView`
- `WhiteRabbitAccessView`
- `WhiteRabbitRuntimeView`
- `WhiteRabbitRiskView`
- `WhiteRabbitTelemetryView`
- `WhiteRabbitDisclosureView`
- `WhiteRabbitCredentialBindingView`
- `WhiteRabbitProductSurfaceService`
- tests for secret isolation, provider DTO isolation, disclosure blocking, credential blocking, entitlement blocking, and normalized runtime status

---

# Phase 5A - Credential Vault Skeleton and Runtime Credential Authority

Status: IMPLEMENTED

Objectives:
- create sovereign credential authority for User Trading
- keep Product Layer, ACS, agents, telemetry, marketplace, and frontend secret-blind
- bind runtime instances to vault references
- enforce tenant isolation and provider-scoped access
- reject withdrawal-like scopes
- support credential lifecycle events

Deliverables:
- `CredentialVaultService`
- `RuntimeCredentialBindingService`
- `CredentialAccessPolicyEvaluator`
- `CredentialLifecycleService`
- `InMemoryCredentialVaultRepository`
- `CredentialRotationPolicy`
- `CredentialAccessDecision`
- events for credential create, revoke, rotate, access denied, and runtime binding
- tests for vault reference only, secret non-exposure, invalid scope, revoked credential, tenant isolation, provider scope, and telemetry-safe serialization

---

# Phase 5B - Compliance Runtime Enforcement and Disclosure Gate

Status: IMPLEMENTED

Objectives:
- turn compliance/disclosure into active runtime gates
- block runtime provisioning, resume, execution enablement, and provider activation without required acceptance
- enforce disclosure versioning and expiration
- preserve audit trail for compliance decisions
- keep Treasury Trading outside the user disclosure flow

Deliverables:
- `ComplianceGate`
- `DisclosureAcceptanceService`
- `DisclosureRequirementEvaluator`
- `DisclosureVersionService`
- `RuntimeComplianceValidator`
- `RISK_DISCLOSURE_EXPIRED`
- `RUNTIME_COMPLIANCE_REJECTED`
- tests for missing, expired, version mismatch, valid acceptance, treasury bypass, and audit persistence

---

# Phase 5C - Runtime Provisioning API and Lifecycle Orchestration

Status: IMPLEMENTED

Objectives:
- formalize runtime provisioning as a sovereign lifecycle workflow
- enforce entitlement, compliance, credential binding, quota, runtime policy, and risk before runtime start
- normalize lifecycle states and events
- model conceptual runtime recovery
- revoke provider access on runtime termination
- prevent Product Layer from provisioning runtimes directly

Deliverables:
- `RuntimeProvisioningService`
- `RuntimeProvisioningRequest`
- `RuntimeProvisioningDecision`
- `RuntimeProvisioningPolicy`
- `RuntimeLifecycleCoordinator`
- `RuntimeRecoveryService`
- runtime lifecycle events
- tests for missing credential, missing disclosure, quota exhaustion, treasury/user separation, recovery correlation, and termination credential revocation

---

# Phase 6A - Trinity Cognitive Recommendation Engine

Status: IMPLEMENTED

Objectives:
- introduce Trinity as bounded cognitive trading operator under ACS governance
- normalize recommendation lifecycle
- support deterministic mocked market, strategy, and telemetry analysis
- emit audit-compatible Trinity events
- preserve tenant and correlation context
- prevent provider, Hummingbot, runtime, or treasury execution bypass

Deliverables:
- `TrinityTradingIntent`
- `TradingRecommendation`
- `TrinityRecommendationEngine`
- `TrinityMarketAnalysisService`
- `TrinityStrategyOptimizationService`
- `TrinityTelemetryAnalysisService`
- `TrinityRecommendationEvaluator`
- Trinity event types
- tests for ACS boundary, no provider execution, tenant context, degradation recommendation, runtime anomaly recommendation, and audit persistence

---

# Phase 6B - Trinity Autonomy Policy and Simulation Governance

Status: IMPLEMENTED

Objectives:
- establish bounded autonomy levels for Trinity and future ACS agents
- enforce simulation-first strategy mutation policy
- block autonomous production mutation without simulation/backtest/paper validation
- require governance and risk approval before production eligibility
- prevent treasury autonomous mutation
- preserve audit trail for autonomous action decisions

Deliverables:
- `AgentAutonomyPolicy`
- `TrinityAutonomyProfile`
- `SimulationApprovalPolicy`
- `BacktestGovernancePolicy`
- `StrategyMutationPolicy`
- `AutonomousActionBoundary`
- autonomy/simulation/backtest/mutation events
- tests for level 0, level 1, mutation without simulation, governance rejection, audit trail, and treasury mutation block

---

# Phase 7A - Persistent Repository Adapters and Postgres Event Store

Status: IMPLEMENTED

Objectives:
- establish durable authoritative state for Trading Core
- implement Postgres-backed repository adapters
- create initial state/event/audit migration
- preserve append-only event history
- support replay by correlation, runtime, strategy product, provider, tenant, and event type
- let runtime recovery hydrate lifecycle state from persisted runtime records
- preserve user/treasury trace isolation

Deliverables:
- `0001_trading_state.sql`
- `PostgresTradingEventRepository`
- `PostgresOrderRepository`
- `PostgresFillRepository`
- `PostgresPositionRepository`
- `PostgresPortfolioRepository`
- `PostgresRuntimeRepository`
- `PostgresProviderStateRepository`
- `PostgresClient`
- `InMemoryPostgresClient`
- runtime recovery persistence hook
- tests for durability, replay, recovery, isolation, dispatch failure, and append-only guarantees

---

# Phase 7B - Provider Reconciliation Skeleton

Status: IMPLEMENTED

Objectives:
- establish provider/runtime divergence boundaries
- compare provider side effects against Axodus normalized state
- detect provider drift, order divergence, position divergence, runtime drift, stale state, and orphan runtimes
- emit reconciliation telemetry and audit-compatible events
- generate proposals without mutating sovereign state
- preserve treasury/user reconciliation isolation

Deliverables:
- `ProviderReconciliationService`
- `OrderReconciliationService`
- `PositionReconciliationService`
- `RuntimeReconciliationService`
- `ProviderDriftDetector`
- `StaleExecutionStateDetector`
- reconciliation contracts
- reconciliation event types
- tests for drift, stale runtime, orphan runtime, proposals, isolation, and telemetry

---

# Phase 8A - Hummingbot Runtime Deep Adapter

Status: IMPLEMENTED

Objectives:
- deepen Hummingbot adapter lifecycle without sovereignty loss
- support paper runtime boot, shutdown, restart, recovery, and degradation
- normalize runtime orders, fills, balances, positions, health, connector state, and telemetry
- emit Hummingbot-specific runtime lifecycle events
- preserve DTO isolation
- keep workflows paper/simulation-first

Deliverables:
- expanded `HummingbotRuntime`
- expanded `HummingbotProvider`
- expanded `HummingbotTelemetryAdapter`
- expanded `HummingbotHealthService`
- connector config and paper session mapping
- Hummingbot lifecycle event types
- tests for boot, degradation, fills, connector failure, restart correlation, telemetry ingestion, emergency shutdown, and DTO isolation

---

# Phase 8B - WhiteRabbit Runtime Migration and Strategy Runtime Engine

Status: IMPLEMENTED

Objectives:
- migrate WhiteRabbit into `StrategyProvider -> StrategyProduct -> RuntimeInstance`
- implement runtime-native signal pipeline
- support Bollinger, ATR, RSI, volume, and candlestick filter configuration
- emit signal traces and runtime telemetry
- preserve tenant isolation and treasury/user separation
- keep Trinity parameter proposals bounded by governance/risk approval
- enforce simulation-first lifecycle

Deliverables:
- `WhiteRabbitRuntimeEngine`
- `WhiteRabbitSignalPipeline`
- `WhiteRabbitExecutionProfile`
- `WhiteRabbitStrategyState`
- `WhiteRabbitRuntimeTelemetryService`
- expanded `WhiteRabbitStrategyProvider`
- expanded `WhiteRabbitProductAdapter`
- WhiteRabbit runtime contracts
- WhiteRabbit runtime events
- tests for signal generation, tenant isolation, simulation-first lifecycle, Trinity proposal boundary, telemetry persistence, and normalized state

---

# Phase 9A - Trinity Market Intelligence and Telemetry Ingestion

Status: IMPLEMENTED

Objectives:
- give Trinity deterministic market/runtime/provider intelligence ingestion
- analyze market regime, volatility, spread, liquidity, provider quality, strategy degradation, and runtime latency
- generate telemetry-aware recommendations without execution authority
- preserve ACS boundary and tenant context
- emit intelligence events for audit and telemetry

Deliverables:
- `MarketIntelligenceService`
- `RuntimeTelemetryIngestionService`
- `ProviderQualityScoringService`
- `StrategyDegradationAnalyzer`
- `MarketRegimeDetector`
- `SpreadAnalysisService`
- `VolatilityAnalysisService`
- expanded `TrinityRecommendationEngine`
- expanded `TrinityTradingIntent`
- intelligence event types
- tests for volatility, provider quality, spread, runtime anomaly, tenant context, and audit persistence

---

# Phase 9B - Headless Trading API Boundary

Status: IMPLEMENTED

Objectives:
- expose governed headless API services for ACS and product surfaces
- support normalized read APIs, action request APIs, telemetry summaries, and runtime inspection
- keep action requests routed through ACS and Trading Core gates
- prevent direct provider execution, secret exposure, provider DTO leakage, and frontend authority
- preserve treasury/user separation

Deliverables:
- `TradingApiGateway`
- `TradingReadApi`
- `TradingActionRequestApi`
- `TradingTelemetryApi`
- `TradingRuntimeInspectionApi`
- API contracts
- tests for bypass prevention, provider isolation, secret/DTO exclusion, tenant preservation, telemetry normalization, and treasury/user separation

---

# Phase 9C - WhiteRabbit Product Surface API

Status: IMPLEMENTED

Objectives:
- expose WhiteRabbit as consumable Strategy Product surface
- support Marketplace, DeFi, DEX, Academy, Governance local pages, and ACS embedding
- expose normalized access/runtime/entitlement/quota/telemetry/disclosure/credential/provider readiness views
- support request-only product actions
- prevent provider DTO, credential, raw runtime command, direct mutation, ACS bypass, and Hummingbot leakage

Deliverables:
- `WhiteRabbitSurfaceApi`
- `WhiteRabbitQueryService`
- `WhiteRabbitActionRequestService`
- `WhiteRabbitTelemetrySummaryService`
- `WhiteRabbitQuotaViewService`
- WhiteRabbit surface API contracts
- tests for normalized state, entitlement blocking, tenant-scoped runtime, telemetry sanitization, and request-only actions

---

# Phase 10A - ACS / Trinity Command Orchestration API

Status: IMPLEMENTED

Objectives:
- standardize ACS command submission
- standardize Trinity recommendation workflow submission
- preserve tenant, runtime, execution domain, correlation, governance, and autonomy context
- return workflow approval decisions instead of direct runtime/provider authority
- persist audit trail for workflow approvals and rejections

Deliverables:
- `AcsTradingCommandApi`
- `TrinityRecommendationApi`
- `RuntimeSupervisionApi`
- `TradingWorkflowRequestService`
- `RecommendationApprovalService`
- ACS/Trinity workflow contracts
- workflow approval/rejection events
- tests for tenant preservation, runtime mutation prevention, governance rejection, risk rejection, and audit persistence

---

# Phase 10B - Postgres Bootstrap and Migration Runner

Status: IMPLEMENTED

Objectives:
- make Trading persistence operationally bootstrappable
- standardize migration execution and ordering
- track append-only migration history
- validate database connectivity and schema version
- expose normalized database health state
- support graceful shutdown hooks for local/future staging environments

Deliverables:
- `PostgresBootstrapService`
- `MigrationRunner`
- `DatabaseHealthService`
- `DatabaseConnectionManager`
- `TradingDatabaseConfig`
- `trading_schema_migrations` support in the in-memory Postgres test client
- tests for ordering, idempotency, invalid migration handling, schema version validation, and health normalization

---

# Phase 10C - Runtime Observability and Operational Telemetry

Status: IMPLEMENTED

Objectives:
- introduce internal operational observability for runtimes, providers, strategies, and telemetry pipelines
- normalize health scoring for providers, runtimes, strategies, and telemetry quality
- track runtime operational metrics
- emit telemetry events for degradation, critical health, and latency spikes
- preserve tenant isolation in observability state

Deliverables:
- `RuntimeObservabilityService`
- `ProviderObservabilityService`
- `StrategyTelemetryAggregator`
- `OperationalHealthScoringService`
- `RuntimeMetricsCollector`
- `ExecutionLatencyTracker`
- observability telemetry contracts
- operational health events
- tests for runtime/provider/strategy/latency/tenant isolation

---

# Phase 11A - Local Infrastructure Runtime

Status: IMPLEMENTED

Objectives:
- standardize local Postgres runtime for Trading Core
- run persistence against real local Postgres instead of only in-memory clients
- configure database from env
- run migrations through the existing migration runner
- validate repository/database readiness
- seed safe mock/simulation-only data
- document startup and teardown

Deliverables:
- `docker-compose.trading.yml`
- `.env.example`
- `bootstrap-local-db.ts`
- `healthcheck-db.ts`
- `seed-local-trading.ts`
- `local-db-utils.ts`
- local database config parser
- local service README updates
- tests for env validation, missing config, mock bootstrap flow, mock healthcheck flow, and production-like seed rejection

---

# Phase 11B - Migration CLI and Operational Scripts

Status: IMPLEMENTED

Objectives:
- expose migration and health services through operational CLI commands
- support human-readable and JSON output
- make local/future staging database operations repeatable
- preserve migration runner as the only schema mutation path
- prevent secret leakage in output

Deliverables:
- `trading-db` CLI
- `migrate` command
- `status` command
- `health` command
- `version` command
- `validate` command
- `seed-local` command
- JSON and human output renderers
- npm command wrapper
- tests for migrate, health, JSON, redaction, invalid command, and seed-local environment guard

---

# Phase 11C - Real Postgres Client Adapter

Status: IMPLEMENTED

Objectives:
- add a real `pg`-backed adapter behind `PostgresQueryClient`
- keep repositories decoupled from the `pg` driver
- support pooling, timeout, conservative retry, normalized errors, and graceful shutdown
- map env config into the real adapter
- use the real adapter in local operational scripts

Deliverables:
- `NodePostgresClient`
- `PostgresConnectionPool`
- `PostgresErrorMapper`
- `PostgresEnvConfig`
- `pg` runtime dependency
- local scripts updated to use `NodePostgresClient`
- tests for parameterized queries, health checks, timeouts, error normalization, shutdown, repository compatibility, and env redaction

---

# Phase 12A - Observability Query API

Status: IMPLEMENTED

Objectives:
- expose observability as safe headless read-only API
- support ACS, WhiteRabbit Product Surface, and future operator tools
- provide normalized runtime/provider/strategy health read models
- provide tenant-scoped operational telemetry snapshots
- preserve tenant isolation and prevent provider/secret leakage

Deliverables:
- `TradingObservabilityApi`
- `TenantObservabilityQueryService`
- `ObservabilityAccessGuard`
- `RuntimeHealthReadModel`
- `ProviderHealthReadModel`
- `StrategyHealthReadModel`
- `OperationalTelemetrySnapshot`
- tests for normalized reads, DTO/secret exclusion, tenant isolation, snapshot, and read-only surface

---

# Phase 12B - Trinity Observability Integration

Status: IMPLEMENTED

Objectives:
- connect normalized runtime/provider/strategy observability to Trinity recommendations
- keep Trinity recommendation-only and ACS-governed
- preserve tenant context and correlationId
- persist observability recommendation lifecycle in audit trail

Delivered:
- `TrinityObservabilityAdapter`
- runtime/provider/strategy/latency recommendation services
- observability recommendation audit service
- observability evidence model
- recommendation type expansion
- tests for runtime recovery, provider block, strategy pause/simulation, latency warning, ACS requirement, and audit persistence

---

# Phase 13A - Local Postgres End-to-End Validation

Status: IMPLEMENTED

Objectives:
- validate real local Postgres runtime end-to-end
- prove migration, health, seed, repository readiness and replay flow
- keep test gated when local Postgres env is absent
- preserve append-only event store and tenant-scoped replay

Delivered:
- `smoke-local-postgres.ts`
- `reset-local-db.ts`
- `PostgresRepositoryReadinessCheck`
- `0002_trading_events_tenant_id.sql`
- gated Postgres E2E test
- local README updates

---

# Phase 13B - Observability Risk Feedback Policy

Status: IMPLEMENTED

Objectives:
- feed observability health evidence into risk decisions
- avoid automatic provider/runtime/strategy mutation
- keep ACS/Governance as escalation authority
- preserve tenant context and auditability

Delivered:
- `ObservabilityRiskSignal`
- `ObservabilityRiskPolicy`
- `ProviderHealthRiskEvaluator`
- `RuntimeHealthRiskEvaluator`
- `StrategyHealthRiskEvaluator`
- `ObservabilityRiskDecisionService`
- `ObservabilityRiskAuditService`
- tests for provider critical, runtime critical, strategy degraded, cross-tenant rejection, audit, and final risk authority

---

# Phase 13C - Reconciliation Worker Skeleton

Status: IMPLEMENTED

Objectives:
- execute reconciliation scans locally using normalized state/snapshots
- persist reviewable reconciliation proposals
- preserve tenant isolation
- emit worker audit events
- avoid auto-healing and provider calls

Delivered:
- `ReconciliationWorker`
- `ReconciliationWorkerScheduler`
- `ReconciliationCandidateDiscoveryService`
- `ReconciliationProposalRepository`
- `RuntimeStaleScanService`
- `ProviderDriftScanService`
- `ReconciliationWorkerAuditService`
- proposal review states
- worker lifecycle events
- tests for stale runtime, provider drift, orphan runtime, tenant context, failure audit, and no provider execution methods

---

# Phase 14A - Credential Vault Real Adapter Boundary

Status: IMPLEMENTED

Objectives:
- prepare vault for future real encrypted backend
- add provider-agnostic adapter boundary
- model encrypted envelope metadata
- model ephemeral credential grants
- enforce TTL, revocation and provider/runtime/tenant scope

Delivered:
- `CredentialVaultAdapter`
- `CredentialEncryptionEnvelope`
- `KmsKeyReference`
- `EphemeralCredentialGrant`
- `CredentialGrantPolicy`
- `CredentialGrantLifecycleService`
- `CredentialVaultAdapterRegistry`
- `MockEncryptedCredentialVaultAdapter`
- tests for grant lifecycle and redacted envelope serialization

---

# Phase 14B - Paper Trading Runtime Session

Status: IMPLEMENTED

Completed:
- added paper session request/state/policy contracts
- added paper session lifecycle service
- added paper connector config validation
- added paper order ingestion and fill normalization
- added paper session audit events
- connected paper telemetry to runtime observability
- connected reconciliation dry-run to proposal-only workflow
- validated SimulationProvider and Hummingbot paper-compatible boundaries

Validation:
- lifecycle transitions covered
- live mode config rejected
- raw API key config rejected
- paper fills normalized and persisted
- observability updated from paper telemetry
- reconciliation dry-run creates proposal without mutation
- user and treasury paper sessions remain isolated

---

# Phase 15B - WhiteRabbit Paper Validation Workflow

Status: IMPLEMENTED

Completed:
- added WhiteRabbit paper validation contracts
- added WhiteRabbit paper validation service
- added paper session adapter for WhiteRabbit
- added paper telemetry summary service
- added controlled resume evaluator
- connected WhiteRabbit signal generation to paper order/fill normalization
- connected reconciliation dry-run evidence
- included Trinity recommendation IDs as advisory evidence

Validation:
- live config rejected
- required runtime/candle gates enforced
- telemetry summary remains tenant-scoped
- controlled resume blocked without evidence
- Trinity recommendation does not mutate runtime
- reconciliation dry-run remains proposal-only
- Hummingbot paper-compatible validation does not leak DTOs

---

# Phase 15C - ACS Review Flow for Reconciliation Proposals

Status: IMPLEMENTED

Completed:
- added reconciliation review contracts
- added ACS reconciliation review service
- added reconciliation remediation eligibility service
- added reconciliation proposal audit service
- added review policy defaults
- added review/remediation events
- mapped approved proposals to request-only remediation requests

Validation:
- ACS review command requires tenant context
- risk rejection blocks remediation request
- governance rejection blocks treasury remediation
- approved proposal creates remediation request only
- rejected proposal remains auditable
- reconciliation worker cannot auto-approve its own proposal

---

# Phase 3 — Risk Infrastructure

Status: PLANNED

Objectives:
- implement sovereign risk systems

Deliverables:
- exposure limits
- drawdown controls
- emergency execution controls
- treasury protection systems
- risk telemetry

---

# Phase 4 — ACS Integration

Status: PLANNED

Objectives:
- integrate AI-assisted execution

Deliverables:
- orchestration integration
- execution recommendations
- telemetry analysis
- strategy simulations
- bounded optimization

---

# Phase 5 — Cross-market Coordination

Status: FUTURE

Objectives:
- multi-market treasury coordination

Deliverables:
- cross-exchange execution
- cross-market balancing
- liquidity coordination
- exposure normalization

---

# Phase 6 — Autonomous Market Coordination

Status: FUTURE

Objectives:
- bounded autonomous execution

Deliverables:
- autonomous orchestration
- treasury-aware execution
- AI-assisted portfolio balancing
- strategy adaptation systems

Autonomous systems must remain:
- bounded
- observable
- governance-constrained

---

# Phase 16A - Paper Observability Risk Loop

Status: IMPLEMENTED

Completed:
- added paper risk signal contracts
- added paper risk decision contracts
- added paper execution quality evaluator
- added paper session health evaluator
- added paper controlled resume policy
- added paper risk decision service
- added paper risk audit events

Validation:
- high latency creates risk signal
- critical runtime blocks controlled resume eligibility
- unresolved reconciliation proposal blocks eligibility
- poor paper quality requires simulation retry
- tenant isolation preserved
- no provider call occurs during risk evaluation

---

# Phase 16B - Real Local Postgres CI Script

Status: IMPLEMENTED

Completed:
- added local E2E command runner
- added `npm run trading:local:e2e`
- added docker compose up/down orchestration
- added wait-for-postgres script
- reused `trading-db migrate`, `seed-local`, `health`, `validate`
- reused local smoke script for repository readiness and replay
- added JSON/human report formatting
- added cleanup/reset/skip-docker options

Validation:
- production-like env rejected before execution
- secrets redacted in diagnostics
- migration, seed, health, validate and smoke steps are called
- failure report is readable and stops safely

---

# AXODUS-TRADING-REQ-02 - Canonical Architecture & RAG Reconciliation

Status: COMPLETE / DOCUMENTATION VALIDATED / IMPLEMENTATION HOLD

Completed:
- audited the Trading workspace and relevant Core/Institutional authority surfaces
- recovered and classified canonical, supporting, legacy, partial, contradictory and missing architecture material
- formalized Hummingbot responsibilities and the Condor agent-runtime/orchestration boundary
- documented ownership for strategy, signals, judgment, risk, order intent, execution, state, credentials, data, agents, audit, accounting and capital authority
- reconciled architecture, SPEC/boundary guidance, roadmap and task records
- assessed REQ-01A–A4 impacts without re-running System One research

Validation:
- documentation/source inventory completed
- no conflicting Hummingbot or Condor authority statement found in checked Core/Institutional surfaces
- implementation remains unauthorized and on hold

Record:
- `.instructions/TRADING_REQ_02_CANONICAL_ARCHITECTURE_AUDIT.md`

---

# AXODUS-TRADING-REQ-03 - Hummingbot / Condor Implementation Baseline & Gap Freeze

Status: COMPLETE / DEPENDENCY BASELINE FROZEN / IMPLEMENTATION HOLD

Task:
- inspect concrete Hummingbot and Condor source, revisions, dependencies, APIs, lifecycle, licensing and tests
- map every capability to Axodus ownership and classify the action as `REUSE`, `ADAPT`, `EXTEND`, `NEW`, `PROTECT` or `REJECT`
- freeze the implementation baseline required before `IMP-01`

Resolution:
- Condor `2105d27…`, client `1.4.1` with verified wheel hash, and Hummingbot API `e855625…` are frozen for implementation planning
- static route, auth and schema compatibility was established; no live contract test was run

Boundary:
- no adapter implementation, runtime activation, credential use, trading, dataset purchase or capital authority

Record:
- `.instructions/TRADING_REQ_03_IMPLEMENTATION_BASELINE_GAP_FREEZE.md`
