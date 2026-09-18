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
- preserve the published restricted HTTP baseline as the completed IMP-01 result
- proceed to `AXODUS-TRADING-REQ-06` for execution lifecycle, reconciliation and idempotency contract freeze
- track the WebSocket incompatibility as `AXODUS-TRADING-BLOCKER-01`; do not use the client WebSocket path
- Condor integration remains later work and is outside the first implementation path

## IMP-01 — Restricted Baseline Implementation Authorization

Status: COMPLETE / CTO ACCEPTED / RESTRICTED HTTP SUBSTRATE ESTABLISHED / PUBLISHED

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

Status: COMPLETE / CTO ACCEPTED / PUBLISHED

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

Status: COMPLETE / CTO ACCEPTED / PUBLISHED

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
- proceed to `AXODUS-TRADING-REQ-06` execution lifecycle, reconciliation and idempotency freeze
- separate future milestone for admitted streaming or LTDI work

## AXODUS-TRADING-BLOCKER-01 — WebSocket Authentication Remediation Design

Status: COMPLETE / CTO ACCEPTED / PUBLISHED / KEEP BLOCKED

Completed:
- verified the client query-token handshake against the server Basic/subprotocol authentication contract
- verified that current client configuration cannot select a compatible authentication mode
- assessed Axodus transport adaptation, dependency update, upstream fix and continued block
- recorded Condor's client WebSocket callers and reconnect limitation
- preserved the separation between operational streaming and research-grade collection

Decision state:
- current classification: `KEEP BLOCKED / DO NOT USE`
- preferred future candidate: `ADAPT AXODUS TRANSPORT`, pending explicit implementation decision
- `IMP-01D-HTTP` is complete for the admitted HTTP read boundary; streaming remains deferred and no collector is authorized

Record:
- `.instructions/TRADING_BLOCKER_01_REMEDIATION_DESIGN.md`

## AXODUS-TRADING-REQ-05 — Market Data Transport & Read-Boundary Freeze

Status: COMPLETE / CTO ACCEPTED / PUBLISHED

Result:
- `IMP-01D HTTP-SAFE / STREAMING DEFERRED`
- HTTP supports bounded reads for candles, historical candles, prices, tickers, rates, funding and order-book snapshots
- incremental order-book updates and trades remain blocked because they require the inadmissible WebSocket path
- HTTP responses do not establish sequence integrity, gap recovery, losslessness, replay or research-grade provenance

Record:
- `.instructions/TRADING_REQ_05_MARKET_DATA_TRANSPORT_READ_BOUNDARY_FREEZE.md`

Next:
- `AXODUS-TRADING-REQ-06` execution lifecycle, reconciliation and idempotency freeze
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


## AXODUS-TRADING-REQ-06 — Execution State, Reconciliation & Idempotency Freeze

Result: COMPLETE / CTO ACCEPTED / PUBLISHED / IMP-02 BLOCKED

Completed:

- verified Hummingbot client/server submission, identity, search, fills, cancellation and restart surfaces from the materialized REQ-04 baseline
- froze the Axodus lifecycle, identity/attempt model, reconciliation algorithm, restart durability and cancellation semantics
- classified missing provider caller identity, idempotency and exact unknown-outcome lookup as an implementation blocker
- defined the implementation gap map and proposed sequence for future IMP-02

Decision:

- IMP-02 is blocked for operational execution lifecycle until CTO selects a remedy for the provider identity/reconciliation gap
- AXODUS-TRADING-BLOCKER-01 remains independent and open

Boundaries:

- no lifecycle implementation, persistence changes, credentials, exchange connectivity, orders, paper/shadow/live trading, Condor integration, WebSocket work or upstream modification

Record:

- .instructions/TRADING_REQ_06_EXECUTION_STATE_RECONCILIATION_IDEMPOTENCY_FREEZE.md

## AXODUS-TRADING-REQ-07 — Provider Order Identity Propagation & Reconciliation Feasibility

Result: `COMPLETE / CTO ACCEPTED / PUBLISHED / IMP-02 REMAINS BLOCKED`

Completed:

- traced Axodus `clientOrderId` through the current adapter, API client, Hummingbot API request model/router/services and persistence;
- confirmed the current path drops caller identity before connector `buy/sell`;
- confirmed Hummingbot persistence exposes provider-generated IDs but does not create Axodus identity continuity;
- confirmed concrete Hummingbot Core connector source is not materialized or revision-pinned;
- classified venue-level caller-ID acceptance, preservation and lookup as unverified;
- preserved Condor as outside the Axodus execution authority boundary;
- preserved REQ-06 unknown-outcome and no-blind-retry invariants.

