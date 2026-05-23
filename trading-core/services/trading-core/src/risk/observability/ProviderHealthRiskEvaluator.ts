import type {
  ObservabilityQueryContext,
  ObservabilityRiskSignal,
  ProviderHealthReadModel,
} from '../../../../../packages/trading-contracts/src/index.js';
import { createObservabilityRiskSignal } from './ObservabilityRiskSignalFactory.js';

export class ProviderHealthRiskEvaluator {
  evaluate(context: ObservabilityQueryContext, provider?: ProviderHealthReadModel): ObservabilityRiskSignal[] {
    if (!provider || provider.tenantId !== context.tenantId) {
      return [];
    }
    if (provider.health.state === 'critical') {
      return [createObservabilityRiskSignal(context, 'provider-critical', 'provider-health', provider.health, {
        providerId: provider.providerId,
      })];
    }
    if (provider.health.state === 'degraded') {
      return [createObservabilityRiskSignal(context, 'provider-degraded', 'provider-health', provider.health, {
        providerId: provider.providerId,
      })];
    }
    return [];
  }
}
