import type {
  ObservabilityQueryContext,
  RuntimeHealthReadModel,
  TradingRecommendation,
} from '../../../../../packages/trading-contracts/src/index.js';
import { createObservabilityRecommendation, healthEvidence } from './ObservabilityRecommendationTypes.js';

export class RuntimeHealthRecommendationService {
  evaluate(context: ObservabilityQueryContext, runtime?: RuntimeHealthReadModel): TradingRecommendation[] {
    if (!runtime || (runtime.health.state !== 'degraded' && runtime.health.state !== 'critical')) {
      return [];
    }

    const state = runtime.health.state;
    return [
      createObservabilityRecommendation(
        context,
        'recommend-runtime-recovery',
        state === 'critical' ? 0.92 : 0.78,
        `Runtime health is ${state}; Trinity recommends ACS-reviewed recovery investigation.`,
        healthEvidence('runtime-health', runtime.health, {
          runtimeInstanceId: runtime.runtimeInstanceId,
          providerId: runtime.providerId,
        }),
      ),
    ];
  }
}
