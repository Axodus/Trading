import type {
  WhiteRabbitTelemetrySummary,
  WhiteRabbitTelemetryView,
} from '../../../../../packages/trading-contracts/src/index.js';

export class WhiteRabbitTelemetrySummaryService {
  summarize(telemetry: WhiteRabbitTelemetryView): WhiteRabbitTelemetrySummary {
    return {
      runtimeInstanceId: telemetry.runtimeInstanceId,
      executionCount: telemetry.executionCount,
      lastExecutionAt: telemetry.lastExecutionAt,
      health: telemetry.health,
      sensitiveFieldsExcluded: true,
    };
  }
}
