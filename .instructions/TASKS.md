## AXODUS-TRADING-EPIC-QUANT / REQ-QUANT-01 — Canonical Quant Foundations

Status: `COMPLETE / LOCAL VALIDATED / CTO REVIEW REQUIRED`

Completed:
- Audited legacy `quants-lab` assets against REQ-15 / SCF-01; explicitly rejected MongoDB, DEX signing (`okx_dex_api.py`), floating dependencies, and direct live capital mutations as canonical Quant authorities.
- Implemented Python canonical Quant foundations under `quants-lab/core/quant_foundations/` without adding external runtime dependencies.
- Implemented `DatasetManifest` with content addressing, gap/integrity tracking, and non-leaking `to_shared_reference()` mapping.
- Implemented immutable `ExperimentDefinition` with explicit parameter space, execution assumptions, methodology, seed policy, and runtime provenance.
- Implemented `TrialDefinition` and deterministic `TrialIdentity` with seed semantics distinguishing stochastic trials from strategy changes.
- Implemented `ExperimentResult` with strict status semantics (`completed` vs `partial`).
- Implemented `StrategyEvidence` and validated its envelope mapping to the actual ACS `EvidenceRecordV2` contract in `ACS/dist/native-core/evidence.js`.
- Added unit test suites for Python Quant foundations (`quants-lab/tests/test_quant_foundations.py`) and TypeScript ACS Evidence conformance (`trading-core/services/trading-core/test/epic-quant-req01-acs.test.mjs`).

Validation:
- `quants-lab` unit tests: `PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py' -v` — PASS (9/9 tests)
- `trading-core` test suite: `npm test` — PASS (24/24 tests across all suites, including `epic-quant-req01-acs.test.mjs`)
- `trading-core` typecheck: `npm run typecheck` — PASS

Next Gate:
- CTO acceptance of REQ-QUANT-01 foundations.
- Proceed to Phase 2: Dataset Engine & Historical Ingestion.
## AXODUS-TRADING-CROSS-EPIC-SCF-01 — Trading Harness & Quant Lab Shared Contract Freeze

## AXODUS-TRADING-EPIC-01 / REQ-01 — Canonical Harness Contract Foundations

## AXODUS-TRADING-EPIC-01 / REQ-02 — Market Intelligence & MarketState Foundation

## AXODUS-TRADING-EPIC-01 / REQ-03 — Opportunity Discovery Foundation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Audited existing Trinity/recommendation and strategy surfaces; retained them as advisory `REFERENCE / ADAPT` candidates.
- Extended the provider-neutral Opportunity contract with applicability, lifecycle status, detector identity/version, validity context, discovery lineage and idempotency references.
- Implemented `OpportunityDiscoveryService` with contextual strategy discovery, detector applicability, required-feature fail-closed behavior, stale-live rejection, deterministic identity and duplicate suppression.
- Implemented `revalidateOpportunity` for expiry, supporting MarketState changes and stale-live invalidation.
- Implemented `OpportunityRankingService` for explicit strategy/timeframe/methodology context only; no universal pair score, capital allocation or risk authority.
- Added REQ-03 fixtures for multi-strategy behavior, historical discovery, expiry, detector revisions, duplicate suppression, provenance and contextual ranking.

Validation:
- Contracts typecheck: PASS
- Trading Core typecheck: PASS
- Trading Core build: PASS
- Tests: PASS, 26 tests / 0 failures / 0 skipped
- `git diff --check`: PASS
- External mutations: 0

