import type {
  ObservabilityQueryContext,
  ObservabilityRiskSignal,
  RuntimeHealthReadModel,
} from '../../../../../packages/trading-contracts/src/index.js';
import { createObservabilityRiskSignal } from './ObservabilityRiskSignalFactory.js';

export class RuntimeHealthRiskEvaluator {
  evaluate(context: ObservabilityQueryContext, runtime?: RuntimeHealthReadModel): ObservabilityRiskSignal[] {
    if (!runtime || runtime.tenantId !== context.tenantId) {
      return [];
    }
    const signals: ObservabilityRiskSignal[] = [];
    if (runtime.health.state === 'critical') {
      signals.push(createObservabilityRiskSignal(context, 'runtime-critical', 'runtime-health', runtime.health, {
        providerId: runtime.providerId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        strategyProductId: runtime.strategyProductId,
      }));
    }
    if (runtime.health.state === 'degraded') {
      signals.push(createObservabilityRiskSignal(context, 'runtime-degraded', 'runtime-health', runtime.health, {
        providerId: runtime.providerId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        strategyProductId: runtime.strategyProductId,
      }));
    }
    if (runtime.metrics.recoveryCount >= 3) {
      signals.push(createObservabilityRiskSignal(context, 'repeated-runtime-recovery', 'runtime-health', runtime.health, {
        providerId: runtime.providerId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        strategyProductId: runtime.strategyProductId,
      }));
    }
    return signals;
  }
}
