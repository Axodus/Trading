import type { ExecutionFill, PaperTradingSessionState, TradingEvent } from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';

export class PaperFillNormalizationService {
  constructor(private readonly eventBus?: TradingEventBus) {}

  async normalize(session: PaperTradingSessionState, fill: ExecutionFill): Promise<ExecutionFill> {
    const normalized = { ...fill };
    await this.eventBus?.publish(this.toEvent(session, normalized));
    return normalized;
  }

  private toEvent(session: PaperTradingSessionState, fill: ExecutionFill): TradingEvent {
    return {
      id: `${session.id}:paper-fill:${fill.fillId}`,
      type: 'PAPER_FILL_NORMALIZED',
      occurredAt: fill.filledAt,
      correlationId: session.correlationId,
      source: 'core',
      daoId: session.context.daoId,
      federationId: session.context.federationId,
      userId: session.context.userId,
      strategyId: session.context.strategyId,
      strategyProductId: session.context.strategyProductId,
      runtimeInstanceId: session.context.runtimeInstanceId,
      payload: {
        sessionId: session.id,
        tenantId: session.tenantId,
        providerId: session.providerId,
        fill,
        paper: true,
        liveTrading: false,
      },
    };
  }
}
