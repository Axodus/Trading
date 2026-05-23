import type {
  ObservabilityQueryContext,
  OperationalTelemetrySnapshot,
  ProviderHealthReadModel,
  RuntimeHealthReadModel,
  StrategyHealthReadModel,
  TradingApiResponse,
} from '../../../../../packages/trading-contracts/src/index.js';
import { TenantObservabilityQueryService } from './TenantObservabilityQueryService.js';

export class TradingObservabilityApi {
  constructor(private readonly queries: TenantObservabilityQueryService) {}

  runtimeHealth(context: ObservabilityQueryContext): TradingApiResponse<RuntimeHealthReadModel | undefined> {
    return {
      ok: true,
      correlationId: context.correlationId,
      data: this.queries.runtimeHealth(context),
    };
  }

  providerHealth(context: ObservabilityQueryContext): TradingApiResponse<ProviderHealthReadModel | undefined> {
    return {
      ok: true,
      correlationId: context.correlationId,
      data: this.queries.providerHealth(context),
    };
  }

  strategyHealth(context: ObservabilityQueryContext): TradingApiResponse<StrategyHealthReadModel | undefined> {
    return {
      ok: true,
      correlationId: context.correlationId,
      data: this.queries.strategyHealth(context),
    };
  }

  snapshot(context: ObservabilityQueryContext): TradingApiResponse<OperationalTelemetrySnapshot> {
    return {
      ok: true,
      correlationId: context.correlationId,
      data: this.queries.snapshot(context),
    };
  }
}
