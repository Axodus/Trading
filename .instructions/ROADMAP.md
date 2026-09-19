# Cross-EPIC Shared Contract Freeze — SCF-01

Status: COMPLETE / CTO REVIEW REQUIRED / IMPLEMENTATION HOLD

SCF-01 reconciles the shared semantic contracts required by EPIC-01 and
EPIC-QUANT under REQ-15. The documentary freeze covers strategy identity and
revision, lifecycle, MarketState, features, datasets, experiments, evidence,
promotion eligibility and StrategyHealth. It does not authorize implementation.

Readiness: `PARALLEL IMPLEMENTATION READY: NO` pending the missing formal EPIC-01
planning artifact and ACS Evidence adapter conformance validation. See
`.instructions/AXODUS_TRADING_CROSS_EPIC_SCF_01_SHARED_CONTRACT_FREEZE.md`.

# Trading Roadmap

## Sovereign Architecture Gate — REQ-15

Status: `COMPLETE / DOCUMENTAL AUDIT & ARCHITECTURE FREEZE / CTO REVIEW REQUIRED`

The next program architecture gate is `AXODUS-TRADING-REQ-15 — Sovereign
Agentic Trading Architecture & Infrastructure Freeze`. It must audit ACS,
Trading Harness ownership, Hummingbot, Condor, the standalone Binance runtime,
current risk/reconciliation state, market data, `quants-lab`, and runtime
boundaries before any new Trading implementation is authorized.

Planning deliverables include the sovereign architecture diagram, ownership and
component classification matrices, Agent/Workforce model, provider-neutral
contracts, data and execution architecture, Quant Lab and security boundaries,
strategy lifecycle, gap register, and proposed EPIC sequence.

Entry gate: `VAL-05 COMPLETE / PASS` is satisfied and CTO accepted on commit
`ded3f85d2acc3f2f6d6d9e1337bf1dcafc123710`. REQ-15 planning is authorized to proceed.

Deliverable completed: `.instructions/TRADING_REQ_15_SOVEREIGN_AGENTIC_TRADING_ARCHITECTURE_FREEZE.md`.

Sequenced post-acceptance EPIC roadmap:
1. `AXODUS-TRADING-EPIC-01`: Sovereign Trading Contracts & Intelligence Foundations
2. `AXODUS-TRADING-EPIC-QUANT`: Quantitative Research & Strategy Validation Laboratory
3. `AXODUS-TRADING-EPIC-02`: Strategy Research, Specialization & Workforce Modeling
4. `AXODUS-TRADING-EPIC-03`: Portfolio Allocation & Sovereign Risk Authority
5. `AXODUS-TRADING-EPIC-04`: Execution Plane Integration (Hummingbot & Condor Adapters)
6. `AXODUS-TRADING-EPIC-05`: Trading Feedback, Attribution & Continuous Adaptation
7. `AXODUS-TRADING-EPIC-06`: Axodus Trading Pocket (Client Trial & Demo Productization)

Until acceptance: documentation, factual audits, evidence preservation, and
authorized validation closure only. No strategy, Agent, Quant Lab, Pocket,
Hummingbot/Condor integration, new exchange adapter, or production enablement.

# Phase 0 - Trading Architecture and Product Economy

Status: IN PROGRESS

Objectives:
- define sovereign trading architecture
- define Trading Core as headless operational infrastructure
- define product economy architecture
- define treasury versus user execution boundaries
- define runtime, access, billing, credential vault, and disclosure boundaries
- define telemetry and event foundations

Deliverables:
- trading core architecture specification
- product economy specification
- headless core decision and frontend non-goals
- runtime/security/compliance specifications
- shared contract package
- scaffolded core and product services
- Phase 0 event model

---

# Phase 3A - Headless Core and Product Surface Alignment

Status: IN PROGRESS

Objectives:
- keep Trading Core as a governed background nucleus
- route user-facing interaction through Strategy Products, Marketplace, DeFi, DEX, Academy, Governance local tenant pages, and ACS tenant consoles
- document that WhiteRabbit is the first user-facing Strategy Product
- prevent generic public `/trading` frontend exposure by default

Deliverables:
- headless Trading Core architecture decision
- AxodusAPP generic Trading route marked as non-goal
- provider and Hummingbot controls restricted to internal/gated workflows

---

# Phase 1 — Execution Foundation

Status: PLANNED

Objectives:
- implement execution infrastructure
- implement exchange abstraction
- implement telemetry systems
- implement portfolio tracking

Deliverables:
- execution engine
- exchange connectors
- execution telemetry
- portfolio visibility
- accounting aggregation

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

# Phase 3 — Risk Infrastructure

Status: IN PROGRESS

