# Axodus Trading - Phase 0 Final Plan with Product Economy, Security, and Compliance

## Summary

Axodus Trading is officially modeled as:

```text
Infrastructure + Product + Economy + Monetization
```

The architecture has two major domains:

1. **Sovereign Trading Core**
   - governance
   - federation
   - treasury
   - execution
   - risk
   - telemetry
   - orchestration

2. **Trading Product Layer**
   - user-facing strategy products
   - subscriptions
   - token-gated access
   - runtime provisioning
   - billing policies
   - marketplace evolution
   - monetized infrastructure access

Phase 0 will establish only:
- documentation
- contracts
- scaffolding
- event model
- product/access/runtime/billing boundaries
- security/compliance boundaries

It will **not** implement deep Hummingbot runtime behavior yet.

## Architecture

### 1. Final topology

```text
Axodus Governance
        ↓
Federation Layer
        ↓
Trading Product Layer
        ↓
Axodus MCP / Intelligence Layer
        ↓
Axodus Trading Core
        ↓
Execution Providers
    ├── Hummingbot Runtime
    ├── Native Execution Engine
    ├── DEX Routers
    ├── Hyperliquid Runtime
    └── Future Institutional Engines
```

### 2. Trading domains

#### Treasury Trading
For Axodus-controlled capital:
- DAO treasury
- federation treasury
- sovereign operations
- governed strategy execution

#### User Trading
For customer-owned capital:
- own exchange account
- own wallet
- own CEX API key
- own strategy runtime
- own balance/risk exposure

The same `TradingCore` supports both, differentiated by:

```ts
type ExecutionDomain = 'treasury' | 'user';
```

### 3. Phase 0 domain boundaries

Phase 0 must formally define these domains:

```text
Product Layer
Marketplace Layer
Access Layer
Runtime Layer
Billing Layer
Security / Credential Vault Layer
Compliance / Disclosure Layer
```

## Key Changes

### 1. Phase 0 folders and scaffolding

```text
trading-core/
  packages/
    trading-contracts/
      src/
        execution/
        governance/
        federation/
        treasury/
        risk/
        strategy/
        telemetry/
        portfolio/
        product/
        marketplace/
        access/
        billing/
        runtime/
        security/
        compliance/
        events/

  services/
    trading-core/
      src/
        core/
        application/
        execution/
        governance/
        federation/
        treasury/
        risk/
        telemetry/
        portfolio/
        agents/

    trading-product/
      src/
        product/
        marketplace/
        access/
        billing/
        runtime/
        security/
        compliance/
```

### 2. Product economy contracts

#### StrategyProduct

```ts
export interface StrategyProduct {
  id: string;
  name: string;
  description?: string;

  visibility:
    | 'public'
    | 'token-gated'
    | 'dao-only'
    | 'premium';

  accessPolicy: StrategyAccessPolicy;
  runtimeLimits: RuntimeLimits;
  supportedProviders: ExecutionProviderType[];

  monetization:
    | 'free'
    | 'subscription'
    | 'milestone'
    | 'staking'
    | 'dao-access';

  lifecycleStatus:
    | 'draft'
    | 'active'
    | 'deprecated'
    | 'suspended';
}
```

#### UserTradingProfile

```ts
export interface UserTradingProfile {
  userId: string;
  wallet: Address;

  neuronBalance: bigint;
  unlockedStrategies: string[];

  runtimeQuota: RuntimeQuota;
  executionLimits: ExecutionLimits;

  subscriptionTier?: string;
  entitlementState: EntitlementState;
}
```

#### Runtime and monetization contracts

```ts
export interface RuntimeQuota {
  maxActiveStrategies: number;
  maxConcurrentRuntimes: number;
  maxMonthlyExecutions?: number;
  maxProviderConnections?: number;
}

export interface ExecutionQuota {
  strategyId: string;
  maxOrdersPerDay?: number;
  maxNotionalPerDay?: string;
  maxConcurrentPositions?: number;
}

export interface BillingPolicy {
  billingMode:
    | 'none'
    | 'subscription'
    | 'usage'
    | 'milestone'
    | 'staking'
    | 'dao-funded';

  entitlementKey: string;
  quotaPolicy?: RuntimeQuota;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  includedStrategies: string[];
  runtimeQuota: RuntimeQuota;
  executionQuota?: ExecutionQuota[];
}
```

