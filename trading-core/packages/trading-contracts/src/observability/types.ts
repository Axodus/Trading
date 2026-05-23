import type { OperationalHealthScore, RuntimeOperationalMetrics } from '../telemetry/types.js';

export interface ObservabilityQueryContext {
  tenantId: string;
  requestedBy: string;
  correlationId: string;
  executionDomain?: 'treasury' | 'user';
  userId?: string;
  daoId?: string;
  federationId?: string;
  runtimeInstanceId?: string;
  providerId?: string;
  strategyId?: string;
  strategyProductId?: string;
}

export interface RuntimeHealthReadModel {
  tenantId: string;
  runtimeInstanceId: string;
  providerId: string;
  strategyProductId?: string;
  health: OperationalHealthScore;
  metrics: RuntimeOperationalMetrics;
  advisoryOnly: true;
}

export interface ProviderHealthReadModel {
  tenantId: string;
  providerId: string;
  health: OperationalHealthScore;
  advisoryOnly: true;
}

export interface StrategyHealthReadModel {
  tenantId: string;
  strategyKey: string;
  health: OperationalHealthScore;
  advisoryOnly: true;
}

export interface OperationalTelemetrySnapshot {
  tenantId: string;
  runtimeHealth?: RuntimeHealthReadModel;
  providerHealth?: ProviderHealthReadModel;
  strategyHealth?: StrategyHealthReadModel;
  telemetryIngestionQuality?: OperationalHealthScore;
  executionLatency?: {
    averageLatencyMs: number;
    runtimeInstanceId?: string;
  };
  degraded: boolean;
  critical: boolean;
  advisoryOnly: true;
  generatedAt: string;
}
