import type {
  ObservabilityQueryContext,
  ObservabilityRiskDecision,
  OperationalTelemetrySnapshot,
} from '../../../../../packages/trading-contracts/src/index.js';
import { createLatencyRiskSignal, createObservabilityRiskSignal } from './ObservabilityRiskSignalFactory.js';
import { ObservabilityRiskAuditService } from './ObservabilityRiskAuditService.js';
import { ObservabilityRiskPolicy } from './ObservabilityRiskPolicy.js';
import { ProviderHealthRiskEvaluator } from './ProviderHealthRiskEvaluator.js';
import { RuntimeHealthRiskEvaluator } from './RuntimeHealthRiskEvaluator.js';
import { StrategyHealthRiskEvaluator } from './StrategyHealthRiskEvaluator.js';

export interface ObservabilityRiskDecisionServiceDependencies {
  policy?: ObservabilityRiskPolicy;
  providerHealth?: ProviderHealthRiskEvaluator;
  runtimeHealth?: RuntimeHealthRiskEvaluator;
  strategyHealth?: StrategyHealthRiskEvaluator;
  audit?: ObservabilityRiskAuditService;
}

export class ObservabilityRiskBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObservabilityRiskBoundaryError';
  }
}

export class ObservabilityRiskDecisionService {
  private readonly policy: ObservabilityRiskPolicy;
  private readonly providerHealth: ProviderHealthRiskEvaluator;
  private readonly runtimeHealth: RuntimeHealthRiskEvaluator;
  private readonly strategyHealth: StrategyHealthRiskEvaluator;
  private readonly audit: ObservabilityRiskAuditService;

  constructor(deps: ObservabilityRiskDecisionServiceDependencies = {}) {
    this.policy = deps.policy ?? new ObservabilityRiskPolicy();
    this.providerHealth = deps.providerHealth ?? new ProviderHealthRiskEvaluator();
    this.runtimeHealth = deps.runtimeHealth ?? new RuntimeHealthRiskEvaluator();
    this.strategyHealth = deps.strategyHealth ?? new StrategyHealthRiskEvaluator();
    this.audit = deps.audit ?? new ObservabilityRiskAuditService();
  }

  async evaluate(context: ObservabilityQueryContext, snapshot: OperationalTelemetrySnapshot): Promise<ObservabilityRiskDecision[]> {
    this.assertTenantScope(context, snapshot);
    const signals = [
      ...this.providerHealth.evaluate(context, snapshot.providerHealth),
      ...this.runtimeHealth.evaluate(context, snapshot.runtimeHealth),
      ...this.strategyHealth.evaluate(context, snapshot.strategyHealth),
      ...this.latencySignals(context, snapshot),
      ...this.telemetrySignals(context, snapshot),
    ];
    const decisions = signals.map((signal) => this.policy.decide(signal));
    return this.audit.record(context, decisions);
  }

  private latencySignals(context: ObservabilityQueryContext, snapshot: OperationalTelemetrySnapshot) {
    const latency = snapshot.executionLatency;
    if (!latency || latency.averageLatencyMs < 1000) {
      return [];
    }
    return [createLatencyRiskSignal(context, latency.averageLatencyMs)];
  }

  private telemetrySignals(context: ObservabilityQueryContext, snapshot: OperationalTelemetrySnapshot) {
    const telemetry = snapshot.telemetryIngestionQuality;
    if (!telemetry || (telemetry.state !== 'degraded' && telemetry.state !== 'critical')) {
      return [];
    }
    return [createObservabilityRiskSignal(context, 'telemetry-ingestion-degraded', 'telemetry-ingestion', telemetry, {
      providerId: context.providerId,
      runtimeInstanceId: context.runtimeInstanceId,
      strategyProductId: context.strategyProductId,
    })];
  }

  private assertTenantScope(context: ObservabilityQueryContext, snapshot: OperationalTelemetrySnapshot): void {
    const tenants = [
      snapshot.tenantId,
      snapshot.runtimeHealth?.tenantId,
      snapshot.providerHealth?.tenantId,
      snapshot.strategyHealth?.tenantId,
    ].filter(Boolean);
    if (tenants.some((tenantId) => tenantId !== context.tenantId)) {
      throw new ObservabilityRiskBoundaryError('Cross-tenant observability risk evaluation rejected.');
    }
  }
}
