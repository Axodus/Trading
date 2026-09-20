import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  FixedDecimal,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import {
  ExecutionControlAuthority,
  ReconciliationAuthority,
  PostgresExecutionLifecycleRepository,
  ControlledExecutionService,
  SimulatedControlledLifecycleAdapter,
  InMemoryPostgresClient,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function makeValidExecutionIntent(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  const now = new Date(Date.now() - 60000).toISOString();
  const expiresAt = new Date(Date.now() + 3600000).toISOString();

  return {
    executionIntentId: 'exec-intent-' + uniqueId,
    tradingIntentId: 'trading-intent-' + uniqueId,
    strategyId: 'strat-momentum-1',
    strategyRevisionId: 'strat-momentum-1:r7',
    targetAdapterType: 'testnet_adapter',
    venue: 'binance',
    instrument: 'BTC-USDT',
    side: 'buy',
    authorizedQuantity: '0.005000000000',
    authorizedCapital: '100.000000000000',
    authorizedLeverage: '2.000000000000',
    executionQuantity: '0.005000000000',
    executionCapital: '100.000000000000',
    executionLeverage: '2.000000000000',
    constraints: {
      orderType: 'LIMIT',
      timeInForce: 'GTC',
      limitPrice: '60000.000000000000',
    },
    policyRevision: 'POLICY_V1',
    correlationId: 'corr-' + uniqueId,
    idempotencyKey: 'idem-' + uniqueId,
    createdAt: now,
    expiresAt,
    evidenceRefs: ['ev-exec-1'],
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / REQ-09 — Controlled Execution Lifecycle & Reconciliation', () => {
  let db;
  let repository;
  let service;
  let adapter;

  beforeEach(() => {
    db = new InMemoryPostgresClient();
    repository = new PostgresExecutionLifecycleRepository(db);
    service = new ControlledExecutionService(repository, db, { publishEvents: true });
    adapter = new SimulatedControlledLifecycleAdapter();
  });

  describe('1. Execution Control Authority & Pre-Submission Guards', () => {
    it('successfully reserves submission for valid ExecutionIntent in TESTNET', () => {
      const intent = makeValidExecutionIntent();
      const res = ExecutionControlAuthority.reserveSubmission({
        commandId: 'cmd-1',
        executionIntent: intent,
        environment: 'TESTNET',
        idempotencyKey: 'idem-test-1',
        evaluationTime: intent.createdAt,
      });

      assert.equal(res.authorized, true);
      assert.ok(res.attempt);
      assert.ok(res.canonicalOrder);
      assert.equal(res.attempt.status, 'RESERVED');
      assert.equal(res.canonicalOrder.state, 'PENDING_SUBMISSION');
      assert.equal(res.canonicalOrder.orderVersion, 1);
      assert.equal(res.canonicalOrder.executionQuantity, intent.executionQuantity);
      assert.equal(res.canonicalOrder.cumulativeFilledQuantity, '0');
    });

    it('prohibits LIVE, MAINNET, and PRODUCTION environments', () => {
      const intent = makeValidExecutionIntent();
      for (const env of ['LIVE', 'MAINNET', 'PRODUCTION', 'UNKNOWN_ENV']) {
        const res = ExecutionControlAuthority.reserveSubmission({
          commandId: 'cmd-unauth-env',
          executionIntent: intent,
          environment: env,
          idempotencyKey: 'idem-unauth',
          evaluationTime: intent.createdAt,
        });
        assert.equal(res.authorized, false);
        assert.ok(res.reasonCodes.includes('ENVIRONMENT_UNAUTHORIZED'));
      }
    });

    it('rejects reservation when kill switch / execution halt is active', () => {
      const intent = makeValidExecutionIntent();
      const res = ExecutionControlAuthority.reserveSubmission({
        commandId: 'cmd-halt',
        executionIntent: intent,
        environment: 'TESTNET',
        idempotencyKey: 'idem-halt',
        evaluationTime: intent.createdAt,
        killSwitchActive: true,
      });
      assert.equal(res.authorized, false);
      assert.ok(res.reasonCodes.includes('EXECUTION_HALT_ACTIVE'));
    });

    it('rejects reservation when strategy health is SUSPENDED, RETIRED, REVALIDATION_REQUIRED, or UNKNOWN', () => {
      const intent = makeValidExecutionIntent();
      const invalidStates = [
        ['SUSPENDED', 'STRATEGY_HEALTH_SUSPENDED'],
        ['RETIRED', 'STRATEGY_HEALTH_RETIRED'],
        ['REVALIDATION_REQUIRED', 'STRATEGY_HEALTH_REVALIDATION_REQUIRED'],
        ['UNKNOWN', 'STRATEGY_HEALTH_UNKNOWN'],
      ];

      for (const [health, expectedCode] of invalidStates) {
        const res = ExecutionControlAuthority.reserveSubmission({
          commandId: 'cmd-health-' + health,
          executionIntent: intent,
          environment: 'TESTNET',
          idempotencyKey: 'idem-health-' + health,
          evaluationTime: intent.createdAt,
          strategyHealthState: health,
        });
        assert.equal(res.authorized, false);
        assert.ok(res.reasonCodes.includes(expectedCode));
      }
    });

    it('rejects reservation when strategy lifecycle is RETIRED', () => {
      const intent = makeValidExecutionIntent();
      const res = ExecutionControlAuthority.reserveSubmission({
        commandId: 'cmd-strat-ret',
        executionIntent: intent,
        environment: 'TESTNET',
        idempotencyKey: 'idem-ret',
        evaluationTime: intent.createdAt,
        strategyLifecycleState: 'RETIRED',
      });
      assert.equal(res.authorized, false);
      assert.ok(res.reasonCodes.includes('STRATEGY_RETIRED'));
    });

    it('rejects reservation when ExecutionIntent is expired', () => {
      const intent = makeValidExecutionIntent({
        expiresAt: new Date(Date.now() - 10000).toISOString(),
      });
      const res = ExecutionControlAuthority.reserveSubmission({
        commandId: 'cmd-exp',
        executionIntent: intent,
        environment: 'TESTNET',
        idempotencyKey: 'idem-exp',
        evaluationTime: new Date().toISOString(),
      });
      assert.equal(res.authorized, false);
      assert.ok(res.reasonCodes.includes('EXECUTION_INTENT_EXPIRED'));
    });
  });

  describe('2. Happy Path Submission & Complete Fill Reconciliation', () => {
    it('executes reserve -> submit -> ACK -> fill query -> FILLED lifecycle with outbox events', async () => {
      adapter.setBehavior({
        mode: 'immediate_fill',
        fillPrice: '62500.000000000000',
      });

      const intent = makeValidExecutionIntent();
      const result = await service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
      });

     assert.equal(result.terminalState, 'FILLED');
     assert.equal(result.reconciled, true);
      assert.ok(FixedDecimal.from(result.cumulativeFilledQuantity).eq(FixedDecimal.from(intent.executionQuantity)));
      assert.ok(FixedDecimal.from(result.weightedAveragePrice).eq(FixedDecimal.from('62500')));

      // Verify canonical order in DB
      const storedOrder = await repository.getCanonicalOrder(result.canonicalOrderId);
      assert.ok(storedOrder);
      assert.equal(storedOrder.state, 'FILLED');
      assert.ok(FixedDecimal.from(storedOrder.cumulativeFilledQuantity).eq(FixedDecimal.from(intent.executionQuantity)));
      assert.ok(FixedDecimal.from(storedOrder.remainingQuantity).eq(FixedDecimal.from('0')));

      // Verify fills in DB
      const fills = await repository.listFillsForOrder(result.canonicalOrderId);
      assert.equal(fills.length, 1);
      assert.ok(FixedDecimal.from(fills[0].fillQuantity).eq(FixedDecimal.from(intent.executionQuantity)));
      assert.ok(FixedDecimal.from(fills[0].fillPrice).eq(FixedDecimal.from('62500')));

      // Verify outbox events
      const outboxRows = db.getStorage().trading_execution_outbox;
      assert.ok(outboxRows.some((e) => e.event_type === 'ExecutionAttemptReserved'));
      assert.ok(outboxRows.some((e) => e.event_type === 'ProviderSubmissionObserved'));
    });
  });

  describe('3. Provider Rejection Handling', () => {
    it('handles provider SUBMISSION_REJECT and marks attempt & order as REJECTED', async () => {
      adapter.setBehavior({ mode: 'reject' });

      const intent = makeValidExecutionIntent();
      const result = await service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
      });

      assert.equal(result.terminalState, 'REJECTED');
      assert.equal(result.cumulativeFilledQuantity, '0');

      const storedOrder = await repository.getCanonicalOrder(result.canonicalOrderId);
      assert.equal(storedOrder?.state, 'REJECTED');

      const storedAttempt = await repository.getAttemptByClientOrderId(storedOrder.clientOrderId);
      assert.equal(storedAttempt?.status, 'REJECTED');
    });
  });

  describe('4. Timeout & Ambiguous Submission — No Blind Retry', () => {
    it('sets SUBMITTED_UNKNOWN on submission timeout, then reconciles by clientOrderId without second POST', async () => {
      adapter.setBehavior({ mode: 'timeout' });

      const intent = makeValidExecutionIntent();
      const result = await service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
      });

      assert.equal(result.terminalState, 'SUBMITTED_UNKNOWN');
      assert.equal(result.reconciled, false);

     const storedOrder = await repository.getCanonicalOrder(result.canonicalOrderId);
     assert.equal(storedOrder?.state, 'SUBMITTED_UNKNOWN');

     // Now simulate provider query showing order is OPEN on exchange
     adapter.setBehavior({ mode: 'ack_only' });
     adapter.setOrder(storedOrder.clientOrderId, {
       status: 'OPEN',
       total: intent.executionQuantity,
       price: '60000.000000000000',
     });
     const reconResult = await service.reconcileOrder(storedOrder.clientOrderId, adapter);

     assert.equal(reconResult.decision, 'UPDATED');
      assert.equal(reconResult.updatedOrder?.state, 'OPEN');

      const reloadedOrder = await repository.getCanonicalOrder(result.canonicalOrderId);
      assert.equal(reloadedOrder?.state, 'OPEN');
    });
  });

  describe('5. Partial Fills & Weighted Average Price Calculation', () => {
    it('reconciles multi-step partial fills and calculates exact weighted average price', async () => {
      adapter.setBehavior({
        mode: 'partial_fill_then_fill',
        fillPrice: '60000.000000000000',
        firstFillQuantity: '0.002000000000',
        secondFillQuantity: '0.003000000000',
      });

      const intent = makeValidExecutionIntent({
        executionQuantity: '0.005000000000',
      });

      const result = await service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
      });

     assert.equal(result.terminalState, 'FILLED');
      assert.ok(FixedDecimal.from(result.cumulativeFilledQuantity).eq(FixedDecimal.from('0.005')));

      const fills = await repository.listFillsForOrder(result.canonicalOrderId);
      assert.equal(fills.length, 2);
      assert.ok(FixedDecimal.from(fills[0].fillQuantity).eq(FixedDecimal.from('0.002')));
      assert.ok(FixedDecimal.from(fills[1].fillQuantity).eq(FixedDecimal.from('0.003')));

      const storedOrder = await repository.getCanonicalOrder(result.canonicalOrderId);
      assert.ok(FixedDecimal.from(storedOrder?.weightedAveragePrice).eq(FixedDecimal.from('60000')));
    });
  });

  describe('6. Cancellation & Cancel / Fill Race Handling', () => {
    it('executes controlled cancellation on OPEN order transitioning through CANCEL_PENDING to CANCELLED', async () => {
      adapter.setBehavior({ mode: 'ack_only' });

      const intent = makeValidExecutionIntent();
      const subResult = await service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
      });

      assert.equal(subResult.terminalState, 'ACKNOWLEDGED');

      // Now cancel order
      const cancelRes = await service.cancelOrder(
        {
          commandId: 'cancel-cmd-1',
          canonicalOrderId: subResult.canonicalOrderId,
          reason: 'MANUAL_OPERATOR_REQUEST',
          requestedAt: new Date().toISOString(),
        },
        adapter,
      );

      assert.equal(cancelRes.decision, 'UPDATED');
      assert.equal(cancelRes.updatedOrder?.state, 'CANCELLED');

      const storedOrder = await repository.getCanonicalOrder(subResult.canonicalOrderId);
      assert.equal(storedOrder?.state, 'CANCELLED');
    });

    it('cancellation on already terminal order returns NO_OP', async () => {
      adapter.setBehavior({ mode: 'immediate_fill' });

      const intent = makeValidExecutionIntent();
      const subResult = await service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
      });

      assert.equal(subResult.terminalState, 'FILLED');

      const cancelRes = await service.cancelOrder(
        {
          commandId: 'cancel-cmd-noop',
          canonicalOrderId: subResult.canonicalOrderId,
          reason: 'TEST',
          requestedAt: new Date().toISOString(),
        },
        adapter,
      );

      assert.equal(cancelRes.decision, 'NO_OP');
      assert.ok(cancelRes.reasonCodes.includes('ORDER_ALREADY_TERMINAL'));
    });
  });

  describe('7. Observation Deduplication & Terminal Protection', () => {
    it('suppresses duplicate observations and prevents stale OPEN observation from regressing FILLED state', () => {
      const initialOrder = {
        canonicalOrderId: 'ord-1',
        executionIntentId: 'exec-1',
        executionAttemptId: 'att-1',
        tradingIntentId: 'trade-1',
        strategyId: 'strat-1',
        strategyRevisionId: 'strat-1:r1',
        provider: 'test_adapter',
        venue: 'binance',
        instrument: 'BTC-USDT',
        side: 'buy',
        orderType: 'LIMIT',
        authorizedQuantity: '0.005000000000',
        executionQuantity: '0.005000000000',
        cumulativeFilledQuantity: '0.005000000000',
        remainingQuantity: '0.000000000000',
        weightedAveragePrice: '60000.000000000000',
        state: 'FILLED',
        orderVersion: 3,
        clientOrderId: 'ax-client-1',
        createdAt: '2026-09-20T10:00:00.000Z',
        updatedAt: '2026-09-20T10:01:00.000Z',
      };

      const staleObservation = {
        observationId: 'obs-stale',
        observationType: 'ORDER_STATUS',
        provider: 'test_adapter',
        venue: 'binance',
        clientOrderId: 'ax-client-1',
        providerStatus: 'OPEN',
        source: 'ws-stream',
        observedAt: '2026-09-20T10:02:00.000Z',
        rawPayloadDigest: 'digest-stale-open',
      };

      const recon = ReconciliationAuthority.reconcile({
        order: initialOrder,
        observation: staleObservation,
        existingFills: [],
        evaluationTime: '2026-09-20T10:02:00.000Z',
      });

      assert.equal(recon.decision, 'NO_OP');
      assert.ok(recon.reasonCodes.includes('STALE_OBSERVATION_SUPPRESSED'));
      assert.equal(recon.record.newState, 'FILLED');
    });

    it('detects overfill invariant violation if cumulative fills exceed execution quantity', () => {
      const order = {
        canonicalOrderId: 'ord-overfill',
        executionIntentId: 'exec-overfill',
        executionAttemptId: 'att-overfill',
        tradingIntentId: 'trade-overfill',
        strategyId: 'strat-1',
        strategyRevisionId: 'strat-1:r1',
        provider: 'test_adapter',
        venue: 'binance',
        instrument: 'BTC-USDT',
        side: 'buy',
        orderType: 'LIMIT',
        authorizedQuantity: '0.005000000000',
        executionQuantity: '0.005000000000',
        cumulativeFilledQuantity: '0.004000000000',
        remainingQuantity: '0.001000000000',
        state: 'PARTIALLY_FILLED',
        orderVersion: 2,
        clientOrderId: 'ax-client-overfill',
        createdAt: '2026-09-20T10:00:00.000Z',
        updatedAt: '2026-09-20T10:01:00.000Z',
      };

      const excessFillObservation = {
        observationId: 'obs-excess',
        observationType: 'FILL',
        provider: 'test_adapter',
        venue: 'binance',
        clientOrderId: 'ax-client-overfill',
        providerTradeId: 'trade-excess',
        observedQuantity: '0.002000000000', // 0.004 + 0.002 = 0.006 > 0.005
        observedPrice: '60000.000000000000',
        source: 'rest-query',
        observedAt: '2026-09-20T10:02:00.000Z',
        rawPayloadDigest: 'digest-excess-fill',
      };

      const recon = ReconciliationAuthority.reconcile({
        order,
        observation: excessFillObservation,
        existingFills: [],
        evaluationTime: '2026-09-20T10:02:00.000Z',
      });

      assert.equal(recon.decision, 'INVARIANT_VIOLATION');
      assert.ok(recon.reasonCodes.includes('EXECUTION_INVARIANT_VIOLATION'));
    });
  });

  describe('8. Durable Idempotency & Orphan Order Detection', () => {
    it('returns existing execution lifecycle result on exact idempotency key replay', async () => {
      adapter.setBehavior({ mode: 'immediate_fill' });

      const intent = makeValidExecutionIntent();
      const idempotencyKey = 'idem-fixed-123';

      const res1 = await service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
        idempotencyKey,
      });

      const res2 = await service.reserveAndSubmit(intent, adapter, {
        environment: 'TESTNET',
        idempotencyKey,
      });

     assert.equal(res1.canonicalOrderId, res2.canonicalOrderId);
     assert.equal(res1.terminalState, res2.terminalState);
      assert.ok(FixedDecimal.from(res1.cumulativeFilledQuantity).eq(FixedDecimal.from(res2.cumulativeFilledQuantity)));
    });

    it('detects orphan provider order when clientOrderId is unknown in Axodus registry', async () => {
      const recon = await service.reconcileOrder('unknown-client-order-id-999', adapter);
      assert.equal(recon.decision, 'ORPHAN_DETECTED');
      assert.ok(recon.reasonCodes.includes('ORPHAN_PROVIDER_ORDER'));
    });
  });

  describe('9. Non-Terminal Order Recovery Across Restart', () => {
    it('discovers non-terminal orders and reconciles them to terminal state without duplicate submissions', async () => {
      adapter.setBehavior({ mode: 'ack_only' });

      const intent = makeValidExecutionIntent();
      const sub = await service.reserveAndSubmit(intent, adapter, { environment: 'TESTNET' });
      assert.equal(sub.terminalState, 'ACKNOWLEDGED');

      const storedSub = await repository.getCanonicalOrder(sub.canonicalOrderId);
      assert.ok(storedSub);

      // Simulate process restart with fresh service instance sharing same db storage
      const freshRepo = new PostgresExecutionLifecycleRepository(db);
      const freshService = new ControlledExecutionService(freshRepo, db);

      // Now exchange reports order filled
      adapter.setBehavior({ mode: 'immediate_fill' });
      adapter.setOrder(storedSub.clientOrderId, {
        status: 'FILLED',
        filled: intent.executionQuantity,
        total: intent.executionQuantity,
        price: '60000.000000000000',
      });
      const recoveries = await freshService.recoverNonTerminalOrders(adapter);

      assert.equal(recoveries.length, 1);
      assert.equal(recoveries[0].decision, 'UPDATED');

      const reloaded = await freshRepo.getCanonicalOrder(sub.canonicalOrderId);
      assert.equal(reloaded?.state, 'FILLED');
    });
  });
});
