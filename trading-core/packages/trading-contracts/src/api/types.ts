import type { TradingExecutionContext } from '../runtime/types.js';
import type { TradingEvent, TradingEventType } from '../events/types.js';
import type { UserRuntimeInstance } from '../runtime/types.js';

export interface TradingApiRequest<TPayload = unknown> {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  context: TradingExecutionContext;
  payload?: TPayload;
}

export interface TradingApiResponse<TData = unknown> {
  ok: boolean;
  correlationId: string;
  data?: TData;
  error?: {
    code: string;
    message: string;
  };
}

export type TradingActionRequestType =
  | 'request-runtime-provisioning'
  | 'request-runtime-pause'
  | 'request-runtime-stop'
  | 'request-simulation'
  | 'request-backtest'
  | 'request-strategy-activation'
  | 'request-disclosure-acceptance';

export interface TradingActionRequest<TPayload = unknown> extends TradingApiRequest<TPayload> {
  actionType: TradingActionRequestType;
  reason?: string;
}

export interface TradingReadModel {
  context: TradingExecutionContext;
  runtime?: Pick<UserRuntimeInstance, 'id' | 'userId' | 'strategyProductId' | 'providerId' | 'executionDomain' | 'status' | 'createdAt' | 'updatedAt'>;
  providerStatus?: 'healthy' | 'degraded' | 'offline' | 'suspended' | 'unknown';
  entitlementState?: 'unknown' | 'active' | 'trial' | 'expired' | 'revoked' | 'missing';
  quotaState?: 'unknown' | 'available' | 'exhausted';
  strategyState?: 'unknown' | 'provisioned' | 'simulating' | 'paper-validating' | 'running' | 'paused' | 'degraded';
  runtimeLifecycle?: string;
  recommendationSummary?: {
    total: number;
    latestRecommendationType?: string;
  };
}

export interface TradingRuntimeSnapshot {
  runtime?: TradingReadModel['runtime'];
  telemetry?: {
    runtimeInstanceId: string;
    strategyProductId: string;
    executionCount: number;
    lastExecutionAt?: string;
  };
  recentEvents: Array<Pick<TradingEvent, 'id' | 'type' | 'occurredAt' | 'correlationId' | 'source'>>;
}

export interface TradingTelemetrySnapshot {
  context: TradingExecutionContext;
  totalEvents: number;
  eventCounts: Partial<Record<TradingEventType, number>>;
  latestEventAt?: string;
  recommendationCount: number;
  runtimeEventCount: number;
}
