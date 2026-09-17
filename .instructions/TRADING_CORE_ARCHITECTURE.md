# Trading Core Architecture

# Sovereign Model

```text
Governance
    -> Federation
    -> Trading Product Layer
    -> Intelligence
    -> Trading Core
    -> Execution Providers
```

The core normalizes commands, state, events, and guardrail decisions.

---

# Headless Operating Model

Trading Core is a headless operational nucleus.

It is background infrastructure accessed through:
- governed APIs
- ACS workflows
- tenant ACS consoles
- contextual product surfaces

It is not a primary public frontend section.

User-facing access must happen through product and tenant surfaces such as WhiteRabbit, Marketplace, DeFi, DEX, Academy, Governance local tenant pages, or ACS tenant consoles.

AxodusAPP must not expose a generic public `/trading` route by default. A generic Trading route is a non-goal unless explicitly scoped as internal admin, observability, or controlled operator infrastructure.

Provider controls must not be exposed directly to users. Hummingbot controls must remain behind provider adapters and governed workflows.

---

# ACS Tenant Operator Boundary

Tenant ACS is an operator access layer for the headless Trading Core.

ACS may:
- request execution
- pause runtime
- resume runtime
- stop runtime
- inspect normalized runtime state
- request risk review
- request strategy simulation
- request telemetry summary
- submit agent recommendations

ACS may not:
- call execution providers directly
- bypass product, governance, risk, runtime, credential, or compliance gates
- expose Hummingbot controls
- convert recommendations into authorization
- become source of truth for execution state

All ACS commands must preserve:
- `correlationId`
- execution domain
- tenant context
- runtime context when applicable
- provider and strategy identifiers when applicable

---

# Execution Domains

## Treasury Trading

Used for Axodus-controlled capital and governed treasury operations.

Required gate order:

```text
Governance
-> Federation
-> Treasury Policy
-> Global Risk
-> Treasury Risk
-> Provider Execution
```

## User Trading

Used for non-custodial customer runtime execution.

Required gate order:

```text
Compliance Acceptance
-> Product Entitlement
-> Token or Access Policy
-> Runtime Permission
-> Credential Vault Binding
-> Global Risk
-> User Runtime Risk
-> Provider Execution
```

---

# Ownership Boundaries

Axodus owns normalized state for:
- execution context
- execution lifecycle
- orders and fills
- strategy product state
- runtime state
- provider state
- positions and portfolio snapshots
- access decisions
- quota consumption
- disclosure acceptance references
- event history
- audit history

Execution providers own venue-specific side effects only.

---

# Trading State Layer

Trading State Layer is the authoritative boundary for normalized state.

It is responsible for:
- event persistence contracts
- execution state
- runtime state
- order and fill state
- position state
- portfolio state
- provider state
- audit history

Required mutation rule:

```text
Normalized Event or Snapshot
-> State Context Validation
-> Trading State Service
-> Repository Boundary
```

Hummingbot and other execution providers may emit normalized events or snapshots, but they must not own canonical Axodus Trading state.

---

# Persistent State Boundary

Phase 7A introduces Postgres repository adapters as the first durable state boundary.

Durable tables:
- `trading_events`
- `trading_orders`
- `trading_fills`
- `trading_positions`
- `trading_portfolios`
- `trading_runtime_instances`
- `trading_provider_state`
- `trading_runtime_audit`

`trading_events` is append-only. Events must persist before subscriber dispatch.

Replay must support:
- correlation trace
- runtime trace
- strategy product trace
- provider trace
- tenant trace
- event type trace

Runtime recovery may rehydrate lifecycle state from persisted runtime records before emitting recovery events.

---

# Provider Reconciliation Boundary

Provider reconciliation compares provider side effects with Axodus normalized state.

It detects:
- provider state drift
- order divergence
- fill divergence
- position divergence
- runtime drift
- stale execution state
- orphan runtime state

Reconciliation produces proposals and telemetry. It must not directly overwrite sovereign state.

```text
Provider Snapshot
-> Reconciliation Detector
-> Finding
-> Proposal
-> Event / Audit Trail
-> Governed Recovery or Review Workflow
```

