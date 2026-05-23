# Trading Implementation Inventory

Status: CHECKPOINT INVENTORY

Date: 2026-05-23

## Purpose

Map the current Trading Core implementation by domain so review, commit splitting, and next sprint planning remain traceable.

## Contracts

Path:

```text
trading-core/packages/trading-contracts/src/
```

Domains present:

- access
- ACS
- agents
- API
- billing
- compliance
- events
- execution
- federation
- governance
- marketplace
- observability
- portfolio
- product
- reconciliation
- risk
- runtime
- security
- strategy
- telemetry
- treasury
- WhiteRabbit

Review note:

The contracts package is now the shared normalized boundary for core, product, runtime, security, compliance, observability, reconciliation and strategy product surfaces.

## Execution Core

Representative files:

- `src/core/TradingCore.ts`
- `src/application/ExecutionIntent.ts`
- `src/application/ExecutionOrchestrator.ts`
- `src/execution/ExecutionProviderRegistry.ts`
- `src/telemetry/TradingEventBus.ts`

Role:

- orchestrates execution intent
- enforces gate ordering
- resolves providers through registry
- emits normalized events

## Execution Providers

Simulation:

- `src/execution/providers/simulation/SimulationProvider.ts`
- `src/execution/providers/simulation/SimulationRuntime.ts`
- `src/execution/providers/simulation/SimulationExecutionEngine.ts`

Hummingbot adapter:

- `src/execution/providers/hummingbot/HummingbotProvider.ts`
- `src/execution/providers/hummingbot/HummingbotRuntime.ts`
- `src/execution/providers/hummingbot/HummingbotConfigMapper.ts`
- `src/execution/providers/hummingbot/HummingbotHealthService.ts`
- `src/execution/providers/hummingbot/HummingbotTelemetryAdapter.ts`

Review note:

Hummingbot DTO-shaped types are confined to the Hummingbot adapter boundary.

## Product Access

Representative files:

- `src/product/ProductExecutionGate.ts`
- `src/product/StrategyAccessService.ts`
- `src/product/TokenGateEvaluator.ts`
- `src/product/EntitlementEvaluator.ts`
- `src/product/RuntimeQuotaEvaluator.ts`

Role:

- validates user strategy access
- enforces entitlement
- enforces token/access placeholders
- enforces runtime and execution quotas

## Governance and Risk

Governance:

- `src/governance/GovernanceExecutionGuard.ts`
- `src/governance/TreasuryPolicyEvaluator.ts`
- `src/governance/FederationExecutionEvaluator.ts`
- `src/governance/ConstitutionalStandingEvaluator.ts`

Risk:

- `src/risk/GlobalRiskGateway.ts`
- `src/risk/TreasuryRiskGateway.ts`
- `src/risk/UserRuntimeRiskGateway.ts`
- `src/risk/RiskGateway.ts`

Observability risk:

- `src/risk/observability/ObservabilityRiskDecisionService.ts`
- `src/risk/observability/ObservabilityRiskPolicy.ts`
- `src/risk/observability/*RiskEvaluator.ts`

Paper risk:

- `src/risk/paper/PaperRiskDecisionService.ts`
- `src/risk/paper/PaperControlledResumePolicy.ts`
- `src/risk/paper/PaperSessionRiskSignalService.ts`

Role:

- separates treasury and user execution
- treats telemetry as risk evidence
- preserves final authority in core/gates/workflows

## Compliance

Representative files:

- `src/compliance/ComplianceGate.ts`
- `src/compliance/DisclosureAcceptanceService.ts`
- `src/compliance/DisclosureRequirementEvaluator.ts`
- `src/compliance/DisclosureVersionService.ts`
- `src/compliance/RuntimeComplianceValidator.ts`

Role:

- enforces disclosure acceptance
- blocks runtime provisioning/resume/execution enablement/provider activation when required acceptance is missing, expired or outdated

## Credential Vault

Representative files:

- `src/security/CredentialVaultService.ts`
- `src/security/RuntimeCredentialBindingService.ts`
- `src/security/CredentialAccessPolicyEvaluator.ts`
- `src/security/CredentialLifecycleService.ts`
- `src/security/CredentialGrantLifecycleService.ts`
- `src/security/CredentialVaultAdapter.ts`
- `src/security/CredentialVaultAdapterRegistry.ts`
- `src/security/MockEncryptedCredentialVaultAdapter.ts`
- `src/security/InMemoryCredentialVaultRepository.ts`

Role:

- keeps runtime credentials reference-based
- blocks withdrawal-like scope
- supports provider-scoped grants
- prepares future real encrypted adapter integration

## Runtime Lifecycle

Representative files:

- `src/runtime/RuntimeProvisioningService.ts`
- `src/runtime/RuntimeProvisioningPolicy.ts`
- `src/runtime/RuntimeLifecycleCoordinator.ts`
- `src/runtime/RuntimeLifecycleService.ts`
- `src/runtime/RuntimeRecoveryService.ts`
- `src/runtime/UserRuntimeProvisioner.ts`
- `src/runtime/RuntimeIsolationPolicy.ts`

Paper runtime:

- `src/runtime/paper/PaperTradingSessionService.ts`
- `src/runtime/paper/PaperConnectorConfigValidator.ts`
- `src/runtime/paper/PaperOrderIngestionService.ts`
- `src/runtime/paper/PaperFillNormalizationService.ts`
- `src/runtime/paper/PaperSessionAuditService.ts`

Role:

- makes provisioning governed
- normalizes lifecycle
- keeps paper/simulation non-live

## WhiteRabbit

Representative files:

- `src/strategies/whiterabbit/WhiteRabbitRuntimeEngine.ts`
- `src/strategies/whiterabbit/WhiteRabbitSignalPipeline.ts`
- `src/strategies/whiterabbit/WhiteRabbitStrategyProvider.ts`
- `src/strategies/whiterabbit/WhiteRabbitProductAdapter.ts`
- `src/strategies/whiterabbit/WhiteRabbitSurfaceApi.ts`
- `src/strategies/whiterabbit/WhiteRabbitPaperValidationService.ts`
- `src/strategies/whiterabbit/WhiteRabbitControlledResumeEvaluator.ts`
- `src/strategies/whiterabbit/WhiteRabbitPaperSessionAdapter.ts`
- `src/strategies/whiterabbit/WhiteRabbitPaperTelemetrySummaryService.ts`

Role:

- first user-facing Strategy Product
- runtime-native strategy model
- paper validation workflow
- controlled resume evidence generation

## ACS and Trinity

ACS:

- `src/acs/AcsTradingAccessService.ts`
- `src/acs/AcsTradingCommandApi.ts`
- `src/acs/RuntimeSupervisionApi.ts`
- `src/acs/TradingWorkflowRequestService.ts`
- `src/acs/RecommendationApprovalService.ts`

Trinity:

- `src/agents/trinity/TrinityRecommendationEngine.ts`
- `src/agents/trinity/TrinityObservabilityAdapter.ts`
- `src/agents/trinity/*RecommendationService.ts`
- `src/agents/autonomy/*`

Role:

- ACS submits workflow requests
- Trinity produces recommendations only
- autonomy remains simulation-first and governance-aware

## State, Audit and Persistence

State:

- `src/state/TradingStateService.ts`
- `src/state/ExecutionStateService.ts`
- `src/state/RuntimeStateService.ts`
- `src/state/ProviderStateService.ts`
- `src/state/TradingAuditService.ts`
- `src/state/TradingEventQueryService.ts`
- `src/state/CorrelationTraceService.ts`

Postgres:

- `src/repositories/postgres/PostgresTradingEventRepository.ts`
- `src/repositories/postgres/PostgresOrderRepository.ts`
- `src/repositories/postgres/PostgresFillRepository.ts`
- `src/repositories/postgres/PostgresPositionRepository.ts`
- `src/repositories/postgres/PostgresPortfolioRepository.ts`
- `src/repositories/postgres/PostgresRuntimeRepository.ts`
- `src/repositories/postgres/PostgresProviderStateRepository.ts`
- `src/repositories/postgres/MigrationRunner.ts`
- `src/repositories/postgres/NodePostgresClient.ts`
- `src/repositories/postgres/PostgresRepositoryReadinessCheck.ts`

Role:

- Axodus owns normalized state
- event store is append-only
- replay supports local durable validation

## Reconciliation

Representative files:

- `src/reconciliation/ProviderReconciliationService.ts`
- `src/reconciliation/ReconciliationWorker.ts`
- `src/reconciliation/ReconciliationProposalRepository.ts`
- `src/reconciliation/ReconciliationProposalReviewService.ts`
- `src/reconciliation/ReconciliationRemediationEligibilityService.ts`
- `src/reconciliation/ReconciliationReviewPolicy.ts`

Role:

- detects drift and stale/orphan candidates
- creates proposals
- routes ACS review
- creates remediation requests only

## Observability

Representative files:

- `src/telemetry/RuntimeObservabilityService.ts`
- `src/telemetry/ProviderObservabilityService.ts`
- `src/telemetry/StrategyTelemetryAggregator.ts`
- `src/telemetry/OperationalHealthScoringService.ts`
- `src/telemetry/RuntimeMetricsCollector.ts`
- `src/telemetry/ExecutionLatencyTracker.ts`
- `src/api/observability/TradingObservabilityApi.ts`
- `src/api/observability/TenantObservabilityQueryService.ts`
- `src/api/observability/ObservabilityAccessGuard.ts`

Role:

- exposes read-only normalized observability
- feeds Trinity/risk as evidence
- preserves tenant scope

## Local Tooling

Representative files:

- `docker-compose.trading.yml`
- `.env.example`
- `scripts/bootstrap-local-db.ts`
- `scripts/healthcheck-db.ts`
- `scripts/seed-local-trading.ts`
- `scripts/smoke-local-postgres.ts`
- `scripts/reset-local-db.ts`
- `scripts/trading-db.ts`
- `scripts/trading-local-e2e.ts`
- `src/local/TradingLocalE2eCommand.ts`

Role:

- local Postgres bootstrap
- migration CLI
- local E2E durable persistence validation
- development-only simulation data

## Documentation

Active guidance lives in:

```text
.instructions/
```

Processed historical sprint docs live in:

```text
.instructions/.processed/
```

Current Planner handoff:

```text
.instructions/TRADING_PLANNER_HANDOFF.md
```