Objectives:
- implement sovereign risk systems
- establish authoritative trading state infrastructure

Deliverables:
- normalized state services
- event-derived execution state
- runtime lifecycle state
- provider health state
- audit history boundary
- in-memory event persistence skeleton
- correlation trace reconstruction
- audit query layer
- exposure limits
- drawdown controls
- emergency execution controls
- treasury protection systems
- risk telemetry

---

# Phase 4 — ACS Integration

Status: IN PROGRESS

Objectives:
- integrate AI-assisted execution
- establish Tenant ACS operator boundary
- prepare WhiteRabbit product surface contract

Deliverables:
- ACS trading intent contracts
- ACS runtime command contracts
- operator access service
- normalized runtime inspection
- recommendation intake without authorization
- WhiteRabbit product read models
- WhiteRabbit safe product surface service
- Trinity recommendation engine
- Trinity bounded cognitive operator events
- Trinity autonomy policy
- simulation-first governance policy
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

# Phase 5 — Credential, Compliance, and Runtime Authority

Status: IN PROGRESS

Objectives:
- establish non-custodial credential authority
- enforce disclosure/compliance before runtime enablement
- formalize governed runtime provisioning

Delivered:
- Credential Vault skeleton
- runtime credential binding service
- provider-scoped credential policy
- tenant credential isolation
- compliance runtime gate
- disclosure acceptance/version enforcement
- runtime provisioning API
- runtime lifecycle orchestration
- runtime recovery skeleton
- Postgres repository adapters
- durable event store migration
- persistent runtime/provider/order/fill/portfolio/position state boundaries
- replay by correlation/runtime/strategy product/provider/tenant/event type

Next deliverables:
- reconciliation jobs
- Hummingbot runtime session orchestration

---

# Phase 7A - Persistent State Authority

Status: IMPLEMENTED

Objectives:
- make audit/event history durable
- preserve append-only Trading event store
- prepare runtime recovery from persisted state
- keep provider side effects outside sovereign state authority

Delivered:
- initial Postgres migration
- Postgres repository adapters
- replay-capable event repository
- in-memory Postgres-compatible test adapter
- runtime recovery persistence hook
- durability and replay tests

---

# Phase 7B - Provider Reconciliation Skeleton

Status: IMPLEMENTED

Objectives:
- prepare provider/runtime divergence handling
- detect provider drift before live Hummingbot execution
- keep provider side effects bounded by reconciliation proposals
- preserve sovereign state authority

Delivered:
- reconciliation contracts
- provider drift detector
- order reconciliation service
- position reconciliation service
- runtime reconciliation service
- stale execution state detector
- provider reconciliation orchestrator
- reconciliation telemetry events
- tests for divergence, stale/orphan runtime, proposal generation, isolation, and telemetry

---

# Phase 8A - Hummingbot Runtime Deep Adapter

Status: IMPLEMENTED

Objectives:
- begin realistic Hummingbot runtime lifecycle integration
- keep Hummingbot paper-first and non-sovereign
- normalize runtime streams into Axodus contracts
- emit lifecycle and degradation telemetry

Delivered:
- runtime boot/shutdown/restart/recovery skeleton
- connector unavailable handling
- runtime degradation handling
- normalized fills/balances/positions/telemetry ingestion
- Hummingbot lifecycle events
- DTO isolation tests

---

# Phase 8B - WhiteRabbit Runtime Migration

Status: IMPLEMENTED

Objectives:
- make WhiteRabbit the first runtime-native Strategy Product
- introduce strategy state, signal pipeline, telemetry, and execution profile
- keep lifecycle simulation-first and tenant-isolated
- keep Trinity proposals bounded by governance and risk

Delivered:
- WhiteRabbit runtime engine
- WhiteRabbit signal pipeline
- WhiteRabbit execution profile
- WhiteRabbit normalized strategy state
- WhiteRabbit runtime telemetry service
- signal and lifecycle events
- runtime-native strategy tests

---

# Phase 9A - Trinity Market Intelligence

Status: IMPLEMENTED

Objectives:
- make Trinity telemetry-aware
- ingest deterministic market and runtime intelligence
- improve recommendation quality without granting execution authority

Delivered:
- market intelligence service
- market regime detector
- volatility and spread analysis
- provider quality scoring
- strategy degradation analyzer
- runtime telemetry ingestion
- intelligence recommendation events
- tests for intelligence recommendations and audit

---

# Phase 9B - Headless Trading API Boundary

Status: IMPLEMENTED

Objectives:
- make Trading Core safely consumable by ACS and product surfaces
- standardize read models, action requests, runtime inspection, and telemetry summaries
- keep the core headless and provider-protected