Treasury reconciliation and user reconciliation must preserve separate tenant context and correlation traces.

---

# Hummingbot Runtime Boundary

Hummingbot is a deep execution runtime adapter, not a sovereign core.

Supported paper-first lifecycle:
- boot
- shutdown
- restart
- recovery
- degradation signaling
- connector availability signaling
- normalized runtime telemetry ingestion

The Hummingbot adapter may produce normalized:
- orders
- fills
- positions
- balances
- runtime health
- connector health
- runtime telemetry

It must not expose Hummingbot DTOs outside `execution/providers/hummingbot`.

It must not bypass:
- governance
- product entitlement
- compliance
- risk
- runtime credential authority
- Trading Core orchestration

---

# Condor Agent Runtime Boundary

Condor is an external agent runtime and bounded orchestration adapter at the Axodus boundary. It may reason, propose signals or workflow requests, maintain bounded agent state, and orchestrate operations that Axodus has already permitted.

Condor must remain downstream of Axodus-owned governance, compliance, risk, credential, state, audit and execution gates. It must not call Hummingbot, exchange connectors, exchanges, wallets or credential stores directly; create or approve orders outside Trading Core; own canonical positions, portfolio, accounting, audit or capital authority; bypass gates; or receive private keys, withdrawal rights or unrestricted capital access.

The Condor source is not materialized in this checkout. This boundary formalizes the approved Axodus ownership model without asserting uninspected Condor internals. A future Condor implementation task must verify the source interfaces and add an adapter contract where required.

---

# WhiteRabbit Runtime-native Strategy Boundary

WhiteRabbit is the first strategy migrated into:

```text
StrategyProvider
-> StrategyProduct
-> RuntimeInstance
-> RuntimeEngine
-> SignalPipeline
-> ExecutionProfile
```

WhiteRabbit runtime supports:
- Bollinger configuration
- ATR adaptation metadata
- RSI confirmation
- volume filters
- candlestick filters
- signal traces
- runtime telemetry
- simulation-first lifecycle

WhiteRabbit may emit normalized strategy signals and telemetry, but it does not directly execute production orders or mutate production runtime parameters.

Trinity recommendations may create parameter proposals. They do not mutate strategy state unless future governance/risk workflows explicitly approve a bounded mutation path.

---

# Headless API Boundary

Trading Core exposes a service/controller API boundary for ACS and product surfaces.

```text
ACS / Product Surface
-> TradingApiGateway
-> Read API / Action Request API / Telemetry API / Runtime Inspection API
-> ACS Boundary
-> Trading Core Gates
```

The API boundary supports normalized reads and request submission only.

It must not:
- call providers directly
- expose execution authority
- expose secrets
- expose provider DTOs
- bypass product, governance, compliance, risk, credential, or runtime gates
- create public frontend routes by default

---

# ACS / Trinity Command Orchestration Boundary

ACS and Trinity submit workflow requests through explicit command APIs.

```text
ACS / Trinity
-> AcsTradingCommandApi / TrinityRecommendationApi / RuntimeSupervisionApi
-> TradingWorkflowRequestService
-> RecommendationApprovalService
-> Workflow Decision / Audit Trail
```

Supported requests include simulation, backtest, provisioning, runtime recovery, provider suspension, strategy pause, telemetry inspection, and strategy activation review.

This boundary preserves:
- tenant context
- runtime context
- execution domain
- correlation ID
- governance context
- autonomy level

The command boundary returns approval/rejection decisions. It does not call providers, mutate runtime directly, control Hummingbot, or grant production execution authority.

---

# Postgres Bootstrap Boundary

Trading persistence has an operational bootstrap layer:

```text
TradingDatabaseConfig
-> DatabaseConnectionManager
-> MigrationRunner
-> DatabaseHealthService
-> PostgresBootstrapService
```

The bootstrap layer supports local and future staging readiness:

- ordered migration execution
- append-only migration history
- schema version inspection
- minimum schema version validation
- connection health checks
- repository readiness checks
- graceful shutdown