## AXODUS-TRADING-EPIC-01 / REQ-04 — Strategy Intelligence & TradeProposal Foundation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Audited legacy strategy, trading agent and recommendation assets (`WhiteRabbit*`, `Trinity*`, `AgentAutonomy*`); classified them as `REFERENCE / ADAPT` for heuristics and `DEPRECATE / REJECT` as canonical TradeProposal authorities.
- Enforced strict `StrategyIdentity` vs `AgentIdentity` separation: strategies represent trading methodologies, agents represent ACS execution actors.
- Established canonical `StrategyContext` and `StrategySpecialist` boundaries consuming qualified Opportunities, exact StrategyRevisions, MarketStates, PromotionEligibility, StrategyEvidence, and StrategyHealth.
- Implemented `StrategyProposalValidator` providing fail-closed validation for context lineage, required features, operational health guards, promotion eligibility, and structured candidate proposals.
- Implemented canonical `TradeProposal` construction, deterministic proposal identity, idempotency key generation, and pure immutable `revalidateTradeProposal`.
- Implemented `StrategyIntelligenceService` with specialist registry, deduplication suppression, and fail-closed error handling.
- Implemented reference deterministic specialists (`DirectionalSwingSpecialist`, `FuturesScalpingSpecialist`) and extensible `AgentAssistedStrategySpecialist` with fail-closed structured candidate validation.
- Added comprehensive REQ-04 tests covering deterministic proposals, NO_PROPOSAL, Opportunity lineage, StrategyRevision attribution, deterministic replay, deduplication, requested leverage/sizing, expiry, immutable revalidation, multi-strategy specialization, Agent structured validation, health/promotion guards, missing features, and research/historical compatibility.

Validation:
- Contracts typecheck: PASS
- Trading Core typecheck: PASS
- Trading Core build: PASS
- Tests: PASS, 27 test suites / 0 failures / 0 skipped
- `git diff --check`: PASS
- External mutations: 0

## AXODUS-TRADING-EPIC-01 / REQ-05 — Portfolio & Capital Allocation Foundation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Audited existing portfolio state, balance, and position management surfaces; preserved them as internal/persistence state while establishing canonical `CanonicalPortfolioSnapshot`, `PortfolioContext`, and `CapitalPolicyLimits`.
- Enforced the strict boundary: Capital Allocation ≠ Risk Authorization ≠ Execution Authority.
- Implemented `CapitalAllocationService` resolving proposal competition with strict capital conservation (`allocatedCapital ≤ availableCapital`).
- Implemented strategy-level budget caps and instrument concentration limits.
- Implemented deterministic proposal deduplication and input-permutation invariance.
- Implemented conflict detection for opposing directional positions and explicit unknown-correlation handling.
- Implemented pure immutable `revalidatePortfolioDecision` detecting expired decisions, depleted capital, and strategy health/eligibility changes.
- Added comprehensive REQ-05 test suite covering proposal competition, budget caps, instrument concentration, capital exhaustion, expired proposals, suspended/retired strategies, ineligible strategies, duplicate suppression, deterministic replay, permutation invariance, unknown correlation, and decision revalidation.

Validation:
- Contracts typecheck: PASS
- Trading Core typecheck: PASS
- Trading Core build: PASS
- Tests: PASS, 28 test suites / 0 failures / 0 skipped
- `git diff --check`: PASS
- External mutations: 0

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Audited existing market-data HTTP adapters, candles, tickers, funding and order-book snapshots.
- Defined provider-neutral `MarketObservation`, `MarketObservationType`, `MarketObservationQuality` and `MarketSequenceStatus` in contracts package.
- Implemented `MarketObservationNormalizer` converting raw HTTP observations to canonical typed observations with deterministic deduplication and conflicting-value detection.
- Implemented `MarketStateFreshnessPolicy` distinguishing live freshness windows from historical temporal validity.
- Implemented `MarketStateBuilder` with deterministic ID generation, provenance tracking, feature-version validation, closed-failure on missing required features and sequence-gap recording.
- Added comprehensive offline fixtures in `trading-core/services/trading-core/test/epic01-req02-market-intelligence.test.mjs` covering live/historical, stale detection, feature-dependency rejection, duplicate handling and sequence-gap reporting.

Validation:
- Contracts typecheck: PASS
- Trading Core typecheck: PASS
- Trading Core build: PASS
- Tests: PASS, 25 test files / 25 suites / 0 failures / 0 skipped
- `git diff --check`: PASS
- External mutations: 0

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Materialized `.instructions/AXODUS_TRADING_EPIC_01_PLAN.md` to resolve GAP-SCF-01 baseline persistence.
- Created canonical domain contract packages:
  - `trading-core/packages/trading-contracts/src/strategy/types.ts` (`StrategyIdentity`, `StrategyRevision`, `StrategyLifecycleRecord`, `FeatureDefinition`, `StrategyHealth`)
  - `trading-core/packages/trading-contracts/src/research/types.ts` (`DatasetReference`, `ExperimentReference`, `StrategyEvidence`, `PromotionEligibility`)
  - `trading-core/packages/trading-contracts/src/market/types.ts` (`MarketState`, `Opportunity`)
  - `trading-core/packages/trading-contracts/src/governance/types.ts` (`TradeProposal`, `PortfolioDecision`, `RiskDecision`, `TradingIntent`)
  - `trading-core/packages/trading-contracts/src/foundation/validation.ts` (pure validators for lineage, freshness, eligibility and kill-switch invariant)
