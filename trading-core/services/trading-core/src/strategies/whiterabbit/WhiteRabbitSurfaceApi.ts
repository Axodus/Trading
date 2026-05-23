import type {
  TradingApiResponse,
  WhiteRabbitSurfaceResponse,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { WhiteRabbitSurfaceInput } from './WhiteRabbitProductSurfaceService.js';
import type { WhiteRabbitSurfaceActionRequest } from './WhiteRabbitActionRequestService.js';
import { WhiteRabbitActionRequestService } from './WhiteRabbitActionRequestService.js';
import { WhiteRabbitQueryService } from './WhiteRabbitQueryService.js';

export class WhiteRabbitSurfaceApi {
  constructor(
    private readonly queryService = new WhiteRabbitQueryService(),
    private readonly actionService?: WhiteRabbitActionRequestService,
  ) {}

  getSurface(input: WhiteRabbitSurfaceInput): TradingApiResponse<WhiteRabbitSurfaceResponse> {
    return {
      ok: true,
      correlationId: input.runtime?.id ?? input.profile.userId,
      data: this.queryService.query(input),
    };
  }

  async submitAction(request: WhiteRabbitSurfaceActionRequest): Promise<TradingApiResponse<{ submitted: true; action: WhiteRabbitSurfaceActionRequest['action'] }>> {
    if (!this.actionService) {
      return {
        ok: false,
        correlationId: request.correlationId,
        error: {
          code: 'WHITERABBIT_ACTION_SERVICE_UNAVAILABLE',
          message: 'WhiteRabbit action service is not configured.',
        },
      };
    }
    return this.actionService.submit(request);
  }
}
