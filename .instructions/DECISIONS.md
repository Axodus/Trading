# Trading Decisions

# Active Decisions

## Trading Direction

Decision:
Trading acts as the strategic market execution layer of the Axodus ecosystem.

Status:
CONFIRMED

---

## Risk Philosophy

Decision:
Risk systems take priority over execution optimization.

Treasury preservation is sovereign priority.

Status:
CONFIRMED

---

## Execution Philosophy

Decision:
Execution systems must remain:
- observable
- auditable
- telemetry-driven
- governance-compatible

Opaque execution is forbidden.

Status:
CONFIRMED

---

## Governance Integration

Decision:
Trading remains governance-aware and governance-constrained.

Trading systems must never bypass:
- governance permissions
- treasury boundaries
- constitutional restrictions

Status:
CONFIRMED

---

## ACS Integration

Decision:
ACS systems may assist:
- analysis
- simulations
- optimization
- telemetry interpretation

ACS systems must remain bounded and observable.

Status:
CONFIRMED

---

## Strategy Philosophy

Decision:
Strategies remain isolated execution systems.

Strategies must:
- expose telemetry
- expose accounting
- expose risk boundaries

Status:
CONFIRMED

---

## Exchange Philosophy

Decision:
Exchange integrations must remain modular and abstracted.

Avoid exchange-specific coupling.

Status:
CONFIRMED

---

## Telemetry Philosophy

Decision:
Telemetry is mandatory infrastructure.

All execution systems must expose:
- execution state
- accounting visibility
- failure telemetry
- portfolio visibility

Status:
CONFIRMED

---

## Trading Infrastructure as a Service

Decision:
Trading is a product economy layer as well as sovereign execution infrastructure.

Axodus provides:
- orchestration
- automation
- intelligence
- tooling
- governed infrastructure access

Users retain:
- their own capital
- their own wallets
- their own exchange accounts
- their own execution credentials

Status:
CONFIRMED

---

## Treasury Trading and User Trading

Decision:
Treasury Trading and User Trading share one `TradingCore`, but must remain distinct execution domains with separate policy, risk, compliance, and permission boundaries.

Status:
CONFIRMED

---

## Product Economy Boundaries

Decision:
Phase 0 must formalize first-class product boundaries for marketplace, access, runtime, billing, credential vault, and disclosure acceptance.

Status:
CONFIRMED

---

## Free Strategy Monetization

Decision:
Free or no-commission strategies may still support revenue and token utility through token gating, staking, subscriptions, premium telemetry, marketplace upgrades, access tiers, and runtime quotas.

Status:
CONFIRMED

---

## First Execution Provider

Decision:
The first functional execution flow must run against `SimulationProvider`.

Hummingbot must not be introduced as a deep runtime dependency until the provider abstraction, gate ordering, event flow, and risk/provider boundaries are proven independently.

Status:
CONFIRMED

---

## Product Gate Implementation

Decision:
User execution must pass through ProductExecutionGate before risk and provider access.

Phase 1B uses mocked local evaluators for strategy access, entitlement, token policy, runtime quota, and DAO membership. External billing, chain, staking, NFT, and wallet integrations remain out of scope.

Status:
CONFIRMED

---

## Sovereign Protection Pipeline

Decision:
Treasury execution must pass through constitutional, federation, treasury policy, global risk, and treasury risk evaluation before provider access.

User execution must remain separated from treasury permissions and pass through product access plus user runtime risk evaluation.

Phase 1C uses deterministic local evaluators only.

Status:
CONFIRMED

---

## Hummingbot Provider Boundary

Decision:
Hummingbot enters Trading as an `ExecutionProvider` adapter only.

All Hummingbot-shaped DTOs must remain isolated inside `execution/providers/hummingbot`. Normalized orders, fills, positions, balances, health, and connector state are the only shapes allowed to leave the adapter boundary.

Status:
CONFIRMED

---

