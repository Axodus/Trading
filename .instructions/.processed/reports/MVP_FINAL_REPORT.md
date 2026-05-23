# Axodus Trading MVP Final Report

Date: 2026-05-20

# Executive Summary

The Phase 0 MVP delivered the architectural foundation for Axodus Trading as:

```text
Infrastructure + Product + Economy + Monetization
```

This MVP does not implement live trading, live Hummingbot orchestration, billing provider integration, or production credential storage. It establishes the sovereign Trading Core, Trading Product Layer, shared TypeScript contracts, event taxonomy, documentation, and service boundaries required before runtime implementation.

The delivered MVP treats Hummingbot as an execution runtime/provider, not as the source of truth or sovereign core.

---

# Architecture Delivered

## Sovereign Topology

```text
Governance
    -> Federation
    -> Trading Product Layer
    -> Intelligence / MCP
    -> Trading Core
    -> Execution Providers
```

## Execution Domains

Two execution domains are formally modeled:

## Treasury Trading

Used for Axodus-controlled capital:
- DAO treasury operations
- federation treasury operations
- governed strategy execution
- sovereign portfolio coordination

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

Used for non-custodial customer-owned capital:
- user exchange account
- user CEX API key
- user wallet binding
- user runtime instance
- user strategy product access

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

## Product Economy

The MVP formalizes Trading as a product economy layer, not only internal execution infrastructure.

Product domains delivered as architecture and scaffold:
- Product Layer
- Marketplace Layer
- Access Layer
- Runtime Layer
- Billing Layer
- Security / Credential Vault Layer
- Compliance / Disclosure Layer

Free or no-commission strategies are explicitly still economic assets. They may support revenue or token utility through:
- token gating
- staking requirements
- subscriptions
- premium telemetry tiers
- marketplace upgrades
- runtime quotas
- access tier progression
- bundled premium infrastructure

---

# Repository Deliverables

## Documentation

Created:
- `.instructions/TRADING_CORE_PLAN.md`
- `.instructions/TRADING_CORE_ARCHITECTURE.md`
- `.instructions/TRADING_PRODUCT_ECONOMY.md`
- `.instructions/TRADING_MONETIZATION.md`
- `.instructions/TRADING_RUNTIME_MODEL.md`
- `.instructions/TRADING_SECURITY_MODEL.md`
- `.instructions/TRADING_COMPLIANCE_MODEL.md`

Updated:
- `.instructions/DECISIONS.md`
- `.instructions/TASKS.md`
- `.instructions/ROADMAP.md`
- `.instructions/TRADING_ARCHITECTURE.md`
- `.instructions/TRADING_ROADMAP.md`

## Code Scaffold

Created:

```text
trading-core/
  README.md
  packages/
    trading-contracts/
      package.json
      tsconfig.json
      src/
  services/
    trading-core/
      README.md
      src/
  services/
    trading-product/
      README.md
      src/
```

## Service Boundaries

`services/trading-core` contains Phase 0 boundaries for:
- core
- application
- execution
- governance
- federation
- treasury
- risk
- telemetry
- portfolio
- agents

`services/trading-product` contains Phase 0 boundaries for:
- product
- marketplace
- access
- billing
- runtime
- security
- compliance

---

# Contracts Delivered

The shared contract package is:

```text
trading-core/packages/trading-contracts
```

Exports are centralized through:

```text
trading-core/packages/trading-contracts/src/index.ts
```

## Execution Contracts

Delivered:
- `ExecutionProvider`
- `ExecutionProviderType`
- `ExecutionProviderStatus`
- `ExecutionRequest`
- `ExecutionResult`
- `CancelOrderRequest`
- `CancelOrderResult`
- `BalanceSnapshot`
- `PositionSnapshot`

Provider types:

```ts
'hummingbot' | 'native' | 'dex' | 'cex' | 'perp' | 'simulation'
```

## Runtime Contracts

Delivered:
- `ExecutionDomain`
- `TradingExecutionContext`
- `RuntimeQuota`
- `ExecutionQuota`
- `ExecutionLimits`
- `UserRuntimeInstance`

Execution domains:

```ts
'treasury' | 'user'
```

## Product Contracts

Delivered:
- `StrategyProduct`
- `UserTradingProfile`
- `StrategyAccessPolicy`
- `TokenAccessPolicy`
- `EntitlementState`
- `UnlockCondition`

## Billing Contracts

Delivered:
- `BillingPolicy`
- `SubscriptionTier`
- `EntitlementGrant`
- `QuotaConsumption`

Billing is vendor-neutral in Phase 0.

## Security / Credential Vault Contracts