- Added test fixtures under `trading-core/services/trading-core/test/epic01-req01-contracts.test.mjs` verifying positive/negative validation, lineage, historical equivalence, and risk authority separation.

Validation:
- `npm run typecheck` in contracts package: PASS
- `npm run typecheck` in service: PASS
- `npm run build`: PASS
- `npm test`: PASS (all existing + new tests green)
- `git diff --check`: PASS

Status: COMPLETE / CTO REVIEW REQUIRED / IMPLEMENTATION HOLD

Completed:
- Reconciled the accepted REQ-15 architecture with the available EPIC-QUANT planning artifact and existing ACS evidence contracts.
- Frozen shared semantics for StrategyIdentity, StrategyRevision, StrategyLifecycleState, MarketState, FeatureDefinition, DatasetReference, ExperimentReference, StrategyEvidence, PromotionEligibility and StrategyHealth.
- Defined versioning, immutability, historical/live MarketState compatibility, ACS Evidence mapping, dependency direction, shared-file change control and cross-EPIC RFC rules.
- Recorded that no formal EPIC-01 planning artifact was found in the local audit surface; this remains a P0 reconciliation gap rather than an inferred acceptance.
- Created `.instructions/AXODUS_TRADING_CROSS_EPIC_SCF_01_SHARED_CONTRACT_FREEZE.md`.

Readiness:
- Parallel implementation: NO pending CTO review, EPIC-01 plan reconciliation and ACS envelope conformance validation.
- Runtime implementation, migrations, dependencies, provider integration, credentials, trading and mainnet remain unauthorized.

Next Gate:
- CTO review of SCF-01 and resolution of the listed P0 gaps before authorizing implementation slices.

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

Status: `EXECUTED / PASS CANDIDATE / CTO REVIEW REQUIRED`

