import type {
  TrinityMarketIntelligenceReport,
  TrinityTradingIntent,
} from '../../../../../packages/trading-contracts/src/index.js';
import { MarketRegimeDetector } from './MarketRegimeDetector.js';
import { ProviderQualityScoringService } from './ProviderQualityScoringService.js';
import { RuntimeTelemetryIngestionService } from './RuntimeTelemetryIngestionService.js';
import { SpreadAnalysisService } from './SpreadAnalysisService.js';
import { StrategyDegradationAnalyzer } from './StrategyDegradationAnalyzer.js';
import { VolatilityAnalysisService } from './VolatilityAnalysisService.js';

export class MarketIntelligenceService {
  constructor(
    private readonly regimeDetector = new MarketRegimeDetector(),
    private readonly volatility = new VolatilityAnalysisService(),
    private readonly spread = new SpreadAnalysisService(),
    private readonly providerQuality = new ProviderQualityScoringService(),
    private readonly strategyDegradation = new StrategyDegradationAnalyzer(),
    private readonly runtimeTelemetry = new RuntimeTelemetryIngestionService(),
  ) {}

  analyze(intent: TrinityTradingIntent): TrinityMarketIntelligenceReport {
    const volatilityScore = this.volatility.score(intent);
    const volatilitySpike = this.volatility.isSpike(intent);
    const spreadDeteriorated = this.spread.deteriorated(intent);
    const providerQualityScore = this.providerQuality.score(intent);
    const providerDegraded = this.providerQuality.degraded(intent);
    const strategyDegraded = this.strategyDegradation.degraded(intent);
    const runtimeLatencySpike = this.runtimeTelemetry.latencySpike(intent);
    const runtimeAnomaly = this.runtimeTelemetry.anomaly(intent);
    const recommendedProtections = new Set<TrinityMarketIntelligenceReport['recommendedProtections'][number]>();

    if (volatilitySpike) {
      recommendedProtections.add('reduce-exposure');
      recommendedProtections.add('request-simulation');
    }
    if (spreadDeteriorated) {
      recommendedProtections.add('rotate-pair');
    }
    if (providerDegraded) {
      recommendedProtections.add('recommend-provider-block');
    }
    if (strategyDegraded) {
      recommendedProtections.add('pause-strategy');
    }
    if (runtimeAnomaly) {
      recommendedProtections.add('recommend-runtime-recovery');
    }

    return {
      regime: this.regimeDetector.detect(intent),
      volatilityScore,
      volatilitySpike,
      spreadDeteriorated,
      providerQualityScore,
      providerDegraded,
      strategyDegraded,
      runtimeLatencySpike,
      runtimeAnomaly,
      recommendedProtections: [...recommendedProtections],
    };
  }
}