Decision:

- `AXODUS-TRADING-BLOCKER-02`: `OPEN / IMP-02 BLOCKING`;
- final classification: `IDENTITY PROPAGATION NOT RELIABLE / IMP-02 REMAINS BLOCKED`;
- direction retained: `AXODUS-CONTROLLED CLIENT ORDER ID PROPAGATION`;
- no adapter, shim, upstream modification, connector modification or heuristic reconciliation was implemented.

Next gate:

- materialize and freeze the Hummingbot Core connector source;
- select canonical connectors/venues for a targeted extension design;
- define request, persistence and exact evidence lookup contracts before implementation.

Record: `.instructions/TRADING_REQ_07_PROVIDER_ORDER_IDENTITY_PROPAGATION_FEASIBILITY.md`.

## AXODUS-TRADING-REQ-08 — Hummingbot Core & Connector Execution Baseline Audit

Result: `COMPLETE / CORE BASELINE UNRESOLVED / IMP-02 BLOCKED`

Completed:

- verified `.gitmodules` URLs, actual remotes, Trading gitlinks, checked-out SHAs, branch/tag relationships and dirty state for Condor, Hummingbot API client and Hummingbot API;
- verified the current API acquisition path installs `hummingbot` unpinned and does not record a Core repository, commit, package lock or image digest;
- recovered the historical `hummingbot==20241125` pin as provenance only and preserved it as superseded by the current unpinned state;
- confirmed the local workspace contains no Hummingbot Core source, wheel, lockfile or installed package;
- mapped the API's Core-facing connector boundary and recorded that Binance spot/perpetual and Gateway/DEX identity behavior cannot be verified without the exact Core source.

Disposition:

- final classification: `CORE BASELINE UNRESOLVED`;
- REQ-07 findings preserved; no prior identity conclusion invalidated;
- `AXODUS-TRADING-BLOCKER-02` remains open and `IMP-02` remains blocked;
- no Core, API, client, connector, adapter, shim or dependency modification was made.

Next gate:

- obtain or freeze immutable Core provenance;
- repeat the targeted Core and connector identity trace;
- do not select upstream HEAD, `latest`, or the historical package pin by approximation.

Record: `.instructions/TRADING_REQ_08_HUMMINGBOT_CORE_CONNECTOR_EXECUTION_BASELINE_AUDIT.md`.

## AXODUS-TRADING-REQ-09 — Hummingbot Core Provenance Recovery & Immutable Baseline Freeze

Result: `COMPLETE / PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED / IMP-02 BLOCKED`

Completed:

- recovered API history for the explicit `hummingbot==20241125` and `hummingbot==20250715` pins and their later removals;
- inspected current dependency, Docker, Compose, setup and CI provenance;
- confirmed no current Core SHA, package artifact, lockfile or image digest is recorded;
- checked reachable tags and unreachable Git objects for a hidden immutable recovery path;
- preserved the distinction between historical evidence and a new prospective Axodus baseline.

Disposition:

- historical Core reconstruction: `NOT DEFENSIBLE`;
- final classification: `PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED`;
- `AXODUS-TRADING-BLOCKER-02` remains open and `IMP-02` remains blocked;
- Binance spot/perpetual and Gateway/DEX identity tracing remains on hold;
- no dependency, Core, API, client, connector or runtime modification was made.

Next gate:

- CTO selects immutable historical provenance or authorizes a prospective Axodus Core qualification;
- only after that selection, materialize the Core and resume targeted connector identity tracing.

Record: `.instructions/TRADING_REQ_09_HUMMINGBOT_CORE_PROVENANCE_RECOVERY.md`.


## VAL-02A — Offline End-to-End Execution Identity Validation

Status: COMPLETE / CTO REVIEW READY

Classification: IDENTITY PROPAGATION VALIDATED / TRACKING VALIDATED / VENUE VALIDATION PENDING

Completed:
- exact caller identity propagation from Axodus adapter through API, service, Core, to InFlightOrder (PASS)
- native Hummingbot ID fallback when caller ID absent (PASS)
- OrderTracker registration and retrieval by exact caller ID (PASS)
- cancellation path locates order by propagated client ID offline (PASS)
- exchange_order_id coexistence does not corrupt client_order_id (PASS)
- duplicate active caller ID rejected deterministically before submission (PASS)
- invalid identity (empty, whitespace, too long, bad charset) rejected at API boundary with field_validator (PASS)
- ambiguous submission preserves PROVIDER_EXECUTION_UNKNOWN with no retry (PASS)
- IMP-01 execution regression: all tests pass (PASS)
- IMP-01D market-data regression: all tests pass (PASS)
- WebSocket isolation confirmed: no WS path on adapter (PASS)

