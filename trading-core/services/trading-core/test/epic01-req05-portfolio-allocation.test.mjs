import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateTradeProposal,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import {
  CapitalAllocationService,
  revalidatePortfolioDecision,
  validatePortfolioContext,
  validateProposalForPortfolioAdmission,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function buildSnapshot(overrides = {}) {
  return {
    snapshotId: 'snap-100',
    asOf: '2026-09-19T12:00:00.000Z',
    validityContext: 'live',
    totalCapital: '100000',
    availableCapital: '50000',
    reservedCapital: '10000',
    positions: [
      {
        instrument: 'BTC-USDT',
        venue: 'binance',
        side: 'LONG',
        quantity: '0.2',
        notional: '12000',
        strategyId: 'strat-swing-1',
      },
    ],
    drawdownContext: {
      currentDrawdownPct: '0.02',
      highWaterMark: '105000',
    },
    provenanceRef: 'ledger:snap-100',
    ...overrides,
  };
}

function buildPolicy(overrides = {}) {
  return {
    policyVersion: 'policy-cap-v1',
    maxTotalCapital: '100000',
    maxStrategyBudgetPct: {
      'strat-swing-1': 0.4, // max 40k
      'strat-scalp-1': 0.3, // max 30k
    },
    defaultMaxStrategyBudgetPct: 0.2, // 20k default
    maxInstrumentConcentrationPct: {
      'BTC-USDT': 0.5, // max 50k
      'ETH-USDT': 0.3, // max 30k
    },
    defaultMaxInstrumentConcentrationPct: 0.25,
    maxTotalGrossLeverage: 3.0,
    ...overrides,
  };
}

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
    sizing: {
      requestedQuantity: '0.5',
      requestedCapital: '30000',
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
    correlationId: 'corr-req05',
    idempotencyKey: `prop-idemp-${id}`,
    createdAt: '2026-09-19T12:00:01.000Z',
    expiresAt: '2026-09-19T12:05:00.000Z',
    evidenceRefs: [`ev-${id}`],
    ...overrides,
  };
}

function buildContext(overrides = {}) {
  return {
    portfolioSnapshot: overrides.portfolioSnapshot ?? buildSnapshot(),
    proposals: overrides.proposals ?? [buildProposal('p1')],
    policy: overrides.policy ?? buildPolicy(),
    environment: 'live',
    now: '2026-09-19T12:00:02.000Z',
    correlationId: 'corr-req05-batch',
    ...overrides,
  };
}

