import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PortfolioAllocationCoordinator,
  InMemoryPortfolioProposalDecisionRepository,
  PortfolioProposalDecisionConflictError,
  PortfolioProposalDecisionRepositoryUnavailableError,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function buildProposal(id, overrides = {}) {
  const strategyId = overrides.strategyId ?? 'strat-swing-1';
  const strategyRevisionId = overrides.strategyRevisionId ?? `${strategyId}:1`;
  const instrument = overrides.instrument ?? 'BTC-USDT';
  return {
    proposalId: id,
    strategyId,
    strategyRevisionId,
    strategyRevision: {
      strategy: {
        strategyId,
        family: 'spot-swing',
        name: 'Alpha Strategy',
        organizationId: 'org-axodus',
      },
      revision: 1,
      revisionId: strategyRevisionId,
    },
    opportunity: {
      opportunityId: `opp-${id}`,
      marketStateId: `ms-${id}`,
      instrument,
      venue: 'binance',
      timeframe: '1m',
    },
    marketState: {
      marketStateId: `ms-${id}`,
      schemaVersion: '1.0.0',
      validityContext: 'live',
    },
    action: 'buy',
    sizing: overrides.sizing ?? {
      requestedQuantity: '0.5',
      requestedCapital: '10000',
      leverage: '1.0',
    },
    expectedReturn: { alpha: '0.015' },
    expectedRisk: { stopLossBps: 50 },
    liquidityAssumptions: { depth: 'high' },
    duration: { horizon: '4h' },
    costAssumptions: { feeBps: 2 },
    confidence: 0.85,
    eligibility: {
      eligibilityId: `elig-${id}`,
      strategyRevisionId,
      decision: 'ELIGIBLE',
      policyVersion: '1.0.0',
    },
    correlationId: 'corr-alloc',
    idempotencyKey: `prop-idemp-${id}`,
    createdAt: '2026-09-19T12:00:01.000Z',
    expiresAt: '2026-09-19T12:05:00.000Z',
    evidenceRefs: [`ev-${id}`],
    ...overrides,
  };
}

function buildContext(overrides = {}) {
  return {
    portfolioSnapshot: {
      snapshotId: 'snap-100',
      asOf: '2026-09-19T12:00:00.000Z',
      validityContext: 'live',
      totalCapital: '100000',
      availableCapital: '50000',
      reservedCapital: '10000',
      positions: [],
      drawdownContext: {
        currentDrawdownPct: '0.02',
        highWaterMark: '105000',
      },
      provenanceRef: 'ledger:snap-100',
      ...(overrides.portfolioSnapshot ?? {}),
    },
    proposals: overrides.proposals ?? [],
    policy: {
      policyVersion: 'policy-cap-v1',
      maxTotalCapital: '100000',
      maxStrategyBudgetPct: {
        'strat-swing-1': 0.4,
        'strat-scalp-1': 0.3,
      },
      defaultMaxStrategyBudgetPct: 0.2,
      maxInstrumentConcentrationPct: {
        'BTC-USDT': 0.5,
        'ETH-USDT': 0.3,
      },
      defaultMaxInstrumentConcentrationPct: 0.25,
      maxTotalGrossLeverage: 3.0,
      ...(overrides.policy ?? {}),
    },
    environment: 'live',
    now: '2026-09-19T12:00:02.000Z',
    correlationId: overrides.correlationId ?? 'corr-alloc-batch-1',
  };
}