Delivered:
- `CredentialVaultReference`
- `ExchangeCredentialBinding`
- `WalletRuntimeBinding`
- `CredentialScope`

Important boundary:
- contracts expose vault references and bindings only
- raw API secrets, decrypted payloads, and signing material are not modeled in application contracts

## Compliance / Disclosure Contracts

Delivered:
- `TradingRiskDisclosure`
- `UserRiskAcceptance`
- `DisclosureRequirementTarget`

Compliance scope:
- non-custodial disclosure
- automation risk
- market risk
- leverage risk
- strategy-specific risk

## Event Contracts

Delivered:
- `TradingOperationalEvent`
- `TradingProductEvent`
- `TradingSecurityComplianceEvent`
- `TradingEventType`
- `TradingEventSource`
- `TradingEvent`

Operational events:

```ts
MARKET_DATA_RECEIVED
SIGNAL_CREATED
RISK_CHECK_REQUESTED
RISK_CHECK_APPROVED
RISK_CHECK_REJECTED
EXECUTION_REQUESTED
ORDER_SUBMITTED
ORDER_FILLED
ORDER_CANCELLED
EXECUTION_FAILED
GOVERNANCE_EXECUTION_BLOCKED
EMERGENCY_SHUTDOWN_TRIGGERED
```

Product/runtime events:

```ts
STRATEGY_PRODUCT_PUBLISHED
STRATEGY_ACCESS_GRANTED
STRATEGY_ACCESS_REVOKED
USER_RUNTIME_PROVISION_REQUESTED
USER_RUNTIME_PROVISIONED
USER_RUNTIME_SUSPENDED
RUNTIME_QUOTA_EXCEEDED
SUBSCRIPTION_TIER_CHANGED
TOKEN_ACCESS_POLICY_FAILED
BILLING_ENTITLEMENT_GRANTED
BILLING_ENTITLEMENT_REVOKED
```

Security/compliance events:

```ts
CREDENTIAL_BINDING_CREATED
CREDENTIAL_BINDING_REVOKED
WALLET_RUNTIME_BINDING_CREATED
RISK_DISCLOSURE_REQUIRED
RISK_DISCLOSURE_ACCEPTED
RISK_DISCLOSURE_MISSING
```

---

# Endpoints

## Delivered in MVP

No HTTP endpoints were implemented in Phase 0.

Reason:
- Phase 0 scope was documentation, contracts, scaffolding, event model, and service boundaries.
- No API server was created for `trading-core` or `trading-product`.
- Existing `hummingbot-api` remains a separate submodule/runtime dependency and was not modified.

## Planned Endpoint Surface

The following endpoint groups are recommended for Phase 1+ after service implementation begins:

```text
/api/trading/core/status
/api/trading/execution/providers
/api/trading/execution/requests
/api/trading/events
/api/trading/portfolio
/api/trading/risk/checks
/api/trading/governance/guards

/api/trading/products
/api/trading/marketplace/listings
/api/trading/access/entitlements
/api/trading/runtime/instances
/api/trading/runtime/quotas
/api/trading/billing/policies
/api/trading/security/credential-bindings
/api/trading/compliance/disclosures
/api/trading/compliance/acceptances
```

Implementation rule:
- user trading endpoints must enforce compliance, entitlement, access, runtime permission, credential binding, and risk gates before any provider call
- treasury trading endpoints must enforce governance, federation, treasury policy, and risk gates before any provider call

---

# AxodusAPP Routes

## Delivered in MVP

No AxodusAPP frontend routes were implemented in this workspace during Phase 0.

Reason:
- There is no AxodusAPP application source tree in this Trading workspace.
- Phase 0 created backend/domain scaffolding and contracts only.

## Planned AxodusAPP Route Map

Recommended route surface for the Trading module:

```text
/trading
/trading/terminal
/trading/strategies
/trading/strategies/whiterabbit
/trading/risk
/trading/providers
/trading/portfolio
/trading/telemetry
/trading/federation
/trading/marketplace
/trading/access
/trading/runtime
/trading/subscriptions
/trading/security
/trading/compliance
```

Recommended initial UI components:
- `TradingProviderStatusCard`
- `StrategyStatusCard`
- `RiskStatusPanel`
- `ExecutionTimeline`
- `PortfolioExposureCard`
- `GovernanceExecutionGuard`
- `HummingbotRuntimeStatus`
- `WhiteRabbitConfigPanel`
- `TradingEventLog`
- `StrategyMarketplaceCard`
- `StrategyAccessBadge`
- `SubscriptionTierCard`
- `RuntimeQuotaPanel`
- `UserRuntimeStatusTable`
- `TokenGateStatus`
- `BillingEntitlementPanel`
- `CredentialBindingStatus`
- `RiskDisclosureAcceptancePanel`

