# Axodus Trading Core - Implementation and Progress Report

Date: 2026-05-20

# Executive Summary

The Axodus Trading Core has advanced from Phase 0 architecture scaffolding into a functional execution foundation with product access gates, sovereign governance/risk protection, a simulation provider, a Hummingbot provider adapter boundary, and the first strategy product model for WhiteRabbit.

Current status:
- Core execution pipeline is functional.
- `SimulationProvider` is fully isolated and test-backed.
- Product entitlement/access gates are operational with mocked evaluators.
- Governance and risk pipelines are operational with deterministic local evaluators.
- Hummingbot is integrated as an adapter boundary, not as sovereign core.
- WhiteRabbit is modeled as both treasury strategy and user-facing `StrategyProduct`.
- Multi-tenant runtime provisioning is modeled locally with tenant isolation.

Not yet implemented:
- persistence adapters
- production APIs
- AxodusAPP routes
- real billing
- real credential vault
- real chain/token/staking/NFT checks
- real Hummingbot API network integration
- real WhiteRabbit strategy migration from `quants-lab`

---

# Delivered Architecture

## Current Execution Flow

```text
ExecutionIntent
-> TradingCore
-> ExecutionOrchestrator
-> ProductExecutionGate
-> GovernanceExecutionGuard
-> RiskGateway
-> ExecutionProviderRegistry
-> ExecutionProvider
   -> SimulationProvider
   -> HummingbotProvider
-> TradingEventBus
```

## Execution Domains

## Treasury Trading

Treasury execution is protected by:
- governance status
- constitutional standing
- federation tier
- delegated execution permission
- federation strategy authorization
- treasury authorization
- treasury strategy policy
- global risk
- treasury risk

## User Trading

User execution is protected by:
- product entitlement
- token access policy
- subscription tier compatibility
- trial state
- runtime status
- runtime quota
- execution quota
- global risk
- user runtime risk

User execution does not inherit treasury permissions.

---

# Implemented Phases

## Phase 0 - Architecture, Contracts, and Scaffolding

Delivered:
- `trading-core/packages/trading-contracts`
- `trading-core/services/trading-core`
- `trading-core/services/trading-product` scaffold
- product economy documentation
- credential vault boundary documentation
- compliance/disclosure boundary documentation
- event model
- base TypeScript contracts

Key docs:
- `TRADING_CORE_ARCHITECTURE.md`
- `TRADING_PRODUCT_ECONOMY.md`
- `TRADING_RUNTIME_MODEL.md`
- `TRADING_SECURITY_MODEL.md`
- `TRADING_COMPLIANCE_MODEL.md`

## Phase 1A - Execution Core Foundation

Delivered:
- `TradingCore`
- `ExecutionOrchestrator`
- `ExecutionProviderRegistry`
- `TradingEventBus`
- `SimulationProvider`
- `SimulationRuntime`
- `SimulationExecutionEngine`
- repository interfaces

Validated:
- execution reaches provider only after gates approve
- invalid provider blocks execution
- missing execution context fails safely
- correlationId is preserved
- simulation fills, positions, balances, and cancellations work locally
- event bus supports ordered dispatch and subscriber failure isolation

## Phase 1B - Product Access and Entitlement Gates

Delivered:
- `ProductExecutionGate`
- `StrategyAccessService`
- `TokenGateEvaluator`
- `EntitlementEvaluator`
- `RuntimeQuotaEvaluator`

Supported:
- public strategy access
- token-gated strategy access
- DAO-only strategy access
- premium strategy access
- trial-enabled strategy access
- runtime quotas
- execution quotas
- subscription tier compatibility
- runtime state validation

Current limitation:
- all evaluators are local/mocked; no real billing, wallet RPC, staking, NFT, or chain validation exists yet.

## Phase 1C - Governance and Sovereign Risk Pipeline

Delivered:
- `GovernanceExecutionGuard`
- `ConstitutionalStandingEvaluator`
- `FederationExecutionEvaluator`
- `TreasuryPolicyEvaluator`
- `RiskGateway`
- `GlobalRiskGateway`
- `TreasuryRiskGateway`
- `UserRuntimeRiskGateway`