Delivered:
- headless API gateway
- read API
- action request API
- telemetry API
- runtime inspection API
- normalized API models
- API boundary tests

---

# Phase 9C - WhiteRabbit Product Surface API

Status: IMPLEMENTED

Objectives:
- make WhiteRabbit externally consumable as a Strategy Product
- reinforce product economy layer
- expose product-specific normalized read models and request-only actions

Delivered:
- WhiteRabbit surface API
- WhiteRabbit query service
- WhiteRabbit action request service
- telemetry summary service
- quota view service
- product surface models
- product API boundary tests

---

# Phase 10A - ACS / Trinity Command Orchestration API

Status: IMPLEMENTED

Objectives:
- formalize ACS and Trinity command orchestration boundary
- convert commands and recommendations into auditable workflow requests
- preserve governance/risk/compliance/autonomy context
- keep runtime/provider authority centralized behind Trading Core gates

Delivered:
- ACS command API
- Trinity recommendation API
- runtime supervision API
- workflow request service
- recommendation approval service
- workflow command contracts
- approval/rejection events
- command orchestration tests

---

# Phase 10B - Postgres Bootstrap and Migration Runner

Status: IMPLEMENTED

Objectives:
- operationalize the Postgres persistence boundary for local and future staging
- standardize migrations, startup validation, health checks, and schema version inspection
- preserve sovereign state boundaries while making repositories environment-ready

Delivered:
- Postgres bootstrap service
- migration runner
- database connection manager
- database health service
- database config contract
- append-only migration history support
- migration ordering/idempotency tests
- normalized database health tests

---

# Phase 10C - Runtime Observability and Operational Telemetry

Status: IMPLEMENTED

Objectives:
- make runtime, provider, strategy, and telemetry health measurable
- produce normalized operational health scores
- track runtime operational metrics
- emit internal telemetry events for degraded/critical conditions
- prepare richer Trinity telemetry analysis inputs

Delivered:
- runtime observability service
- provider observability service
- strategy telemetry aggregator
- operational health scoring service
- runtime metrics collector
- execution latency tracker
- operational telemetry contracts and events
- observability tests

---

# Phase 11A - Local Infrastructure Runtime

Status: IMPLEMENTED

Objectives:
- make Trading Core persistence runnable against local Postgres
- provide local env example and isolated Docker Compose service
- standardize bootstrap, healthcheck, and mock seed commands
- keep local runtime explicitly non-production and simulation-only

Delivered:
- local Trading Docker Compose
- local env example
- database bootstrap script
- database healthcheck script
- mock seed script
- local database config parser
- service startup/teardown documentation
- local infrastructure tests

---

# Phase 11B - Migration CLI and Operational Scripts

Status: IMPLEMENTED

Objectives:
- expose Trading database migration and health services as repeatable CLI workflows
- support local and future staging operational use
- support JSON output for automation
- keep migration logic centralized in `MigrationRunner`
- keep local seed data simulation-only

Delivered:
- `trading-db` CLI
- migrate/status/health/version/validate/seed-local commands
- human output renderer
- JSON output renderer
- npm wrapper script
- CLI tests

---

# Phase 11C - Real Postgres Client Adapter

Status: IMPLEMENTED

Objectives:
- connect Trading persistence boundary to real local Postgres
- keep repository interfaces unchanged
- keep `pg` isolated inside the Postgres adapter boundary
- make local bootstrap/health/seed/CLI commands use the real adapter

Delivered:
- real Node/Postgres client adapter
- connection pool wrapper
- error mapper
- env config mapper
- timeout and retry support
- graceful shutdown support
- local script integration
- adapter tests

---

# Phase 12A - Observability Query API

Status: IMPLEMENTED

Objectives:
- make Trading observability safely consumable by ACS and product surfaces
- expose normalized read-only runtime/provider/strategy health
- preserve tenant scope and prevent sensitive leakage
- keep observability separate from execution authority

Delivered:
- observability contracts
- trading observability API
- tenant observability query service
- observability access guard
- observability read model tests

---

# Phase 12B - Trinity Observability Integration

Status: IMPLEMENTED

Objectives:
- feed normalized observability snapshots into Trinity
- generate telemetry-aware recommendations without execution authority
- preserve tenant context and correlationId
- record observability recommendation evidence and lifecycle in audit trail

Delivered:
- `TrinityObservabilityAdapter`
- runtime, provider, strategy, latency recommendation services
- observability recommendation audit service
- observability evidence model
- expanded Trinity recommendation types
- tests for advisory-only recommendations and audit persistence

---

# Phase 13A - Local Postgres End-to-End Validation

Status: IMPLEMENTED

