import type {
  PaperRiskEvaluationInput,
  ReconciliationWorkerCandidate,
  TradingExecutionContext,
  TrinityTradingIntent,
  WhiteRabbitMarketCandle,
  WhiteRabbitPaperValidationRequest,
  WhiteRabbitRuntimeConfig,
} from '../../../../../../packages/trading-contracts/src/index.js';

export interface WhiteRabbitPaperScenarioFixtureOverrides {
  id?: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  runtimeInstanceId?: string;
  providerId?: string;
  includeReconciliationCandidate?: boolean;
}

export interface WhiteRabbitPaperScenarioFixtures {
  request: WhiteRabbitPaperValidationRequest;
  trinityIntent: TrinityTradingIntent;
  reconciliationCandidate?: ReconciliationWorkerCandidate;
  paperRiskDefaults: Omit<PaperRiskEvaluationInput, 'fills' | 'unresolvedReconciliationProposals'>;
}

export function createWhiteRabbitPaperScenarioFixtures(
  overrides: WhiteRabbitPaperScenarioFixtureOverrides = {},
): WhiteRabbitPaperScenarioFixtures {
  const correlationId = overrides.correlationId ?? 'corr-wr-paper-scenario-1';
  const userId = overrides.userId ?? 'alice';
  const tenantId = overrides.tenantId ?? userId;
  const runtimeInstanceId = overrides.runtimeInstanceId ?? 'runtime-wr-paper-scenario-1';
  const providerId = overrides.providerId ?? 'simulation';
  const context = whiteRabbitScenarioContext({
    userId,
    runtimeInstanceId,
    providerId,
  });
  const request: WhiteRabbitPaperValidationRequest = {
    id: overrides.id ?? 'wr-paper-scenario-1',
    correlationId,
    tenantId,
    requestedBy: 'acs',
    context,
    connectorConfig: {
      providerId,
      providerType: providerId === 'hummingbot' ? 'hummingbot' : 'simulation',
      mode: 'paper',
      connectorName: providerId === 'hummingbot' ? 'binance_paper_trade' : 'simulation-paper',
      market: 'BTC-USDT',
    },
    runtimeConfig: whiteRabbitScenarioRuntimeConfig(),
    candles: whiteRabbitScenarioCandles(),
  };

  return {
    request,
    trinityIntent: whiteRabbitScenarioTrinityIntent(correlationId, tenantId, context, request.candles),
    reconciliationCandidate: overrides.includeReconciliationCandidate === false
      ? undefined
      : whiteRabbitScenarioReconciliationCandidate(correlationId, tenantId, context),
    paperRiskDefaults: {
      correlationId,
      tenantId,
      executionDomain: 'user',
      userId,
      runtimeInstanceId,
      providerId,
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      expectedPrice: '100',
      averageLatencyMs: 120,
      runtimeHealth: { state: 'healthy' },
      providerHealth: { state: 'healthy' },
      strategyHealth: { state: 'healthy' },
      telemetryIngestionQuality: { state: 'healthy' },
    },
  };
}

export function whiteRabbitScenarioContext(overrides: Partial<TradingExecutionContext> = {}): TradingExecutionContext {
  return {
    executionDomain: 'user',
    userId: 'alice',
    strategyProductId: 'whiterabbit-scalper-futures',
    runtimeInstanceId: 'runtime-wr-paper-scenario-1',
    providerId: 'simulation',
    strategyId: 'whiterabbit-v1',
    ...overrides,
  };
}

export function whiteRabbitScenarioCandles(): WhiteRabbitMarketCandle[] {
  return [
    { market: 'BTC-USDT', open: 100, high: 101, low: 99, close: 100, volume: 100, pattern: 'momentum', closedAt: '2026-05-23T15:00:00.000Z' },
    { market: 'BTC-USDT', open: 100, high: 101, low: 99, close: 100, volume: 100, pattern: 'momentum', closedAt: '2026-05-23T15:01:00.000Z' },
    { market: 'BTC-USDT', open: 100, high: 101, low: 79, close: 80, volume: 150, pattern: 'momentum', closedAt: '2026-05-23T15:02:00.000Z' },
  ];
}

export function whiteRabbitScenarioRuntimeConfig(): WhiteRabbitRuntimeConfig {
  return {
    bollinger: { period: 3, standardDeviation: 1 },
    atr: { period: 3, adaptationRate: 0.5, volatilityFloor: 0.01 },
    rsi: { period: 3, buyBelow: 100, sellAbove: 101 },
    volumeFilter: { enabled: false, minimumRelativeVolume: 1 },
    candlestickFilter: { enabled: false, allowedPatterns: ['momentum'] },
  };
}

function whiteRabbitScenarioTrinityIntent(
  correlationId: string,
  tenantId: string,
  context: TradingExecutionContext,
  marketCandles: WhiteRabbitMarketCandle[],
): TrinityTradingIntent {
  return {
    id: 'trinity-wr-paper-scenario-1',
    correlationId,
    tenantId,
    context,
    marketCandles,
    marketSnapshot: {
      volatility: 0.82,
      spreadBps: 12,
      liquidityScore: 0.72,
      trendStrength: 0.61,
    },
    providerSnapshot: {
      health: 'healthy',
    },
    strategySnapshot: {
      degradationScore: 0.2,
      drawdownPct: 0.01,
    },
    runtimeSnapshot: {
      health: 'healthy',
      staleExecutionState: false,
    },
    runtimeTelemetry: {
      latencyMs: 120,
      errorRate: 0,
      staleExecutionState: false,
    },
    providerQualityTelemetry: {
      degradationScore: 0.1,
      slippageBps: 4,
      fillRate: 1,
      rejectionRate: 0,
    },
    strategyPerformanceTelemetry: {
      degradationScore: 0.2,
      drawdownPct: 0.01,
      signalFailureRate: 0,
    },
  };
}

function whiteRabbitScenarioReconciliationCandidate(
  correlationId: string,
  tenantId: string,
  context: TradingExecutionContext,
): ReconciliationWorkerCandidate {
  const now = '2026-05-23T15:10:00.000Z';
  return {
    id: 'wr-paper-scenario-reconciliation-candidate-1',
    tenantId,
    candidateType: 'provider-drift',
    discoveredAt: now,
    reason: 'WhiteRabbit paper validation operational scenario dry run',
    request: {
      context: {
        ...context,
        correlationId,
      },
      sovereignSnapshot: {
        providerStatus: {
          providerId: context.providerId,
          type: 'simulation',
          connected: true,
          mode: 'paper',
          health: 'healthy',
          checkedAt: '2026-05-23T15:00:00.000Z',
        },
        runtimes: [{
          runtimeInstanceId: context.runtimeInstanceId ?? '',
          status: 'active',
          updatedAt: '2026-05-23T15:00:00.000Z',
        }],
        capturedAt: '2026-05-23T15:00:00.000Z',
      },
      providerSnapshot: {
        providerStatus: {
          providerId: context.providerId,
          type: 'simulation',
          connected: false,
          mode: 'paper',
          health: 'offline',
          checkedAt: '2026-05-23T15:01:00.000Z',
        },
        runtimes: [],
        capturedAt: '2026-05-23T15:01:00.000Z',
      },
      now,
    },
  };
}

