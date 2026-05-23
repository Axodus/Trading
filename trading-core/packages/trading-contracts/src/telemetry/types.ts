export interface StrategyTelemetryProfile {
  strategyId: string;
  exposuresReported: boolean;
  drawdownReported: boolean;
  runtimeHealthReported: boolean;
}

export interface TenantExecutionMetrics {
  userId: string;
  runtimeInstanceId: string;
  strategyProductId: string;
  executionCount: number;
  lastExecutionAt?: string;
}

export type OperationalHealthState = 'healthy' | 'degraded' | 'critical' | 'suspended';

export interface OperationalHealthScore {
  state: OperationalHealthState;
  score: number;
  reasons: string[];
  measuredAt: string;
}

export interface ObservabilityContext {
  tenantId: string;
  correlationId: string;
  executionDomain: 'treasury' | 'user';
  userId?: string;
  daoId?: string;
  federationId?: string;
  runtimeInstanceId?: string;
  providerId: string;
  strategyId?: string;
  strategyProductId?: string;
}

export interface RuntimeOperationalMetrics {
  tenantId: string;
  runtimeInstanceId: string;
  providerId: string;
  strategyProductId?: string;
  uptimeMs: number;
  restartCount: number;
  recoveryCount: number;
  degradedPeriods: number;
  failedExecutions: number;
  averageLatencyMs: number;
  executionDriftFrequency: number;
  updatedAt: string;
}

export interface RuntimeTelemetrySample {
  context: ObservabilityContext & { runtimeInstanceId: string };
  status: OperationalHealthState;
  uptimeMs?: number;
  restartCount?: number;
  recoveryCount?: number;
  degradedPeriods?: number;
  failedExecutions?: number;
  averageLatencyMs?: number;
  executionDriftFrequency?: number;
  telemetryIngestionQuality?: number;
  measuredAt?: string;
}

export interface ProviderTelemetrySample {
  context: ObservabilityContext;
  status: OperationalHealthState;
  latencyMs?: number;
  slippageBps?: number;
  rejectionRate?: number;
  fillRate?: number;
  degradationScore?: number;
  measuredAt?: string;
}

export interface StrategyTelemetrySample {
  context: ObservabilityContext;
  degradationScore?: number;
  drawdownPct?: number;
  signalFailureRate?: number;
  failedExecutions?: number;
  telemetryIngestionQuality?: number;
  measuredAt?: string;
}

export interface ExecutionLatencySample {
  context: ObservabilityContext;
  latencyMs: number;
  thresholdMs?: number;
  measuredAt?: string;
}
