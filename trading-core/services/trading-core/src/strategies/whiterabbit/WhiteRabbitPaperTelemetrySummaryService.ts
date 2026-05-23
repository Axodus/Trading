import type {
  ExecutionFill,
  WhiteRabbitRuntimeTelemetry,
  WhiteRabbitTelemetrySummary,
} from '../../../../../packages/trading-contracts/src/index.js';

export class WhiteRabbitPaperTelemetrySummaryService {
  summarize(input: {
    runtimeInstanceId?: string;
    fills: ExecutionFill[];
    telemetry?: WhiteRabbitRuntimeTelemetry;
  }): WhiteRabbitTelemetrySummary {
    return {
      runtimeInstanceId: input.runtimeInstanceId,
      executionCount: input.fills.length,
      signalCount: input.telemetry?.signalCount,
      lastExecutionAt: input.fills.at(-1)?.filledAt,
      health: this.health(input.telemetry),
      sensitiveFieldsExcluded: true,
    };
  }

  private health(telemetry?: WhiteRabbitRuntimeTelemetry): WhiteRabbitTelemetrySummary['health'] {
    if (!telemetry) {
      return 'unknown';
    }
    if (telemetry.health === 'degraded') {
      return 'degraded';
    }
    if (telemetry.health === 'paused') {
      return 'offline';
    }
    return 'healthy';
  }
}

