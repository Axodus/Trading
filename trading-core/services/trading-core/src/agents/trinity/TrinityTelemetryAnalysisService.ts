import type { TradingRecommendation, TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';

export class TrinityTelemetryAnalysisService {
  evaluate(intent: TrinityTradingIntent, createdAt = new Date().toISOString()): TradingRecommendation[] {
    const health = intent.runtimeSnapshot?.health ?? 'healthy';
    const staleExecutionState = intent.runtimeSnapshot?.staleExecutionState ?? false;
    const recommendations: TradingRecommendation[] = [];

    if (health === 'degraded' || health === 'offline' || staleExecutionState) {
      recommendations.push({
        id: `trinity-recommend-runtime-recovery-${intent.id}`,
        correlationId: intent.correlationId,
        tenantId: intent.tenantId,
        producedByAgent: 'trinity',
        context: intent.context,
        recommendationType: 'recommend-runtime-recovery',
        confidence: health === 'offline' ? 0.9 : 0.78,
        rationale: staleExecutionState ? 'Runtime has stale execution state.' : `Runtime health is ${health}.`,
        createdAt,
        requiresAcs: true,
        authorizedExecution: false,
      });
    }

    return recommendations;
  }
}
