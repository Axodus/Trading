import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import {
  NodePostgresClient,
  createNodePostgresEnvConfig,
  withTradingLocalDatabaseDefaults,
  PostgresPerformanceDriftRepository,
  PerformanceEvaluationAuthority,
  DriftDetectionAuthority,
  RevalidationRequestAuthority,
  PerformanceIdempotencyConflictError,
  RevalidationRequestConflictError,
  MigrationRunner,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import {
  FixedDecimal,
  DEFAULT_PERFORMANCE_COMPARISON_POLICY_V1,
  DEFAULT_DRIFT_POLICY_V1,
  DEFAULT_REVALIDATION_REQUEST_POLICY_V1,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

function loadMigrations() {
  const packageMigrationsDir = resolve(process.cwd(), 'migrations');
  const workspaceMigrationsDir = resolve(process.cwd(), 'trading-core/services/trading-core/migrations');
  const migrationsDir = existsSync(packageMigrationsDir) ? packageMigrationsDir : workspaceMigrationsDir;
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      id: name,
      sql: readFileSync(join(migrationsDir, name), 'utf8'),
    }));
}

function makeMockEnvelope(overrides = {}) {
  const uniqueId = globalThis.crypto.randomUUID().slice(0, 8);
  return {
    envelopeId: 'env-pg-' + uniqueId,
    strategyId: 'strat-momentum-pg-' + uniqueId,
    strategyRevisionId: 'strat-momentum-pg-' + uniqueId + ':r7',
    strategyEvidenceRefs: ['ev-quant-001'],
    experimentRefs: ['exp-wf-001'],
    datasetRefs: ['ds-binance-btc-001'],
    policyId: 'POLICY_PERF_V1',
    policyRevision: 'POLICY_PERF_V1_R1',
    environmentApplicability: ['TESTNET', 'SIMULATED'],
    evidenceStrength: 'VALIDATED',
    expectedMetrics: {
      expectedReturn: '150.000000000000',
      expectedSharpe: '2.100000000000',
      expectedMaxDrawdown: '5.000000000000',
      expectedSlippageBps: '5.000000000000',
      expectedFee: '1.000000000000',
      expectedFillRatio: '0.950000000000',
      expectedLatencyMs: 150,
      expectedRejectionRate: '0.000000000000',
    },
    createdAt: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    inputDigest: 'digest-env-pg-' + uniqueId,
    ...overrides,
  };
}

function makeMockDiagnostic(id, envelope, overrides = {}) {
  return {
    diagnosticsId: 'diag-pg-' + id + '-' + globalThis.crypto.randomUUID().slice(0, 8),
    executionResultId: 'res-pg-' + id,
    executionIntentId: 'intent-pg-' + id,
    canonicalOrderId: 'order-pg-' + id,
    strategyId: envelope.strategyId,
    strategyRevisionId: envelope.strategyRevisionId,
    venue: 'binance',
    instrument: 'BTC-USDT',
    environment: 'TESTNET',
    diagnosticsPolicyId: 'POLICY_DIAG_V1',
    diagnosticsPolicyRevision: 'POLICY_DIAG_V1_R1',
    filledQuantity: '1.000000000000',
    fillRatio: '1.000000000000',
    slippageBps: '5.000000000000',
    realizedExecutionPrice: '60000.000000000000',
    canonicalFees: '1.000000000000',
    accountingCurrency: 'USDT',
    latencies: {
      submissionMs: 50,
      ackMs: 40,
      completionMs: 140,
    },
    observationsCount: 3,
    duplicateObservationsCount: 0,
    outOfOrderObservationsCount: 0,
    reconciliationAttemptsCount: 1,
    ambiguousSubmissionOccurred: false,
    quality: 'COMPLETE',
    createdAt: new Date().toISOString(),
    asOf: new Date().toISOString(),
    inputDigest: 'digest-diag-pg-' + id + '-' + globalThis.crypto.randomUUID().slice(0, 8),
    ...overrides,
  };
}

