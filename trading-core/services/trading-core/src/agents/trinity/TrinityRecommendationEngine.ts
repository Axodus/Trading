import type {
  TradingEvent,
  TradingRecommendation,
  TrinityMarketAnalysis,
  TrinityMarketIntelligenceReport,
  TrinityTradingIntent,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';
import { MarketIntelligenceService } from './MarketIntelligenceService.js';
import { TrinityMarketAnalysisService } from './TrinityMarketAnalysisService.js';
import { TrinityRecommendationEvaluator } from './TrinityRecommendationEvaluator.js';
import { TrinityStrategyOptimizationService } from './TrinityStrategyOptimizationService.js';
import { TrinityTelemetryAnalysisService } from './TrinityTelemetryAnalysisService.js';

export interface TrinityRecommendationResult {
  marketAnalysis: TrinityMarketAnalysis;
  intelligenceReport: TrinityMarketIntelligenceReport;
  recommendations: TradingRecommendation[];
}

export class TrinityRecommendationEngine {
  readonly evaluator = new TrinityRecommendationEvaluator();

  constructor(
    private readonly eventBus?: TradingEventBus,
    private readonly marketAnalysis = new TrinityMarketAnalysisService(),
    private readonly strategyOptimization = new TrinityStrategyOptimizationService(),
    private readonly telemetryAnalysis = new TrinityTelemetryAnalysisService(),
    private readonly marketIntelligence = new MarketIntelligenceService(),
  ) {}

  async evaluate(intent: TrinityTradingIntent): Promise<TrinityRecommendationResult> {
    const analysis = this.marketAnalysis.analyze(intent);
    const intelligenceReport = this.marketIntelligence.analyze(intent);
    await this.publish(intent, 'TRINITY_MARKET_ANALYSIS_COMPLETED', { analysis });
    await this.publishIntelligenceEvents(intent, intelligenceReport);

    const createdAt = new Date().toISOString();
    const recommendations = [
      ...this.intelligenceRecommendations(intent, intelligenceReport, createdAt),
      ...this.marketRecommendations(intent, analysis, createdAt),
      ...this.strategyOptimization.evaluate(intent, createdAt),
      ...this.telemetryAnalysis.evaluate(intent, createdAt),
    ];

    for (const recommendation of recommendations) {
      await this.publishRecommendationEvents(intent, recommendation);
    }

    return {
      marketAnalysis: analysis,
      intelligenceReport,
      recommendations,
    };
  }

  private intelligenceRecommendations(
    intent: TrinityTradingIntent,
    report: TrinityMarketIntelligenceReport,
    createdAt: string,
  ): TradingRecommendation[] {
    return report.recommendedProtections.map((recommendationType) => ({
      id: `trinity-intel-${recommendationType}-${intent.id}`,
      correlationId: intent.correlationId,
      tenantId: intent.tenantId,
      producedByAgent: 'trinity',
      context: intent.context,
      recommendationType,
      confidence: this.confidenceFor(recommendationType, report),
      rationale: this.rationaleFor(recommendationType, report),
      createdAt,
      requiresAcs: true,
      authorizedExecution: false,
    }));
  }

  private confidenceFor(
    recommendationType: TradingRecommendation['recommendationType'],
    report: TrinityMarketIntelligenceReport,
  ): number {
    if (recommendationType === 'recommend-provider-block') {
      return Math.max(0.75, 1 - report.providerQualityScore);
    }
    if (recommendationType === 'recommend-runtime-recovery') {
      return report.runtimeLatencySpike ? 0.84 : 0.78;
    }
    if (recommendationType === 'reduce-exposure') {
      return Math.max(0.8, report.volatilityScore);
    }
    return 0.74;
  }

  private rationaleFor(
    recommendationType: TradingRecommendation['recommendationType'],
    report: TrinityMarketIntelligenceReport,
  ): string {
    if (recommendationType === 'reduce-exposure') {
      return 'Volatility protection recommended by market intelligence.';
    }
    if (recommendationType === 'rotate-pair') {
      return 'Spread deterioration detected by market intelligence.';
    }
    if (recommendationType === 'recommend-provider-block') {
      return 'Provider quality degraded by telemetry scoring.';
    }
    if (recommendationType === 'recommend-runtime-recovery') {
      return 'Runtime anomaly detected by telemetry ingestion.';
    }
    if (recommendationType === 'pause-strategy') {
      return 'Strategy performance degraded by telemetry analysis.';
    }
    return `Market intelligence recommended ${recommendationType} in ${report.regime} regime.`;
  }

  private marketRecommendations(
    intent: TrinityTradingIntent,
    analysis: TrinityMarketAnalysis,
    createdAt: string,
  ): TradingRecommendation[] {
    const recommendations: TradingRecommendation[] = [];
    if (analysis.volatility === 'high') {
      recommendations.push(this.recommend(intent, 'reduce-exposure', 0.8, 'High volatility detected.', createdAt));
      recommendations.push(this.recommend(intent, 'request-simulation', 0.76, 'Simulation requested before volatility response.', createdAt));
    }
    if (analysis.spread === 'wide' || analysis.liquidity === 'thin') {
      recommendations.push(this.recommend(intent, 'rotate-pair', 0.72, 'Spread or liquidity conditions are unfavorable.', createdAt));
    }
    if (analysis.providerHealth === 'degraded' || analysis.providerHealth === 'offline') {
      recommendations.push(this.recommend(intent, 'recommend-provider-block', 0.88, `Provider health is ${analysis.providerHealth}.`, createdAt));
    }
    return recommendations;
  }

  private recommend(
    intent: TrinityTradingIntent,
    recommendationType: TradingRecommendation['recommendationType'],
    confidence: number,
    rationale: string,
    createdAt: string,
  ): TradingRecommendation {
    return {
      id: `trinity-${recommendationType}-${intent.id}`,
      correlationId: intent.correlationId,
      tenantId: intent.tenantId,
      producedByAgent: 'trinity',
      context: intent.context,
      recommendationType,
      confidence,
      rationale,
      createdAt,
      requiresAcs: true,
      authorizedExecution: false,
    };
  }

  private async publishRecommendationEvents(intent: TrinityTradingIntent, recommendation: TradingRecommendation): Promise<void> {
    await this.publish(intent, 'TRINITY_RECOMMENDATION_CREATED', { recommendation });
    if (recommendation.recommendationType === 'pause-strategy' || recommendation.recommendationType === 'adjust-parameter') {
      await this.publish(intent, 'TRINITY_STRATEGY_DEGRADATION_DETECTED', { recommendationId: recommendation.id });
    }
    if (recommendation.recommendationType === 'recommend-runtime-recovery') {
      await this.publish(intent, 'TRINITY_RUNTIME_ANOMALY_DETECTED', { recommendationId: recommendation.id });
    }
    if (recommendation.recommendationType === 'request-backtest') {
      await this.publish(intent, 'TRINITY_BACKTEST_REQUESTED', { recommendationId: recommendation.id });
    }
    if (recommendation.recommendationType === 'request-simulation') {
      await this.publish(intent, 'TRINITY_SIMULATION_REQUESTED', { recommendationId: recommendation.id });
    }
  }

  private async publishIntelligenceEvents(
    intent: TrinityTradingIntent,
    report: TrinityMarketIntelligenceReport,
  ): Promise<void> {
    await this.publish(intent, 'MARKET_REGIME_CHANGED', { regime: report.regime, report });
    if (report.providerDegraded) {
      await this.publish(intent, 'PROVIDER_QUALITY_DEGRADED', { report });
    }
    if (report.strategyDegraded) {
      await this.publish(intent, 'STRATEGY_PERFORMANCE_DEGRADED', { report });
    }
    if (report.runtimeLatencySpike) {
      await this.publish(intent, 'RUNTIME_LATENCY_SPIKE_DETECTED', { report });
    }
    if (report.volatilitySpike) {
      await this.publish(intent, 'VOLATILITY_PROTECTION_RECOMMENDED', { report });
    }
  }

  private async publish(
    intent: TrinityTradingIntent,
    type: TradingEvent['type'],
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.eventBus?.publish({
      id: `${intent.id}:${type.toLowerCase()}:${Date.now()}`,
      type,
      occurredAt: new Date().toISOString(),
      correlationId: intent.correlationId,
      source: 'agent',
      daoId: intent.context.daoId,
      federationId: intent.context.federationId,
      userId: intent.context.userId,
      strategyId: intent.context.strategyId,
      strategyProductId: intent.context.strategyProductId,
      runtimeInstanceId: intent.context.runtimeInstanceId,
      payload: {
        ...payload,
        providerId: intent.context.providerId,
        agent: 'trinity',
        authorizedExecution: false,
      },
    });
  }
}