Objectives:
- validate local durable Postgres runtime end-to-end
- prove migrations, health, seed, repository readiness, event persistence, and replay
- keep integration test gated so environments without local Postgres remain green
- preserve tenant-scoped replay and user/treasury separation

Delivered:
- local Postgres smoke script
- local DB reset helper
- repository readiness check
- tenant_id event-store migration
- gated real Postgres integration test
- README and phase documentation

---

# Phase 13B - Observability Risk Feedback Policy

Status: IMPLEMENTED

Objectives:
- connect normalized observability signals to risk policy
- produce decisions/proposals without direct execution authority
- preserve tenant context and correlationId
- persist risk signal and decision lifecycle in audit trail

Delivered:
- observability risk contracts
- provider/runtime/strategy health risk evaluators
- observability risk policy
- risk decision service
- risk audit service
- tests for proposals, recovery, revalidation, tenant rejection, audit, and final RiskGateway authority

---

# Phase 13C - Reconciliation Worker Skeleton

Status: IMPLEMENTED

Objectives:
- transform reconciliation services into executable local/mock workflow
- discover stale runtime, provider drift, orphan runtime and divergence candidates
- create reviewable reconciliation proposals
- preserve user/treasury tenant isolation
- emit audit trail without auto-healing

Delivered:
- `ReconciliationWorker`
- `ReconciliationWorkerScheduler`
- `ReconciliationCandidateDiscoveryService`
- `ReconciliationProposalRepository`
- `RuntimeStaleScanService`
- `ProviderDriftScanService`
- `ReconciliationWorkerAuditService`
- tests for proposals, tenant isolation, failure audit, and no provider execution methods

---

# Phase 14A - Credential Vault Real Adapter Boundary

Status: IMPLEMENTED

Objectives:
- prepare Credential Vault for future encrypted backend
- keep adapters provider-agnostic
- introduce encrypted envelope metadata
- introduce ephemeral provider-scoped credential grants
- enforce TTL and revocation

Delivered:
- `CredentialVaultAdapter`
- `CredentialVaultAdapterRegistry`
- `MockEncryptedCredentialVaultAdapter`
- `CredentialGrantLifecycleService`
- envelope/grant contracts
- grant lifecycle events
- tests for TTL, revocation, forbidden scope, scope isolation, registry, and redaction

---

# Phase 14B - Paper Trading Runtime Session

Status: IMPLEMENTED

Objectives:
- introduce governed paper session lifecycle
- support `SimulationProvider` as first paper execution target
- model Hummingbot paper-compatible sessions safely
- reject live execution config and raw production API keys
- persist normalized paper orders/fills
- feed paper telemetry into observability
- run reconciliation dry-runs as proposals only

Delivered:
- `PaperTradingSessionService`
- `PaperConnectorConfigValidator`
- `PaperOrderIngestionService`
- `PaperFillNormalizationService`
- `PaperSessionAuditService`
- paper session contracts and events
- tests for lifecycle, rejection, persistence, observability, reconciliation, and tenant isolation

---

# Phase 15B - WhiteRabbit Paper Validation Workflow

Status: IMPLEMENTED

Objectives:
- connect WhiteRabbit runtime engine to governed paper sessions
- generate WhiteRabbit paper signals and normalized paper fills
- produce tenant-scoped paper telemetry summaries
- include reconciliation dry-run evidence
- keep Trinity recommendations advisory
- evaluate controlled resume eligibility without live authorization

Delivered:
- `WhiteRabbitPaperValidationService`
- `WhiteRabbitPaperSessionAdapter`
- `WhiteRabbitPaperTelemetrySummaryService`
- `WhiteRabbitControlledResumeEvaluator`
- paper validation contracts and events
- tests for live rejection, gates, telemetry scope, evidence, reconciliation and Hummingbot DTO isolation

---

# Phase 15C - ACS Review Flow for Reconciliation Proposals

Status: IMPLEMENTED

Objectives:
- close the reconciliation proposal review loop
- require ACS review before remediation requests
- enforce risk rejection and treasury governance rejection
- preserve user/treasury tenant isolation
- keep remediation request-only with no provider mutation
- persist review and remediation audit events

Delivered:
- `ReconciliationProposalReviewService`
- `ReconciliationProposalAuditService`
- `ReconciliationRemediationEligibilityService`
- `ReconciliationReviewPolicy`
- review/remediation contracts and events
- tests for tenant context, risk/governance blocks, approval request-only, rejection audit and worker self-approval block

---

# Phase 16A - Paper Observability Risk Loop

Status: IMPLEMENTED

Objectives:
- convert paper telemetry into consultative risk evidence
- evaluate fill quality, latency, slippage, health and reconciliation results
- block controlled resume eligibility on critical evidence
- preserve ACS/Risk workflow as approval boundary

