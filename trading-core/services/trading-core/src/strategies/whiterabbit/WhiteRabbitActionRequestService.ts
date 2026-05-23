import type {
  TradingActionRequest,
  TradingApiResponse,
  TradingExecutionContext,
  WhiteRabbitSurfaceResponse,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingActionRequestApi } from '../../api/TradingActionRequestApi.js';

export type WhiteRabbitSurfaceAction =
  | 'request-access'
  | 'request-provisioning'
  | 'request-runtime-pause'
  | 'request-runtime-stop'
  | 'request-simulation'
  | 'request-telemetry-export';

export interface WhiteRabbitSurfaceActionRequest {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  action: WhiteRabbitSurfaceAction;
  context: TradingExecutionContext;
  surface: WhiteRabbitSurfaceResponse;
  reason?: string;
}

export class WhiteRabbitActionRequestService {
  constructor(private readonly actionApi: TradingActionRequestApi) {}

  async submit(request: WhiteRabbitSurfaceActionRequest): Promise<TradingApiResponse<{ submitted: true; action: WhiteRabbitSurfaceAction }>> {
    const blocker = this.blocker(request);
    if (blocker) {
      return {
        ok: false,
        correlationId: request.correlationId,
        error: {
          code: 'WHITERABBIT_ACTION_BLOCKED',
          message: blocker,
        },
      };
    }

    await this.actionApi.submit(this.toTradingAction(request));
    return {
      ok: true,
      correlationId: request.correlationId,
      data: {
        submitted: true,
        action: request.action,
      },
    };
  }

  private blocker(request: WhiteRabbitSurfaceActionRequest): string | undefined {
    if (request.action !== 'request-access' && request.surface.access.accessStatus === 'blocked') {
      return 'WhiteRabbit action requires valid product entitlement.';
    }
    if (request.action === 'request-provisioning' && !request.surface.runtime.runtimeEnablement.canProvision) {
      return request.surface.runtime.runtimeEnablement.blockers[0] ?? 'WhiteRabbit runtime provisioning is not available.';
    }
    if (request.action === 'request-runtime-pause' && !request.surface.runtime.pauseAvailable) {
      return 'WhiteRabbit runtime pause is not available.';
    }
    if (request.action === 'request-runtime-stop' && !request.surface.runtime.stopAvailable) {
      return 'WhiteRabbit runtime stop is not available.';
    }
    return undefined;
  }

  private toTradingAction(request: WhiteRabbitSurfaceActionRequest): TradingActionRequest {
    return {
      id: request.id,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      requestedBy: request.requestedBy,
      context: request.context,
      actionType: this.toActionType(request.action),
      reason: request.reason,
      payload: {
        productId: 'whiterabbit-scalper-futures',
        runtimeInstanceId: request.context.runtimeInstanceId,
      },
    };
  }

  private toActionType(action: WhiteRabbitSurfaceAction): TradingActionRequest['actionType'] {
    const mapping: Record<WhiteRabbitSurfaceAction, TradingActionRequest['actionType']> = {
      'request-access': 'request-strategy-activation',
      'request-provisioning': 'request-runtime-provisioning',
      'request-runtime-pause': 'request-runtime-pause',
      'request-runtime-stop': 'request-runtime-stop',
      'request-simulation': 'request-simulation',
      'request-telemetry-export': 'request-simulation',
    };
    return mapping[action];
  }
}
