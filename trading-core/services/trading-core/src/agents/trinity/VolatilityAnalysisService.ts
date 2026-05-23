import type { TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';

export class VolatilityAnalysisService {
  score(intent: TrinityTradingIntent): number {
    if (typeof intent.marketSnapshot?.volatility === 'number') {
      return intent.marketSnapshot.volatility;
    }
    const candles = intent.marketCandles ?? [];
    if (candles.length < 2) {
      return 0.2;
    }
    const returns = candles.slice(1).map((candle, index) => {
      const previous = candles[index].close || 1;
      return Math.abs((candle.close - previous) / previous);
    });
    return Math.min(1, returns.reduce((sum, value) => sum + value, 0) / returns.length * 10);
  }

  isSpike(intent: TrinityTradingIntent): boolean {
    return this.score(intent) >= 0.75;
  }
}
