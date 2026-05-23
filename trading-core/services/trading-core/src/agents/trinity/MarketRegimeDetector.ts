import type { TrinityMarketAnalysis, TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';
import { SpreadAnalysisService } from './SpreadAnalysisService.js';
import { VolatilityAnalysisService } from './VolatilityAnalysisService.js';

export class MarketRegimeDetector {
  constructor(
    private readonly volatility = new VolatilityAnalysisService(),
    private readonly spread = new SpreadAnalysisService(),
  ) {}

  detect(intent: TrinityTradingIntent): TrinityMarketAnalysis['regime'] {
    const liquidity = intent.liquiditySnapshot?.liquidityScore ?? intent.marketSnapshot?.liquidityScore ?? 0.8;
    if (liquidity < 0.35 || this.spread.deteriorated(intent)) {
      return 'illiquid';
    }
    if (this.volatility.isSpike(intent)) {
      return 'volatile';
    }
    if ((intent.marketSnapshot?.trendStrength ?? 0) >= 0.7) {
      return 'trending';
    }
    return 'calm';
  }
}
