# Trading Implementation Inventory

Status: REVIEW CHECKPOINT

Date: 2026-05-23

## Modified Tracked Files

### Environment and Documentation

- `.env.example`
- `.instructions/DECISIONS.md`
- `.instructions/ROADMAP.md`
- `.instructions/TASKS.md`
- `.instructions/TRADING_CORE_PROGRESS_REPORT.md`
- `trading-core/services/trading-core/README.md`
- `trading-core/services/trading-core/package.json`

### Contracts

- `trading-core/packages/trading-contracts/src/events/types.ts`
- `trading-core/packages/trading-contracts/src/execution/types.ts`
- `trading-core/packages/trading-contracts/src/reconciliation/types.ts`
- `trading-core/packages/trading-contracts/src/risk/types.ts`
- `trading-core/packages/trading-contracts/src/security/types.ts`

### Service Exports

- `trading-core/services/trading-core/src/index.ts`

### Persistence

- `trading-core/services/trading-core/src/repositories/postgres/InMemoryPostgresClient.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresTradingEventRepository.ts`

### Reconciliation

- `trading-core/services/trading-core/src/reconciliation/ProviderReconciliationService.ts`

### Security

- `trading-core/services/trading-core/src/security/CredentialLifecycleService.ts`
- `trading-core/services/trading-core/src/security/CredentialVaultService.ts`

### Tests

- `trading-core/services/trading-core/test/execution-orchestrator.test.mjs`

## Untracked Files

### Phase Documentation

- `.instructions/TRADING_PHASE_13A_LOCAL_POSTGRES_E2E.md`
- `.instructions/TRADING_PHASE_13B_OBSERVABILITY_RISK_FEEDBACK.md`
- `.instructions/TRADING_PHASE_13C_RECONCILIATION_WORKER.md`
- `.instructions/TRADING_PHASE_14A_CREDENTIAL_VAULT_ADAPTER.md`
- `.instructions/TRADING_PHASE_14B_PAPER_TRADING_SESSION.md`
- `.instructions/TRADING_CHECKPOINT_REVIEW.md`
- `.instructions/TRADING_IMPLEMENTATION_INVENTORY.md`
- `.instructions/TRADING_OPEN_RISKS.md`
- `.instructions/TRADING_NEXT_PHASE_BOUNDARIES.md`

### Local Postgres E2E

- `trading-core/services/trading-core/migrations/0002_trading_events_tenant_id.sql`
- `trading-core/services/trading-core/scripts/reset-local-db.ts`
- `trading-core/services/trading-core/scripts/smoke-local-postgres.ts`
- `trading-core/services/trading-core/src/repositories/postgres/PostgresRepositoryReadinessCheck.ts`
- `trading-core/services/trading-core/test/postgres.e2e.test.mjs`

### Observability Risk

- `trading-core/services/trading-core/src/risk/observability/ObservabilityRiskAuditService.ts`
- `trading-core/services/trading-core/src/risk/observability/ObservabilityRiskDecisionService.ts`
- `trading-core/services/trading-core/src/risk/observability/ObservabilityRiskPolicy.ts`
- `trading-core/services/trading-core/src/risk/observability/ObservabilityRiskSignalFactory.ts`
- `trading-core/services/trading-core/src/risk/observability/ProviderHealthRiskEvaluator.ts`
- `trading-core/services/trading-core/src/risk/observability/RuntimeHealthRiskEvaluator.ts`
- `trading-core/services/trading-core/src/risk/observability/StrategyHealthRiskEvaluator.ts`

### Reconciliation Worker

- `trading-core/services/trading-core/src/reconciliation/ProviderDriftScanService.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationCandidateDiscoveryService.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationProposalRepository.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationWorker.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationWorkerAuditService.ts`
- `trading-core/services/trading-core/src/reconciliation/ReconciliationWorkerScheduler.ts`
- `trading-core/services/trading-core/src/reconciliation/RuntimeStaleScanService.ts`

### Credential Vault Adapter Boundary

- `trading-core/services/trading-core/src/security/CredentialGrantLifecycleService.ts`
- `trading-core/services/trading-core/src/security/CredentialVaultAdapter.ts`
- `trading-core/services/trading-core/src/security/CredentialVaultAdapterRegistry.ts`
- `trading-core/services/trading-core/src/security/MockEncryptedCredentialVaultAdapter.ts`

### Paper Trading Runtime

- `trading-core/services/trading-core/src/runtime/paper/PaperConnectorConfigValidator.ts`
- `trading-core/services/trading-core/src/runtime/paper/PaperFillNormalizationService.ts`
- `trading-core/services/trading-core/src/runtime/paper/PaperOrderIngestionService.ts`
- `trading-core/services/trading-core/src/runtime/paper/PaperSessionAuditService.ts`
- `trading-core/services/trading-core/src/runtime/paper/PaperTradingSessionService.ts`

## Sprint-to-file Mapping

### Phase 13A - Local Postgres End-to-End Validation

Primary files:

- `0002_trading_events_tenant_id.sql`
- `smoke-local-postgres.ts`
- `reset-local-db.ts`
- `PostgresRepositoryReadinessCheck.ts`
- `postgres.e2e.test.mjs`
- README/local docs updates

### Phase 13B - Observability Risk Feedback Policy

Primary files:

- `src/risk/observability/*`
- risk contract additions
- event contract additions
- execution orchestrator tests

### Phase 13C - Reconciliation Worker Skeleton

Primary files:

- `ReconciliationWorker.ts`
- `ReconciliationWorkerScheduler.ts`
- `ReconciliationCandidateDiscoveryService.ts`
- `ReconciliationProposalRepository.ts`
- `RuntimeStaleScanService.ts`
- `ProviderDriftScanService.ts`
- `ReconciliationWorkerAuditService.ts`
- reconciliation contract additions

### Phase 14A - Credential Vault Real Adapter Boundary

Primary files:

- `CredentialVaultAdapter.ts`
- `CredentialVaultAdapterRegistry.ts`
- `MockEncryptedCredentialVaultAdapter.ts`
- `CredentialGrantLifecycleService.ts`
- security contract additions
- credential service/lifecycle updates

### Phase 14B - Paper Trading Runtime Session

Primary files:

- `src/runtime/paper/*`
- execution contract additions
- paper event additions
- paper runtime tests

## Review Notes

The current implementation is coherent but too broad for a single opaque review. Prefer commit/review grouping by phase or domain.