## WhiteRabbit Productization

Decision:
WhiteRabbit is the first official Axodus Trading strategy product.

It must support treasury execution and user product execution simultaneously, while user runtimes remain tenant-isolated by credentials, balances, positions, execution state, and telemetry.

Status:
CONFIRMED

---

## Headless Trading Core

Decision:
Trading Core is a headless operational nucleus.

Trading Core must run as background infrastructure accessed through governed APIs, ACS workflows, and contextual product surfaces. It must not be planned as a primary public frontend section.

User-facing interaction belongs in product surfaces such as:
- WhiteRabbit strategy product pages
- Marketplace
- DeFi
- DEX
- Academy
- Governance local tenant pages
- ACS tenant consoles

AxodusAPP must not expose a generic public `/trading` section by default. Any generic Trading route is limited to internal admin, observability, or controlled operator use.

Frontend surfaces must never become execution authorities, risk authorities, treasury authorities, or direct Hummingbot control panels.

Status:
CONFIRMED

---

## Trading State Ownership

Decision:
Axodus Trading owns normalized execution, runtime, portfolio, position, provider, event, and audit state.

Execution providers own venue-specific side effects only. Hummingbot and future providers must not become the source of truth for Trading Core state.

All state mutation must carry correlation context plus tenant, runtime, DAO, or provider context. Anonymous execution state mutation is not allowed.

Status:
CONFIRMED

---

## Event Persistence Before Subscriber Dispatch

Decision:
Trading events must be persisted before subscriber dispatch begins.

This preserves audit continuity when telemetry, trace, or downstream subscribers fail. Subscriber failure is recorded as dispatch error, but it must not remove the event from the event repository.

Status:
CONFIRMED

---

## ACS Is Operator Interface, Not Authority Layer

Decision:
Tenant ACS may request, supervise, pause, resume, stop, inspect, and forward recommendations into Trading Core, but it must never bypass Trading Core gates.

ACS commands must enter through Trading Core and preserve correlation and tenant context. ACS does not receive direct provider access and must not expose Hummingbot controls.

Status:
CONFIRMED

---

## WhiteRabbit Is Initial User-facing Trading Product Surface

Decision:
WhiteRabbit is the only initial user-facing Trading product surface.

Trading Core remains headless. WhiteRabbit surfaces expose safe normalized read models for Marketplace, DeFi, DEX, Academy, Tenant DAO, or ACS embedding.

WhiteRabbit product views must not expose secrets, provider DTOs, Hummingbot controls, strategy internals, or execution authority.

Status:
CONFIRMED

---

## Credential Vault Is the User Trading Credential Authority

Decision:
User Trading credentials must be mediated by Credential Vault references and runtime credential bindings.

Product Layer, ACS, agents, telemetry, marketplace surfaces, and frontend surfaces remain secret-blind. They may receive only vault references, scoped metadata, binding state, and access decisions.

Runtime credential access must enforce tenant isolation, provider-scoped access, lifecycle state, and allowed scopes. Withdrawal-like scopes are not supported.

Status:
CONFIRMED

---

## Compliance Disclosure Is an Operational Runtime Gate

Decision:
User Trading runtime provisioning, runtime resume, execution enablement, and provider activation require valid disclosure acceptance.

Missing, expired, or outdated disclosure acceptance must block runtime enablement and emit auditable compliance events. Treasury execution bypasses the user disclosure flow.

Status:
CONFIRMED

---

## Runtime Provisioning Is a Sovereign Core Workflow

Decision:
Runtime provisioning must happen through Trading Core lifecycle orchestration, not directly through Product Layer, ACS, marketplace, or frontend surfaces.

Provisioning requires product entitlement, compliance disclosure acceptance, credential binding, runtime policy, quota, and risk validation before a runtime instance is started.

Runtime recovery and termination must preserve correlation IDs and audit events. Runtime termination revokes provider access through the credential authority boundary when a runtime credential binding exists.

