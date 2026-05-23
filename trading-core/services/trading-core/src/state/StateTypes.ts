import type { BalanceSnapshot, ExecutionFill, PositionSnapshot, TradingEvent } from '../../../../packages/trading-contracts/src/index.js';

export type StateProviderStatus = 'healthy' | 'degraded' | 'offline' | 'suspended';

export type ExecutionStateStatus =
  | 'requested'
  | 'submitted'
  | 'filled'
  | 'cancelled'
  | 'failed';

export type RuntimeStateStatus =
  | 'requested'
  | 'provisioning'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'stopped'
  | 'degraded'
  | 'recovering'
  | 'failed'
  | 'terminated';

export interface StateMutationContext {
  correlationId: string;
  executionDomain?: 'treasury' | 'user';
  daoId?: string;
  federationId?: string;
  userId?: string;
  providerId?: string;
  strategyId?: string;
  strategyProductId?: string;
  runtimeInstanceId?: string;
}

export interface ExecutionState {
  correlationId: string;
  status: ExecutionStateStatus;
  updatedAt: string;
  requestId?: string;
  providerId?: string;
  providerOrderId?: string;
  market?: string;
  userId?: string;
  daoId?: string;
  runtimeInstanceId?: string;
  strategyId?: string;
  strategyProductId?: string;
  fills: ExecutionFill[];
  failureReason?: string;
}

export interface RuntimeState {
  runtimeInstanceId: string;
  status: RuntimeStateStatus;
  updatedAt: string;
  userId?: string;
  providerId?: string;
  strategyProductId?: string;
  strategyId?: string;
  suspensionReason?: string;
}

export interface ProviderState {
  providerId: string;
  status: StateProviderStatus;
  updatedAt: string;
  detail?: string;
}

export interface PositionState {
  ownerId: string;
  ownerType: 'treasury' | 'user';
  runtimeInstanceId?: string;
  providerId: string;
  snapshot: PositionSnapshot;
  updatedAt: string;
}

export interface PortfolioStateRecord {
  ownerId: string;
  ownerType: 'treasury' | 'user';
  runtimeInstanceId?: string;
  providerId: string;
  snapshot: BalanceSnapshot;
  updatedAt: string;
}

export interface TradingAuditRecord {
  id: string;
  correlationId: string;
  eventType: TradingEvent['type'];
  occurredAt: string;
  actor: TradingEvent['source'];
  executionDomain?: 'treasury' | 'user';
  userId?: string;
  daoId?: string;
  runtimeInstanceId?: string;
  providerId?: string;
  strategyId?: string;
  strategyProductId?: string;
  rejectionReason?: string;
  detail?: string;
}

export interface ExecutionTrace {
  correlationId: string;
  events: TradingEvent[];
  auditRecords: TradingAuditRecord[];
  startedAt?: string;
  lastUpdatedAt?: string;
  userId?: string;
  daoId?: string;
  runtimeInstanceId?: string;
  providerId?: string;
  strategyId?: string;
  strategyProductId?: string;
  rejectionReason?: string;
}