The native-host execution completed the single authorized Testnet lifecycle.
One LIMIT order was submitted, exact identity lookup returned `NEW`, the order
was canceled and terminally reconciled as `CANCELED`, and cleanup confirmed no
active validation orders and no residual position. No blind retry, WebSocket or
mainnet contact occurred. Await CTO final review.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B2_TESTNET_CONTROLLED_ORDER.md`.

## AXODUS-TRADING-VAL-04B2-R1 — Network Preflight

Status: `BLOCKED / DNS OR SANDBOX NETWORKING / SAFE STOP`

## AXODUS-TRADING-VAL-04B2-R5 — Native Host Public Qualification

Status: `COMPLETE / CTO ACCEPTED / NATIVE HOST PATH QUALIFIED`

The native host passed public Testnet qualification and derived the current
BTCUSDT venue rules through the built runner.

## AXODUS-TRADING-VAL-04B2 — Controlled Testnet Order Lifecycle

Status: `EXECUTED / PASS CANDIDATE / CTO REVIEW REQUIRED`

Sanitized evidence confirms one order, preserved identity, exact lookup,
terminal cancellation and cleanup with zero residual orders or position.

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

## AXODUS-TRADING-VAL-04B2-R4-R4 — Built Entrypoint Correction

Status: `COMPLETE / CTO REVIEW READY / PHASE B NOT AUTHORIZED`

Tasks completed:
- corrected package scripts to execute from the built JS output instead of source TypeScript with node strip-types;
- added `scripts/verify-val-04b2-built-runner.mjs` and `npm run val:04b2:r4:verify-built`;
- verified built dependency graph resolution and fail-closed operational gate offline;
- updated `val-04b2-r4-runner.test.mjs` asserting package scripts target the built JS artifacts;
- ran full verification (typecheck, build, 15/15 test files, diff-check, built runner verification);
- recorded safe aborts for Phase B Attempts #1, #2, and #3 with zero orders submitted and zero credentials loaded;
- preserved all safety boundaries with Phase B strictly on HOLD.

Next task: obtain explicit CTO Phase B execution authorization against the persisted R4 commit.

The authorized public DNS, TCP/TLS, and `exchangeInfo` preflight was attempted.
Local sandbox network isolation prevented socket creation, and escalation was
rejected by the auto-review evaluator (`opencodex structured output` limitation).
No credentials, private calls, orders, cancellations, or WebSocket usage occurred.

Next task: execute the public-only preflight in an environment with functional
outbound networking or resolve the proxy evaluator model configuration, then
report validated `BTCUSDT` filters before requesting order authorization.

Record: `.instructions/validation/AXODUS-TRADING-VAL-04B2_TESTNET_CONTROLLED_ORDER.md`.
## AXODUS-TRADING-REQ-14 — Operational Trading Readiness & Failure Recovery

Status: `COMPLETE / CTO REVIEW REQUIRED`

Audit deliverable: `.instructions/TRADING_REQ_14_OPERATIONAL_TRADING_READINESS_FAILURE_RECOVERY.md`.

The audit separates the accepted single-order Testnet lifecycle from
continuous/autonomous readiness. Authorized execution sequence is `AEES-05` (`IMP-05A` through `IMP-05E`).

## AXODUS-TRADING-AEES-05 / IMP-05A — Continuous Execution Runtime & Durable Ownership

Status: `COMPLETE / ADVANCING TO IMP-05B`

Tasks completed:
- implemented `ContinuousExecutionRuntime` with preflight gating, durable attempt creation before mutation, deterministic client order ID, and failure safety;
- added `transaction` support to `InMemoryPostgresClient` satisfying `TransactionalPostgresQueryClient`;
- added unit test suite `test/imp-05a-continuous-runtime.test.mjs` testing preflight rejections, durable state creation, network timeout unknown-state recording, exact reconciliation, concurrent duplicate suppression, and sequential executions;
- verified full regression (16/16 test files pass, typecheck pass, build pass, diff-check pass);
- preserved all safety boundaries: 0 real Testnet orders, 0 mainnet requests, 0 secrets leaked.

## AXODUS-TRADING-AEES-05 / IMP-05B — Failure Recovery & Order Reconciliation

Status: `COMPLETE / ADVANCING TO IMP-05C`

Tasks completed:
- implemented `ContinuousOrderRecoveryService` supporting candidate discovery, startup scan, and single/batch deterministic reconciliation;
- verified zero blind resubmission during recovery: recovery exclusively queries provider state;
- fixed in-flight active order release on ambiguous POST network errors;
- added unit test suite `test/imp-05b-recovery-reconciliation.test.mjs` testing discovery after crash, provider accepted (found) recovery, provider missing (not-found) recovery, lookup failure handling, idempotency, and batch recovery;
- verified full regression (17/17 test files pass, typecheck pass, build pass, diff-check pass);
- preserved all safety boundaries: 0 real Testnet orders, 0 mainnet requests, 0 secrets leaked.

Next task: execute IMP-05C (Position Reconciliation, Risk Envelope & Kill Switch).

## AXODUS-TRADING-IMP-05F — Continuous Live Provider Composition

Status: `COMPLETE / CTO ACCEPTED / PERSISTED / ALL 21 TEST SUITES PASS`

Tasks completed:
- implemented `ContinuousBinanceTestnetProvider` over the accepted Binance Testnet transport and signing primitives;
- composed submit, exact client-order lookup, controlled cancellation, open-order reads, dynamic venue rules/reference price, and authenticated position reads;
- wired provider composition into the canonical continuous runtime, recovery service, position reconciliation, risk envelope, kill switch, intent admission, and observability path;
- implemented `Val05ContinuousRunner` with public, authenticated-read-only, and explicitly gated controlled-execute modes;
- implemented explicit VAL-05 session envelope and transactional `PostgresVal05SessionBudgetStore` enforcing one active external order and three submissions per session;
- added deterministic integration matrix covering the 20 IMP-05F scenarios plus runner safety and durable budget checks;
- preserved the historical VAL-05 attempt record as `G0 PASS / G1 PASS / G2 PASS / G3 BLOCKED / 0 mutations`.

Validation:
- `npm run typecheck` PASS;
- `npm test` PASS, 21/21 test files;
- `npm run build` PASS;
- built runner verification PASS;
- public Testnet runner read PASS, BTCUSDT rules/reference loaded, credentials 0, POST 0, DELETE 0;
- `git diff --check` PASS.

Evidence: `.instructions/validation/AXODUS-TRADING-IMP-05F_CONTINUOUS_LIVE_PROVIDER_COMPOSITION.md`.

## AXODUS-TRADING-VAL-05 — Continuous Testnet Trading Acceptance

Status: `COMPLETE / PASS / CTO ACCEPTED`

Accepted by CTO review following `VAL-05-FIX-01` verification on commit
`ded3f85d2acc3f2f6d6d9e1337bf1dcafc123710`. Safety accounting: External Safety PASS,
Residual Orders 0, Residual Position 0, Blind Retries 0, Duplicate Submissions 0,
Mainnet Calls 0, Secrets Exposed false, Cleanup PASS.

Record: `.instructions/validation/AXODUS-TRADING-VAL-05_CONTINUOUS_TESTNET_TRADING_ACCEPTANCE.md`.

## AXODUS-TRADING-VAL-05-FIX-01 — Provider-Acknowledged Exact Reconciliation

Status: `COMPLETE / CTO ACCEPTED`

Tasks completed:
- removed `provider-acknowledged` from terminal classification;
- allowed acknowledged executions to enter durable reconciliation;
- added exact lookup regression coverage across provider states and failure modes;
- added the built read-only A/B reconciliation runner;
- performed exact Binance Testnet reads for historical Executions A and B with
  zero POST, zero DELETE, zero blind retry, zero residual position, and no
  secret exposure.

Validation: typecheck PASS, build PASS, 22/22 test files PASS, built-runner
verification PASS, `git diff --check` PASS.

## AXODUS-TRADING-REQ-15 — Sovereign Agentic Trading Architecture & Infrastructure Freeze

Status: `COMPLETE / DOCUMENTAL AUDIT & ARCHITECTURE FREEZE / CTO REVIEW REQUIRED`

The Sovereign Program Planning & Epic Architecture Mandate establishes REQ-15
as the mandatory next architecture gate before new Trading IMP/AEES work. The
local planning record defines the factual audit scope, ownership boundaries,
provider-neutral contracts, required deliverables, validation gates, candidate
EPIC families, and explicit non-goals.

Entry gate: `VAL-05 COMPLETE / PASS` is satisfied and CTO accepted on commit
`ded3f85d2acc3f2f6d6d9e1337bf1dcafc123710`. REQ-15 planning is authorized to proceed.

The comprehensive factual audit across Trading, ACS, Hummingbot, Condor, and
`quants-lab` is complete, establishing the Sovereign Architecture Freeze,
canonical ownership matrix, component classifications, provider-neutral domain
contracts, Quant Lab lifecycle, gap register, and sequenced EPIC roadmap.

Record: `.instructions/TRADING_REQ_15_SOVEREIGN_AGENTIC_TRADING_ARCHITECTURE_FREEZE.md`.

No implementation is authorized by this planning entry.
## AXODUS-TRADING-EPIC-QUANT / REQ-QUANT-02 — Historical Data & Dataset Foundation

Status: `COMPLETE / LOCAL VALIDATED / CTO REVIEW REQUIRED`

Completed:
- Audited legacy historical-data assets: `Candles`, `SimpleCandlesDownloader`, CLOB/market-feed sources, Mongo-backed data paths, and notebook-oriented loaders.
- Classified legacy data paths as `ADAPT` for candle normalization concepts, `REFERENCE` for provider feed adapters, `REBUILD` for canonical dataset construction and quality, and `REJECT` for MongoDB-backed authority and execution/signing coupling.
- Implemented provider-neutral historical source and candle normalization boundaries under `quants-lab/core/quant_data/`.
- Implemented deterministic ordering, decimal-string numeric normalization, UTC timestamp normalization, duplicate handling, cadence gap detection, invalid-record reporting, quality status, and source anomaly capture.
- Operationalized `DatasetManifest` with finalized content digest, exact DatasetReference export, integrity metadata, and storage-locator neutrality.
- Implemented exact-version `DatasetRegistry`, immutable in-memory storage, and a deterministic JSONL fixture storage adapter without adding `pyarrow`, DuckDB, MongoDB, or new dependencies.
- Implemented historical `MarketState` reconstruction using the shared MarketState semantic shape, historical validity context, DatasetReference provenance, feature-version references, and basic causality/look-ahead rejection.
- Added deterministic local fixtures for valid, duplicate, missing-cadence, invalid, corrected-version, exact-resolution, integrity, and historical MarketState scenarios.

Validation:
- `quants-lab`: `PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py' -v` — PASS (16/16 tests)
- `trading-core`: `npm test` — PASS (25/25 tests, including REQ-QUANT-01 ACS Evidence, EPIC-01 REQ-01, and EPIC-01 REQ-02)
- `trading-core`: `npm run typecheck` — PASS
- `git diff --check` and `git -C quants-lab diff --check` — PASS

