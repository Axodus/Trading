import type { ExecutionProviderType } from '../execution/types.js';

export type Address = string;
export type ExecutionDomain = 'treasury' | 'user';

export interface RuntimeQuota {
  maxActiveStrategies: number;
  maxConcurrentRuntimes: number;
  maxMonthlyExecutions?: number;
  maxProviderConnections?: number;
}

export interface ExecutionQuota {
  strategyId: string;
  maxOrdersPerDay?: number;
  maxNotionalPerDay?: string;
  maxConcurrentPositions?: number;
}

export interface ExecutionLimits {
  maxPositionSize?: string;
  maxLeverage?: string;
  maxDailyLoss?: string;
}

export interface TradingExecutionContext {
  executionDomain: ExecutionDomain;
  daoId?: string;
  federationId?: string;
  userId?: string;
  strategyProductId?: string;
  runtimeInstanceId?: string;
  providerId: string;
  strategyId?: string;
}

export interface UserRuntimeInstance {
  id: string;
  userId: string;
  strategyProductId: string;
  providerId: string;
  executionDomain: 'user';
  status: 'provisioning' | 'active' | 'paused' | 'stopped' | 'failed';
  createdAt: string;
  updatedAt: string;
}
