import type {
  ObservabilityQueryContext,
  TradingRecommendation,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingObservabilityApi } from '../../api/observability/TradingObservabilityApi.js';
import { LatencySpikeRecommendationService } from './LatencySpikeRecommendationService.js';
import { ObservabilityRecommendationAuditService } from './ObservabilityRecommendationAuditService.js';
import { ProviderHealthRecommendationService } from './ProviderHealthRecommendationService.js';
import { RuntimeHealthRecommendationService } from './RuntimeHealthRecommendationService.js';
import { StrategyHealthRecommendationService } from './StrategyHealthRecommendationService.js';

export interface TrinityObservabilityAdapterDependencies {
  runtimeHealth?: RuntimeHealthRecommendationService;
  providerHealth?: ProviderHealthRecommendationService;
  strategyHealth?: StrategyHealthRecommendationService;
  latency?: LatencySpikeRecommendationService;
  audit?: ObservabilityRecommendationAuditService;
}

export class TrinityObservabilityAdapter {
  private readonly runtimeHealth: RuntimeHealthRecommendationService;
  private readonly providerHealth: ProviderHealthRecommendationService;
  private readonly strategyHealth: StrategyHealthRecommendationService;
  private readonly latency: LatencySpikeRecommendationService;
  private readonly audit: ObservabilityRecommendationAuditService;

  constructor(
    private readonly observabilityApi: TradingObservabilityApi,
    deps: TrinityObservabilityAdapterDependencies = {},
  ) {
    this.runtimeHealth = deps.runtimeHealth ?? new RuntimeHealthRecommendationService();
    this.providerHealth = deps.providerHealth ?? new ProviderHealthRecommendationService();
    this.strategyHealth = deps.strategyHealth ?? new StrategyHealthRecommendationService();
    this.latency = deps.latency ?? new LatencySpikeRecommendationService();
    this.audit = deps.audit ?? new ObservabilityRecommendationAuditService();
  }

  async evaluate(context: ObservabilityQueryContext): Promise<TradingRecommendation[]> {
    const response = this.observabilityApi.snapshot(context);
    if (!response.ok || !response.data) {
      return [];
    }

    const snapshot = response.data;
    const recommendations = [
      ...this.runtimeHealth.evaluate(context, snapshot.runtimeHealth),
      ...this.providerHealth.evaluate(context, snapshot.providerHealth),
      ...this.strategyHealth.evaluate(context, snapshot.strategyHealth),
      ...this.latency.evaluate(context, snapshot),
    ];

    return this.audit.record(context, snapshot, recommendations);
  }
}