Python-side (Core/API) runtime tests:
- NOT RUN due to sandbox network isolation (pip install blocked)
- validation for Python side is static trace through modified source
- this is documented and does not convert NOT RUN into PASS

Validation fixes applied (IMP-02A criteria):
- added field_validator for client_order_id in TradeRequest (length <= 32, charset, non-empty)
- added duplicate active ID rejection in ExchangePyBase._create_order

Next gate:
- CTO review of VAL-02A
- if accepted, IMP-02A moves to COMPLETE / CTO ACCEPTED
- BLOCKER-02 remains OPEN (venue/reconciliation pending)
- IMP-02B remains HOLD

## IMP-02A — Provider Order Identity Propagation Foundation

Status: COMPLETE / CTO REVIEW READY (pending VAL-02A acceptance)

Validation fixes:
- field_validator for client_order_id at API boundary
- duplicate active ID rejection at Core boundary


## AXODUS-TRADING-IMP-02B — Canonical CEX Execution Lifecycle & Reconciliation

Result: `IMPLEMENTED / CTO REVIEW PENDING / VAL-02B NEXT`

Completed:

- implemented Axodus-owned CEX submission-attempt lifecycle contracts;
- generated a distinct execution client order identity per attempt;
- added capability admission for caller identity, exact lookup and deterministic reconciliation;
- added exact reconciliation outcomes `found`, `not-found` and `indeterminate`;
- preserved `PROVIDER_EXECUTION_UNKNOWN` and prohibited automatic resubmission;
- modeled cancellation request and cancellation completion separately;
- exposed recoverable states for later durable restart/recovery integration;
- kept Gateway/DEX, WebSocket, Condor, credentials and operational trading outside the implementation.

Validation:

- `npm test` from `trading-core/services/trading-core`: 7 test files passed, 0 failed;
- typecheck/test compilation passed as part of the test command;
- `VAL-02B` is not yet executed;
- `AXODUS-TRADING-BLOCKER-02` remains open pending VAL-02B.

Record: `.instructions/TRADING_IMP_02B_CEX_LIFECYCLE_RECONCILIATION.md`.

## AXODUS-TRADING-VAL-02B — Offline Deterministic CEX Lifecycle & Reconciliation Acceptance

Result: `COMPLETE / CEX RECONCILIATION PARTIALLY VALIDATED / BLOCKER-02 REMAINS OPEN`.

Completed:

- validated acknowledged, rejected and ambiguous submission paths;
- validated exact `FOUND`, `NOT_FOUND` and `INDETERMINATE` outcomes without blind resubmission;
- validated malformed evidence, provider lookup failure, cancellation ambiguity and terminal-state protection;
- validated repeated/concurrent reconciliation safety and connector capability admission;
- validated Gateway/DEX exclusion and WebSocket-independent correctness;
- validated snapshot-equivalent reconstruction in a new service instance.

Limitation: lifecycle persistence is currently in memory. Durable restart/recovery and cross-process concurrency remain outside the implementation and keep `AXODUS-TRADING-BLOCKER-02` open.

Record: `.instructions/TRADING_VAL_02B_OFFLINE_CEX_LIFECYCLE_RECONCILIATION.md`.

## AXODUS-TRADING-REQ-12 — Durable Execution State & Recovery Architecture Freeze

Result: `COMPLETE / DURABLE ARCHITECTURE PARTIAL / DEPENDENCY DECISION REQUIRED`.

Completed:

- audited PostgreSQL, migrations, repositories, events and recovery-related services;
- confirmed reuse candidates and separated Trading-owned state from ACS and upstream infrastructure;
- defined the durable `OrderIntent` / `SubmissionAttempt` aggregate boundary;
- defined provider-call, atomic transition, concurrency and restart/recovery requirements;
- modeled failure windows A-J and preserved `UNKNOWN`, cancellation and no-blind-retry semantics;
- documented that no durable execution implementation was added.

Next gate: CTO decision on transaction abstraction, durable schema/repository, CAS/claim fencing and outbox requirement, followed by a separately scoped `IMP-02C` implementation and crash/recovery validation.

