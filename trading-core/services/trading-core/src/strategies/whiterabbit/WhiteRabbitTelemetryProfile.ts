import type { StrategyTelemetryProfile } from '../../../../../packages/trading-contracts/src/index.js';

export const whiteRabbitTelemetryProfile: StrategyTelemetryProfile = {
  strategyId: 'whiterabbit-v1',
  exposuresReported: true,
  drawdownReported: true,
  runtimeHealthReported: true,
};

export const whiteRabbitProductTelemetryProfile = {
  rankingEnabled: true,
  productMetrics: ['runtime-health', 'execution-count', 'fill-quality', 'drawdown'],
  tenantScoped: true,
} as const;