Supported:
- governance halt/restriction
- constitutional standing checks
- strategy whitelist checks
- federation tier restrictions
- delegated execution restrictions
- treasury authorization
- global emergency shutdown
- provider block list
- volatility/liquidity block flags
- treasury exposure/leverage checks
- user runtime exposure checks
- beginner-safe user limits
- provider and quote currency whitelist checks

Current limitation:
- risk and governance inputs are deterministic local state; no external sync is implemented.

## Phase 2A - Hummingbot Provider Adapter Foundation

Delivered:
- `HummingbotProvider`
- `HummingbotRuntime`
- `HummingbotTelemetryAdapter`
- `HummingbotConfigMapper`
- `HummingbotHealthService`

Supported:
- provider registration
- runtime health normalization
- connector discovery
- paper trading mapping
- order normalization
- fill normalization
- position normalization
- balance normalization
- emergency shutdown propagation
- provider health and connector telemetry events
- Hummingbot DTO isolation inside adapter boundary

Current limitation:
- the runtime client is in-memory/mockable. It does not yet call a live Hummingbot API.

## Phase 2B - WhiteRabbit Productization and Multi-Tenant Runtime

Delivered:
- `WhiteRabbitStrategyProvider`
- `WhiteRabbitProductAdapter`
- `WhiteRabbitRuntimePolicy`
- `WhiteRabbitTelemetryProfile`
- `UserRuntimeProvisioner`
- `RuntimeLifecycleService`
- `RuntimeIsolationPolicy`

Supported:
- WhiteRabbit as official `StrategyProduct`
- WhiteRabbit as treasury strategy and user product simultaneously
- independent user runtime provisioning
- quota exhaustion blocking provisioning
- runtime suspension
- runtime recovery
- tenant-scoped telemetry
- isolated credential, position, balance, and execution state scopes

Current limitation:
- no real WhiteRabbit execution logic has been migrated from `quants-lab` yet.

---

# Current Test Status

Latest validation:

```bash
tsc --noEmit -p trading-core/packages/trading-contracts/tsconfig.json
npm run lint --prefix trading-core/services/trading-core
npm test --prefix trading-core/services/trading-core
git diff --check
```

Result:
- TypeScript validation passed.
- lint/typecheck passed.
- unit tests passed.
- diff check passed.

Current unit test count:
- 37 tests passing.

Covered areas:
- execution orchestration
- provider registry
- product access gates
- runtime quotas
- governance gates
- sovereign risk gates
- simulation provider
- event bus
- Hummingbot adapter boundary
- WhiteRabbit productization
- multi-tenant runtime isolation

---

# Current File Map

## Core Execution

```text
trading-core/services/trading-core/src/core/TradingCore.ts
trading-core/services/trading-core/src/application/ExecutionIntent.ts
trading-core/services/trading-core/src/application/ExecutionOrchestrator.ts
trading-core/services/trading-core/src/execution/ExecutionProviderRegistry.ts
```

## Providers

```text
trading-core/services/trading-core/src/execution/providers/simulation/
trading-core/services/trading-core/src/execution/providers/hummingbot/
```

## Product Access

```text
trading-core/services/trading-core/src/product/ProductExecutionGate.ts
trading-core/services/trading-core/src/product/StrategyAccessService.ts
trading-core/services/trading-core/src/product/TokenGateEvaluator.ts
trading-core/services/trading-core/src/product/EntitlementEvaluator.ts
trading-core/services/trading-core/src/product/RuntimeQuotaEvaluator.ts
```

## Governance and Risk

```text
trading-core/services/trading-core/src/governance/
trading-core/services/trading-core/src/risk/
```

## Runtime and Strategy Product

```text
trading-core/services/trading-core/src/runtime/
trading-core/services/trading-core/src/strategies/whiterabbit/
```

## Telemetry

```text
trading-core/services/trading-core/src/telemetry/TradingEventBus.ts
```

---

# Known Limitations