Next Gate:
- CTO review of REQ-QUANT-02.
- Proceed to REQ-QUANT-03 Backtest & Simulation Foundation.
## AXODUS-TRADING-EPIC-QUANT / REQ-QUANT-03 — Backtest & Simulation Foundation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Added an isolated provider-neutral simulation foundation under `quants-lab/core/quant_simulation/`.
- Enforced exact experiment, StrategyRevision and DatasetReference lineage before execution.
- Added deterministic historical MarketState validation, point-in-time feature checks and fail-closed look-ahead detection.
- Added explicit execution assumptions for fees, spread, slippage, latency steps, fill ratio and leverage boundary metadata.
- Added deterministic simulated orders, fills, cash/equity accounting, realized/unrealized mark-to-market foundation, cost attribution, equity series and core metrics.
- Added a reference threshold strategy and no-action strategy for offline conformance fixtures.
- Added projection from a completed simulation to the canonical `ExperimentResult` contract.
- Did not implement mass trials, parameter search, Monte Carlo, walk-forward, promotion, live execution or credentials.

Validation:
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — PASS (21/21 tests)
- `npm --prefix trading-core/services/trading-core test` — PASS (26/26 tests)
- `npm --prefix trading-core/services/trading-core run typecheck` — PASS
- `git diff --check` and `git -C quants-lab diff --check` — PASS

