import type {
  TradingApiRequest,
  TradingApiResponse,
  TradingRuntimeSnapshot,
} from '../../../../packages/trading-contracts/src/index.js';
import type { AcsTradingAccessService } from '../acs/AcsTradingAccessService.js';

export class TradingRuntimeInspectionApi {
  constructor(private readonly acs: AcsTradingAccessService) {}

  inspect(request: TradingApiRequest): TradingApiResponse<TradingRuntimeSnapshot> {
    const inspection = this.acs.inspectRuntime({
      id: request.id,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      requestedBy: request.requestedBy,
      context: request.context,
    });

    return {
      ok: true,
      correlationId: request.correlationId,
      data: {
        runtime: inspection.runtime ? {
          id: inspection.runtime.id,
          userId: inspection.runtime.userId,
          strategyProductId: inspection.runtime.strategyProductId,
          providerId: inspection.runtime.providerId,
          executionDomain: inspection.runtime.executionDomain,
          status: inspection.runtime.status,
          createdAt: inspection.runtime.createdAt,
          updatedAt: inspection.runtime.updatedAt,
        } : undefined,
        telemetry: inspection.telemetry ? {
          runtimeInstanceId: inspection.telemetry.runtimeInstanceId,
          strategyProductId: inspection.telemetry.strategyProductId,
          executionCount: inspection.telemetry.executionCount,
          lastExecutionAt: inspection.telemetry.lastExecutionAt,
        } : undefined,
        recentEvents: inspection.events.map((event) => ({
          id: event.id,
          type: event.type,
          occurredAt: event.occurredAt,
          correlationId: event.correlationId,
          source: event.source,
        })),
      },
    };
  }
}
