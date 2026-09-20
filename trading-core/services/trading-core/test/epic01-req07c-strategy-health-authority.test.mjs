import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_STRATEGY_HEALTH_POLICY,
  InMemoryPostgresClient,
  RiskAuthorityService,
  StrategyHealthAuthority,
  StrategyHealthIdempotencyError,
  StrategyHealthValidator,
  StrategyOperationalSnapshotService,
  lifecycleHealthCompatibility,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

const NOW = '2026-09-20T12:00:00.000Z';
const REVISION = 'swing-r7';
const STRATEGY = 'strategy-swing';

function command(overrides = {}) {
  return {
    commandId: 'health-command-1',
    strategyId: STRATEGY,
    strategyRevisionId: REVISION,
    expectedHealthVersion: 0,
    fromHealth: 'UNKNOWN',
    toHealth: 'HEALTHY',
    policyRevision: DEFAULT_STRATEGY_HEALTH_POLICY.policyRevision,
    evidenceRefs: ['evidence:validated:r7'],
    authorizationRefs: ['governance:health-recovery'],
    reasonCodes: ['VALIDATED_OPERATIONAL_CONTEXT'],
    evaluationTime: NOW,
    idempotencyKey: 'health-idempotency-1',
    actorType: 'system',
    actorId: 'health-authority',
    ...overrides,
  };
}

async function seedLifecycle(db, state = 'PRODUCTION', revision = REVISION, version = 1) {
  await db.query(
    'INSERT INTO strategy_lifecycle_heads (strategy_id, current_revision_id, current_state, lifecycle_version, updated_at) VALUES ($1, $2, $3, 0, $4)',
    [STRATEGY, revision, state, NOW],
  );
  const head = db.getStorage().strategy_lifecycle_heads.find((row) => row.strategy_id === STRATEGY);
  head.lifecycle_version = version;
}

function healthContext(snapshot, healthState = 'HEALTHY', policyOverrides = {}) {
  return {
    portfolioDecision: {
      portfolioDecisionId: 'portfolio-1',
      proposalIds: ['proposal-1'],
      outcome: 'APPROVED',
      requestedCapital: '100',
      approvedCapital: '100',
      currentExposure: {},
      correlatedExposure: {},
      concentration: {},
      leverage: {},
      liquidity: {},
      duration: {},
      drawdown: {},
      executionCost: {},
      modifications: {},
      rationale: 'fixture',
      evidenceRefs: [],
      createdAt: NOW,
      expiresAt: '2026-09-20T12:05:00.000Z',
    },
    proposal: {
      proposalId: 'proposal-1',
      strategyId: STRATEGY,
      strategyRevisionId: REVISION,
      strategyRevision: { strategy: { strategyId: STRATEGY, family: 'spot-swing', name: 'fixture', organizationId: 'axodus' }, revision: 7, revisionId: REVISION },
      opportunity: { opportunityId: 'opportunity-1', marketStateId: 'market-1', instrument: 'BTC-USDT', venue: 'venue', timeframe: '1m' },
      marketState: { marketStateId: 'market-1', schemaVersion: '1', validityContext: 'live' },
      action: 'buy',
      sizing: { requestedQuantity: '1', requestedCapital: '100', leverage: '1' },
      expectedReturn: {}, expectedRisk: {}, liquidityAssumptions: {}, duration: {}, costAssumptions: {},
      eligibility: { eligibilityId: 'eligibility-1', strategyRevisionId: REVISION, decision: 'ELIGIBLE', policyVersion: '1' },
      correlationId: 'correlation-1', idempotencyKey: 'proposal-key', createdAt: NOW, expiresAt: '2026-09-20T12:05:00.000Z', evidenceRefs: [],
    },
    strategyRevision: {
      strategy: { strategyId: STRATEGY, family: 'spot-swing', name: 'fixture', organizationId: 'axodus' },
      revision: 7, revisionId: REVISION, artifactRef: 'artifact', parameterSchemaRef: 'parameters',
      featureDefinitions: [], marketStateSchemaVersion: '1', lifecycleState: 'PRODUCTION', createdAt: NOW, createdBy: 'fixture',
    },
    policy: {
      policyVersion: 'risk-v1', policyRevision: 1, maxCapitalPerTrade: '1000', maxGrossExposureTotal: '1000',
      maxInstrumentGrossExposure: { 'BTC-USDT': '1000' }, defaultMaxInstrumentGrossExposure: '1000',
      maxStrategyGrossExposure: { [STRATEGY]: '1000' }, defaultMaxStrategyGrossExposure: '1000',
      maxLeverageCeiling: '2', maxMarketStateAgeMs: 10000, maxPortfolioDecisionAgeMs: 10000,
      ...policyOverrides,
    },
    exposureSnapshot: {
      snapshotId: 'exposure-1', asOf: NOW, validityContext: 'live', totalCapital: '1000',
      availableCapital: '900', reservedCapital: '0', positions: [], provenanceRef: 'snapshot',
    },
    strategyHealth: {
      strategyId: STRATEGY, strategyRevisionId: REVISION, state: healthState, observedAt: NOW,
      expectedEvidenceRefs: [], observedEvidenceRefs: [], divergenceRefs: [], rationale: 'fixture',
    },
    operationalSnapshot: snapshot,
    marketState: {
      marketStateId: 'market-1', instrument: 'BTC-USDT', venue: 'venue', timeframe: '1m',
      marketTime: NOW, observedAt: NOW, constructedAt: NOW, validityContext: 'live', freshness: 'current',
      schemaVersion: '1', features: [], sourceRefs: [], completeness: 'complete', validationRefs: [],
    },
    evaluationTime: '2026-09-20T12:00:01.000Z',
    correlationId: 'risk-correlation',
    environment: 'live',
  };
}