Frontend rule:
- AxodusAPP must never be the source of truth for execution, risk, entitlement, compliance, or credential decisions.

---

# Tests

## Tests Run

TypeScript contract validation:

```bash
tsc --noEmit -p trading-core/packages/trading-contracts/tsconfig.json
```

Patch hygiene:

```bash
git diff --check
```

## Test Result

Both checks passed.

## Test Coverage Delivered

Phase 0 validates:
- TypeScript contract compilation
- event type coverage at the type level
- execution-domain typing
- product/access/runtime/billing contract typing
- security and compliance contract typing

## Not Covered Yet

No tests exist yet for:
- runtime provider registry
- Hummingbot adapter behavior
- HTTP API handlers
- database persistence
- credential vault implementation
- compliance policy execution
- billing/entitlement implementation
- frontend route rendering

Those are outside Phase 0 and should be added when implementation begins.

---

# Limitations

Phase 0 intentionally does not include:
- live order execution
- live Hummingbot orchestration
- Hummingbot runtime start/stop
- real credential storage
- encryption implementation
- database schema or migrations
- API server
- AxodusAPP frontend routes
- billing vendor integration
- on-chain token gate implementation
- disclosure content delivery
- jurisdiction-specific compliance logic
- provider health monitoring
- telemetry persistence
- WhiteRabbit runtime migration

Existing WhiteRabbit and Hummingbot-related code was not removed or migrated.

---

# Risks

## Architecture Risks

- If product, access, runtime, billing, security, and compliance boundaries are skipped in implementation, User Trading can become tightly coupled to execution providers.
- If Treasury Trading and User Trading share runtime paths without explicit `ExecutionDomain` enforcement, user flows may accidentally inherit treasury privileges.
- If Hummingbot DTOs leak outside the provider adapter layer, the sovereign core may become dependent on Hummingbot internals.

## Security Risks

- Credential Vault must not expose raw secrets to frontend, agents, product services, or telemetry.
- Wallet runtime binding must be treated as security-sensitive.
- Runtime provisioning must avoid cross-user credential leakage.

## Compliance Risks

- User Trading requires auditable disclosure acceptance before runtime provisioning or execution enablement.
- Product UI must not imply custody of user funds.
- Strategy product marketing must avoid unrealistic APY/yield assumptions.

## Operational Risks

- No persistence exists yet for events, runtime state, quotas, or disclosures.
- No provider registry exists yet.
- No runtime suspension or emergency shutdown logic exists yet.
- No production observability exists yet.

---

# Next Steps

## Phase 1 - Contract Hardening and API Skeleton

- add root workspace package management for `trading-core`
- add API framework selection for `trading-core` and `trading-product`
- create read-only status endpoints
- create event ingestion and query skeletons
- add unit tests for gate ordering
- define persistence model for events and runtime state

## Phase 2 - Provider Registry and Hummingbot Adapter Skeleton

- implement `ExecutionProviderRegistry`
- add `HummingbotProvider` skeleton
- map Hummingbot health/status into `ExecutionProviderStatus`
- keep Hummingbot DTOs isolated inside adapter layer
- add simulation provider for tests

## Phase 3 - Product Access and Runtime Admission

- implement entitlement evaluation
- implement token/access policy evaluator boundary
- implement runtime quota checks
- implement credential binding checks using vault references
- enforce User Trading gate order before execution

## Phase 4 - Compliance and Security Foundation

- implement disclosure requirement checks
- implement acceptance recording
- define credential vault adapter interface
- integrate encrypted secret backend only behind vault boundary
- add audit events for credential and compliance flows

## Phase 5 - AxodusAPP Trading Surfaces

- add AxodusAPP route module for Trading
- implement marketplace, runtime, provider, risk, telemetry, and compliance screens
- consume backend truth only
- add UI states for missing entitlement, quota exceeded, missing disclosure, and credential binding issues

## Phase 6 - WhiteRabbit Productization

- wrap existing WhiteRabbit as future `StrategyProduct`
- preserve existing `quants-lab` code
- define product metadata, access policy, runtime limits, and telemetry requirements
- prepare backtesting compatibility and signal trace output

---

# MVP Status

Status: Phase 0 MVP delivered.

Delivered:
- architecture documentation
- product economy model
- security and compliance boundaries
- shared TypeScript contracts
- unified event model
- service scaffolding
- structural validation

Not delivered:
- runtime execution
- HTTP API
- AxodusAPP routes
- live provider integration
- persistent storage
- production security implementation

The MVP is ready for Phase 1 implementation.
