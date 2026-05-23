import type {
  ObservabilityQueryContext,
  ProviderHealthReadModel,
  TradingRecommendation,
} from '../../../../../packages/trading-contracts/src/index.js';
import { createObservabilityRecommendation, healthEvidence } from './ObservabilityRecommendationTypes.js';

export class ProviderHealthRecommendationService {
  evaluate(context: ObservabilityQueryContext, provider?: ProviderHealthReadModel): TradingRecommendation[] {
    if (!provider || (provider.health.state !== 'degraded' && provider.health.state !== 'critical')) {
      return [];
    }

    const state = provider.health.state;
    return [
      createObservabilityRecommendation(
        context,
        'recommend-provider-block',
        state === 'critical' ? 0.94 : 0.82,
        `Provider health is ${state}; Trinity recommends ACS/governance review before continued use.`,
        healthEvidence('provider-health', provider.health, {
          providerId: provider.providerId,
        }),
      ),
    ];
  }
}