### 3. Clarification on free / no-commission strategy monetization

Phase 0 documentation must explicitly state:

Free or no-commission strategies may still generate revenue or token utility through:
- token gating
- staking requirements
- subscription access
- premium telemetry tiers
- marketplace upgrades
- execution/runtime quotas
- access tier progression
- bundled premium infrastructure

This prevents the architecture from treating “free strategy” as “non-economic strategy.”

### 4. Security / Credential Vault domain

Phase 0 must add a dedicated security domain for non-custodial user execution.

Responsibilities:
- encrypted CEX API credential references
- wallet runtime bindings
- key lifecycle metadata
- credential usage boundaries
- provider-scoped credential access
- separation between raw secret storage and execution contracts
- explicit non-exposure of secrets to frontend, agents, or marketplace services

Contracts to define:

```ts
export interface CredentialVaultReference {
  id: string;
  ownerUserId: string;
  credentialType: 'cex-api-key' | 'wallet-binding';
  providerId: string;
  status: 'active' | 'rotated' | 'revoked' | 'suspended';
}

export interface ExchangeCredentialBinding {
  vaultRefId: string;
  exchange: string;
  accountLabel?: string;
  scopes: CredentialScope[];
}

export interface WalletRuntimeBinding {
  vaultRefId: string;
  walletAddress: Address;
  chainId: string;
  allowedProviders: ExecutionProviderType[];
}
```

Associated service boundaries:
- `CredentialVaultService`
- `RuntimeCredentialBindingService`
- `CredentialAccessPolicyEvaluator`

No secret material should be specified as a plain application contract in Phase 0.

### 5. Compliance / Disclosure domain

Phase 0 must define contracts and boundaries for non-custodial user trading acceptance.

Responsibilities:
- risk acknowledgement
- non-custodial disclosures
- automation consent
- strategy-specific disclosures
- product-tier risk disclosures
- acceptance versioning
- auditable user consent trail

Contracts to define:

```ts
export interface TradingRiskDisclosure {
  id: string;
  version: string;
  category:
    | 'non-custodial'
    | 'automation-risk'
    | 'market-risk'
    | 'leverage-risk'
    | 'strategy-specific';

  title: string;
  contentRef: string;
  requiredFor: DisclosureRequirementTarget[];
}

export interface UserRiskAcceptance {
  userId: string;
  disclosureId: string;
  disclosureVersion: string;
  acceptedAt: string;
  executionDomain: 'user';
}
```

Operational rule:
- user trading flows must be designed so that required disclosures can be checked before runtime provisioning or execution enablement.

### 6. Trading execution context

```ts
export interface TradingExecutionContext {
  executionDomain: 'treasury' | 'user';

  daoId?: string;
  federationId?: string;

  userId?: string;
  strategyProductId?: string;
  runtimeInstanceId?: string;

  providerId: string;
  strategyId?: string;
}
```

### 7. Final execution gate order

#### Treasury Trading

```text
Governance
→ Federation
→ Treasury Policy
→ Global Risk
→ Treasury Risk
→ Provider Execution
```

#### User Trading

```text
Compliance Acceptance
→ Product Entitlement
→ Token / Access Policy
→ Runtime Permission
→ Credential Vault Binding
→ Global Risk
→ User Runtime Risk
→ Provider Execution
```

### 8. Risk model

```text
Global Risk Engine
    ↓
Treasury Risk
    ↓
User Runtime Risk
```

Phase 0 defines boundaries and contracts only.

### 9. WhiteRabbit productization

WhiteRabbit must be documented as both:
- a strategy engine candidate
- a future `StrategyProduct`

Target model:

```text
WhiteRabbit V1
    ↓
WhiteRabbit Engine
    ↓
StrategyProvider
    ↓
StrategyProduct
    ↓
UserRuntimeInstance / TreasuryStrategyInstance
    ↓
ExecutionProvider
```

Phase 0 only documents and types this evolution. No deep runtime migration yet.

## Event Model

Maintain prior trading events and add product, runtime, security, and compliance events.