Record: `.instructions/TRADING_REQ_12_DURABLE_EXECUTION_STATE_RECOVERY_ARCHITECTURE_FREEZE.md`.

## AXODUS-TRADING-IMP-02C0 — Durable Execution Persistence Primitives

Status: `IMPLEMENTED / VALIDATION READY / CTO REVIEW PENDING`

Tasks completed:

- add durable `SubmissionAttempt` and transactional outbox migration;
- add PostgreSQL repository with versioned CAS updates and typed concurrency errors;
- require a dedicated checked-out connection for transaction callbacks;
- persist attempt mutation and outbox event through one transaction context;
- expose non-terminal recovery-candidate queries and restart visibility;
- add real PostgreSQL rollback, CAS conflict, atomic outbox and recovery tests;
- keep lifecycle integration, provider calls, recovery workers and operational execution out of scope.

Next task: run and review `VAL-02C0` acceptance evidence before authorizing `IMP-02C`.

Record: `.instructions/TRADING_IMP_02C0_DURABLE_EXECUTION_PERSISTENCE_PRIMITIVES.md`.

## AXODUS-TRADING-IMP-02C — Durable CEX Lifecycle & Crash Recovery

Status: `IMPLEMENTED / VALIDATION EVIDENCE READY / CTO REVIEW PENDING`

Tasks completed:

- integrated durable `SubmissionAttempt` state with the accepted CEX lifecycle;
- kept provider calls outside PostgreSQL transactions;
- persisted exact reconciliation evidence and canonical transitions with CAS;
- made concurrent recovery workers stale-write safe;
- persisted cancellation ambiguity and recovered it without a second cancel;
- preserved no-blind-resubmission behavior for `NOT_FOUND` and `INDETERMINATE`;
- added real PostgreSQL restart/recovery and concurrency coverage with deterministic provider fakes.

Next task: `VAL-02C — Durable Crash Recovery Acceptance`, including failure windows A–J and process crash/restart boundaries. `BLOCKER-02` remains open.

Record: `.instructions/TRADING_IMP_02C_DURABLE_CEX_LIFECYCLE_CRASH_RECOVERY.md`.

## AXODUS-TRADING-VAL-02C — Durable Crash Recovery Acceptance

Status: `COMPLETE / CTO ACCEPTED`.

Accepted the PostgreSQL durable lifecycle and crash-recovery evidence: 7/7 targeted PostgreSQL tests, 10/10 full service test files, typecheck, build, local simulated E2E with cleanup and diff check passed. `BLOCKER-02` is now `RESOLVED / CTO CLOSED`; real venue execution remains unvalidated.

## AXODUS-TRADING-VAL-03 — Hummingbot Runtime & CEX Provider Integration Acceptance

Status: `COMPLETE / CTO ACCEPTED`.

Evidence update: Core compatibility 5/5, client contract 337/337, deterministic API synchronization 6/6, deterministic API reconciliation 7/7 and Trading Core regression all pass. The full controlled lifespan harness also passes with local PostgreSQL, Core initialization, controlled connector submission/lookup/cancellation, restart visibility and cleanup. The history pagination test exceeded a bounded 30-second run and remains unaccepted. Temporary `hummingbot==20260901` is not a dependency-baseline selection.

Controlled FastAPI HTTP and full-lifespan harness update: submission identity, exact lookup, cancellation, malformed request rejection, provider failure normalization, no-blind-retry behavior, PostgreSQL persistence, service reconstruction and deterministic cleanup pass. The order-history timeout remains unaccepted and is proposed as a documented non-critical limitation, pending CTO review.

Next tasks: obtain CTO disposition of the isolated order-history timeout, preserve the full-runtime evidence, and keep credentials, exchange connectivity, orders, WebSocket, Condor, DEX and capital disabled.

## AXODUS-TRADING-REQ-13 — External CEX Validation & Paper/Shadow Readiness Freeze

Date: 2026-09-18

Status: `COMPLETE / CTO REVIEW READY`

Tasks completed:
- froze admissible external environments (Testnet / Sandbox / Paper only; no mainnet or real funds);
- defined zero-withdrawal, read-and-trade minimal credential scope;
- established secret storage boundary via Credential Vault reference injection without checking keys into repos;
- set hard order ceilings, single-tenant isolation, and rate limit protections;
- established deterministic testnet cleanup requirements (no orphaned orders);
- confirmed BLOCKER-01 (WebSocket) remains excluded from the initial external validation gate;
- verified order history limitation does not block submission, exact reconciliation, or cancellation.

