import type {
  WhiteRabbitRuntimeSignal,
  WhiteRabbitRuntimeTelemetry,
  WhiteRabbitStrategyState,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';

export class WhiteRabbitRuntimeTelemetryService {
  private readonly telemetry = new Map<string, WhiteRabbitRuntimeTelemetry>();

  constructor(private readonly eventBus?: TradingEventBus) {}

  async recordSignal(state: WhiteRabbitStrategyState, signal: WhiteRabbitRuntimeSignal): Promise<WhiteRabbitRuntimeTelemetry> {
    const previous = this.telemetry.get(state.runtimeInstanceId);
    const telemetry: WhiteRabbitRuntimeTelemetry = {
      runtimeInstanceId: state.runtimeInstanceId,
      userId: state.context.userId,
      daoId: state.context.daoId,
      strategyProductId: state.context.strategyProductId ?? 'whiterabbit-scalper-futures',
      signalCount: (previous?.signalCount ?? 0) + 1,
      lastSignalAction: signal.action,
      health: state.status === 'degraded' ? 'degraded' : state.status === 'paused' ? 'paused' : 'healthy',
      updatedAt: signal.generatedAt,
    };
    this.telemetry.set(state.runtimeInstanceId, telemetry);
    await this.eventBus?.publish({
      id: `${signal.id}:event`,
      type: 'WHITERABBIT_SIGNAL_CREATED',
      occurredAt: signal.generatedAt,
      correlationId: signal.id,
      source: 'core',
      daoId: state.context.daoId,
      userId: state.context.userId,
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: state.runtimeInstanceId,
      payload: { signal, telemetry },
    });
    return { ...telemetry };
  }

  get(runtimeInstanceId: string): WhiteRabbitRuntimeTelemetry | undefined {
    const telemetry = this.telemetry.get(runtimeInstanceId);
    return telemetry ? { ...telemetry } : undefined;
  }
}