Status:
CONFIRMED

---

## Trinity Is a Bounded Cognitive Operator

Decision:
Trinity may analyze markets, telemetry, strategy health, runtime anomalies, and provider health, then produce recommendations for ACS intake.

Trinity recommendations are not execution authority. Trinity must not call providers, Hummingbot, runtime execution, treasury execution, or strategy mutation paths directly.

All Trinity actions must flow through ACS and then through Trading Core governance, product, compliance, risk, runtime, and provider boundaries.

Status:
CONFIRMED

---

## Trinity Autonomy Is Simulation-first and Governance-aware

Decision:
Trinity and future ACS trading agents must operate under bounded autonomy levels.

Production strategy mutation requires simulation, backtest, paper validation, controlled execution proposal, and governance/risk approval. Autonomous treasury mutation and self-escalating autonomy are not allowed.

Status:
CONFIRMED

---

## Persistent Trading State Authority

Decision:
Trading Core uses durable repository adapters as the persistence boundary for normalized state.

`trading_events` is append-only and must persist before subscriber dispatch. Runtime, provider, order, fill, position, and portfolio state are persisted through normalized repositories, not through provider-owned state.

Replay must support correlation, runtime, strategy product, provider, tenant, and event-type lookup. Runtime recovery may rehydrate lifecycle state from persisted runtime records.

Status:
CONFIRMED

---

## Provider Reconciliation Produces Proposals, Not Blind Mutation

Decision:
Provider reconciliation compares provider side effects with Axodus normalized state and emits findings, telemetry, and reconciliation proposals.

Provider snapshots, runtime snapshots, order state, fill state, and position state must not overwrite sovereign state directly. Any divergence must enter the system as auditable reconciliation output.

Treasury reconciliation and user reconciliation must remain isolated by correlation and tenant context.

Status:
CONFIRMED

---

## Hummingbot Deep Runtime Remains Paper-first and Non-sovereign

Decision:
Hummingbot may run a deeper paper runtime lifecycle through `HummingbotProvider` and `HummingbotRuntime`, including boot, shutdown, restart, recovery, degradation telemetry, connector availability, and normalized runtime stream ingestion.

Hummingbot remains disposable execution infrastructure. It does not own Axodus normalized state, cannot bypass Trading Core gates, and must not expose internal DTOs outside the adapter boundary.

Status:
CONFIRMED

---

## WhiteRabbit Is the First Runtime-native Strategy Product

Decision:
WhiteRabbit is migrated into the sovereign `StrategyProvider -> StrategyProduct -> RuntimeInstance` model.

WhiteRabbit runtime state, signal traces, telemetry, and parameter proposals must remain normalized and tenant-scoped. Trinity may propose parameter changes, but production mutation requires simulation, governance, and risk approval and remains disabled in the current runtime.

Status:
CONFIRMED

---

## Trinity Market Intelligence Is Recommendation-only

Decision:
Trinity may ingest deterministic market, provider, runtime, and strategy telemetry to produce operational recommendations.

Telemetry-aware recommendations must preserve tenant context, require ACS intake, and never become direct execution authority, provider access, or autonomous strategy mutation.

Status:
CONFIRMED

---

## Headless Trading API Is a Governed Request Boundary

Decision:
Trading Core exposes a headless service/controller API boundary for ACS and product surfaces.

The API boundary may expose normalized reads, telemetry summaries, runtime inspection, and action request submission. It must not expose direct provider execution authority, secrets, provider DTOs, or bypass Product/Governance/Compliance/Risk/Runtime gates.

Status:
CONFIRMED

---

## WhiteRabbit Surface API Is a Product Endpoint, Not Trading Dashboard

Decision:
WhiteRabbit may expose a product-specific surface API for Marketplace, DeFi, DEX, Academy, Governance local pages, and ACS.