Delivered:
- `PaperSessionRiskSignalService`
- `PaperSessionHealthEvaluator`
- `PaperExecutionQualityEvaluator`
- `PaperControlledResumePolicy`
- `PaperRiskDecisionService`
- `PaperRiskAuditService`
- tests for latency, runtime degradation, unresolved reconciliation, quality degradation, tenant isolation and no provider calls

---

# Phase 16B - Real Local Postgres CI Script

Status: IMPLEMENTED

Objectives:
- expose one repeatable local E2E validation command
- start local compose Postgres when requested
- run migrate, seed, health, validate and smoke replay flow
- support JSON output and cleanup/reset options
- reject unsafe production-like environments
- redact database secrets in diagnostics

Delivered:
- `npm run trading:local:e2e`
- `TradingLocalE2eCommand`
- `scripts/trading-local-e2e.ts`
- `scripts/wait-for-postgres.ts`
- `scripts/local-e2e-report.ts`
- tests for safety, redaction, command sequencing and readable failure reporting

---

# AXODUS-TRADING-REQ-02 - Canonical Architecture & RAG Reconciliation

Status: COMPLETE / DOCUMENTATION VALIDATED / IMPLEMENTATION HOLD

Delivered:
- recovered and classified existing Axodus, Hummingbot, backend API, agent, market-data, risk, credential and execution material
- formalized the Condor external agent runtime and bounded orchestration boundary
- recorded the canonical ownership matrix and implementation gap map
- reconciled RAG-facing architecture, SPEC-facing boundaries and roadmap/task order
- assessed System One REQ-01A–A4 premises without re-running research

Next implementation order, pending CTO review:
1. architecture and contract freeze
2. materialize and audit Hummingbot/Condor source boundaries
3. complete adapter contracts
4. validate market-data and execution-provider paths
5. integrate risk and strategy through governed requests
6. integrate Condor/agent workflows behind the same gates
7. expand research/backtest and operations evidence

Record:
- `.instructions/TRADING_REQ_02_CANONICAL_ARCHITECTURE_AUDIT.md`

---

# AXODUS-TRADING-REQ-03 - Hummingbot / Condor Implementation Baseline & Gap Freeze

Status: COMPLETE / DEPENDENCY BASELINE FROZEN / IMPLEMENTATION HOLD

Objective:
- verify concrete Hummingbot and Condor revisions, APIs, dependencies, lifecycle and adaptation points against REQ-02

Delivered:
- Condor audit baseline `2105d27…` materialized and inspected
- Hummingbot API `v2.1.0` inspected and rejected for the audited Condor surface
- Hummingbot API `e855625…` frozen as the server baseline after static client compatibility resolution
- `hummingbot-api-client==1.4.1` frozen by wheel SHA-256 `37e8b442…` from Condor's lockfile
- ownership, security-sensitive surfaces, market-data suitability and implementation gap map recorded

Remaining constraints:
- server is pinned by immutable SHA rather than release tag
- client wheel embeds no source commit
- IMP-01 remains on hold until its own implementation authorization and contract validation plan

Record:
- `.instructions/TRADING_REQ_03_IMPLEMENTATION_BASELINE_GAP_FREEZE.md`

---

# AXODUS-TRADING-REQ-04 - Materialized Repository Verification & Baseline Reconciliation

Status: COMPLETE / CTO ACCEPTED / CURRENT BASELINE FROZEN / PUBLISHED

Delivered:
- verified the three materialized repositories, origins, gitlinks, checked-out SHAs, tags, branches and clean states
- superseded the REQ-03 planning baseline with Condor `d89e74f…`, client `v1.5.9` / `dae015a3…` and Hummingbot API `2494e847…`
- reconciled Condor, client and server as a compatibility triangle
- verified 337 client HTTP contracts against the vendored OpenAPI specification
- recorded the current WebSocket authentication incompatibility without introducing a shim
- revalidated Axodus ownership, direct-authority isolation and market-data limitations

Remaining constraints:
- no live or fixture-backed server/client contract test was run
- Condor and server focused tests require absent local dependencies
- Hummingbot API remains an untagged commit after `v2.1.0`
- the client WebSocket authentication path is blocked as `AXODUS-TRADING-BLOCKER-01`
- `IMP-01D-HTTP` is complete for the explicitly admitted HTTP transport; streaming remains deferred

Record:
- `.instructions/TRADING_REQ_04_MATERIALIZED_REPOSITORY_VERIFICATION.md`
- REQ-03 remains historical provenance; REQ-04 is the current materialized baseline record

---

# AXODUS-TRADING-IMP-01 - Restricted Baseline Implementation Foundations

