import type {
  PaperTradingSessionRequest,
  PaperTradingSessionState,
  WhiteRabbitPaperValidationRequest,
  WhiteRabbitPaperValidationPolicy,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { PaperTradingSessionService } from '../../runtime/paper/PaperTradingSessionService.js';
import { whiteRabbitPaperValidationPolicy } from './WhiteRabbitPaperValidationPolicy.js';

export class WhiteRabbitPaperSessionAdapter {
  constructor(
    private readonly sessions: PaperTradingSessionService,
    private readonly policy: WhiteRabbitPaperValidationPolicy = whiteRabbitPaperValidationPolicy,
  ) {}

  async start(request: WhiteRabbitPaperValidationRequest): Promise<PaperTradingSessionState> {
    if (!this.policy.allowedProviders.includes(request.connectorConfig.providerType)) {
      return {
        id: this.sessionId(request),
        correlationId: request.correlationId,
        tenantId: request.tenantId,
        context: { ...request.context },
        providerId: request.connectorConfig.providerId,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        failureReason: `WhiteRabbit paper validation provider is not allowed: ${request.connectorConfig.providerType}`,
      };
    }
    return this.sessions.requestSession(this.toPaperSessionRequest(request));
  }

  async ingestSignalOrder(sessionId: string, request: WhiteRabbitPaperValidationRequest, side: 'buy' | 'sell') {
    return this.sessions.ingestOrder(sessionId, {
      requestId: `${request.id}:paper-order`,
      providerId: request.connectorConfig.providerId,
      market: request.connectorConfig.market ?? request.candles.at(-1)?.market ?? 'UNKNOWN',
      side,
      orderType: 'market',
      quantity: this.policy.defaultPaperQuantity,
      clientOrderId: request.correlationId,
    });
  }

  toPaperSessionRequest(request: WhiteRabbitPaperValidationRequest): PaperTradingSessionRequest {
    return {
      id: this.sessionId(request),
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      requestedBy: request.requestedBy,
      context: {
        ...request.context,
        strategyId: 'whiterabbit-v1',
        strategyProductId: 'whiterabbit-scalper-futures',
        providerId: request.connectorConfig.providerId,
      },
      connectorConfig: {
        ...request.connectorConfig,
      },
      reason: 'WhiteRabbit paper validation',
    };
  }

  private sessionId(request: WhiteRabbitPaperValidationRequest): string {
    return `${request.id}:paper-session`;
  }
}