The surface exposes normalized product/readiness/telemetry/quota views and request-only actions. It must not expose provider DTOs, secrets, raw runtime commands, strategy mutation authority, or direct Hummingbot access.

Status:
CONFIRMED

---

## ACS / Trinity Commands Are Workflow Requests, Not Execution Authority

Decision:
ACS and Trinity command APIs may submit supervision, recommendation, simulation, backtest, provisioning, recovery, provider suspension, strategy pause, telemetry inspection, and activation review requests.

These APIs must preserve tenant, runtime, execution domain, correlation, governance, and autonomy context. They return auditable workflow decisions and must not call providers, mutate runtime directly, control Hummingbot, bypass governance/risk/compliance/runtime gates, or grant production execution authority.

Status:
CONFIRMED

---

## Trading Postgres Bootstrap Is Operational but Not Production Deployment

Decision:
Trading persistence now has a standardized Postgres bootstrap boundary for local and future staging environments.

`PostgresBootstrapService`, `MigrationRunner`, `DatabaseHealthService`, `DatabaseConnectionManager`, and `TradingDatabaseConfig` may execute ordered migrations, track append-only migration history, inspect schema version, validate startup health, and shut down gracefully.

This is infrastructure bootstrap, not production deployment orchestration. Distributed locks, clustering, managed database integration, ClickHouse, Redis, Kafka, and production scaling remain out of scope.

Status:
CONFIRMED

---

## Runtime Observability Is Internal Normalized Telemetry

Decision:
Trading Core has an internal observability layer for runtime, provider, strategy, execution latency, and telemetry pipeline health.

Observability produces normalized health states and telemetry events for operational monitoring and Trinity analysis inputs. It does not expose provider DTOs, secrets, direct runtime mutation, or execution authority.

External observability systems such as Grafana, Prometheus, distributed tracing, websocket telemetry streaming, and public dashboards remain out of scope.

Status:
CONFIRMED

---

## Local Trading Infrastructure Runtime Is Development-only

Decision:
Trading Core may run against a standardized local Postgres runtime through `docker-compose.trading.yml`, `.env.example`, local bootstrap scripts, local healthcheck scripts, and mock/simulation seed data.

This local runtime exists for development, persistent event replay testing, database bootstrap validation, and future staging preparation. It is not production deployment infrastructure and must not enable live exchange execution, live Hummingbot sessions, treasury execution, or real credentials.

Status:
CONFIRMED

---

## Trading DB CLI Is Operational Tooling, Not Production Automation

Decision:
Trading database operations may be exposed through `trading-db` CLI commands for local and future staging workflows.

The CLI may run migrations, inspect status, check health, report schema version, validate compatibility, and seed local mock data. It must call the existing migration and health services, support JSON output, avoid printing secrets, and return non-zero exit codes on failure.

This CLI does not imply production deployment automation, rollback, migration squashing, distributed locking, Kubernetes jobs, cloud deployment, or secrets manager integration.

Status:
CONFIRMED

---

## Node Postgres Client Is the Real Local Persistence Adapter

Decision:
Trading Core may use `NodePostgresClient` as the real `pg`-backed adapter behind the existing `PostgresQueryClient` contract.

Repositories must continue to depend only on the contract. The real adapter is swappable with `InMemoryPostgresClient`, owns only database connectivity concerns, and supports pooling, query timeout, conservative retry, normalized errors, env config mapping, and graceful shutdown.

This enables local real persistence only. It does not imply cloud Postgres, clustering, distributed locks, production HA, live trading, or real exchange execution.

Status:
CONFIRMED

---

## Observability Query API Is Read-only Visibility

Decision:
Trading observability may be exposed through a headless read-only API for ACS, WhiteRabbit Product Surface, and future operator tooling.

The API may expose normalized runtime, provider, strategy, telemetry, latency, and tenant summary read models. It must enforce tenant scope and must not call providers, mutate runtime, expose secrets, expose provider DTOs, or imply execution authority or profitability.