describe('REQ-07C Strategy Health Authority & Operational Snapshot', () => {
  it('initializes UNKNOWN explicitly and requires exact revision-specific recovery evidence', async () => {
    const db = new InMemoryPostgresClient();
    const authority = new StrategyHealthAuthority(db);
    const initial = await authority.initialize({ strategyId: STRATEGY, strategyRevisionId: REVISION, effectiveAt: NOW });
    assert.equal(initial.healthState, 'UNKNOWN');
    assert.equal(initial.healthVersion, 0);

    const rejected = await authority.transition(command({ authorizationRefs: [] }));
    assert.equal(rejected.decision, 'REJECTED');
    assert.ok(rejected.reasonCodes.includes('AUTHORIZATION_REQUIRED'));

    const accepted = await authority.transition(command({ idempotencyKey: 'accept-1' }));
    assert.equal(accepted.decision, 'ACCEPTED');
    assert.equal(accepted.newHealth, 'HEALTHY');
    assert.equal(accepted.newVersion, 1);

    await authority.initialize({ strategyId: STRATEGY, strategyRevisionId: 'swing-r8', effectiveAt: NOW });
    const r8 = await authority.getHealthHead(STRATEGY, 'swing-r8');
    assert.equal(r8.healthState, 'UNKNOWN');
  });

  it('enforces every frozen policy edge and representative forbidden transitions', () => {
    for (const rule of DEFAULT_STRATEGY_HEALTH_POLICY.allowedTransitions) {
      const result = StrategyHealthValidator.validate(command({
        fromHealth: rule.fromHealth,
        toHealth: rule.toHealth,
        evidenceRefs: rule.requiredEvidence ? ['evidence'] : [],
        authorizationRefs: rule.requiredAuthorization ? ['governance:approval'] : [],
      }), {
        strategyId: STRATEGY, strategyRevisionId: REVISION, state: rule.fromHealth, healthState: rule.fromHealth,
        healthVersion: 0, observedAt: NOW, effectiveAt: NOW, evaluationPolicyRevision: DEFAULT_STRATEGY_HEALTH_POLICY.policyRevision,
        reasonCodes: [], evidenceRefs: [], expectedEvidenceRefs: [], observedEvidenceRefs: [], divergenceRefs: [], rationale: 'fixture',
      }, DEFAULT_STRATEGY_HEALTH_POLICY);
      assert.equal(result.decision, 'ACCEPTED', `${rule.fromHealth} -> ${rule.toHealth}`);
    }
    for (const [fromHealth, toHealth] of [['RETIRED', 'HEALTHY'], ['HEALTHY', 'UNKNOWN'], ['SUSPENDED', 'DEGRADED']]) {
      const result = StrategyHealthValidator.validate(command({ fromHealth, toHealth }), {
        strategyId: STRATEGY, strategyRevisionId: REVISION, state: fromHealth, healthState: fromHealth,
        healthVersion: 0, observedAt: NOW, effectiveAt: NOW, evaluationPolicyRevision: DEFAULT_STRATEGY_HEALTH_POLICY.policyRevision,
        reasonCodes: [], evidenceRefs: [], expectedEvidenceRefs: [], observedEvidenceRefs: [], divergenceRefs: [], rationale: 'fixture',
      }, DEFAULT_STRATEGY_HEALTH_POLICY);
      assert.notEqual(result.decision, 'ACCEPTED');
    }
  });

  it('rejects agent and Quant direct mutation attempts without mutating lifecycle or capital', async () => {
    const db = new InMemoryPostgresClient();
    const authority = new StrategyHealthAuthority(db);
    await authority.initialize({ strategyId: STRATEGY, strategyRevisionId: REVISION, effectiveAt: NOW });
    await seedLifecycle(db);
    const beforeLifecycle = structuredClone(db.getStorage().strategy_lifecycle_heads);
    const agent = await authority.transition(command({ actorType: 'agent', actorId: 'agent-1', idempotencyKey: 'agent-bypass' }));
    const quant = await authority.transition(command({ actorType: 'quant', actorId: 'quant-1', idempotencyKey: 'quant-bypass' }));
    assert.ok(agent.reasonCodes.includes('AGENT_UNAUTHORIZED_MUTATION'));
    assert.ok(quant.reasonCodes.includes('QUANT_UNAUTHORIZED_MUTATION'));
    assert.deepEqual(db.getStorage().strategy_lifecycle_heads, beforeLifecycle);
    assert.equal(db.getStorage().trading_portfolios.length, 0);
  });

  it('uses CAS and durable idempotency across authority restart', async () => {
    const db = new InMemoryPostgresClient();
    const first = new StrategyHealthAuthority(db);
    await first.initialize({ strategyId: STRATEGY, strategyRevisionId: REVISION, effectiveAt: NOW });
    const accepted = await first.transition(command({ idempotencyKey: 'durable-key' }));
    const restarted = new StrategyHealthAuthority(db);
    const replay = await restarted.transition(command({ idempotencyKey: 'durable-key' }));
    assert.equal(replay.transitionId, accepted.transitionId);
    const conflict = await restarted.transition(command({ expectedHealthVersion: 0, idempotencyKey: 'stale-head', toHealth: 'DEGRADED' }));
    assert.equal(conflict.decision, 'CONFLICT');
    await assert.rejects(
      restarted.transition(command({ idempotencyKey: 'durable-key', reasonCodes: ['DIFFERENT_PAYLOAD'] })),
      StrategyHealthIdempotencyError,
    );
  });

  it('rolls back head, transition and outbox together when outbox persistence fails', async () => {
    const db = new InMemoryPostgresClient(undefined, (sql) =>
      sql.startsWith('insert into trading_execution_outbox') ? new Error('injected outbox failure') : undefined,
    );
    const authority = new StrategyHealthAuthority(db);
    await authority.initialize({ strategyId: STRATEGY, strategyRevisionId: REVISION, effectiveAt: NOW });
    await assert.rejects(authority.transition(command({ idempotencyKey: 'atomic-failure' })), /injected outbox failure/);
    const head = await authority.getHealthHead(STRATEGY, REVISION);
    assert.equal(head.healthState, 'UNKNOWN');
    assert.equal((await authority.getHistory(STRATEGY, REVISION)).length, 0);
    assert.equal(db.getStorage().trading_execution_outbox.length, 0);
  });

  it('implements the complete 6 x 12 lifecycle-health compatibility matrix without conflating it with RiskDecision', () => {
    const lifecycleStates = ['IDEA', 'RESEARCH', 'BACKTEST', 'ROBUSTNESS', 'PAPER', 'TESTNET', 'LIMITED_LIVE', 'PRODUCTION', 'MONITOR', 'REVALIDATION', 'DEMOTED', 'RETIRED'];
    const healthStates = ['UNKNOWN', 'HEALTHY', 'DEGRADED', 'REVALIDATION_REQUIRED', 'SUSPENDED', 'RETIRED'];
    let rows = 0;
    for (const lifecycle of lifecycleStates) {
      for (const health of healthStates) {
        const compatibility = lifecycleHealthCompatibility(lifecycle, health);
        rows += 1;
        if (['PAPER', 'TESTNET', 'LIMITED_LIVE', 'PRODUCTION'].includes(lifecycle) && health === 'HEALTHY') assert.equal(compatibility, 'FULL');
        else if (lifecycle === 'MONITOR' && health === 'HEALTHY') assert.equal(compatibility, 'RISK_REDUCING_ONLY');
        else if (['PAPER', 'TESTNET', 'LIMITED_LIVE', 'PRODUCTION', 'MONITOR'].includes(lifecycle) && health === 'DEGRADED') assert.equal(compatibility, 'CONDITIONAL');
        else assert.equal(compatibility, 'REJECTED');
      }
    }
    assert.equal(rows, 72);
  });

  it('issues immutable coherent snapshots with deterministic identity, expiry, and version-sensitive staleness', async () => {
    const db = new InMemoryPostgresClient();
    const authority = new StrategyHealthAuthority(db);
    await authority.initialize({ strategyId: STRATEGY, strategyRevisionId: REVISION, effectiveAt: NOW });
    await seedLifecycle(db);
    await authority.transition(command({ idempotencyKey: 'healthy-1' }));
    const snapshots = new StrategyOperationalSnapshotService(db);
    const one = await snapshots.issue({ strategyId: STRATEGY, strategyRevisionId: REVISION, evaluationTime: NOW, ttlMs: 1_000 });
    const same = await snapshots.issue({ strategyId: STRATEGY, strategyRevisionId: REVISION, evaluationTime: NOW, ttlMs: 1_000 });
    assert.equal(one.snapshotId, same.snapshotId);
    assert.equal(one.compatibility, 'FULL');
    assert.doesNotThrow(() => StrategyOperationalSnapshotService.validateFresh(one, '2026-09-20T12:00:00.999Z'));
    assert.throws(() => StrategyOperationalSnapshotService.validateFresh(one, '2026-09-20T12:00:01.000Z'));

    await authority.transition(command({
      expectedHealthVersion: 1, fromHealth: 'HEALTHY', toHealth: 'DEGRADED',
      idempotencyKey: 'degraded-2', evidenceRefs: ['evidence:adverse'], authorizationRefs: [],
    }));
    const changed = await snapshots.issue({ strategyId: STRATEGY, strategyRevisionId: REVISION, evaluationTime: NOW, ttlMs: 1_000 });
    assert.notEqual(changed.snapshotId, one.snapshotId);
    assert.equal(changed.healthVersion, 2);

    const lifecycleHead = db.getStorage().strategy_lifecycle_heads.find((row) => row.strategy_id === STRATEGY);
    lifecycleHead.current_state = 'TESTNET';
    lifecycleHead.lifecycle_version = 2;
    lifecycleHead.updated_at = '2026-09-20T12:00:00.500Z';
    const lifecycleChanged = await snapshots.issue({ strategyId: STRATEGY, strategyRevisionId: REVISION, evaluationTime: NOW, ttlMs: 1_000 });
    assert.notEqual(lifecycleChanged.snapshotId, changed.snapshotId);
    assert.equal(lifecycleChanged.lifecycleVersion, 2);
  });

  it('binds RiskDecision to the operational snapshot and detects health/lifecycle drift without allowing Risk HALT to mutate health', async () => {
    const db = new InMemoryPostgresClient();
    const authority = new StrategyHealthAuthority(db);
    await authority.initialize({ strategyId: STRATEGY, strategyRevisionId: REVISION, effectiveAt: NOW });
    await seedLifecycle(db);
    await authority.transition(command({ idempotencyKey: 'risk-healthy' }));
    const snapshots = new StrategyOperationalSnapshotService(db);
    const initial = await snapshots.issue({ strategyId: STRATEGY, strategyRevisionId: REVISION, evaluationTime: NOW, ttlMs: 60_000 });
    const risk = new RiskAuthorityService();
    const result = risk.evaluate(healthContext(initial));
    assert.equal(result.outcome, 'ALLOW');
    assert.equal(StrategyOperationalSnapshotService.riskDecisionIsCurrent(result.decision, initial, '2026-09-20T12:00:01.000Z'), true);

    await authority.transition(command({
      expectedHealthVersion: 1, fromHealth: 'HEALTHY', toHealth: 'SUSPENDED',
      idempotencyKey: 'risk-suspend', evidenceRefs: ['evidence:incident'], authorizationRefs: ['operator:emergency'],
    }));
    const stale = await snapshots.issue({ strategyId: STRATEGY, strategyRevisionId: REVISION, evaluationTime: NOW, ttlMs: 60_000 });
    assert.equal(StrategyOperationalSnapshotService.riskDecisionIsCurrent(result.decision, stale, '2026-09-20T12:00:01.000Z'), false);
    const lifecycleHead = db.getStorage().strategy_lifecycle_heads.find((row) => row.strategy_id === STRATEGY);
    lifecycleHead.lifecycle_version = 2;
    lifecycleHead.updated_at = '2026-09-20T12:00:00.500Z';
    const lifecycleStale = await snapshots.issue({ strategyId: STRATEGY, strategyRevisionId: REVISION, evaluationTime: NOW, ttlMs: 60_000 });
    assert.equal(StrategyOperationalSnapshotService.riskDecisionIsCurrent(result.decision, lifecycleStale, '2026-09-20T12:00:01.000Z'), false);
    const before = await authority.getHealthHead(STRATEGY, REVISION);
    risk.evaluate(healthContext(initial, 'HEALTHY', { systemHaltActive: true }));
    const after = await authority.getHealthHead(STRATEGY, REVISION);
    assert.equal(after.healthVersion, before.healthVersion);
  });
});
