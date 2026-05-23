import type { TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';

export class StrategyDegradationAnalyzer {
  degraded(intent: TrinityTradingIntent): boolean {
    const degradationScore = intent.strategyPerformanceTelemetry?.degradationScore ?? intent.strategySnapshot?.degradationScore ?? 0;
    const drawdownPct = intent.strategyPerformanceTelemetry?.drawdownPct ?? intent.strategySnapshot?.drawdownPct ?? 0;
    const signalFailureRate = intent.strategyPerformanceTelemetry?.signalFailureRate ?? 0;
    return degradationScore >= 0.7 || drawdownPct >= 8 || signalFailureRate >= 0.35;
  }
}
