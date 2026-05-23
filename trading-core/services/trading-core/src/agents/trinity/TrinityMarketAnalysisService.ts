import type { TrinityMarketAnalysis, TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';

export class TrinityMarketAnalysisService {
  analyze(intent: TrinityTradingIntent): TrinityMarketAnalysis {
    const volatilityValue = intent.marketSnapshot?.volatility ?? 0.25;
    const spreadBps = intent.marketSnapshot?.spreadBps ?? 8;
    const liquidityScore = intent.marketSnapshot?.liquidityScore ?? 0.8;
    const trendStrength = intent.marketSnapshot?.trendStrength ?? 0.3;
    const providerHealth = intent.providerSnapshot?.health ?? 'unknown';

    const volatility = volatilityValue >= 0.75 ? 'high' : volatilityValue >= 0.35 ? 'medium' : 'low';
    const spread = spreadBps >= 25 ? 'wide' : spreadBps >= 10 ? 'normal' : 'tight';
    const liquidity = liquidityScore < 0.35 ? 'thin' : liquidityScore < 0.7 ? 'normal' : 'deep';
    const regime = liquidity === 'thin'
      ? 'illiquid'
      : volatility === 'high'
        ? 'volatile'
        : trendStrength >= 0.7
          ? 'trending'
          : 'calm';

    return {
      regime,
      volatility,
      spread,
      liquidity,
      providerHealth,
    };
  }
}
