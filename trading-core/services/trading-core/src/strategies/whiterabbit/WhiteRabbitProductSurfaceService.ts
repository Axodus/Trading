import type {
  ExchangeCredentialBinding,
  StrategyProduct,
  TenantExecutionMetrics,
  TradingRiskDisclosure,
  UserRiskAcceptance,
  UserRuntimeInstance,
  UserTradingProfile,
  WhiteRabbitAccessView,
  WhiteRabbitCredentialBindingView,
  WhiteRabbitDisclosureView,
  WhiteRabbitProductView,
  WhiteRabbitRiskView,
  WhiteRabbitRuntimeView,
  WhiteRabbitTelemetryView,
} from '../../../../../packages/trading-contracts/src/index.js';
import { WhiteRabbitProductAdapter } from './WhiteRabbitProductAdapter.js';
import { whiteRabbitTelemetryProfile } from './WhiteRabbitTelemetryProfile.js';

export interface WhiteRabbitSurfaceInput {
  profile: UserTradingProfile;
  product?: StrategyProduct;
  runtime?: UserRuntimeInstance;
  credentialBinding?: ExchangeCredentialBinding;
  disclosures?: TradingRiskDisclosure[];
  acceptances?: UserRiskAcceptance[];
  telemetry?: TenantExecutionMetrics;
  quotaUsage?: {
    activeStrategies: number;
    activeRuntimes: number;
    dailyExecutions: number;
  };
  riskStatus?: 'ok' | 'review-required' | 'blocked';
}

export interface WhiteRabbitProductSurface {
  product: WhiteRabbitProductView;
  access: WhiteRabbitAccessView;
  runtime: WhiteRabbitRuntimeView;
  risk: WhiteRabbitRiskView;
  telemetry: WhiteRabbitTelemetryView;
  disclosures: WhiteRabbitDisclosureView;
  credentialBinding: WhiteRabbitCredentialBindingView;
}

export class WhiteRabbitProductSurfaceService {
  private readonly defaultProduct = new WhiteRabbitProductAdapter().toStrategyProduct();

  build(input: WhiteRabbitSurfaceInput): WhiteRabbitProductSurface {
    const product = input.product ?? this.defaultProduct;
    const disclosures = this.buildDisclosureView(input.disclosures ?? [], input.acceptances ?? []);
    const access = this.buildAccessView(product, input.profile);
    const credentialBinding = this.buildCredentialBindingView(input.credentialBinding, input.runtime?.providerId);
    const runtime = this.buildRuntimeView(product, input, access, disclosures, credentialBinding);
    const risk = this.buildRiskView(input.riskStatus ?? 'ok', disclosures);
    const telemetry = this.buildTelemetryView(input.runtime, input.telemetry);

    return {
      product: this.buildProductView(product),
      access,
      runtime,
      risk,
      telemetry,
      disclosures,
      credentialBinding,
    };
  }

  private buildProductView(product: StrategyProduct): WhiteRabbitProductView {
    return {
      productId: product.id,
      strategyId: 'whiterabbit-v1',
      name: product.name,
      description: product.description,
      status: product.lifecycleStatus,
      visibility: product.visibility,
      monetization: product.monetization,
      supportedSurfaceTargets: ['marketplace', 'defi', 'dex', 'academy', 'tenant-dao', 'acs'],
      allowedUserActions: [
        'request-access',
        'accept-disclosure',
        'bind-credential-reference',
        'provision-runtime',
        'pause-runtime',
        'stop-runtime',
        'view-telemetry',
        'view-quota-usage',
      ],
      forbiddenUserActions: [
        'call-provider',
        'call-hummingbot',
        'bypass-risk',
        'bypass-compliance',
        'bypass-product-entitlement',
        'override-treasury-policies',
        'mutate-strategy-internals',
      ],
      riskLanguage: 'WhiteRabbit is non-custodial automation infrastructure. Users retain custody, capital risk, exchange account risk, and market risk.',
    };
  }

  private buildAccessView(product: StrategyProduct, profile: UserTradingProfile): WhiteRabbitAccessView {
    const reasons: string[] = [];
    const entitlementRequired = product.accessPolicy.entitlementKey;
    const entitlementActive = ['active', 'trial'].includes(profile.entitlementState.status)
      && profile.entitlementState.entitlementKeys.includes(entitlementRequired);
    const tokenMinimum = product.accessPolicy.tokenPolicy?.neuronMinimum;
    const tokenPassed = tokenMinimum === undefined || profile.neuronBalance >= tokenMinimum;
    const subscriptionCompatible = !product.accessPolicy.allowedSubscriptionTiers?.length
      || (profile.subscriptionTier ? product.accessPolicy.allowedSubscriptionTiers.includes(profile.subscriptionTier) : false);

    if (!entitlementActive) {
      reasons.push('Product entitlement is not active.');
    }
    if (!tokenPassed) {
      reasons.push('Token gate requirements are not met.');
    }
    if (!subscriptionCompatible) {
      reasons.push('Subscription tier is not compatible.');
    }

    const accessStatus = entitlementActive && tokenPassed && subscriptionCompatible
      ? (profile.entitlementState.status === 'trial' ? 'trial' : 'granted')
      : 'blocked';

    return {
      accessStatus,
      entitlementState: { ...profile.entitlementState },
      tokenGateStatus: tokenMinimum === undefined ? 'not-required' : (tokenPassed ? 'passed' : 'failed'),
      subscriptionTier: profile.subscriptionTier,
      subscriptionCompatible,
      reasons,
    };
  }

