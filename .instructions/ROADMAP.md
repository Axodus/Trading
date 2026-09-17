# Trading Roadmap

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
- `IMP-01D` remains conditional on an explicitly admitted transport

Record:
- `.instructions/TRADING_REQ_04_MATERIALIZED_REPOSITORY_VERIFICATION.md`
- REQ-03 remains historical provenance; REQ-04 is the current materialized baseline record

---

# AXODUS-TRADING-IMP-01 - Restricted Baseline Implementation Foundations

Status: IN PROGRESS / RESTRICTED HTTP BASELINE

Progress: `IMP-01A COMPLETE / IMP-01B COMPLETE / IMP-01C NEXT`

Scope:
- establish the dependency and contract foundations for the frozen REQ-04 baseline
- implement the minimal Axodus-owned HTTP `ExecutionProvider` boundary
- run offline fixture, mock and contract validation before any operational integration
- defer market-data read/feed work until the required transport is explicitly admitted

Sequence:
1. `IMP-01A` — dependency and contract foundations
2. `IMP-01B` — HTTP `ExecutionProvider` adapter
3. `IMP-01C` — offline contract validation
4. `IMP-01D` — conditional market-data read boundary

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
- Condor integration is later work and remains outside the first path
- no credentials, direct trading, real orders, Gateway/wallet authority, production, capital or System One activity
