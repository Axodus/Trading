import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PreExecutionAuthorizationService,
  PostgresPreExecutionAuthorizationRepository,
  InMemoryPostgresClient,
  PreExecutionAuthorizationValidator,
  PreExecutionIdempotencyConflictError,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function createTestContext() {
  const db = new InMemoryPostgresClient();
  const repo = new PostgresPreExecutionAuthorizationRepository(db);
  const service = new PreExecutionAuthorizationService(repo, db, { publishEvents: true });
  return { db, repo, service };
}

function makeValidCommand(overrides = {}) {
  const now = new Date('2026-09-20T10:00:00.000Z').toISOString();
  const expiresAt = new Date('2026-09-20T11:00:00.000Z').toISOString();

  return {
    commandId: 'cmd-val07d-01',
    proposal: {
      proposalId: 'prop-001',
      strategyId: 'strat-momentum-01',
      strategyRevisionId: 'strat-momentum-01:r7',
      strategyRevision: { strategy: 'strat-momentum-01', revision: 'r7', revisionId: 'strat-momentum-01:r7' },
      opportunity: {
        opportunityId: 'opp-001',
        marketStateId: 'ms-001',
        instrument: 'BTC-USDT',
        venue: 'binance',
        timeframe: '1m',
      },
      marketState: {
        marketStateId: 'ms-001',
        schemaVersion: '1.0.0',
        validityContext: 'live',
      },
      action: 'buy',
      sizing: {
        requestedQuantity: '0.005000000000',
        requestedCapital: '100.000000000000',
        leverage: '2.000000000000',
      },
      expectedReturn: {},
      expectedRisk: {},
      liquidityAssumptions: {},
      duration: {},
      costAssumptions: {},
      eligibility: {
        eligibilityId: 'elig-001',
        strategyRevisionId: 'strat-momentum-01:r7',
        decision: 'ELIGIBLE',
        policyVersion: '1.0.0',
      },
      correlationId: 'corr-001',
      idempotencyKey: 'idem-prop-001',
      createdAt: now,
      expiresAt,
      evidenceRefs: ['ev-quant-01'],
    },
    portfolioDecision: {
      portfolioDecisionId: 'pd-001',
      proposalIds: ['prop-001'],
      outcome: 'APPROVED',
      requestedCapital: '100.000000000000',
      approvedCapital: '80.000000000000',
      currentExposure: {},
      correlatedExposure: {},
      concentration: {},
      leverage: {},
      liquidity: {},
      duration: {},
      drawdown: {},
      executionCost: {},
      modifications: {},
      rationale: 'Portfolio approved 80 USDT',
      evidenceRefs: ['ev-port-01'],
      createdAt: now,
      expiresAt,
    },
    riskDecision: {
      riskDecisionId: 'rd-001',
      proposalId: 'prop-001',
      portfolioDecisionId: 'pd-001',
      marketStateId: 'ms-001',
      strategyRevisionId: 'strat-momentum-01:r7',
      outcome: 'ALLOW',
      policyVersion: 'risk-policy-v1',
      hardLimitEvaluation: {},
      killSwitch: { active: false },
      modifications: {},
      rationale: 'Risk allows execution',
      evidenceRefs: ['ev-risk-01'],
      decidedAt: now,
      expiresAt,
    },
    operationalSnapshot: {
      snapshotId: 'snap-001',
      strategyId: 'strat-momentum-01',
      strategyRevisionId: 'strat-momentum-01:r7',
      lifecycleState: 'PRODUCTION',
      lifecycleVersion: 12,
      healthState: 'HEALTHY',
      healthVersion: 8,
      compatibility: 'FULL',
      effectiveAt: now,
      expiresAt,
      snapshotVersion: '1.0.0',
    },
    evaluationTime: now,
    idempotencyKey: 'idem-cmd-001',
    correlationId: 'corr-001',
    actorType: 'system',
    actorId: 'risk-orchestrator',
    ...overrides,
  };
}