Status:
CONFIRMED

---

## Trinity Observability Produces Recommendations Only

Decision:
Trinity may consume normalized Trading observability snapshots to generate runtime recovery, provider review, strategy pause/simulation, backtest, telemetry review, and controlled resume recommendations.

These recommendations are advisory and unauthorized by default. Trinity must preserve tenant context, correlationId, and observability evidence, but it must not call providers, mutate runtime, pause strategies, block providers, expose secrets, expose provider DTOs, or bypass ACS/governance/product/compliance/risk workflows.

Status:
CONFIRMED

---

## Local Postgres E2E Is Validation, Not Production Readiness

Decision:
Trading may run a local Postgres end-to-end smoke path using Docker Compose, real `NodePostgresClient`, `MigrationRunner`, repository readiness checks, seed-local mock data, event persistence, and replay validation.

This validates local durable infrastructure only. It does not imply production deployment, cloud database readiness, live trading, live Hummingbot sessions, treasury execution, or real exchange connectivity.

Status:
CONFIRMED

---

## Observability Risk Feedback Is Evidence, Not Authority

Decision:
Trading observability health signals may feed a risk policy layer that creates decisions, proposals, review requirements, recovery requirements, simulation/backtest requirements, and controlled resume requirements.

This layer must not directly block providers, mutate runtime, mutate strategies, call execution providers, or bypass ACS/Governance/Trading Core gates. Every observability risk decision remains unauthorized for execution by default and must preserve tenant context, correlationId, and sanitized evidence.

Status:
CONFIRMED

---

## Reconciliation Worker Detects and Proposes Only

Decision:
Trading may run a local/mock reconciliation worker that discovers stale runtimes, provider drift, orphan runtimes, order divergence, and position divergence candidates, then creates reviewable reconciliation proposals.

The worker must not auto-heal, call providers, call Hummingbot, cancel orders, close positions, mutate provider state, mutate runtime execution state blindly, or bypass ACS/risk/governance.

Status:
CONFIRMED

---

## Credential Vault Adapter Boundary Is Provider-agnostic

Decision:
Trading Credential Vault may expose a provider-agnostic adapter boundary for future encrypted secret storage through redacted encryption envelope metadata and scoped ephemeral credential grants.

The service layer must not depend on a specific KMS/HSM provider. Contracts, events, telemetry, ACS, product surfaces, and frontend read models must not expose raw secrets, decrypted credentials, signing material, wallet private keys, or withdrawal permissions.

Status:
CONFIRMED

---

## Paper Trading Sessions Are Governed Preparation, Not Live Trading

Decision:
Trading may create governed paper runtime sessions through `SimulationProvider` and Hummingbot paper-compatible provider boundaries.

Paper sessions must use normalized Trading Core lifecycle, event store, observability, and reconciliation dry-run flows. They must not enable live exchange orders, production API keys, withdrawal scopes, autonomous execution, production runtime mutation, direct Hummingbot control, or profit/yield claims.

Status:
CONFIRMED

---

## WhiteRabbit Requires Paper Validation Before Controlled Resume Eligibility

Decision:
WhiteRabbit may use governed paper validation to produce simulation evidence, normalized fills, tenant-scoped telemetry summaries, reconciliation dry-run evidence, and controlled resume eligibility decisions.

This workflow does not authorize live execution. Trinity recommendations remain advisory, ACS/Governance/Risk remain approval boundaries, and unresolved reconciliation proposals block controlled resume eligibility.

Status:
CONFIRMED

---

## Reconciliation Remediation Requires ACS Review

Decision:
Reconciliation proposals must be reviewed through ACS and risk/governance decisioning before any remediation request can be created.

The review flow may create request-only remediation intents, but it must not auto-heal, mutate providers, cancel orders, close positions, overwrite sovereign state, or allow the reconciliation worker to approve its own proposal.

Status:
CONFIRMED

---

