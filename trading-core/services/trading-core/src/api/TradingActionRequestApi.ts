import type {
  AcsRuntimeCommandType,
  TradingActionRequest,
  TradingApiResponse,
} from '../../../../packages/trading-contracts/src/index.js';
import type { AcsTradingAccessService } from '../acs/AcsTradingAccessService.js';

export class TradingActionRequestApi {
  constructor(private readonly acs: AcsTradingAccessService) {}

  async submit(request: TradingActionRequest): Promise<TradingApiResponse<{ submitted: true; actionType: TradingActionRequest['actionType'] }>> {
    await this.acs.executeCommand({
      id: request.id,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      requestedBy: request.requestedBy,
      commandType: this.toAcsCommand(request.actionType),
      context: request.context,
      reason: request.reason,
    });

    return {
      ok: true,
      correlationId: request.correlationId,
      data: {
        submitted: true,
        actionType: request.actionType,
      },
    };
  }

  private toAcsCommand(actionType: TradingActionRequest['actionType']): AcsRuntimeCommandType {
    const mapping: Record<TradingActionRequest['actionType'], AcsRuntimeCommandType> = {
      'request-runtime-provisioning': 'request-runtime-provisioning',
      'request-runtime-pause': 'pause-runtime',
      'request-runtime-stop': 'stop-runtime',
      'request-simulation': 'request-strategy-simulation',
      'request-backtest': 'request-strategy-backtest',
      'request-strategy-activation': 'request-strategy-activation',
      'request-disclosure-acceptance': 'request-disclosure-acceptance',
    };
    return mapping[actionType];
  }
}