- No database persistence.
- No API server.
- No AxodusAPP screens or routes.
- No production credential vault.
- No real Hummingbot API calls.
- No Hummingbot container lifecycle management.
- No live exchange connector execution.
- No real treasury accounting.
- No real governance sync.
- No real federation registry.
- No token, staking, NFT, or wallet RPC validation.
- No billing/subscription provider integration.
- No marketplace listing service.
- No WhiteRabbit trading logic migration from `quants-lab`.
- No backtesting integration in the Trading Core.

---

# Risks

## Architecture Risk

The current foundation is correct, but persistence and API layers must preserve the existing gate order. Any direct API route to providers would violate the sovereign architecture.

## Security Risk

Runtime isolation is modeled, but credential vault storage is not implemented. Production execution must not proceed until secret storage, scoped credential access, and audit logging are implemented.

## Governance Risk

Governance and federation checks use local deterministic state. Production use requires trusted synchronization with Axodus Governance and Federation sources.

## Product Risk

Entitlements, token gates, and subscription tiers are mocked. Product launch requires real entitlement sources and clear disclosure flows.

## Provider Risk

Hummingbot DTOs are isolated, but the live API adapter is not implemented. Network errors, retry policy, idempotency, and reconciliation still need design and tests.

---

# Recommended Next Steps

## Phase 2C - Hummingbot Runtime API Adapter

Implement live-but-contained Hummingbot API connectivity behind `HummingbotRuntimeClient`.

Deliver:
- HTTP/API client adapter
- auth boundary using vault references
- health endpoint integration
- connector discovery integration
- order submit/cancel integration
- balance/position read integration
- retry/idempotency policy
- adapter-level tests with mocked HTTP transport

Rule:
- no Hummingbot DTO leaks outside `execution/providers/hummingbot`.

## Phase 2D - Persistence Interfaces and In-Memory Adapters

Before real DB adapters, add in-memory adapters for repositories.

Deliver:
- `OrderRepository`
- `FillRepository`
- `PositionRepository`
- `PortfolioRepository`
- `TradingEventRepository`
- `RuntimeRepository`
- reconciliation-friendly data model

Goal:
- prove execution history and runtime state lifecycle without selecting final storage.

## Phase 2E - Credential Vault Boundary

Implement the service boundary for credential references.

Deliver:
- credential vault interface
- runtime credential binding service
- provider-scoped credential authorization
- no raw secret exposure
- audit events for credential binding and revocation

Goal:
- prepare user runtime execution safely.

## Phase 3A - API Skeleton

Expose controlled API routes only after gates and repository boundaries are stable.

Recommended initial routes:

```text
GET  /api/trading/core/status
GET  /api/trading/providers
GET  /api/trading/providers/:id/status
GET  /api/trading/events
POST /api/trading/execution/intents
GET  /api/trading/runtime/:id
POST /api/trading/runtime/provision
POST /api/trading/runtime/:id/suspend
POST /api/trading/runtime/:id/recover
```

Rule:
- no route may call a provider directly.

## Phase 3B - WhiteRabbit Engine Adapter

Start migration from `quants-lab` without deleting legacy code.

Deliver:
- WhiteRabbit config contract
- signal trace contract
- Bollinger/RSI parity with existing V1
- ATR, volume, and candlestick filters as explicit future extensions
- backtesting compatibility boundary

## Phase 3C - AxodusAPP Trading Console

After API skeleton exists, add UI routes.

Recommended routes:

```text
/trading
/trading/providers
/trading/runtime
/trading/strategies
/trading/strategies/whiterabbit
/trading/risk
/trading/telemetry
/trading/access
```

Frontend must remain display/control surface only, never source of truth.

---

# Current Overall Status

The Trading Core has moved beyond architecture-only scaffolding into a tested execution foundation.

The most important architectural guarantees are currently preserved:
- Hummingbot is a provider adapter, not the core.
- Simulation remains available as safe execution target.
- Product access gates run before provider access.
- Governance and risk gates block provider calls.
- User Trading and Treasury Trading are separated.
- WhiteRabbit is modeled as product and treasury strategy without runtime migration.
- Multi-tenant isolation is modeled and test-backed.

Recommended next milestone:

```text
Phase 2C - Hummingbot Runtime API Adapter
```

This should be implemented before any frontend or live execution work.