### Product/runtime events

```ts
type TradingProductEvent =
  | 'STRATEGY_PRODUCT_PUBLISHED'
  | 'STRATEGY_ACCESS_GRANTED'
  | 'STRATEGY_ACCESS_REVOKED'
  | 'USER_RUNTIME_PROVISION_REQUESTED'
  | 'USER_RUNTIME_PROVISIONED'
  | 'USER_RUNTIME_SUSPENDED'
  | 'RUNTIME_QUOTA_EXCEEDED'
  | 'SUBSCRIPTION_TIER_CHANGED'
  | 'TOKEN_ACCESS_POLICY_FAILED'
  | 'BILLING_ENTITLEMENT_GRANTED'
  | 'BILLING_ENTITLEMENT_REVOKED';
```

### Security/compliance events

```ts
type TradingSecurityComplianceEvent =
  | 'CREDENTIAL_BINDING_CREATED'
  | 'CREDENTIAL_BINDING_REVOKED'
  | 'WALLET_RUNTIME_BINDING_CREATED'
  | 'RISK_DISCLOSURE_REQUIRED'
  | 'RISK_DISCLOSURE_ACCEPTED'
  | 'RISK_DISCLOSURE_MISSING';
```

### Unified event envelope

```ts
export interface TradingEvent<TType extends string, TPayload> {
  id: string;
  type: TType;
  occurredAt: string;
  correlationId: string;
  source: 'core' | 'agent' | 'provider' | 'governance' | 'risk' | 'product' | 'security' | 'compliance';
  daoId?: string;
  federationId?: string;
  userId?: string;
  strategyId?: string;
  strategyProductId?: string;
  runtimeInstanceId?: string;
  payload: TPayload;
}
```

## Phase 0 Deliverables

### Documentation

Create/update:

```text
.instructions/TRADING_CORE_PLAN.md
.instructions/TRADING_CORE_ARCHITECTURE.md
.instructions/TRADING_PRODUCT_ECONOMY.md
.instructions/TRADING_MONETIZATION.md
.instructions/TRADING_RUNTIME_MODEL.md
.instructions/TRADING_SECURITY_MODEL.md
.instructions/TRADING_COMPLIANCE_MODEL.md
.instructions/DECISIONS.md
.instructions/TASKS.md
.instructions/ROADMAP.md
```

### Contracts

Define initial TypeScript contracts for:
- `ExecutionProvider`
- `TradingExecutionContext`
- `StrategyProduct`
- `UserTradingProfile`
- `RuntimeQuota`
- `ExecutionQuota`
- `TokenAccessPolicy`
- `BillingPolicy`
- `SubscriptionTier`
- `UserRuntimeInstance`
- `CredentialVaultReference`
- `ExchangeCredentialBinding`
- `WalletRuntimeBinding`
- `TradingRiskDisclosure`
- `UserRiskAcceptance`
- `TradingEvent`

### Scaffolding

Create empty or skeletal package/service boundaries for:
- `trading-contracts`
- `trading-core`
- `trading-product`

No deep provider runtime logic, no actual Hummingbot implementation.

### Boundary definitions

Explicitly document:
- product vs core ownership
- treasury vs user execution
- entitlement vs governance vs risk
- credential custody boundaries
- compliance preconditions
- monetization and quotas
- multi-tenant execution intent

## Tests

Phase 0 test scope is structural and contract-oriented only:

- contract compilation
- event type coverage
- execution domain typing
- monetization contract typing
- credential vault contract typing
- compliance contract typing
- no runtime/provider logic beyond stubs

No deep integration tests with Hummingbot in Phase 0.

## Assumptions

- Axodus Trading is officially a **Trading Infrastructure as a Service** architecture.
- Axodus provides automation and infrastructure, while users retain custody of capital and credentials.
- Product economy is architectural, not a future bolt-on.
- “Free” strategies may still be monetizable through access systems and infrastructure limits.
- Treasury Trading and User Trading remain distinct operational modes within one core.
- Credential Vault and Compliance/Disclosure are first-class Phase 0 domains.
- Hummingbot remains an execution runtime abstraction target, but Phase 0 does not implement its deep adapter behavior.