Status: IMP-01 COMPLETE / CTO ACCEPTED / RESTRICTED HTTP SUBSTRATE ESTABLISHED / PUBLISHED

Progress: `IMP-01A COMPLETE / IMP-01B COMPLETE / IMP-01C COMPLETE / IMP-01D-HTTP COMPLETE / BLOCKER-01 OPEN`

Scope:
- establish the dependency and contract foundations for the frozen REQ-04 baseline
- implement the minimal Axodus-owned HTTP `ExecutionProvider` boundary
- run offline fixture, mock and contract validation before any operational integration
- complete the admitted HTTP market-data read boundary while keeping streaming deferred

Sequence:
1. `IMP-01A` — dependency and contract foundations
2. `IMP-01B` — HTTP `ExecutionProvider` adapter
3. `IMP-01C` — offline contract validation
4. `AXODUS-TRADING-BLOCKER-01` — WebSocket authentication remediation design, accepted with blocker open
5. `AXODUS-TRADING-REQ-05` — market-data transport and read-boundary freeze
6. `IMP-01D-HTTP` — restricted HTTP-safe market-data read boundary

IMP-01A evidence:
- programmatic REQ-04 dependency baseline and HTTP-only transport admission
- Axodus authorization and provider-failure contracts
- offline foundation tests passing

IMP-01B evidence:
- minimal Axodus-owned HTTP order adapter using `POST /trading/orders`
- request/response mapping and correlation/auth-header propagation
- typed upstream HTTP, timeout, transport and protocol failure mapping
- exact baseline enforcement and no Hummingbot DTO exposure
- offline validation passing

Constraints:
- WebSocket via `hummingbot-api-client v1.5.9` is blocked under `AXODUS-TRADING-BLOCKER-01`

IMP-01C evidence:
- offline adversarial validation covers serialization, response normalization, malformed responses, HTTP 4xx/5xx, timeout and transport failures, auth/correlation boundaries, baseline drift and forbidden capabilities
- transport failure after submission maps to `PROVIDER_EXECUTION_UNKNOWN` and is never blindly retried
- upstream Hummingbot API Client contract suite passes with 337 tests
- no upstream DTO/exception leakage or WebSocket execution path is exposed to Trading Core
- `IMP-01D-HTTP` is complete for the admitted HTTP read boundary; `AXODUS-TRADING-BLOCKER-01` remains open for streaming
- Condor integration is later work and remains outside the first path
- no credentials, direct trading, real orders, Gateway/wallet authority, production, capital or System One activity

IMP-01D-HTTP evidence:
- Axodus-owned market-data read contracts for candles, historical candles, prices, tickers, rates, funding and order-book snapshots
- Hummingbot HTTP normalization with typed market-data failures and no upstream DTO/exception leakage
- offline validation passes for valid observations, malformed responses, timeout/transport failures, baseline drift, pre-HTTP rejection and forbidden stream surfaces
- snapshot metadata explicitly denies continuous, lossless, sequenced, gap-recovered and replayable semantics

Constraints:
- WebSocket remains blocked under `AXODUS-TRADING-BLOCKER-01`
- incremental order-book, trade stream, collector, Trading Data Store, persistence, gap recovery, deduplication, replay, MVRD acquisition and Condor integration remain future work

---

# AXODUS-TRADING-REQ-06 - Execution State, Reconciliation & Idempotency Freeze

Status: COMPLETE / CTO ACCEPTED / PUBLISHED / IMP-02 BLOCKED

Objective: freeze the execution lifecycle and ambiguity-handling contracts required before any operational path or `IMP-02` implementation.

Sequence:
1. preserve the published IMP-01 restricted HTTP substrate;
2. define Axodus-owned client order identity and idempotency semantics;
3. define submission and provider-result state transitions;
4. define reconciliation, restart recovery and cancellation rules;
5. assess Hummingbot identifier/status support without transferring lifecycle ownership;
6. open `IMP-02` only after CTO acceptance of the freeze.

Primary invariant: `PROVIDER_EXECUTION_UNKNOWN` requires reconciliation and cannot be blindly resubmitted.

Record: `.instructions/TRADING_REQ_06_EXECUTION_STATE_RECONCILIATION_IDEMPOTENCY_FREEZE.md`.

# AXODUS-TRADING-REQ-07 - Provider Order Identity Propagation & Reconciliation Feasibility

Status: COMPLETE / CTO ACCEPTED / PUBLISHED / IMP-02 REMAINS BLOCKED

Objective: determine whether an Axodus-controlled execution identity can cross the current Hummingbot path and return as exact provider evidence.