  private buildRuntimeView(
    product: StrategyProduct,
    input: WhiteRabbitSurfaceInput,
    access: WhiteRabbitAccessView,
    disclosures: WhiteRabbitDisclosureView,
    credentialBinding: WhiteRabbitCredentialBindingView,
  ): WhiteRabbitRuntimeView {
    const quotaUsage = input.quotaUsage ?? {
      activeStrategies: input.runtime ? 1 : 0,
      activeRuntimes: input.runtime ? 1 : 0,
      dailyExecutions: input.telemetry?.executionCount ?? 0,
    };
    const blockers: string[] = [];

    if (access.accessStatus === 'blocked') {
      blockers.push('Product access is blocked.');
    }
    if (!disclosures.allRequiredAccepted) {
      blockers.push('Required risk disclosures are missing.');
    }
    if (!credentialBinding.executionReady) {
      blockers.push('Credential binding is missing or not active.');
    }
    if (quotaUsage.activeStrategies >= product.runtimeLimits.maxActiveStrategies && !input.runtime) {
      blockers.push('Active strategy quota is exhausted.');
    }
    if (quotaUsage.activeRuntimes >= product.runtimeLimits.maxConcurrentRuntimes && !input.runtime) {
      blockers.push('Runtime quota is exhausted.');
    }

    const runtimeStatus = input.runtime?.status ?? 'not-provisioned';
    const canEnableExecution = blockers.length === 0 && ['active', 'paused'].includes(runtimeStatus);

    return {
      runtimeInstanceId: input.runtime?.id,
      status: runtimeStatus,
      runtimeEnablement: {
        canProvision: blockers.length === 0 && !input.runtime,
        canEnableExecution,
        blockers,
      },
      quotaUsage: {
        ...quotaUsage,
        maxActiveStrategies: product.runtimeLimits.maxActiveStrategies,
        maxConcurrentRuntimes: product.runtimeLimits.maxConcurrentRuntimes,
        maxDailyExecutions: product.runtimeLimits.maxDailyExecutions,
      },
      pauseAvailable: runtimeStatus === 'active',
      stopAvailable: ['active', 'paused', 'suspended'].includes(runtimeStatus),
    };
  }

  private buildRiskView(status: WhiteRabbitRiskView['status'], disclosures: WhiteRabbitDisclosureView): WhiteRabbitRiskView {
    return {
      status: disclosures.allRequiredAccepted ? status : 'review-required',
      disclosuresRequired: !disclosures.allRequiredAccepted,
      riskSummary: 'Non-custodial automated trading can lose capital. Execution depends on user-owned exchange credentials, market liquidity, volatility, and configured runtime limits.',
      controls: [
        'Product entitlement gate',
        'Disclosure acceptance gate',
        'Credential binding gate',
        'Runtime quota gate',
        'Risk gateway before execution',
      ],
    };
  }

  private buildTelemetryView(runtime?: UserRuntimeInstance, telemetry?: TenantExecutionMetrics): WhiteRabbitTelemetryView {
    return {
      runtimeInstanceId: runtime?.id,
      executionCount: telemetry?.executionCount ?? 0,
      lastExecutionAt: telemetry?.lastExecutionAt,
      health: runtime?.status === 'active' ? 'healthy' : 'unknown',
      summary: whiteRabbitTelemetryProfile.runtimeHealthReported
        ? 'Runtime telemetry is available as normalized product telemetry.'
        : 'Runtime telemetry is not enabled.',
    };
  }

  private buildDisclosureView(disclosures: TradingRiskDisclosure[], acceptances: UserRiskAcceptance[]): WhiteRabbitDisclosureView {
    const accepted = new Set(acceptances.map((acceptance) => `${acceptance.disclosureId}:${acceptance.disclosureVersion}`));
    const required = disclosures.map((disclosure) => ({
      id: disclosure.id,
      version: disclosure.version,
      category: disclosure.category,
      title: disclosure.title,
      contentRef: disclosure.contentRef,
    }));
    const missingDisclosureIds = disclosures
      .filter((disclosure) => !accepted.has(`${disclosure.id}:${disclosure.version}`))
      .map((disclosure) => disclosure.id);

    return {
      required,
      acceptedDisclosureIds: acceptances.map((acceptance) => acceptance.disclosureId),
      missingDisclosureIds,
      allRequiredAccepted: missingDisclosureIds.length === 0,
    };
  }

  private buildCredentialBindingView(binding?: ExchangeCredentialBinding, providerId?: string): WhiteRabbitCredentialBindingView {
    if (!binding) {
      return {
        status: 'missing',
        providerId,
        scopes: [],
        executionReady: false,
      };
    }

    const executionReady = binding.scopes.includes('trade') && binding.scopes.includes('cancel-orders');
    return {
      status: 'active',
      providerId,
      vaultRefId: binding.vaultRefId,
      accountLabel: binding.accountLabel,
      scopes: [...binding.scopes],
      executionReady,
    };
  }
}
