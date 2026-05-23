import type {
  TradingExecutionContext,
  TradingReadModel,
} from '../../../../packages/trading-contracts/src/index.js';
import type { RuntimeLifecycleService } from '../runtime/RuntimeLifecycleService.js';
import type { TradingEventQueryService } from '../state/TradingEventQueryService.js';
import type { ProviderStateService } from '../state/ProviderStateService.js';

export interface TradingReadApiDependencies {
  runtimeLifecycle?: RuntimeLifecycleService;
  eventQuery?: TradingEventQueryService;
  providerState?: ProviderStateService;
}

export class TradingReadApi {
  constructor(private readonly deps: TradingReadApiDependencies = {}) {}

  getReadModel(context: TradingExecutionContext): TradingReadModel {
    const runtime = context.runtimeInstanceId ? this.deps.runtimeLifecycle?.get(context.runtimeInstanceId)?.runtime : undefined;
    const providerState = this.deps.providerState?.get(context.providerId);
    const recommendationEvents = context.runtimeInstanceId
      ? this.deps.eventQuery?.byRuntimeInstanceId(context.runtimeInstanceId).filter((event) => event.type === 'TRINITY_RECOMMENDATION_CREATED') ?? []
      : [];

    return {
      context: { ...context },
      runtime: runtime ? {
        id: runtime.id,
        userId: runtime.userId,
        strategyProductId: runtime.strategyProductId,
        providerId: runtime.providerId,
        executionDomain: runtime.executionDomain,
        status: runtime.status,
        createdAt: runtime.createdAt,
        updatedAt: runtime.updatedAt,
      } : undefined,
      providerStatus: providerState?.status ?? 'unknown',
      entitlementState: 'unknown',
      quotaState: 'unknown',
      strategyState: runtime ? this.strategyStateFromRuntime(runtime.status) : 'unknown',
      runtimeLifecycle: runtime?.status,
      recommendationSummary: {
        total: recommendationEvents.length,
        latestRecommendationType: recommendationEvents.at(-1)?.payload && typeof recommendationEvents.at(-1)?.payload === 'object'
          ? String((recommendationEvents.at(-1)?.payload as { recommendation?: { recommendationType?: string } }).recommendation?.recommendationType ?? '')
          : undefined,
      },
    };
  }

  private strategyStateFromRuntime(status: NonNullable<ReturnType<RuntimeLifecycleService['get']>>['runtime']['status']): TradingReadModel['strategyState'] {
    if (status === 'active') {
      return 'running';
    }
    if (status === 'paused') {
      return 'paused';
    }
    if (status === 'degraded') {
      return 'degraded';
    }
    if (status === 'provisioning' || status === 'requested') {
      return 'provisioned';
    }
    return 'unknown';
  }
}