Next Gate:
- CTO review, then REQ-QUANT-04 or the next approved Quant milestone.
## AXODUS-TRADING-EPIC-QUANT / REQ-QUANT-04 — Mass Trials & Parameter Robustness Foundation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Audited legacy `quants-lab` optimization and search modules (`core/backtesting/optimizer.py`, Optuna, notebooks); rejected blind `maximize(backtest_profit)` and floating dependency optimization as canonical Quant authority.
- Operationalized `ParameterDefinition`, `ParameterConstraint`, and `ParameterSpace` with explicit bounds, types (integer, decimal, boolean, categorical), and pre-simulation validation.
- Implemented deterministic Cartesian `GridTrialGenerator` with explicit `TrialBudget` evaluation, preventing silent combinatorial explosion.
- Reused accepted `SimulationEngine` from REQ-QUANT-03 without creating a parallel execution engine.
- Implemented `MassTrialRunner` supporting duplicate trial suppression, resumability/idempotency from existing results, and failure tracking without silent drops.
- Implemented `ParameterRobustnessAnalyzer` delivering multidimensional robustness reporting (`ParameterRobustnessReport`): metric distribution summaries (min, max, median, quantiles), neighbor adjacency, isolated peak detection, boundary sensitivity diagnostics, candidate regions, and explicit limitations.
- Mapped `ParameterRobustnessReport` into canonical ACS `EvidenceRecordV2` envelope preserving payload digest and provenance.
- Added comprehensive unit and integration tests covering parameter space, constraints, trial budget, deterministic replay, duplicate suppression, resume idempotency, distributions, failure preservation, and isolated peak detection.
- Did not implement Bayesian/genetic optimization, Monte Carlo, walk-forward, CPCV, or strategy promotion.