describe('PortfolioAllocationCoordinator Unit Tests (DEBT-AUD-A-03 / FIX-02)', () => {
  it('1. first proposal -> one durable decision', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const coordinator = new PortfolioAllocationCoordinator(repo);
    const prop = buildProposal('prop-1');
    const context = buildContext({ proposals: [prop] });

    const result = await coordinator.allocate(context);
    assert.equal(result.decisions.length, 1);
    assert.equal(result.decisions[0].outcome, 'APPROVED');
    assert.equal(result.decisions[0].approvedCapital, '10000');
    assert.equal(result.totalApprovedCapital, '10000');
  });

  it('2. same proposal / same process -> same decision', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const coordinator = new PortfolioAllocationCoordinator(repo);
    const prop = buildProposal('prop-same-process');
    const context1 = buildContext({ correlationId: 'batch-1', proposals: [prop] });
    const context2 = buildContext({ correlationId: 'batch-2', proposals: [prop] });

    const res1 = await coordinator.allocate(context1);
    const res2 = await coordinator.allocate(context2);

    assert.equal(res1.decisions[0].portfolioDecisionId, res2.decisions[0].portfolioDecisionId);
    assert.equal(res1.decisions[0].outcome, res2.decisions[0].outcome);
    assert.equal(res1.decisions[0].approvedCapital, res2.decisions[0].approvedCapital);
  });

  it('3. same proposal / new coordinator instance -> same decision', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const coord1 = new PortfolioAllocationCoordinator(repo);
    const coord2 = new PortfolioAllocationCoordinator(repo);
    const prop = buildProposal('prop-restart');

    const res1 = await coord1.allocate(buildContext({ proposals: [prop] }));
    const res2 = await coord2.allocate(buildContext({ correlationId: 'different-batch', proposals: [prop] }));

    assert.equal(res1.decisions[0].portfolioDecisionId, res2.decisions[0].portfolioDecisionId);
    assert.equal(res1.decisions[0].approvedCapital, res2.decisions[0].approvedCapital);
  });

  it('4. two concurrent coordinators / same proposal -> one canonical decision', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const coord1 = new PortfolioAllocationCoordinator(repo);
    const coord2 = new PortfolioAllocationCoordinator(repo);
    const prop = buildProposal('prop-concurrent');

    const [res1, res2] = await Promise.allSettled([
      coord1.allocate(buildContext({ correlationId: 'c1', proposals: [prop] })),
      coord2.allocate(buildContext({ correlationId: 'c2', proposals: [prop] })),
    ]);

    const successful = [res1, res2].filter((r) => r.status === 'fulfilled');
    assert.ok(successful.length >= 1);
    if (res1.status === 'fulfilled' && res2.status === 'fulfilled') {
      assert.equal(res1.value.decisions[0].portfolioDecisionId, res2.value.decisions[0].portfolioDecisionId);
    }
  });

  it('5. same proposalId / different fingerprint -> typed conflict / fail closed', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const coordinator = new PortfolioAllocationCoordinator(repo);
    const prop1 = buildProposal('prop-tamper', { sizing: { requestedQuantity: '0.1', requestedCapital: '10000' } });
    const prop2 = buildProposal('prop-tamper', { sizing: { requestedQuantity: '0.9', requestedCapital: '90000' } });

    await coordinator.allocate(buildContext({ proposals: [prop1] }));
    await assert.rejects(
      () => coordinator.allocate(buildContext({ proposals: [prop2] })),
      (err) => err instanceof PortfolioProposalDecisionConflictError || err.code === 'PORTFOLIO_PROPOSAL_IDENTITY_CONFLICT'
    );
  });

  it('6. process/repository failure during claim lifecycle -> deterministic recovery semantics', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const prop = buildProposal('prop-recovered');
    const fingerprint = 'dummy-fp';
    const expiredLease = '2026-09-20T09:00:00.000Z';
    await repo.claim({
      proposal: prop,
      proposalFingerprint: fingerprint,
      correlationId: 'c-old',
      evidenceRefs: ['ev-1'],
      claimedAt: '2026-09-20T08:59:00.000Z',
      leaseUntil: expiredLease,
    });

    const recovered = await repo.recoverExpiredClaim(prop.proposalId, '2026-09-20T10:00:00.000Z', '2026-09-20T10:01:00.000Z');
    assert.equal(recovered, true);
  });

  it('7. repository unavailable -> fail closed -> no fallback to unsafe in-memory allocation', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    repo.shouldFail = true;
    const coordinator = new PortfolioAllocationCoordinator(repo);
    const prop = buildProposal('prop-outage');

    await assert.rejects(
      () => coordinator.allocate(buildContext({ proposals: [prop] })),
      (err) => err instanceof PortfolioProposalDecisionRepositoryUnavailableError || err.code === 'PORTFOLIO_PROPOSAL_REPOSITORY_UNAVAILABLE'
    );
  });

  it('8. unrelated proposalIds -> independent decisions', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const coordinator = new PortfolioAllocationCoordinator(repo);
    const propA = buildProposal('prop-A', { sizing: { requestedQuantity: '0.1', requestedCapital: '10000' } });
    const propB = buildProposal('prop-B', { sizing: { requestedQuantity: '0.2', requestedCapital: '20000' } });

    const res = await coordinator.allocate(buildContext({ proposals: [propA, propB] }));
    assert.equal(res.decisions.length, 2);
    assert.equal(res.totalApprovedCapital, '30000');
    assert.notEqual(res.decisions[0].portfolioDecisionId, res.decisions[1].portfolioDecisionId);
  });

  it('9. rejected PortfolioDecision -> also durable/idempotent', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const coordinator = new PortfolioAllocationCoordinator(repo);
    const expiredProp = buildProposal('prop-expired', { expiresAt: '2026-09-19T11:59:00.000Z' });

    const res1 = await coordinator.allocate(buildContext({ proposals: [expiredProp] }));
    assert.equal(res1.decisions[0].outcome, 'REJECTED');
    assert.equal(res1.decisions[0].approvedCapital, '0');

    const res2 = await coordinator.allocate(buildContext({ correlationId: 'batch-retry', proposals: [expiredProp] }));
    assert.equal(res2.decisions[0].outcome, 'REJECTED');
    assert.equal(res2.decisions[0].portfolioDecisionId, res1.decisions[0].portfolioDecisionId);
  });

  it('10. accepted PortfolioDecision -> durable/idempotent', async () => {
    const repo = new InMemoryPortfolioProposalDecisionRepository();
    const coordinator = new PortfolioAllocationCoordinator(repo);
    const prop = buildProposal('prop-accepted', { sizing: { requestedQuantity: '0.1', requestedCapital: '5000' } });

    const res1 = await coordinator.allocate(buildContext({ proposals: [prop] }));
    assert.equal(res1.decisions[0].outcome, 'APPROVED');
    assert.equal(res1.decisions[0].approvedCapital, '5000');

    const res2 = await coordinator.allocate(buildContext({ correlationId: 'batch-replayed', proposals: [prop] }));
    assert.equal(res2.decisions[0].outcome, 'APPROVED');
    assert.equal(res2.decisions[0].portfolioDecisionId, res1.decisions[0].portfolioDecisionId);
    assert.equal(res2.decisions[0].approvedCapital, '5000');
  });
});