Record: `.instructions/TRADING_REQ_13_EXTERNAL_READINESS_FREEZE.md`

## AXODUS-TRADING-VAL-04B1 — Testnet Credential & Authenticated Read

Status: `COMPLETE / R2 PASS / AUTHENTICATED READ ACCEPTED / EXTERNAL EXECUTION CLOSED`

Tasks completed:

- fixed the Binance USDⓈ-M Futures Testnet domain and authenticated account
  read boundary;
- rejected mainnet, withdrawal/transfer scopes, non-testnet credentials and
  non-admitted paths before transport;
- kept credential material ephemeral and sanitized all returned evidence;
- validated the preparation harness with typecheck, build, 13/13 test files and
  diff check;
- preserved the closed external execution gate and the independent WebSocket
  blocker.

The single CTO-authorized R2 read completed successfully with HTTP 200 against
Binance USDⓈ-M Futures Testnet. Sanitized evidence confirms authentication,
`canTrade: true`, 8 assets, no mutation, no WebSocket, and secret redaction.
`.env.local` is `0600`, ignored and untracked. Next task: await a separate CTO
decision for `VAL-04B2`; do not submit, cancel, or modify testnet orders.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B1_TESTNET_AUTHENTICATED_READ.md`.

## AXODUS-TRADING-VAL-04B2 — First Controlled Testnet Order Acceptance

Status: `EXECUTED / FAILED / CTO REVIEW REQUIRED`

The single CTO-authorized run aborted at the public Testnet metadata preflight:
`testnet.binancefuture.com` could not be resolved by the execution host
(`EAI_AGAIN`). No order, cancellation, private call, WebSocket or mainnet
contact occurred; no retry or second mutation is authorized. Await CTO review
for any subsequent execution decision.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B2_TESTNET_CONTROLLED_ORDER.md`.

## AXODUS-TRADING-VAL-04B2-R1 — Network Preflight

Status: `BLOCKED / DNS OR SANDBOX NETWORKING / SAFE STOP`

The public-only DNS, TCP/TLS and `exchangeInfo` preflight was attempted without
credentials. The execution host could not resolve `testnet.binancefuture.com`,
so TCP/TLS and HTTP were not reached. The escalated network attempt was
rejected by the approval layer; no workaround was used. No private calls,
orders, cancellations, WebSocket or mainnet contact occurred.

Next task: run the same public preflight in an approved environment with normal
network resolution, stop after successful BTC-USDT metadata retrieval, and
obtain a new CTO authorization before any authenticated or mutating activity.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B2_TESTNET_CONTROLLED_ORDER.md`.

## AXODUS-TRADING-VAL-04B2-R2 — Public Network Qualification

Status: `COMPLETE / CTO ACCEPTED / SANDBOX NETWORK ISOLATION CONFIRMED`

## AXODUS-TRADING-VAL-04B2-R4-R3 — Phase B Entrypoint Completion

Status: `COMPLETE / CTO REVIEW READY / PHASE B NOT AUTHORIZED`

Tasks completed:
- extended `val-04b2-live-runner.ts` on `9b611c8` with explicit `--public` and `--execute` modes;
- added operational confirmation gate `AXODUS_VAL_04B2_EXECUTE_CONFIRMATION=EXECUTE_SINGLE_TESTNET_ORDER`;
- added `val:04b2:r4:execute` script to package.json;
- updated unit tests in `val-04b2-r4-runner.test.mjs` verifying fail-closed invocation and single mock delegation;
- ran full verification (typecheck, build, 15/15 test files, diff-check);
- recorded safe aborts for Phase B Attempt #1 and Attempt #2 with zero orders submitted and zero credentials loaded;
- preserved all safety boundaries with Phase B strictly on HOLD.

Next task: obtain explicit CTO Phase B execution authorization against the persisted R3 commit.

The authorized public DNS, TCP/TLS, and `exchangeInfo` preflight was attempted.
Local sandbox network isolation prevented socket creation, and escalation was
rejected by the auto-review evaluator (`opencodex structured output` limitation).
No credentials, private calls, orders, cancellations, or WebSocket usage occurred.

Next task: execute the public-only preflight in an environment with functional
outbound networking or resolve the proxy evaluator model configuration, then
report validated `BTCUSDT` filters before requesting order authorization.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B2_TESTNET_CONTROLLED_ORDER.md`.
