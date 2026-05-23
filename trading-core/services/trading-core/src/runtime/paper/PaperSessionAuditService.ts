import type { PaperTradingSessionState, TradingEvent } from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';

export class PaperSessionAuditService {
  constructor(private readonly eventBus?: TradingEventBus) {}

  async publish(session: PaperTradingSessionState, type: TradingEvent['type'], reason?: string): Promise<void> {
    await this.eventBus?.publish({
      id: `${session.id}:${type.toLowerCase()}:${session.updatedAt}`,
      type,
      occurredAt: session.updatedAt,
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
        status: session.status,
        reason,
        paper: true,
        liveTrading: false,
      },
    });
  }
}
