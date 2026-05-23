import type { TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';

export class SpreadAnalysisService {
  spreadBps(intent: TrinityTradingIntent): number {
    return intent.spreadMetrics?.currentSpreadBps ?? intent.marketSnapshot?.spreadBps ?? 5;
  }

  deteriorated(intent: TrinityTradingIntent): boolean {
    const current = this.spreadBps(intent);
    const average = intent.spreadMetrics?.averageSpreadBps ?? current;
    const deteriorationPct = intent.spreadMetrics?.deteriorationPct ?? (average > 0 ? ((current - average) / average) * 100 : 0);
    return current >= 25 || deteriorationPct >= 75;
  }
}