describe('REQ-05 Portfolio & Capital Allocation Foundation', () => {
  it('evaluates proposal competition and strictly conserves available capital', () => {
    const service = new CapitalAllocationService();
    const propA = buildProposal('prop-A', {
      confidence: 0.9,
      sizing: { requestedQuantity: '0.5', requestedCapital: '35000' },
    });
    const propB = buildProposal('prop-B', {
      confidence: 0.8,
      strategyId: 'strat-scalp-1',
      strategyRevisionId: 'strat-scalp-1:1',
      instrument: 'ETH-USDT',
      sizing: { requestedQuantity: '10', requestedCapital: '30000' },
    });

    const context = buildContext({
      proposals: [propB, propA],
    });

    const result = service.allocate(context);

    assert.equal(result.decisions.length, 2);
    assert.equal(result.totalRequestedCapital, '65000');
    assert.equal(result.totalApprovedCapital, '50000');
    assert.equal(Number(result.totalApprovedCapital), 50000);
    assert.equal(Number(result.remainingAvailableCapital), 0);

    const decA = result.decisions.find((d) => d.proposalIds.includes('prop-A'));
    const decB = result.decisions.find((d) => d.proposalIds.includes('prop-B'));
    assert.ok(decA);
    assert.ok(decB);
    assert.equal(decA.outcome, 'MODIFIED');
    assert.equal(decA.approvedCapital, '28000');
    assert.equal(decB.outcome, 'MODIFIED');
    assert.equal(decB.approvedCapital, '22000');
  });

  it('FIX-A-01: avoids floating point precision drift and enforces exact decimal math (0.1 + 0.2 = 0.3)', () => {
    const service = new CapitalAllocationService();
    const snap = buildSnapshot({ totalCapital: '1000', availableCapital: '0.3', reservedCapital: '0', positions: [] });
    const prop1 = buildProposal('prop-dec-1', {
      confidence: 0.9,
      sizing: { requestedQuantity: '0.001', requestedCapital: '0.1' },
    });
    const prop2 = buildProposal('prop-dec-2', {
      confidence: 0.8,
      sizing: { requestedQuantity: '0.002', requestedCapital: '0.2' },
    });

    const context = buildContext({
      portfolioSnapshot: snap,
      proposals: [prop1, prop2],
    });

    const result = service.allocate(context);
    assert.equal(result.totalRequestedCapital, '0.3');
    assert.equal(result.totalApprovedCapital, '0.3');
    assert.equal(result.remainingAvailableCapital, '0');
    assert.equal(result.decisions[0].approvedCapital, '0.1');
    assert.equal(result.decisions[1].approvedCapital, '0.2');
  });

  it('enforces strategy-level budget caps', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-huge', {
      sizing: { requestedQuantity: '1.0', requestedCapital: '35000' },
    });
    const context = buildContext({ proposals: [prop] });
    const result = service.allocate(context);

    assert.equal(result.evaluations[0].disposition, 'REDUCED');
    assert.equal(result.evaluations[0].approvedCapital, '28000');
    assert.match(result.evaluations[0].rationale, /strategy budget cap/);
  });

  it('enforces instrument concentration caps across strategies', () => {
    const service = new CapitalAllocationService();
    const prop1 = buildProposal('prop-btc-1', {
      confidence: 0.9,
      strategyId: 'strat-scalp-1',
      strategyRevisionId: 'strat-scalp-1:1',
      instrument: 'BTC-USDT',
      sizing: { requestedQuantity: '0.4', requestedCapital: '25000' },
    });
    const prop2 = buildProposal('prop-btc-2', {
      confidence: 0.8,
      strategyId: 'strat-swing-1',
      strategyRevisionId: 'strat-swing-1:1',
      instrument: 'BTC-USDT',
      sizing: { requestedQuantity: '0.3', requestedCapital: '20000' },
    });

    const context = buildContext({ proposals: [prop1, prop2] });
    const result = service.allocate(context);

    const dec2 = result.decisions.find((d) => d.proposalIds.includes('prop-btc-2'));
    assert.equal(dec2.outcome, 'MODIFIED');
    assert.equal(dec2.approvedCapital, '13000');
    assert.match(dec2.rationale, /instrument concentration cap/);
  });

  it('rejects allocation when available capital is completely exhausted', () => {
    const service = new CapitalAllocationService();
    const emptySnapshot = buildSnapshot({ availableCapital: '0' });
    const prop = buildProposal('prop-unfunded');
    const context = buildContext({ portfolioSnapshot: emptySnapshot, proposals: [prop] });
    const result = service.allocate(context);

    assert.equal(result.evaluations[0].disposition, 'REJECTED');
    assert.equal(result.evaluations[0].approvedCapital, '0');
    assert.match(result.evaluations[0].rationale, /Insufficient total available capital/);
  });

  it('rejects expired TradeProposals and fails closed', () => {
    const service = new CapitalAllocationService();
    const expiredProp = buildProposal('prop-expired', {
      expiresAt: '2026-09-19T11:59:00.000Z',
    });
    const context = buildContext({ proposals: [expiredProp] });
    const result = service.allocate(context);

    assert.equal(result.evaluations[0].disposition, 'REJECTED');
    assert.equal(result.decisions[0].outcome, 'REJECTED');
    assert.match(result.evaluations[0].rationale, /expired/);
  });

  it('rejects proposals from SUSPENDED or RETIRED strategies', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-suspended');
    const context = buildContext({
      proposals: [prop],
      strategyHealth: [
        {
          strategyId: 'strat-swing-1',
          strategyRevisionId: 'strat-swing-1:1',
          state: 'SUSPENDED',
          observedAt: '2026-09-19T12:00:00.000Z',
          expectedEvidenceRefs: [],
          observedEvidenceRefs: [],
          divergenceRefs: ['divergence:anomaly'],
          rationale: 'Health suspended',
        },
      ],
    });

    const result = service.allocate(context);
    assert.equal(result.evaluations[0].disposition, 'REJECTED');
    assert.match(result.evaluations[0].rationale, /StrategyHealth state SUSPENDED prohibits portfolio allocation/);
  });

  it('rejects proposals when PromotionEligibility is NOT_ELIGIBLE', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-ineligible');
    const context = buildContext({
      proposals: [prop],
      eligibilities: [
        {
          eligibilityId: 'elig-not-eligible',
          strategyRevisionId: 'strat-swing-1:1',
          targetState: 'TESTNET',
          decision: 'NOT_ELIGIBLE',
          evidenceRefs: [],
          policyVersion: '1.0.0',
          checks: [],
          violations: ['violation:drawdown'],
          decidedAt: '2026-09-19T10:00:00.000Z',
          authorityRef: 'gov',
        },
      ],
    });

    const result = service.allocate(context);
    assert.equal(result.evaluations[0].disposition, 'REJECTED');
    assert.match(result.evaluations[0].rationale, /PromotionEligibility decision is NOT_ELIGIBLE/);
  });

  it('suppresses duplicate proposals from double-consuming capital in batch', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-dupe', {
      sizing: { requestedQuantity: '0.1', requestedCapital: '10000' },
    });
    const context = buildContext({
      proposals: [prop, prop],
    });

    const result = service.allocate(context);
    assert.equal(result.decisions.length, 1);
    assert.deepEqual(result.deduplicatedProposalIds, ['prop-dupe']);
    assert.equal(result.totalApprovedCapital, '10000');
  });

  it('FIX-A-03: rejects duplicate proposal submission across subsequent contexts via durable tombstone', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-tombstone-1', {
      sizing: { requestedQuantity: '0.1', requestedCapital: '10000' },
    });

    const context1 = buildContext({ correlationId: 'batch-1', proposals: [prop] });
    const res1 = service.allocate(context1);
    assert.equal(res1.decisions[0].outcome, 'APPROVED');
    assert.equal(res1.totalApprovedCapital, '10000');

    // Attempt to submit identical proposal in subsequent context
    const context2 = buildContext({ correlationId: 'batch-2', proposals: [prop] });
    const res2 = service.allocate(context2);
    assert.equal(res2.decisions[0].outcome, 'REJECTED');
    assert.equal(res2.evaluations[0].disposition, 'REJECTED');
    assert.match(res2.evaluations[0].rationale, /already evaluated.*duplicate proposal submission rejected/);
    assert.equal(res2.totalApprovedCapital, '0');
  });

  it('supports deterministic replay of identical context producing identical decision outputs', () => {
    const service = new CapitalAllocationService();
    const propA = buildProposal('prop-replay-1', { confidence: 0.9, sizing: { requestedQuantity: '0.2', requestedCapital: '15000' } });
    const propB = buildProposal('prop-replay-2', { confidence: 0.8, sizing: { requestedQuantity: '0.3', requestedCapital: '20000' } });

    const context = buildContext({ correlationId: 'replay-corr-id', proposals: [propA, propB] });
    const res1 = service.allocate(context);
    const res2 = service.allocate(context);

    assert.equal(res1.decisions.length, res2.decisions.length);
    assert.equal(res1.decisions[0].portfolioDecisionId, res2.decisions[0].portfolioDecisionId);
    assert.equal(res1.decisions[0].approvedCapital, res2.decisions[0].approvedCapital);
    assert.equal(res1.decisions[1].portfolioDecisionId, res2.decisions[1].portfolioDecisionId);
    assert.equal(res1.decisions[1].approvedCapital, res2.decisions[1].approvedCapital);
  });

  it('is input-permutation invariant for competing proposals', () => {
    const propA = buildProposal('prop-perm-A', { confidence: 0.9, sizing: { requestedQuantity: '0.2', requestedCapital: '15000' } });
    const propB = buildProposal('prop-perm-B', { confidence: 0.7, sizing: { requestedQuantity: '0.3', requestedCapital: '20000' } });

    const s1 = new CapitalAllocationService();
    const s2 = new CapitalAllocationService();
    const run1 = s1.allocate(buildContext({ correlationId: 'perm-run', proposals: [propA, propB] }));
    const run2 = s2.allocate(buildContext({ correlationId: 'perm-run', proposals: [propB, propA] }));

    assert.equal(run1.totalApprovedCapital, run2.totalApprovedCapital);
    assert.equal(run1.decisions[0].portfolioDecisionId, run2.decisions[0].portfolioDecisionId);
  });

  it('handles unknown correlation explicitly without assuming zero correlation', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-corr');
    const context = buildContext({ proposals: [prop] });
    const result = service.allocate(context);

    const decision = result.decisions[0];
    assert.equal(decision.correlatedExposure.status, 'unknown');
    assert.match(decision.correlatedExposure.reason, /no correlation matrix/);
  });

  it('FIX-A-02: fails closed and rejects opposing directional exposure unless explicit netting policy is enabled', () => {
    const service1 = new CapitalAllocationService();
    // Snapshot has existing net LONG BTC position
    // Proposal proposes SELL/SHORT BTC
    const shortProp1 = buildProposal('prop-opp-failclosed', {
      action: 'sell',
      instrument: 'BTC-USDT',
    });
    // Default policy (no allowOpposingPositions) -> REJECT fail closed
    const contextDefault = buildContext({ proposals: [shortProp1] });
    const resultDefault = service1.allocate(contextDefault);

    const evaluation = resultDefault.evaluations[0];
    assert.equal(evaluation.disposition, 'REJECTED');
    assert.equal(evaluation.approvedCapital, '0');
    assert.match(evaluation.rationale, /without an explicit netting\/hedge policy; rejected fail-closed/);

    // With explicit allowOpposingPositions policy -> approved within gross limits
    const service2 = new CapitalAllocationService();
    const shortProp2 = buildProposal('prop-opp-allowed', {
      action: 'sell',
      instrument: 'BTC-USDT',
      sizing: { requestedQuantity: '0.1', requestedCapital: '5000' },
    });
    const contextAllowed = buildContext({
      policy: buildPolicy({ allowOpposingPositions: true }),
      proposals: [shortProp2],
    });
    const resultAllowed = service2.allocate(contextAllowed);
    assert.equal(resultAllowed.evaluations[0].disposition, 'ALLOCATED');
    assert.equal(resultAllowed.evaluations[0].approvedCapital, '5000');
  });

  it('revalidates PortfolioDecision without mutating it and detects expired / capital shortage', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-reval', { sizing: { requestedQuantity: '0.2', requestedCapital: '10000' } });
    const context = buildContext({ proposals: [prop] });
    const result = service.allocate(context);
    const decision = result.decisions[0];

    // Valid revalidation
    const valid = revalidatePortfolioDecision(decision, {
      now: '2026-09-19T12:01:00.000Z',
      currentSnapshot: context.portfolioSnapshot,
      proposals: [prop],
    });
    assert.equal(valid.valid, true);
    assert.equal(valid.status, 'ALLOCATED');

    // Expired revalidation
    const expired = revalidatePortfolioDecision(decision, {
      now: '2026-09-19T12:06:00.000Z',
      currentSnapshot: context.portfolioSnapshot,
      proposals: [prop],
    });
    assert.equal(expired.valid, false);
    assert.equal(expired.status, 'EXPIRED');

    // Capital shortage in snapshot
    const depletedSnapshot = buildSnapshot({ availableCapital: '5000' });
    const invalidated = revalidatePortfolioDecision(decision, {
      now: '2026-09-19T12:01:00.000Z',
      currentSnapshot: depletedSnapshot,
      proposals: [prop],
    });
    assert.equal(invalidated.valid, false);
    assert.equal(invalidated.status, 'INVALIDATED');
    assert.match(invalidated.reason, /Portfolio capital no longer sufficient/);
  });

  it('guarantees PortfolioDecision != RiskDecision and does not emit Risk or Execution authority', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-auth-check');
    const context = buildContext({ proposals: [prop] });
    const result = service.allocate(context);
    const decision = result.decisions[0];

    assert.ok(['APPROVED', 'MODIFIED', 'REJECTED'].includes(decision.outcome));
    assert.notEqual(decision.outcome, 'ALLOW');
    assert.notEqual(decision.outcome, 'HALT');

    assert.equal('riskDecisionId' in decision, false);
    assert.equal('killSwitch' in decision, false);
    assert.equal('intentId' in decision, false);
    assert.equal('orderId' in decision, false);
    assert.equal('executionPolicyRef' in decision, false);
  });
});
