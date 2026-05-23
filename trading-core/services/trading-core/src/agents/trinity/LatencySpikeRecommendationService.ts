import type {
  ObservabilityQueryContext,
  OperationalTelemetrySnapshot,
  TradingRecommendation,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { ObservabilityEvidence } from './ObservabilityRecommendationTypes.js';
import { createObservabilityRecommendation, healthEvidence } from './ObservabilityRecommendationTypes.js';

export class LatencySpikeRecommendationService {
  evaluate(context: ObservabilityQueryContext, snapshot: OperationalTelemetrySnapshot): TradingRecommendation[] {
    const recommendations: TradingRecommendation[] = [];
    const latency = snapshot.executionLatency;

    if (latency && latency.averageLatencyMs >= 1000) {
      const evidence: ObservabilityEvidence = {
        evidenceType: 'execution-latency',
        runtimeInstanceId: latency.runtimeInstanceId,
        providerId: context.providerId,
        averageLatencyMs: latency.averageLatencyMs,
      };
      recommendations.push(createObservabilityRecommendation(
        context,
        'recommend-telemetry-review',
        latency.averageLatencyMs >= 2000 ? 0.86 : 0.72,
        `Average execution latency is ${latency.averageLatencyMs}ms; Trinity recommends telemetry review before runtime action.`,
        evidence,
      ));
    }

    const telemetryHealth = snapshot.telemetryIngestionQuality;
    if (telemetryHealth && (telemetryHealth.state === 'degraded' || telemetryHealth.state === 'critical')) {
      recommendations.push(createObservabilityRecommendation(
        context,
        'recommend-telemetry-review',
        telemetryHealth.state === 'critical' ? 0.88 : 0.7,
        `Telemetry ingestion is ${telemetryHealth.state}; Trinity recommends ACS-reviewed observability investigation.`,
        healthEvidence('telemetry-ingestion', telemetryHealth, {
          runtimeInstanceId: context.runtimeInstanceId,
          providerId: context.providerId,
        }),
      ));
    }

    return recommendations;
  }
}