Validation:
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — PASS (29/29 tests)
- `npm --prefix trading-core/services/trading-core test` — PASS (27/27 test suites)
- `npm --prefix trading-core/services/trading-core run typecheck` — PASS
- `git diff --check` and `git -C quants-lab diff --check` — PASS

Next Gate:
- CTO review of REQ-QUANT-04, then REQ-QUANT-05 (Out-of-Sample, Walk-Forward & Statistical Validation).
## AXODUS-TRADING-EPIC-QUANT / REQ-QUANT-05 — Out-of-Sample, Walk-Forward & Statistical Validation Foundation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Audited legacy `quants-lab` train/test, cross-validation, and metrics assets; classified legacy metrics (`REFERENCE`), notebook CV (`ADAPT`), and unvalidated optimization metrics (`REJECT`).
- Reused accepted Quant foundations: `DatasetManifest`/`DatasetReference`, `reconstruct_historical_market_state`, `REQ-QUANT-03` `SimulationEngine`, and `REQ-QUANT-04` parameter spaces and strategy models.
- Implemented typed `ValidationPlan` and `DatasetSegment` defining explicit temporal boundaries and roles (`IN_SAMPLE`, `OUT_OF_SAMPLE`).
- Operationalized `SelectionSnapshot` freezing chosen strategy parameters, source trial lineage, candidate population size, and metrics before OOS exposure.
- Implemented deterministic Holdout OOS executor rejecting look-ahead contamination, computing degradation metrics, and flagging selection bias when population size is large.
- Implemented deterministic Walk-Forward validation (`WalkForwardPlan`) supporting rolling and expanding window modes with temporal fold isolation, parameter reselection strictly within training folds, and preservation of failed folds.
- Implemented `StatisticalAnalyzer` computing moment diagnostics (mean, sample std dev, median, positive fold ratio, annualized Sharpe estimate, and 95% confidence intervals).
- Mapped `ValidationResult` directly into canonical ACS `EvidenceRecordV2` envelope preserving payload digest and provenance.
- Added unit and integration tests covering moment diagnostics, holdout degradation, temporal leakage rejection, rolling/expanding walk-forward, failed-fold preservation, and deterministic replay.
- Did not implement strategy promotion, real-capital validation, Monte Carlo market simulation, or live execution.

Validation:
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — PASS (35/35 tests)
- `npm --prefix trading-core/services/trading-core test` — PASS (28/28 test suites)
- `npm --prefix trading-core/services/trading-core run typecheck` — PASS
- `git diff --check` and `git -C quants-lab diff --check` — PASS

Next Gate:
- CTO review of REQ-QUANT-05, then REQ-QUANT-06 (Strategy Evidence Qualification & Promotion Gate).

## AXODUS-TRADING-AEES-AUDIT-01 — Critical Audit Remediation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Implemented `FixedDecimal` (12 decimal scale BigInt) in `trading-contracts` and refactored `CapitalAllocationService` and `PortfolioDecisionValidator` to eliminate IEEE 754 precision drift (FIX-A-01).
- Implemented fail-closed rejection for opposing directional exposures unless explicit `allowOpposingPositions` policy is enabled (FIX-A-02).
- Implemented durable proposal tombstones preventing duplicate proposal submissions across subsequent contexts (FIX-A-03).
- Updated walk-forward executor in `quants-lab` to withhold aggregated statistical diagnostics when failed folds are present, preventing survivorship bias (FIX-Q-01).
- Implemented and synchronized `MarketState` feature validation schemas across TypeScript contracts and Python pipelines (FIX-C-01).
- Added comprehensive unit tests in TypeScript and Python for all 5 remediations.

Validation:
- `npm --prefix trading-core/services/trading-core run typecheck` — PASS
- `npm --prefix trading-core/services/trading-core test` — PASS (28/28 test suites)
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — PASS (36/36 tests)
- `git diff --check` and `git -C quants-lab diff --check` — PASS