This is not production deployment orchestration. Distributed locks, clustering, cloud managed database control, ClickHouse, Redis, Kafka, and live exchange reconciliation remain outside this boundary.

---

# Runtime Observability Boundary

Trading Core has an internal operational observability layer:

```text
Runtime / Provider / Strategy Telemetry
-> Metrics Collection
-> Health Scoring
-> Operational Events
-> Audit / Trinity Inputs
```

The observability layer measures:

- runtime health
- provider health
- runtime degradation
- execution latency
- slippage metrics
- runtime recovery metrics
- strategy performance health
- telemetry ingestion quality

Normalized health states:

- healthy
- degraded
- critical
- suspended

This layer is not an execution authority. It does not call providers, mutate runtime directly, expose secrets, expose provider DTOs, or bypass ACS/governance/compliance/risk/runtime gates.

---

# Local Infrastructure Runtime

Trading Core has a development-only local infrastructure runtime:

```text
.env
-> docker-compose.trading.yml
-> Local Postgres
-> db:bootstrap-local
-> MigrationRunner
-> DatabaseHealthService
-> mock/simulation seed data
```

The local runtime supports:

- local Postgres startup
- environment-based database config
- migration bootstrap
- schema status validation
- repository readiness healthcheck
- mock/simulation-only seed data
- teardown with optional local volume removal

This local runtime is not production deployment infrastructure.

It must not include:

- production database credentials
- real CEX API keys
- wallet private keys
- live exchange credentials
- Hummingbot live sessions
- treasury execution data
- live execution routes

---

# Trading DB CLI Boundary

Trading database operations are exposed through a local/future-staging CLI:

```text
trading-db command
-> TradingDatabaseConfig
-> DatabaseConnectionManager
-> MigrationRunner / DatabaseHealthService / PostgresBootstrapService
-> Human or JSON output
```

Supported commands:

- migrate
- status
- health
- version
- validate
- seed-local

The CLI does not duplicate migration logic, bypass `MigrationRunner`, mutate schema outside migration files, print database passwords, implement rollback, or imply production deployment automation.

---

# Real Postgres Client Boundary

Trading persistence has a real local Postgres adapter:

```text
Repositories
-> PostgresQueryClient contract
-> NodePostgresClient
-> pg Pool
-> Local Postgres
```

The adapter owns:

- connection pooling
- parameterized query execution
- query timeout
- conservative retry
- normalized error mapping
- graceful shutdown
- env config mapping

Repositories must not import `pg` directly. Provider, runtime, strategy, governance, and risk logic must not live in the database adapter.

This boundary enables local real persistence. It does not enable production deployment, cloud database operations, live trading, or real exchange execution.

---

# Observability Query API Boundary

Trading observability is exposed through a headless read-only API:

```text
ACS / WhiteRabbit / Operator Tool
-> TradingObservabilityApi
-> TenantObservabilityQueryService
-> Runtime / Provider / Strategy Observability Services
-> Normalized Read Models
```

The API exposes:

- runtime health
- provider health
- strategy health
- telemetry ingestion quality
- execution latency
- tenant operational summary

The API does not call providers, mutate runtime, expose provider DTOs, expose secrets, expose raw provider payloads, or create execution authority. Health states are advisory unless future risk/gate policies consume them explicitly.

---

# Trinity Observability Integration Boundary

Trinity consumes normalized observability through:

```text
TradingObservabilityApi
-> TrinityObservabilityAdapter
-> Recommendation Services
-> ObservabilityRecommendationAuditService
-> Event/Audit Trail
```

Supported recommendation triggers:

- degraded or critical runtime health
- degraded or critical provider health
- degraded or critical strategy health
- execution latency spikes
- degraded telemetry ingestion

Trinity output remains:

- recommendation only
- `authorizedExecution: false`
- ACS approval required
- governed by Trading Core workflows before any runtime/provider effect

Trinity does not call providers, mutate runtimes, pause strategies, block providers, expose provider DTOs, expose credentials, or bypass tenant scope.
