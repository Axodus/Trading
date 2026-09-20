import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FixedDecimal,
  DEFAULT_EXECUTION_POLICY_V1,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import {
  ExecutionIntentTranslator,
  PostgresExecutionBoundaryRepository,
  ExecutionBoundaryService,
  DryRunExecutionAdapter,
  DEFAULT_DRY_RUN_CAPABILITIES,
  HummingbotDryRunAdapter,
  CondorDryRunAdapter,
  runExecutionAdapterConformanceTests,
  ExecutionIdempotencyConflictError,
  InMemoryPostgresClient,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function makeValidTradingIntent(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date('2026-09-20T10:00:00.000Z').toISOString();
  const expiresAt = new Date('2026-09-20T11:00:00.000Z').toISOString();

  return {
    intentId: 'intent-test-' + uniqueId,
    strategyId: 'strat-momentum-1',
    strategyRevisionId: 'strat-momentum-1:r7',
    marketStateId: 'ms-' + uniqueId,
    opportunityId: 'opp-' + uniqueId,
    proposalId: 'prop-' + uniqueId,
    portfolioDecisionId: 'port-' + uniqueId,
    riskDecisionId: 'risk-' + uniqueId,
    eligibilityId: 'elig-' + uniqueId,
    instrument: 'BTC-USDT',
    venue: 'binance',
    action: 'buy',
    approvedQuantity: '0.005000000000',
    approvedCapital: '100.000000000000',
    approvedLeverage: '2.000000000000',
    executionPolicyRef: 'RISK_POLICY_V1',
    correlationId: 'corr-' + uniqueId,
    idempotencyKey: 'idem-' + uniqueId,
    createdAt: now,
    expiresAt,
    evidenceRefs: ['ev-1', 'ev-2'],
    ...overrides,
  };
}

function makeTranslationCommand(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const tradingIntent = overrides.tradingIntent ?? makeValidTradingIntent();

  return {
    commandId: 'cmd-exec-' + uniqueId,
    tradingIntent,
    targetAdapterType: 'dry_run',
    adapterCapabilities: DEFAULT_DRY_RUN_CAPABILITIES,
    policy: DEFAULT_EXECUTION_POLICY_V1,
    evaluationTime: '2026-09-20T10:05:00.000Z',
    idempotencyKey: 'idem-exec-' + uniqueId,
    correlationId: 'corr-exec-' + uniqueId,
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / REQ-08 — ExecutionIntent & Execution Boundary', () => {
  it('1. Positive Translation: converts valid TradingIntent into canonical ExecutionIntent', () => {
    const cmd = makeTranslationCommand();
    const outcome = ExecutionIntentTranslator.translate(cmd);

    assert.equal(outcome.decision, 'AUTHORIZED');
    assert.equal(outcome.reasonCodes.length, 0);
    assert.ok(outcome.intent);
    assert.equal(outcome.intent.tradingIntentId, cmd.tradingIntent.intentId);
    assert.equal(outcome.intent.strategyId, cmd.tradingIntent.strategyId);
    assert.equal(outcome.intent.strategyRevisionId, cmd.tradingIntent.strategyRevisionId);
    assert.equal(outcome.intent.instrument, cmd.tradingIntent.instrument);
    assert.equal(outcome.intent.side, 'buy');
    assert.ok(FixedDecimal.from(outcome.intent.executionCapital).eq(cmd.tradingIntent.approvedCapital));
    assert.ok(FixedDecimal.from(outcome.intent.executionQuantity).eq(cmd.tradingIntent.approvedQuantity));
    assert.ok(FixedDecimal.from(outcome.intent.executionLeverage).eq(cmd.tradingIntent.approvedLeverage));
    assert.equal(outcome.intent.targetAdapterType, 'dry_run');
    assert.equal(outcome.intent.expiresAt, cmd.tradingIntent.expiresAt);
  });

  it('2. Quantity Step Alignment: floors quantity to provider step and scales capital monotonically', () => {
    const cmd = makeTranslationCommand({
      tradingIntent: makeValidTradingIntent({
        approvedQuantity: '1.234500000000',
        approvedCapital: '100.000000000000',
      }),
      adapterCapabilities: {
        ...DEFAULT_DRY_RUN_CAPABILITIES,
        quantityStep: '0.01',
      },
    });
    const outcome = ExecutionIntentTranslator.translate(cmd);

    assert.equal(outcome.decision, 'REDUCED');
    assert.ok(outcome.intent);
    assert.equal(outcome.intent.executionQuantity, '1.23');
    assert.ok(FixedDecimal.from(outcome.intent.executionQuantity).lte(FixedDecimal.from('1.2345')));
    assert.ok(FixedDecimal.from(outcome.intent.executionCapital).lte(FixedDecimal.from('100')));
  });

  it('3. Minimum Quantity Enforcement: rejects if aligned quantity is below provider minimum without expanding size', () => {
    const cmd = makeTranslationCommand({
      tradingIntent: makeValidTradingIntent({
        approvedQuantity: '0.000050000000',
        approvedCapital: '5.000000000000',
      }),
      adapterCapabilities: {
        ...DEFAULT_DRY_RUN_CAPABILITIES,
        minQuantity: '0.0001',
      },
    });
    const outcome = ExecutionIntentTranslator.translate(cmd);

    assert.equal(outcome.decision, 'REJECTED');
    assert.ok(outcome.reasonCodes.includes('BELOW_PROVIDER_MIN_QUANTITY'));
    assert.equal(outcome.intent, undefined);
  });

  it('4. Leverage Monotonicity: provider maximum capability caps leverage but never expands authorization', () => {
    // Case A: authorized 2, adapter max 50 -> execution leverage remains 2
    const cmdA = makeTranslationCommand({
      tradingIntent: makeValidTradingIntent({ approvedLeverage: '2' }),
      adapterCapabilities: { ...DEFAULT_DRY_RUN_CAPABILITIES, maxLeverage: '50' },
    });
    const outcomeA = ExecutionIntentTranslator.translate(cmdA);
    assert.equal(outcomeA.intent?.executionLeverage, '2');

    // Case B: authorized 10, adapter max 5 -> execution leverage reduced to 5
    const cmdB = makeTranslationCommand({
      tradingIntent: makeValidTradingIntent({ approvedLeverage: '10' }),
      adapterCapabilities: { ...DEFAULT_DRY_RUN_CAPABILITIES, maxLeverage: '5' },
    });
    const outcomeB = ExecutionIntentTranslator.translate(cmdB);
    assert.equal(outcomeB.decision, 'REDUCED');
    assert.equal(outcomeB.intent?.executionLeverage, '5');
  });

  it('5. Side Preservation: buy produces buy; reduce/close flags reduceOnly', () => {
    const cmdBuy = makeTranslationCommand({ tradingIntent: makeValidTradingIntent({ action: 'buy' }) });
    const outcomeBuy = ExecutionIntentTranslator.translate(cmdBuy);
    assert.equal(outcomeBuy.intent?.side, 'buy');
    assert.equal(outcomeBuy.intent?.constraints.reduceOnly, false);

    const cmdReduce = makeTranslationCommand({ tradingIntent: makeValidTradingIntent({ action: 'reduce' }) });
    const outcomeReduce = ExecutionIntentTranslator.translate(cmdReduce);
    assert.equal(outcomeReduce.intent?.side, 'sell');
    assert.equal(outcomeReduce.intent?.constraints.reduceOnly, true);
  });

  it('6. Venue Substitution Prohibited: adapter missing intent venue fails closed', () => {
    const cmd = makeTranslationCommand({
      tradingIntent: makeValidTradingIntent({ venue: 'kraken' }),
      adapterCapabilities: { ...DEFAULT_DRY_RUN_CAPABILITIES, supportedVenues: ['binance', 'bybit'] },
    });
    const outcome = ExecutionIntentTranslator.translate(cmd);
    assert.equal(outcome.decision, 'REJECTED');
    assert.ok(outcome.reasonCodes.includes('VENUE_SUBSTITUTION_PROHIBITED'));
  });

  it('7. Late Halt & Kill Switch: active halt blocks execution translation with top precedence', () => {
    const cmd = makeTranslationCommand({ killSwitchActive: true });
    const outcome = ExecutionIntentTranslator.translate(cmd);
    assert.equal(outcome.decision, 'REJECTED');
    assert.ok(outcome.reasonCodes.includes('EXECUTION_HALT_ACTIVE'));
  });

  it('8. Late Health / Lifecycle Invalidation: suspended or retired state fails closed', () => {
    const cmdSuspended = makeTranslationCommand({ operationalHealthState: 'SUSPENDED' });
    const outcomeSuspended = ExecutionIntentTranslator.translate(cmdSuspended);
    assert.equal(outcomeSuspended.decision, 'STALE');
    assert.ok(outcomeSuspended.reasonCodes.includes('STRATEGY_HEALTH_SUSPENDED'));

    const cmdRetired = makeTranslationCommand({ operationalLifecycleState: 'RETIRED' });
    const outcomeRetired = ExecutionIntentTranslator.translate(cmdRetired);
    assert.equal(outcomeRetired.decision, 'STALE');
    assert.ok(outcomeRetired.reasonCodes.includes('STRATEGY_RETIRED'));
  });

  it('9. Expiration: expired TradingIntent fails closed as STALE', () => {
    const cmd = makeTranslationCommand({
      tradingIntent: makeValidTradingIntent({ expiresAt: '2026-09-20T10:00:00.000Z' }),
      evaluationTime: '2026-09-20T10:05:00.000Z',
    });
    const outcome = ExecutionIntentTranslator.translate(cmd);
    assert.equal(outcome.decision, 'STALE');
    assert.ok(outcome.reasonCodes.includes('TRADING_INTENT_EXPIRED'));
  });

  it('10. Durable Idempotency: exact command replay returns existing ExecutionIntent', async () => {
    const client = new InMemoryPostgresClient();
    const repo = new PostgresExecutionBoundaryRepository(client);
    const service = new ExecutionBoundaryService(repo, client);

    const cmd = makeTranslationCommand();
    const result1 = await service.translateAndAuthorize(cmd);
    assert.equal(result1.decision, 'AUTHORIZED');
    assert.ok(result1.executionIntent);

    const result2 = await service.translateAndAuthorize(cmd);
    assert.equal(result2.decision, 'AUTHORIZED');
    assert.equal(result2.executionIntent?.executionIntentId, result1.executionIntent.executionIntentId);
    assert.equal(result2.translationId, result1.translationId);
  });

  it('11. Idempotency Conflict: altered command with same key throws ExecutionIdempotencyConflictError', async () => {
    const client = new InMemoryPostgresClient();
    const repo = new PostgresExecutionBoundaryRepository(client);
    const service = new ExecutionBoundaryService(repo, client);

    const cmd = makeTranslationCommand();
    await service.translateAndAuthorize(cmd);

    const conflictingCmd = {
      ...cmd,
      targetAdapterType: 'hummingbot_dry_run', // altered target adapter
    };

    await assert.rejects(
      async () => service.translateAndAuthorize(conflictingCmd),
      ExecutionIdempotencyConflictError,
    );
  });

  it('12. Single-Use TradingIntent Consumption: second command for same TradingIntent fails with CONFLICT', async () => {
    const client = new InMemoryPostgresClient();
    const repo = new PostgresExecutionBoundaryRepository(client);
    const service = new ExecutionBoundaryService(repo, client);

    const tradingIntent = makeValidTradingIntent();
    const cmd1 = makeTranslationCommand({ tradingIntent, idempotencyKey: 'key-1' });
    const res1 = await service.translateAndAuthorize(cmd1);
    assert.equal(res1.decision, 'AUTHORIZED');

    const cmd2 = makeTranslationCommand({ tradingIntent, idempotencyKey: 'key-2' });
    const res2 = await service.translateAndAuthorize(cmd2);
    assert.equal(res2.decision, 'CONFLICT');
    assert.ok(res2.reasonCodes.includes('TRADING_INTENT_ALREADY_CONSUMED'));
  });

  it('13. Dry-Run Adapter Execution: produces immutable ExecutionResult with mode=DRY_RUN', async () => {
    const client = new InMemoryPostgresClient();
    const repo = new PostgresExecutionBoundaryRepository(client);
    const service = new ExecutionBoundaryService(repo, client);

    const cmd = makeTranslationCommand();
    const translation = await service.translateAndAuthorize(cmd);
    assert.ok(translation.executionIntent);

    const adapter = new DryRunExecutionAdapter();
    const execResult = await service.executeDryRun(translation.executionIntent, adapter, {
      evaluationTime: '2026-09-20T10:05:00.000Z',
    });

    assert.equal(execResult.mode, 'DRY_RUN');
    assert.equal(execResult.status, 'DRY_RUN_ACCEPTED');
    assert.equal(execResult.executionIntentId, translation.executionIntent.executionIntentId);
    assert.equal(execResult.tradingIntentId, cmd.tradingIntent.intentId);
    assert.equal(execResult.acceptedQuantity, translation.executionIntent.executionQuantity);

    // Replay of dry run returns the stored result
    const replayedResult = await service.executeDryRun(translation.executionIntent, adapter);
    assert.equal(replayedResult.executionResultId, execResult.executionResultId);
  });

  it('14. Generic Adapter Conformance Suite: validates DryRun, Hummingbot and Condor adapters', async () => {
    await runExecutionAdapterConformanceTests(new DryRunExecutionAdapter());
    await runExecutionAdapterConformanceTests(new HummingbotDryRunAdapter());
    await runExecutionAdapterConformanceTests(new CondorDryRunAdapter());
  });

  it('15. Exact Arithmetic & Extreme Boundaries: zero floating-point drift on fractional boundaries', () => {
    const boundaries = ['0.000000000001', '0.1', '1.234567890123', '999999999.999999999999'];
    for (const val of boundaries) {
      const minCap = val === '0.000000000001' ? '0.000000000001' : '0.0001';
      const stepCap = val === '0.000000000001' ? '0.000000000001' : '0.0001';
      const cmd = makeTranslationCommand({
        tradingIntent: makeValidTradingIntent({
          approvedCapital: val,
          approvedQuantity: val,
        }),
        adapterCapabilities: {
          ...DEFAULT_DRY_RUN_CAPABILITIES,
          minQuantity: minCap,
          quantityStep: stepCap,
        },
      });
      const outcome = ExecutionIntentTranslator.translate(cmd);
      assert.ok(outcome.decision === 'AUTHORIZED' || outcome.decision === 'REDUCED');
      if (outcome.intent) {
        assert.ok(FixedDecimal.from(outcome.intent.executionCapital).lte(FixedDecimal.from(val)));
        assert.ok(FixedDecimal.from(outcome.intent.executionQuantity).lte(FixedDecimal.from(val)));
      }
    }
  });
});