function makeMockPnL(id, envelope, overrides = {}) {
  return {
    pnlAttributionId: 'pnl-pg-' + id + '-' + globalThis.crypto.randomUUID().slice(0, 8),
    strategyId: envelope.strategyId,
    strategyRevisionId: envelope.strategyRevisionId,
    executionIntentId: 'intent-pg-' + id,
    executionResultId: 'res-pg-' + id,
    canonicalOrderId: 'order-pg-' + id,
    venue: 'binance',
    instrument: 'BTC-USDT',
    environment: 'TESTNET',
    accountingCurrency: 'USDT',
    pnlPolicyId: 'POLICY_PNL_V1',
    pnlPolicyRevision: 'POLICY_PNL_V1_R1',
    realizedGrossPnl: '50.000000000000',
    canonicalFees: '1.000000000000',
    otherCanonicalCosts: '0.000000000000',
    realizedNetPnl: '49.000000000000',
    closedQuantity: '1.000000000000',
    quality: 'COMPLETE',
    createdAt: new Date().toISOString(),
    asOf: new Date().toISOString(),
    inputDigest: 'digest-pnl-pg-' + id + '-' + globalThis.crypto.randomUUID().slice(0, 8),
    ...overrides,
  };
}

describe('AXODUS-TRADING-EPIC-01 / VAL-11-PG — Real PostgreSQL Durable Performance Drift & Revalidation Acceptance', () => {
  let client;
  let repository;
  const evalAuth = new PerformanceEvaluationAuthority();
  const driftAuth = new DriftDetectionAuthority();
  const revalAuth = new RevalidationRequestAuthority();

  before(async () => {
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    const runner = new MigrationRunner(client);
    const migrations = loadMigrations();
    await runner.run({ environment: 'local', schemaName: 'public', migrations });
    repository = new PostgresPerformanceDriftRepository(client);
  });

  after(async () => {
    if (client) {
      await client.close();
    }
  });

  it('Gate 1: Migration 0010 applies cleanly and all 7 tables exist in PostgreSQL', async () => {
    const expectedTables = [
      'expected_performance_envelopes',
      'performance_evaluations',
      'performance_metric_deviations',
      'performance_drift_assessments',
      'performance_metric_assessments',
      'revalidation_requests',
      'revalidation_request_events',
    ];

    for (const table of expectedTables) {
      const res = await client.query(
        'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)',
        ['public', table]
      );
      assert.equal(res.rows[0].exists, true, 'Table ' + table + ' must exist in PostgreSQL');
    }
  });

  it('Gate 2: ExpectedPerformanceEnvelope persistence & exact column mapping round-trip in real PostgreSQL', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const loaded = await repository.getExpectedPerformanceEnvelope(envelope.envelopeId);
    assert.ok(loaded);
    assert.equal(loaded.envelopeId, envelope.envelopeId);
    assert.equal(loaded.strategyId, envelope.strategyId);
    assert.equal(loaded.strategyRevisionId, envelope.strategyRevisionId);
    assert.equal(loaded.evidenceStrength, envelope.evidenceStrength);
    assert.equal(loaded.expectedMetrics.expectedReturn, envelope.expectedMetrics.expectedReturn);
    assert.equal(loaded.inputDigest, envelope.inputDigest);
  });

  it('Gate 3: PerformanceEvaluation & metric deviations persistence & querying in real PostgreSQL', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const diags = [makeMockDiagnostic('1', envelope), makeMockDiagnostic('2', envelope), makeMockDiagnostic('3', envelope)];
    const pnls = [makeMockPnL('1', envelope), makeMockPnL('2', envelope), makeMockPnL('3', envelope)];

    const evaluation = evalAuth.evaluate(envelope, diags, pnls);
    await repository.savePerformanceEvaluation(evaluation);

    const loaded = await repository.getPerformanceEvaluation(evaluation.evaluationId);
    assert.ok(loaded);
    assert.equal(loaded.evaluationId, evaluation.evaluationId);
    assert.equal(loaded.strategyRevisionId, envelope.strategyRevisionId);
    assert.equal(loaded.sampleSize, 3);
    assert.equal(loaded.quality, 'COMPLETE');
    assert.ok(loaded.deviations.length > 0);
  });

  it('Gate 4: PerformanceDriftAssessment & metric assessments persistence with dimensions in real PostgreSQL', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const diags = [
      makeMockDiagnostic('1', envelope, { slippageBps: '35.000000000000' }),
      makeMockDiagnostic('2', envelope, { slippageBps: '35.000000000000' }),
      makeMockDiagnostic('3', envelope, { slippageBps: '35.000000000000' }),
    ];
    const pnls = [makeMockPnL('1', envelope), makeMockPnL('2', envelope), makeMockPnL('3', envelope)];

    const evaluation = evalAuth.evaluate(envelope, diags, pnls);
    await repository.savePerformanceEvaluation(evaluation);

    const assessment = driftAuth.assessDrift(evaluation);
    await repository.savePerformanceDriftAssessment(assessment);

    const loaded = await repository.getPerformanceDriftAssessment(assessment.assessmentId);
    assert.ok(loaded);
    assert.equal(loaded.assessmentId, assessment.assessmentId);
    assert.equal(loaded.classification, 'DEGRADED');
    assert.ok(loaded.driftDimensions.includes('EXECUTION'));
    assert.ok(loaded.metricAssessments.length > 0);
  });

  it('Gate 5: RevalidationRequest creation with transactional outbox event emission in real PostgreSQL', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const diags = [
      makeMockDiagnostic('1', envelope, { slippageBps: '35.000000000000' }),
      makeMockDiagnostic('2', envelope, { slippageBps: '35.000000000000' }),
      makeMockDiagnostic('3', envelope, { slippageBps: '35.000000000000' }),
    ];
    const pnls = [makeMockPnL('1', envelope), makeMockPnL('2', envelope), makeMockPnL('3', envelope)];

    const evaluation = evalAuth.evaluate(envelope, diags, pnls);
    await repository.savePerformanceEvaluation(evaluation);

    const priorState = {
      consecutiveDegradedWindows: 1,
      consecutiveNormalWindows: 0,
      previousClassification: 'DEGRADED',
      isTriggered: false,
    };
    const assessment = driftAuth.assessDrift(evaluation, {
      policy: { ...DEFAULT_DRIFT_POLICY_V1, persistenceWindowsRequired: 2 },
      priorPersistenceState: priorState,
    });
    assert.equal(assessment.classification, 'MATERIAL');
    await repository.savePerformanceDriftAssessment(assessment);

    const revalRequest = revalAuth.createRequest(assessment);
    assert.ok(revalRequest);

    const outboxEntry = {
      outboxId: 'outbox-reval-' + globalThis.crypto.randomUUID().slice(0, 8),
      aggregateId: revalRequest.revalidationRequestId,
      aggregateVersion: 1,
      eventType: 'RevalidationRequested',
      correlationId: revalRequest.triggerAssessmentId,
      payload: revalRequest,
      createdAt: new Date().toISOString(),
    };

    await repository.saveRevalidationRequest(revalRequest, outboxEntry);

    const loadedRequest = await repository.getRevalidationRequest(revalRequest.revalidationRequestId);
    assert.ok(loadedRequest);
    assert.equal(loadedRequest.status, 'REQUESTED');
    assert.equal(loadedRequest.triggerClassification, 'MATERIAL');

    const outboxRes = await client.query(
      'SELECT * FROM trading_execution_outbox WHERE outbox_id = $1 LIMIT 1',
      [outboxEntry.outboxId]
    );
    assert.equal(outboxRes.rows.length, 1);
    assert.equal(outboxRes.rows[0].event_type, 'RevalidationRequested');
  });

  it('Gate 6: Concurrency protection — two workers attempting active revalidation requests converge to 1 active in PostgreSQL', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const evaluation1 = evalAuth.evaluate(envelope, [
      makeMockDiagnostic('1', envelope, { slippageBps: '35.000000000000' }),
      makeMockDiagnostic('2', envelope, { slippageBps: '35.000000000000' }),
      makeMockDiagnostic('3', envelope, { slippageBps: '35.000000000000' }),
    ], [
      makeMockPnL('1', envelope),
      makeMockPnL('2', envelope),
      makeMockPnL('3', envelope),
    ]);
    await repository.savePerformanceEvaluation(evaluation1);

    const assessment1 = driftAuth.assessDrift(evaluation1, {
      priorPersistenceState: { consecutiveDegradedWindows: 1, consecutiveNormalWindows: 0, isTriggered: false },
      policy: { ...DEFAULT_DRIFT_POLICY_V1, persistenceWindowsRequired: 2 },
    });
    await repository.savePerformanceDriftAssessment(assessment1);

    // Worker 1 creates request from assessment1
    const request1 = revalAuth.createRequest(assessment1);
    await repository.saveRevalidationRequest(request1);

    // Worker 2 evaluates a separate drift assessment2 for the same strategy revision
    const evaluation2 = evalAuth.evaluate(envelope, [
      makeMockDiagnostic('4', envelope, { slippageBps: '40.000000000000' }),
      makeMockDiagnostic('5', envelope, { slippageBps: '40.000000000000' }),
      makeMockDiagnostic('6', envelope, { slippageBps: '40.000000000000' }),
    ], [
      makeMockPnL('4', envelope),
      makeMockPnL('5', envelope),
      makeMockPnL('6', envelope),
    ]);
    await repository.savePerformanceEvaluation(evaluation2);

    const assessment2 = driftAuth.assessDrift(evaluation2, {
      priorPersistenceState: { consecutiveDegradedWindows: 2, consecutiveNormalWindows: 0, isTriggered: false },
      policy: { ...DEFAULT_DRIFT_POLICY_V1, persistenceWindowsRequired: 2 },
    });
    await repository.savePerformanceDriftAssessment(assessment2);

    const request2 = revalAuth.createRequest(assessment2);

    // Worker 2 must be rejected with RevalidationRequestConflictError because request1 is still active
    await assert.rejects(
      async () => {
        await repository.saveRevalidationRequest(request2);
      },
      RevalidationRequestConflictError
    );

    // Exactly 1 active request exists
    const active = await repository.getActiveRevalidationRequest(envelope.strategyId, envelope.strategyRevisionId);
    assert.ok(active);
    assert.equal(active.revalidationRequestId, request1.revalidationRequestId);
  });

  it('Gate 7: Durable idempotent replay on identical digests returns existing records without duplicate insert', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const countRes = await client.query(
      'SELECT COUNT(*)::int as count FROM expected_performance_envelopes WHERE envelope_id = $1',
      [envelope.envelopeId]
    );
    assert.equal(countRes.rows[0].count, 1);
  });

  it('Gate 8: Idempotency conflict throws PerformanceIdempotencyConflictError on altered digest', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const conflictingEnvelope = {
      ...envelope,
      inputDigest: 'digest-altered-conflict-999',
    };

    await assert.rejects(
      async () => {
        await repository.saveExpectedPerformanceEnvelope(conflictingEnvelope);
      },
      PerformanceIdempotencyConflictError
    );
  });

  it('Gate 9: Disconnect + Reconnect — state survives across pool lifecycle in real PostgreSQL', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    await client.close();
    client = await NodePostgresClient.create(createNodePostgresEnvConfig(withTradingLocalDatabaseDefaults(process.env)));
    repository = new PostgresPerformanceDriftRepository(client);

    const loaded = await repository.getExpectedPerformanceEnvelope(envelope.envelopeId);
    assert.ok(loaded);
    assert.equal(loaded.envelopeId, envelope.envelopeId);
  });

  it('Gate 10: Process / Repository restart — new repository instance preserves replay & lookup in real PostgreSQL', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const restartedRepository = new PostgresPerformanceDriftRepository(client);
    const loaded = await restartedRepository.getExpectedPerformanceEnvelope(envelope.envelopeId);
    assert.ok(loaded);
    assert.equal(loaded.envelopeId, envelope.envelopeId);
  });

  it('Gate 11: Transaction rollback / failure injection leaves zero partial state in real PostgreSQL', async () => {
    const envelope = makeMockEnvelope();
    const brokenEvaluation = {
      evaluationId: 'eval-broken-' + globalThis.crypto.randomUUID().slice(0, 8),
      strategyId: envelope.strategyId,
      strategyRevisionId: envelope.strategyRevisionId,
      expectedEnvelopeId: 'non-existent-envelope-id-triggers-fk-error',
      comparisonPolicyId: 'POL_1',
      comparisonPolicyRevision: 'POL_1_R1',
      observationWindowStart: new Date().toISOString(),
      observationWindowEnd: new Date().toISOString(),
      feedbackSnapshotRefs: [],
      diagnosticsRefs: [],
      pnlAttributionRefs: [],
      expectedMetrics: {},
      observedMetrics: {
        tradeCount: 1,
        filledQuantity: '1.000000000000',
        realizedGrossPnl: '0.000000000000',
        realizedNetPnl: '0.000000000000',
        canonicalFees: '0.000000000000',
      },
      deviations: [],
      sampleSize: 1,
      quality: 'COMPLETE',
      createdAt: new Date().toISOString(),
      asOf: new Date().toISOString(),
      inputDigest: 'digest-broken-eval',
    };

    await assert.rejects(async () => {
      await repository.savePerformanceEvaluation(brokenEvaluation);
    });

    const checkRes = await client.query(
      'SELECT * FROM performance_evaluations WHERE evaluation_id = $1',
      [brokenEvaluation.evaluationId]
    );
    assert.equal(checkRes.rows.length, 0);
  });

  it('Gate 12: Status transition and event append-only audit trail (RevalidationStatusUpdatedTo_COMPLETED)', async () => {
    const envelope = makeMockEnvelope();
    await repository.saveExpectedPerformanceEnvelope(envelope);

    const evaluation = evalAuth.evaluate(envelope, [
      makeMockDiagnostic('1', envelope, { slippageBps: '35.000000000000' }),
      makeMockDiagnostic('2', envelope, { slippageBps: '35.000000000000' }),
      makeMockDiagnostic('3', envelope, { slippageBps: '35.000000000000' }),
    ], [
      makeMockPnL('1', envelope),
      makeMockPnL('2', envelope),
      makeMockPnL('3', envelope),
    ]);
    await repository.savePerformanceEvaluation(evaluation);

    const assessment = driftAuth.assessDrift(evaluation, {
      priorPersistenceState: { consecutiveDegradedWindows: 1, consecutiveNormalWindows: 0, isTriggered: false },
      policy: { ...DEFAULT_DRIFT_POLICY_V1, persistenceWindowsRequired: 2 },
    });
    await repository.savePerformanceDriftAssessment(assessment);

    const revalRequest = revalAuth.createRequest(assessment);
    await repository.saveRevalidationRequest(revalRequest);

    await repository.updateRevalidationRequestStatus(
      revalRequest.revalidationRequestId,
      'REQUESTED',
      'ACKNOWLEDGED',
      'Quant Lab acknowledged request'
    );

    await repository.updateRevalidationRequestStatus(
      revalRequest.revalidationRequestId,
      'ACKNOWLEDGED',
      'IN_PROGRESS',
      'Quant Lab running walk-forward revalidation'
    );

    await repository.updateRevalidationRequestStatus(
      revalRequest.revalidationRequestId,
      'IN_PROGRESS',
      'COMPLETED',
      'Quant Lab verified strategy robustness',
      'quant-evidence-rev-888'
    );

    const completed = await repository.getRevalidationRequest(revalRequest.revalidationRequestId);
    assert.ok(completed);
    assert.equal(completed.status, 'COMPLETED');
    assert.equal(completed.resultRef, 'quant-evidence-rev-888');

    const events = await client.query(
      'SELECT * FROM revalidation_request_events WHERE revalidation_request_id = $1 ORDER BY created_at ASC',
      [revalRequest.revalidationRequestId]
    );
    assert.equal(events.rows.length, 4);
    assert.equal(events.rows[3].to_status, 'COMPLETED');
  });
});
