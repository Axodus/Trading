import type { TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';

export class RuntimeTelemetryIngestionService {
  latencySpike(intent: TrinityTradingIntent): boolean {
    return (intent.runtimeTelemetry?.latencyMs ?? 0) >= 1000;
  }

  anomaly(intent: TrinityTradingIntent): boolean {
    return this.latencySpike(intent)
      || (intent.runtimeTelemetry?.errorRate ?? 0) >= 0.1
      || intent.runtimeTelemetry?.staleExecutionState === true
      || intent.runtimeSnapshot?.staleExecutionState === true
      || intent.runtimeSnapshot?.health === 'degraded'
      || intent.runtimeSnapshot?.health === 'offline';
  }
}
