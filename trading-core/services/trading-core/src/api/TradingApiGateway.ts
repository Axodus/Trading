import type {
  TradingActionRequest,
  TradingApiRequest,
  TradingApiResponse,
  TradingReadModel,
  TradingRuntimeSnapshot,
  TradingTelemetrySnapshot,
} from '../../../../packages/trading-contracts/src/index.js';
import { TradingActionRequestApi } from './TradingActionRequestApi.js';
import { TradingReadApi } from './TradingReadApi.js';
import { TradingRuntimeInspectionApi } from './TradingRuntimeInspectionApi.js';
import { TradingTelemetryApi } from './TradingTelemetryApi.js';

export interface TradingApiGatewayDependencies {
  readApi: TradingReadApi;
  actionRequestApi: TradingActionRequestApi;
  telemetryApi: TradingTelemetryApi;
  runtimeInspectionApi: TradingRuntimeInspectionApi;
}

export class TradingApiGateway {
  constructor(private readonly deps: TradingApiGatewayDependencies) {}

  read(request: TradingApiRequest): TradingApiResponse<TradingReadModel> {
    return {
      ok: true,
      correlationId: request.correlationId,
      data: this.deps.readApi.getReadModel(request.context),
    };
  }

  submitAction(request: TradingActionRequest): Promise<TradingApiResponse<{ submitted: true; actionType: TradingActionRequest['actionType'] }>> {
    return this.deps.actionRequestApi.submit(request);
  }

  telemetry(request: TradingApiRequest): TradingApiResponse<TradingTelemetrySnapshot> {
    return this.deps.telemetryApi.summarize(request);
  }

  inspectRuntime(request: TradingApiRequest): TradingApiResponse<TradingRuntimeSnapshot> {
    return this.deps.runtimeInspectionApi.inspect(request);
  }
}
