import type { RuntimeQuota } from '../../../../../packages/trading-contracts/src/index.js';

export const whiteRabbitRuntimePolicy: RuntimeQuota = {
  maxActiveStrategies: 1,
  maxConcurrentRuntimes: 1,
  maxDailyExecutions: 25,
  maxProviderConnections: 1,
};

export const whiteRabbitExecutionPolicy = {
  strategyId: 'whiterabbit-scalper-futures',
  maxOrdersPerDay: 25,
  maxConcurrentPositions: 2,
} as const;
