import type { ExecutionIntent } from '../../../../../../packages/trading-contracts/src/index.js';
import type { ExecutionAdapter } from './ExecutionAdapter.js';

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, received ${actual}. ${message ?? ''}`);
  }
}

export function makeConformanceTestExecutionIntent(adapterType: string, overrides: Partial<ExecutionIntent> = {}): ExecutionIntent {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date('2026-09-20T10:00:00.000Z').toISOString();
  const expiresAt = new Date('2026-09-20T11:00:00.000Z').toISOString();

  return {
    executionIntentId: 'exec-intent-' + uniqueId,
    tradingIntentId: 'trade-intent-' + uniqueId,
    strategyId: 'strat-conformance-1',
    strategyRevisionId: 'strat-conformance-1:r7',
    instrument: 'BTC-USDT',
    marketType: 'perpetual',
    side: 'buy',
    authorizedCapital: '100',
    authorizedQuantity: '0.005',
    authorizedLeverage: '2',
    executionCapital: '100',
    executionQuantity: '0.005',
    executionLeverage: '2',
    venue: 'binance',
    targetAdapterType: adapterType,
    constraints: {
      orderType: 'limit',
      timeInForce: 'GTC',
      reduceOnly: false,
      positionMode: 'one-way',
    },
    tradingIntentDigest: 'digest-trading-' + uniqueId,
    authorizationContextDigest: 'digest-auth-' + uniqueId,
    executionPolicyRef: 'DEFAULT_EXECUTION_POLICY_V1',
    correlationId: 'corr-' + uniqueId,
    idempotencyKey: 'idem-' + uniqueId,
    createdAt: now,
    expiresAt,
    evidenceRefs: ['ev-1', 'ev-2'],
    ...overrides,
  };
}

export async function runExecutionAdapterConformanceTests(adapter: ExecutionAdapter): Promise<void> {
  const capabilities = adapter.getCapabilities();
  assertTrue(Boolean(capabilities.adapterType), 'Adapter must provide adapterType');
  assertTrue(capabilities.supportedVenues.length > 0, 'Adapter must support at least one venue');
  assertTrue(capabilities.supportedMarketTypes.length > 0, 'Adapter must support at least one market type');
  assertTrue(capabilities.supportedOrderTypes.length > 0, 'Adapter must support at least one order type');

  // Test 1: Successful Dry-Run Execution
  const intent = makeConformanceTestExecutionIntent(adapter.adapterType);
  const result = await adapter.executeDryRun(intent, { evaluationTime: '2026-09-20T10:05:00.000Z' });
  assertEqual(result.mode, 'DRY_RUN', 'Result mode must be DRY_RUN');
  assertEqual(result.status, 'DRY_RUN_ACCEPTED', 'Result status must be DRY_RUN_ACCEPTED');
  assertEqual(result.executionIntentId, intent.executionIntentId);
  assertEqual(result.tradingIntentId, intent.tradingIntentId);
  assertEqual(result.strategyId, intent.strategyId);
  assertEqual(result.strategyRevisionId, intent.strategyRevisionId);
  assertEqual(result.acceptedQuantity, intent.executionQuantity);

  // Test 2: Late Halt Protection
  const haltResult = await adapter.executeDryRun(intent, {
    evaluationTime: '2026-09-20T10:05:00.000Z',
    haltActive: true,
  });
  assertEqual(haltResult.status, 'REJECTED');
  assertTrue(haltResult.reasonCodes.includes('EXECUTION_HALT_ACTIVE'), 'Late HALT must fail closed');

  // Test 3: Late Suspended Health Invalidation
  const suspendedResult = await adapter.executeDryRun(intent, {
    evaluationTime: '2026-09-20T10:05:00.000Z',
    healthState: 'SUSPENDED',
  });
  assertEqual(suspendedResult.status, 'REJECTED');
  assertTrue(suspendedResult.reasonCodes.includes('STRATEGY_HEALTH_SUSPENDED'), 'Suspended health must fail closed');

  // Test 4: Expiration Failure
  const expiredResult = await adapter.executeDryRun(intent, {
    evaluationTime: '2026-09-20T11:05:00.000Z',
  });
  assertEqual(expiredResult.status, 'REJECTED');
  assertTrue(expiredResult.reasonCodes.includes('TRADING_INTENT_EXPIRED'), 'Expired intent must fail closed');
}