## Paper Observability Is Risk Evidence Only

Decision:
Paper session telemetry may produce paper risk signals and controlled resume eligibility decisions.

Paper telemetry must not authorize live execution, mutate runtime, mutate strategy, call providers, bypass ACS/Risk/Governance, create performance claims.

Status:
CONFIRMED

---

## Local Postgres E2E Is Developer Validation Only

Decision:
Trading may expose a local CI-style Postgres validation command that starts local compose services, runs migrations, seeds mock data, checks health, validates schema, and executes repository readiness/replay smoke tests.

This command is developer-local validation only. It must reject production-like environments, redact database secrets, use mock/simulation data only, and must not imply production CI/CD, live trading, live Hummingbot sessions, real exchange connectivity, or treasury execution.

Status:
CONFIRMED

---

# Pending Decisions

## Canonical Exchange Priority Strategy

Status:
PENDING

## Cross-market Routing Strategy

Status:
PENDING

---

## Autonomous Execution Limits

Status:
PENDING

---

## Derivatives Infrastructure Strategy

Status:
PENDING

---

## AI-assisted Optimization Boundaries

Status:
PENDING

---

## AXODUS-TRADING-REQ-02 — Hummingbot and Condor boundary formalization

Status:
CONFIRMED / DOCUMENTATION COMPLETE / IMPLEMENTATION HOLD

Decision:
- Hummingbot remains an operational execution substrate behind the Axodus `ExecutionProvider` boundary.
- Condor is formalized as an external agent runtime and bounded orchestration adapter.
- Condor may reason, propose and orchestrate permitted operations, but does not own Axodus financial authority, canonical state, credentials, risk, execution or capital authority.
- The existing Hummingbot backend API fork remains protected supporting infrastructure and does not become canonical Trading authority.
- No code, installation, provider promotion, credential path or capital authority is authorized by this decision.

Evidence:
- `.instructions/TRADING_REQ_02_CANONICAL_ARCHITECTURE_AUDIT.md`

---

## AXODUS-TRADING-REQ-04 — Current materialized baseline accepted

Status:
CONFIRMED / CURRENT BASELINE FROZEN / PUBLISHED

Decision:
- the current Trading gitlinks are the canonical materialized baseline: Condor `d89e74f2e3e273bea102c64e4977118e6a88084f`, `hummingbot-api-client v1.5.9` at `dae015a3c513879ed06a55cf2b2c10e5772c0962`, and Hummingbot API `2494e847538bb7b819495cbc30eb4ef828feaacd`
- HTTP capabilities are admitted for `IMP-01A/B/C` only through minimal Axodus-defined contracts
- the client WebSocket path is blocked and isolated as `AXODUS-TRADING-BLOCKER-01`
- `IMP-01D` is conditional on an explicitly admitted transport
- no dependency source was changed and no compatibility shim was selected

Evidence:
- `.instructions/TRADING_REQ_04_MATERIALIZED_REPOSITORY_VERIFICATION.md`
- commit `e059ecc` published to `origin/dev`

---

## AXODUS-TRADING-IMP-01 — Restricted baseline implementation authorization

Status:
AUTHORIZED / IMPLEMENTATION GO / RESTRICTED BASELINE

Decision:
- authorize `IMP-01A` dependency and contract foundations, `IMP-01B` minimal HTTP `ExecutionProvider`, and `IMP-01C` offline contract validation
- keep `IMP-01D` conditional on a separately admitted market-data transport
- keep Condor outside the first implementation path; it may not control execution directly
- preserve Axodus ownership of strategy, signal, judgment, risk, order intent, positions, portfolio, credentials, audit, accounting and capital authority
- preserve no-go boundaries for credentials, direct trading, real orders, Gateway/wallets, production, paper/shadow/live trading, System One and capital

Related blocker:
- `AXODUS-TRADING-BLOCKER-01 — Hummingbot WebSocket Authentication Compatibility`