Result: the current client/server request path has no caller-supplied identity and does not pass one to connector `buy/sell`. Provider-generated IDs are persisted and searchable internally, but they do not establish Axodus identity continuity. Concrete Hummingbot Core connector source is not materialized, so venue-level preservation and lookup remain unverified.

Sequence:

1. preserve REQ-06 lifecycle invariants and BLOCKER-02;
2. materialize and freeze the Hummingbot Core connector source;
3. select canonical connectors for a targeted propagation design;
4. define the smallest reviewed request, persistence and exact lookup extension;
5. implement only after CTO review; keep operational `IMP-02` blocked until then.

Final classification: `IDENTITY PROPAGATION NOT RELIABLE / IMP-02 REMAINS BLOCKED`.

Record: `.instructions/TRADING_REQ_07_PROVIDER_ORDER_IDENTITY_PROPAGATION_FEASIBILITY.md`.

# AXODUS-TRADING-REQ-08 - Hummingbot Core & Connector Execution Baseline Audit

Status: `COMPLETE / CORE BASELINE UNRESOLVED / IMPLEMENTATION HOLD`

Objective: determine the exact Hummingbot Core source expected by the materialized API server and trace caller-controlled order identity through Core and canonical connector samples.

Result: the current `hummingbot-api` baseline installs `hummingbot` without a version or revision, does not clone Core, does not record a package lock or image digest, and uses `latest` for the operational Hummingbot image. The API startup guard checks only a currently empty attribute-surface list. The historical `hummingbot==20241125` pin is no longer current. Core provenance is therefore unresolved and Core/connector identity tracing cannot be completed defensibly.

Classification: `CORE BASELINE UNRESOLVED`.

Consequences:

- REQ-07 identity findings are preserved;
- Binance spot, Binance perpetual and Gateway/DEX caller-ID behavior remains `UNVERIFIED`;
- `AXODUS-TRADING-BLOCKER-02` remains open and operational `IMP-02` remains blocked;
- no Core, API, client, connector, adapter or dependency modification is authorized by this audit.

Next gate: provide or freeze an immutable Core repository commit, package artifact or inspectable image digest, then repeat only the Core/connector identity trace.

Record: `.instructions/TRADING_REQ_08_HUMMINGBOT_CORE_CONNECTOR_EXECUTION_BASELINE_AUDIT.md`.

# AXODUS-TRADING-REQ-09 - Hummingbot Core Provenance Recovery & Immutable Baseline Freeze

Status: `COMPLETE / PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED / IMPLEMENTATION HOLD`

Objective: recover the strongest historical evidence for the Hummingbot Core expected by API `2494e847...` without selecting an arbitrary upstream revision.

Result: API history contains explicit pins `hummingbot==20241125` at `88400de...` and `hummingbot==20250715` at `68367ab...`; both were later removed. The current API deliberately installs `hummingbot` without a version or revision, and no Core SHA, package artifact, lockfile or image digest establishes the implementation used by the current baseline.

Classification: `PROVENANCE PARTIALLY RECOVERED / CTO BASELINE SELECTION REQUIRED`.

Consequences:

- historical reconstruction is not defensible from the available evidence;
- a new prospective Axodus Core qualification may be selected, but this REQ does not select it;
- Core/connector identity tracing, `AXODUS-TRADING-BLOCKER-02` and `IMP-02` remain blocked;
- no dependency or runtime modification was made.

Next gate: CTO selection of immutable historical provenance or a prospective Axodus Core qualification, followed by targeted connector identity tracing.

Record: `.instructions/TRADING_REQ_09_HUMMINGBOT_CORE_PROVENANCE_RECOVERY.md`.

## AXODUS-TRADING-IMP-02B — Canonical CEX Execution Lifecycle & Reconciliation

Status: IMPLEMENTED / CTO REVIEW PENDING

Objective: implement the Axodus-owned CEX execution lifecycle on top of the accepted Binance Spot and Binance Perpetual strong-reconciliation capability model.

Delivered:

- attempt-specific execution client identity and repository boundary;
- explicit submission, acknowledgement, rejection, failure and unknown-outcome states;
- REST exact reconciliation with `found`, `not-found` and `indeterminate` outcomes;
- connector capability admission before reconciliation;
- separate cancellation request and cancellation result states;
- recoverable state listing for restart/recovery integration;
- no blind retry and no WebSocket correctness dependency.

Next gate: `VAL-02B — Offline deterministic reconciliation`. `AXODUS-TRADING-BLOCKER-02` remains open until validation acceptance. Gateway/DEX, Condor, WebSocket and operational trading remain outside scope.

Record: `.instructions/TRADING_IMP_02B_CEX_LIFECYCLE_RECONCILIATION.md`.

