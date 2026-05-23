import type { ExecutionProvider, ExecutionRequest, ExecutionResult, PaperTradingSessionState, TradingEvent } from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';
import { PaperFillNormalizationService } from './PaperFillNormalizationService.js';

export class PaperOrderIngestionService {
  constructor(
    private readonly eventBus?: TradingEventBus,
    private readonly fills = new PaperFillNormalizationService(eventBus),
  ) {}

  async ingest(session: PaperTradingSessionState, provider: ExecutionProvider, request: ExecutionRequest): Promise<ExecutionResult> {
    const result = await provider.executeOrder({
      ...request,
      providerId: session.providerId,
      clientOrderId: request.clientOrderId ?? session.correlationId,
    });
    await this.eventBus?.publish(this.toOrderEvent(session, request, result));
    for (const fill of result.fills ?? []) {
      await this.fills.normalize(session, fill);
    }
    return result;
  }

  private toOrderEvent(session: PaperTradingSessionState, request: ExecutionRequest, result: ExecutionResult): TradingEvent {
    return {
      id: `${session.id}:paper-order:${request.requestId}`,
      type: 'PAPER_ORDER_INGESTED',
      occurredAt: result.submittedAt ?? new Date().toISOString(),
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
        request,
        result,
        paper: true,
        liveTrading: false,
      },
    };
  }
}