describe('REQ-07D: Canonical TradingIntent & Pre-Execution Authorization Boundary', () => {
  it('Fixture A: Canonical path produces TradingIntent on Risk ALLOW', async () => {
    const { service, db } = createTestContext();
    const cmd = makeValidCommand();

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'AUTHORIZED');
    assert.equal(result.reasonCodes.length, 0);
    assert.ok(result.intent);
    assert.equal(result.intent.strategyId, 'strat-momentum-01');
    assert.equal(result.intent.strategyRevisionId, 'strat-momentum-01:r7');
    assert.equal(result.intent.approvedCapital, '80');
    assert.equal(result.intent.approvedQuantity, '0.004');
    assert.equal(result.intent.action, 'buy');
    assert.equal(result.intent.instrument, 'BTC-USDT');
    assert.equal(result.intent.proposalId, 'prop-001');
    assert.equal(result.intent.portfolioDecisionId, 'pd-001');
    assert.equal(result.intent.riskDecisionId, 'rd-001');

    // Outbox event verification
    const storage = db.getStorage();
    const outbox = storage.trading_execution_outbox.filter((e) => e.event_type === 'TradingIntentCreated');
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].aggregate_id, result.intent.intentId);
  });

  it('Fixture B: Risk MODIFY reduces effective capital and proportionally scales quantity', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      riskDecision: {
        riskDecisionId: 'rd-modify-01',
        proposalId: 'prop-001',
        portfolioDecisionId: 'pd-001',
        marketStateId: 'ms-001',
        strategyRevisionId: 'strat-momentum-01:r7',
        outcome: 'MODIFY',
        policyVersion: 'risk-policy-v1',
        hardLimitEvaluation: {},
        killSwitch: { active: false },
        modifications: {
          effectiveCapital: '40.000000000000',
          effectiveLeverage: '1.500000000000',
        },
        rationale: 'Risk reduces capital to 40 USDT',
        evidenceRefs: ['ev-risk-mod'],
        decidedAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'AUTHORIZED');
    assert.ok(result.intent);
    assert.equal(result.intent.approvedCapital, '40');
    assert.equal(result.intent.approvedLeverage, '1.5');
    // Requested 0.005 qty for 100 capital -> for 40 capital = 0.005 * 40 / 100 = 0.002
    assert.equal(result.intent.approvedQuantity, '0.002');
  });

  it('Fixture C: Stale Health (HEALTHY -> SUSPENDED) invalidates authorization', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      operationalSnapshot: {
        snapshotId: 'snap-suspended',
        strategyId: 'strat-momentum-01',
        strategyRevisionId: 'strat-momentum-01:r7',
        lifecycleState: 'PRODUCTION',
        lifecycleVersion: 12,
        healthState: 'SUSPENDED',
        healthVersion: 9,
        compatibility: 'REJECTED',
        effectiveAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
        snapshotVersion: '1.0.0',
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('STRATEGY_HEALTH_SUSPENDED'));
    assert.equal(result.intent, undefined);
  });

  it('Fixture D: Stale Lifecycle (PRODUCTION -> RETIRED) invalidates authorization', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      operationalSnapshot: {
        snapshotId: 'snap-retired',
        strategyId: 'strat-momentum-01',
        strategyRevisionId: 'strat-momentum-01:r7',
        lifecycleState: 'RETIRED',
        lifecycleVersion: 13,
        healthState: 'HEALTHY',
        healthVersion: 8,
        compatibility: 'REJECTED',
        effectiveAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
        snapshotVersion: '1.0.0',
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('STRATEGY_RETIRED'));
    assert.equal(result.intent, undefined);
  });

  it('Fixture E: Revision Mismatch (r7 proposal vs r8 snapshot) fails closed', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      operationalSnapshot: {
        snapshotId: 'snap-r8',
        strategyId: 'strat-momentum-01',
        strategyRevisionId: 'strat-momentum-01:r8',
        lifecycleState: 'PRODUCTION',
        lifecycleVersion: 12,
        healthState: 'HEALTHY',
        healthVersion: 8,
        compatibility: 'FULL',
        effectiveAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
        snapshotVersion: '1.0.0',
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('STRATEGY_REVISION_MISMATCH'));
    assert.equal(result.intent, undefined);
  });

  it('Fixture F: Risk REJECT cannot produce intent', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      riskDecision: {
        riskDecisionId: 'rd-reject',
        proposalId: 'prop-001',
        portfolioDecisionId: 'pd-001',
        marketStateId: 'ms-001',
        strategyRevisionId: 'strat-momentum-01:r7',
        outcome: 'REJECT',
        policyVersion: 'risk-policy-v1',
        hardLimitEvaluation: {},
        killSwitch: { active: false },
        modifications: {},
        rationale: 'Risk limit breached',
        evidenceRefs: [],
        decidedAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('RISK_DECISION_REJECTED'));
    assert.equal(result.intent, undefined);
  });

  it('Fixture G: Risk HALT or active Kill Switch has absolute precedence', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      riskDecision: {
        riskDecisionId: 'rd-halt',
        proposalId: 'prop-001',
        portfolioDecisionId: 'pd-001',
        marketStateId: 'ms-001',
        strategyRevisionId: 'strat-momentum-01:r7',
        outcome: 'HALT',
        policyVersion: 'risk-policy-v1',
        hardLimitEvaluation: {},
        killSwitch: { active: true },
        modifications: {},
        rationale: 'Kill switch triggered',
        evidenceRefs: [],
        decidedAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('RISK_HALT_ACTIVE'));
    assert.equal(result.intent, undefined);
  });

  it('Fixture H: Agent cannot bypass upstream to create TradingIntent directly', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      actorType: 'agent',
      actorId: 'agent-rogue-01',
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('AGENT_UNAUTHORIZED_INTENT_CREATION'));
    assert.equal(result.intent, undefined);
  });

  it('Fixture I: Portfolio bypass (missing or unapproved proposal) fails closed', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      portfolioDecision: {
        portfolioDecisionId: 'pd-other',
        proposalIds: ['prop-some-other-id'],
        outcome: 'APPROVED',
        requestedCapital: '100.000000000000',
        approvedCapital: '100.000000000000',
        currentExposure: {},
        correlatedExposure: {},
        concentration: {},
        leverage: {},
        liquidity: {},
        duration: {},
        drawdown: {},
        executionCost: {},
        modifications: {},
        rationale: 'Other proposal approved',
        evidenceRefs: [],
        createdAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('PORTFOLIO_BYPASS'));
    assert.equal(result.intent, undefined);
  });

  it('Fixture J: Single-use RiskDecision consumption prevents duplicate intent creation', async () => {
    const { service } = createTestContext();
    const cmd1 = makeValidCommand({ commandId: 'cmd-001', idempotencyKey: 'idem-cmd-001' });
    const res1 = await service.authorize(cmd1);
    assert.equal(res1.decision, 'AUTHORIZED');

    // Second attempt using the SAME riskDecisionId but a different command/idempotency key
    const cmd2 = makeValidCommand({ commandId: 'cmd-002', idempotencyKey: 'idem-cmd-002' });
    const res2 = await service.authorize(cmd2);

    assert.equal(res2.decision, 'CONFLICT');
    assert.ok(res2.reasonCodes.includes('AUTHORIZATION_ALREADY_CONSUMED'));
    assert.equal(res2.intent, undefined);
  });

  it('Idempotent replay: exact same command returns the existing TradingIntent', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand();

    const res1 = await service.authorize(cmd);
    const res2 = await service.authorize(cmd);

    assert.equal(res1.decision, 'AUTHORIZED');
    assert.equal(res2.decision, 'AUTHORIZED');
    assert.equal(res1.intent.intentId, res2.intent.intentId);
    assert.equal(res1.authorizationId, res2.authorizationId);
  });

  it('Idempotency conflict: same key with different payload throws PreExecutionIdempotencyConflictError', async () => {
    const { service } = createTestContext();
    const cmd1 = makeValidCommand({ idempotencyKey: 'idem-shared' });
    await service.authorize(cmd1);

    const cmd2 = makeValidCommand({
      idempotencyKey: 'idem-shared',
      proposal: { ...cmd1.proposal, proposalId: 'prop-different' },
    });

    await assert.rejects(async () => {
      await service.authorize(cmd2);
    }, PreExecutionIdempotencyConflictError);
  });

  it('Monotonicity check: Risk increasing capital above Portfolio approved is rejected', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      portfolioDecision: {
        portfolioDecisionId: 'pd-001',
        proposalIds: ['prop-001'],
        outcome: 'APPROVED',
        requestedCapital: '100.000000000000',
        approvedCapital: '80.000000000000',
        currentExposure: {},
        correlatedExposure: {},
        concentration: {},
        leverage: {},
        liquidity: {},
        duration: {},
        drawdown: {},
        executionCost: {},
        modifications: {},
        rationale: '',
        evidenceRefs: [],
        createdAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
      },
      riskDecision: {
        riskDecisionId: 'rd-increase',
        proposalId: 'prop-001',
        portfolioDecisionId: 'pd-001',
        marketStateId: 'ms-001',
        strategyRevisionId: 'strat-momentum-01:r7',
        outcome: 'MODIFY',
        policyVersion: 'risk-policy-v1',
        hardLimitEvaluation: {},
        killSwitch: { active: false },
        modifications: {
          approvedCapital: '150.000000000000', // Higher than 80 and 100!
        },
        rationale: 'Attempted capital expansion',
        evidenceRefs: [],
        decidedAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('CAPITAL_MONOTONICITY_VIOLATION'));
    assert.equal(result.intent, undefined);
  });

  it('Monotonicity check: Risk increasing leverage above requested is rejected', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      riskDecision: {
        riskDecisionId: 'rd-lev-increase',
        proposalId: 'prop-001',
        portfolioDecisionId: 'pd-001',
        marketStateId: 'ms-001',
        strategyRevisionId: 'strat-momentum-01:r7',
        outcome: 'MODIFY',
        policyVersion: 'risk-policy-v1',
        hardLimitEvaluation: {},
        killSwitch: { active: false },
        modifications: {
          effectiveLeverage: '10.000000000000', // Requested was 2.0
        },
        rationale: 'Attempted leverage increase',
        evidenceRefs: [],
        decidedAt: new Date('2026-09-20T10:00:00.000Z').toISOString(),
        expiresAt: new Date('2026-09-20T11:00:00.000Z').toISOString(),
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('LEVERAGE_MONOTONICITY_VIOLATION'));
    assert.equal(result.intent, undefined);
  });

  it('Exact decimal boundary arithmetic: handles 12 decimal places without precision loss', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      proposal: {
        ...makeValidCommand().proposal,
        sizing: {
          requestedQuantity: '0.000000000001',
          requestedCapital: '999999999.999999999999',
          leverage: '1.000000000000',
        },
      },
      portfolioDecision: {
        ...makeValidCommand().portfolioDecision,
        approvedCapital: '999999999.999999999999',
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'AUTHORIZED');
    assert.equal(result.intent.approvedCapital, '999999999.999999999999');
    assert.equal(result.intent.approvedQuantity, '0.000000000001');
  });

  it('Expiration check: expired snapshot fails with OPERATIONAL_SNAPSHOT_EXPIRED / STALE', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      evaluationTime: '2026-09-20T12:00:00.000Z', // After snapshot expiresAt (11:00)
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'STALE');
    assert.ok(result.reasonCodes.includes('OPERATIONAL_SNAPSHOT_EXPIRED'));
    assert.equal(result.intent, undefined);
  });

  it('Expiration check: expired RiskDecision fails with RISK_DECISION_EXPIRED / STALE', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      riskDecision: {
        ...makeValidCommand().riskDecision,
        expiresAt: '2026-09-20T09:00:00.000Z', // In the past
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'STALE');
    assert.ok(result.reasonCodes.includes('RISK_DECISION_EXPIRED'));
    assert.equal(result.intent, undefined);
  });

  it('Expiration check: expired PortfolioDecision fails with PORTFOLIO_DECISION_EXPIRED / STALE', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      portfolioDecision: {
        ...makeValidCommand().portfolioDecision,
        expiresAt: '2026-09-20T09:00:00.000Z', // In the past
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'STALE');
    assert.ok(result.reasonCodes.includes('PORTFOLIO_DECISION_EXPIRED'));
    assert.equal(result.intent, undefined);
  });

  it('Expiration check: stale MarketState fails with MARKET_STATE_EXPIRED / STALE', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      marketState: {
        marketStateId: 'ms-001',
        instrument: 'BTC-USDT',
        timeframe: '1m',
        marketTime: '2026-09-20T10:00:00.000Z',
        observedAt: '2026-09-20T10:00:00.000Z',
        constructedAt: '2026-09-20T10:00:00.000Z',
        validityContext: 'live',
        freshness: 'stale',
        schemaVersion: '1.0.0',
        features: [],
        sourceRefs: [],
        completeness: 'complete',
        validationRefs: [],
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'STALE');
    assert.ok(result.reasonCodes.includes('MARKET_STATE_EXPIRED'));
    assert.equal(result.intent, undefined);
  });

  it('Compatibility check: RISK_REDUCING_ONLY rejects buy actions', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      operationalSnapshot: {
        ...makeValidCommand().operationalSnapshot,
        compatibility: 'RISK_REDUCING_ONLY',
      },
      proposal: {
        ...makeValidCommand().proposal,
        action: 'buy',
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'REJECTED');
    assert.ok(result.reasonCodes.includes('OPERATIONAL_SNAPSHOT_INCOMPATIBLE'));
    assert.equal(result.intent, undefined);
  });

  it('Compatibility check: RISK_REDUCING_ONLY permits reduce and close actions', async () => {
    const { service } = createTestContext();
    const cmd = makeValidCommand({
      operationalSnapshot: {
        ...makeValidCommand().operationalSnapshot,
        compatibility: 'RISK_REDUCING_ONLY',
      },
      proposal: {
        ...makeValidCommand().proposal,
        action: 'reduce',
      },
    });

    const result = await service.authorize(cmd);

    assert.equal(result.decision, 'AUTHORIZED');
    assert.ok(result.intent);
    assert.equal(result.intent.action, 'reduce');
  });

  it('Persistence and restart safety: re-reading from database preserves full intent and authorization record', async () => {
    const { service, repo, db } = createTestContext();
    const cmd = makeValidCommand();

    const res = await service.authorize(cmd);
    assert.equal(res.decision, 'AUTHORIZED');

    // Simulate restart with new service instance sharing same db storage
    const newRepo = new PostgresPreExecutionAuthorizationRepository(db);
    const newService = new PreExecutionAuthorizationService(newRepo, db);

    const storedIntent = await newRepo.getTradingIntent(res.intent.intentId);
    assert.ok(storedIntent);
    assert.equal(storedIntent.intentId, res.intent.intentId);
    assert.equal(storedIntent.approvedCapital, '80');

    const replay = await newService.authorize(cmd);
    assert.equal(replay.decision, 'AUTHORIZED');
    assert.equal(replay.intent.intentId, res.intent.intentId);
  });
});