## AXODUS-TRADING-VAL-02B — Offline Deterministic CEX Lifecycle & Reconciliation Acceptance

Status: `COMPLETE / PARTIALLY VALIDATED / CTO REVIEW PENDING`

The offline gate validates deterministic in-process lifecycle and exact REST reconciliation behavior. It does not close `BLOCKER-02`: the current repository is in memory, and durable persistence, crash recovery and cross-process atomicity require a future authorized increment.

Next: CTO review of the evidence, followed by a separately scoped durable execution-state/recovery increment if blocker closure is desired.

Record: `.instructions/TRADING_VAL_02B_OFFLINE_CEX_LIFECYCLE_RECONCILIATION.md`.

## AXODUS-TRADING-REQ-12 — Durable Execution State & Recovery Architecture Freeze

Status: `COMPLETE / ARCHITECTURE PARTIAL / DEPENDENCY DECISION REQUIRED`.

PostgreSQL and persisted events are reusable foundations, but durable execution attempts, atomic state/evidence transitions, compare-and-set or claim fencing, and crash recovery are not yet frozen as implementable contracts.

```text
VAL-02B accepted
      ↓
REQ-12 architecture partial
      ↓ CTO decisions required
IMP-02C durable lifecycle and recovery
      ↓
durability validation and BLOCKER-02 closure review
```

Record: `.instructions/TRADING_REQ_12_DURABLE_EXECUTION_STATE_RECOVERY_ARCHITECTURE_FREEZE.md`.

## AXODUS-TRADING-IMP-02C0 — Durable Execution Persistence Primitives

Status: `IMPLEMENTED / VALIDATION READY / CTO REVIEW PENDING`

```text
REQ-12 accepted
      ↓
IMP-02C0 implemented
      ↓
VAL-02C0 PostgreSQL atomicity + CAS acceptance
      ↓
IMP-02C durable lifecycle and crash recovery
```

The increment establishes only the persistence primitives. `IMP-02C` remains blocked until validation and a separate implementation gate. `BLOCKER-02` remains open.

Record: `.instructions/TRADING_IMP_02C0_DURABLE_EXECUTION_PERSISTENCE_PRIMITIVES.md`.

## AXODUS-TRADING-IMP-02C — Durable CEX Lifecycle & Crash Recovery

Status: `IMPLEMENTED / VALIDATION EVIDENCE READY / CTO REVIEW PENDING`

```text
IMP-02C0 persistence primitives
            ↓
IMP-02C durable lifecycle integration   ✓
            ↓
VAL-02C failure windows A–J             ← NEXT
            ↓
BLOCKER-02 closure review
```

IMP-02C establishes the durable runtime orchestration but does not close crash-recovery validation. WebSocket, Condor, Gateway/DEX, credentials, external orders and capital remain outside scope.

Record: `.instructions/TRADING_IMP_02C_DURABLE_CEX_LIFECYCLE_CRASH_RECOVERY.md`.

## AXODUS-TRADING-VAL-02C — Durable Crash Recovery Acceptance

Status: `COMPLETE / CTO ACCEPTED`.

```text
IMP-02C durable lifecycle
          ↓
VAL-02C accepted
          ↓
BLOCKER-02 RESOLVED / CTO CLOSED
          ↓
VAL-03 controlled runtime acceptance
```

The closure is limited to the Axodus-controlled simulated/provider boundary. Real venue execution, WebSocket correctness, Condor, Gateway/DEX and capital remain outside scope.

## AXODUS-TRADING-VAL-03 — Hummingbot Runtime & CEX Provider Integration Acceptance

Status: `COMPLETE / CTO ACCEPTED`.

The gate validates Python runtime imports, API/Core integration, controlled connector behavior, full Axodus integration and runtime fault injection before any external paper/shadow or live connectivity decision. The controlled full-lifespan harness now passes with local PostgreSQL, Core initialization, controlled connector submission/lookup/cancellation, restart visibility and cleanup. One history pagination service test exceeded the controlled timeout; the temporary Hummingbot package install is validation-only and does not alter the frozen baseline.

The controlled FastAPI HTTP and full-lifespan harnesses pass identity, lookup, cancellation, failure normalization, no-blind-retry behavior, PostgreSQL persistence, service reconstruction and cleanup. Order history remains unaccepted and is proposed as a documented non-critical limitation because it is outside the correctness paths; CTO review is pending.

## AXODUS-TRADING-REQ-13 — External CEX Validation & Paper/Shadow Readiness Freeze

Status: `COMPLETE / CTO REVIEW READY`

Froze the precise isolation, credential mapping, order size ceiling, cleanup, and capability verification requirements for external testnet/sandbox connectivity. External execution remains HOLD until a subsequent validation gate is authorized.