Next Gate:
- CTO review of `AXODUS-TRADING-AEES-AUDIT-01`.
- Execution of independent adversarial validation `VAL-AUDIT-01`.
- Unblocking of `EPIC-01 / REQ-06` and `EPIC-QUANT / REQ-QUANT-06` upon `VAL-AUDIT-01` acceptance.

## AXODUS-TRADING-CROSS-EPIC / VAL-AUDIT-01 — Independent Adversarial Remediation Validation

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Conducted independent adversarial validation of AEES-AUDIT-01 remediations across Track A (Harness), Track B (Quant), and Cross-Track contracts.
- Executed metamorphic property fuzzing (1,000 randomized micro-allocations) verifying BigInt capital conservation.
- Tested opposing direction fail-closed gating and gross exposure calculation.
- Verified failed-fold handling and suppression of moment/Sharpe calculations in walk-forward validation.
- Validated 14 positive and negative cross-language MarketState fixtures between TypeScript and Python.
- Generated comprehensive adversarial validation report in `.instructions/audits/Trading/AXODUS-TRADING-CROSS-EPIC-VAL-AUDIT-01-REPORT.md`.

Validation:
- `npm --prefix trading-core/services/trading-core run typecheck` — PASS (0 errors)
- `npm --prefix trading-core/services/trading-core test` — PASS (28/28 test suites)
- `npm --prefix trading-core/services/trading-core run build` — PASS
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v` — PASS (36/36 tests)
- `git diff --check` & `git -C quants-lab diff --check` — PASS (0 errors)

Next Gate:
- CTO review and acceptance of `VAL-AUDIT-01`.
- Authorization to unblock `EPIC-01 / REQ-06` (Risk Authority) and `EPIC-QUANT / REQ-QUANT-06` (Strategy Evidence Qualification & Promotion Gate).


## AXODUS-TRADING-EPIC-QUANT / REQ-QUANT-06   Strategy Evidence Qualification & Promotion Gate

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Implemented canonical `StrategyEvidenceQualificationGate` in `quants-lab/core/quant_promotion/`.
- Implemented `StrategyEvidencePackage` and immutable versioned `StrategyQualificationPolicy` per lifecycle transition.
- Enforced frozen identity rule (qualification binds strictly to exact `StrategyRevision`).
- Maintained AUD-Q-01 invariant: partial walk-forward validations with failed folds fail closed (`WALK_FORWARD_INCOMPLETE`).
- Enforced execution realism: zero-latency simulations rejected for higher lifecycle stages (`ZERO_LATENCY_DISALLOWED`).
- Parameter robustness: required parameter stability (`STABLE_REGION`), rejecting isolated peaks.
- Full preservation of boundaries: PromotionEligibility does not mutate StrategyLifecycleState, does not create RiskDecision, and does not allocate capital.

Validation:
- `PYTHONPATH=quants-lab python3 -m unittest discover -s quants-lab/tests -p 'test_*.py' -v`   PASS (45/45 tests)
- `PYTHONPATH=quants-lab python3 -m unittest quants-lab/tests/test_quant_promotion.py -v`   PASS (9/9 tests)
- `npm --prefix trading-core/services/trading-core run typecheck`   PASS (0 errors)
- `git diff --check` & `git -C quants-lab diff --check`   PASS (0 errors)

Next Gate:
- CTO review and acceptance of REQ-QUANT-06.


## AXODUS-TRADING-EPIC-01 / REQ-06  14 Risk Authority & Execution Boundary

Status: `COMPLETE / CTO REVIEW REQUIRED`

Delivered:
- Implemented canonical deterministic Risk Authority (`RiskAuthorityService`, `RiskDecisionValidator`, `RiskTypes`).
- Enforced strict fail-closed evaluations, exact `FixedDecimal` arithmetic, risk monotonicity, and explicit halt scopes.
- Preserved audit invariants AUD-A-01, AUD-A-02, and AUD-C-01. Retained DEBT-AUD-A-03.
- Stopped strictly at `RiskDecision`; zero `TradingIntent` or execution plane implementation.

Validation:
- TypeScript typecheck & build: PASS
- Test suite: 29/29 suites pass (including 18/18 REQ-06 risk tests)
- Quant regression: 45/45 tests pass
- Zero external mutations, zero mainnet, zero real capital.
