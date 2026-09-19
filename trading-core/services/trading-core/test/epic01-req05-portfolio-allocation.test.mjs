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
    // Snapshot has 50k available
    // Proposal A requests 35k, Proposal B requests 30k (total 65k > 50k available)
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
      proposals: [propB, propA], // test that confidence sorting prioritizes propA
    });

    const result = service.allocate(context);

    assert.equal(result.decisions.length, 2);
    assert.equal(result.totalRequestedCapital, '65000');
    assert.equal(result.totalApprovedCapital, '50000'); // propA gets 28k (capped by strat-swing budget 40k - 12k existing = 28k), propB gets 22k (remaining available = 22k <= strat-scalp budget 30k)
    assert.equal(Number(result.totalApprovedCapital), 50000);
    assert.equal(Number(result.remainingAvailableCapital), 0);

    // Decisions check
    const decA = result.decisions.find((d) => d.proposalIds.includes('prop-A'));
    const decB = result.decisions.find((d) => d.proposalIds.includes('prop-B'));
    assert.ok(decA);
    assert.ok(decB);
    assert.equal(decA.outcome, 'MODIFIED'); // reduced from 35k to 28k due to strategy budget cap
    assert.equal(decA.approvedCapital, '28000');
    assert.equal(decB.outcome, 'MODIFIED'); // reduced from 30k to 22k
    assert.equal(decB.approvedCapital, '22000');
  });

  it('enforces strategy-level budget caps', () => {
    const service = new CapitalAllocationService();
    // Snapshot has 12k existing in strat-swing-1; max budget is 40k. Max additional is 28k.
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
    // Snapshot total capital: 100k. Max BTC-USDT concentration: 50% = 50k.
    // Existing BTC-USDT position: 12k. Available concentration headroom: 38k.
    // Available capital is 50k.
    // Strat-scalp max budget is 30k. If strat-scalp requests 35k on BTC-USDT, it's limited by strategy budget to 30k.
    // If another proposal on BTC-USDT requests 15k, total requested on BTC = 45k.
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

    // prop1 gets 25k (12k + 25k = 37k BTC gross). Headroom left for BTC is 13k.
    // prop2 requested 20k, but BTC concentration cap leaves 13k.
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
      expiresAt: '2026-09-19T11:59:00.000Z', // past context.now 12:00:02
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

  it('suppresses duplicate proposals from double-consuming capital', () => {
    const service = new CapitalAllocationService();
    const prop = buildProposal('prop-dupe', {
      sizing: { requestedQuantity: '0.1', requestedCapital: '10000' },
    });
    const context = buildContext({
      proposals: [prop, prop], // duplicate in same batch
    });

    const result = service.allocate(context);
    assert.equal(result.decisions.length, 1);
    assert.deepEqual(result.deduplicatedProposalIds, ['prop-dupe']);
    assert.equal(result.totalApprovedCapital, '10000');
  });

  it('supports deterministic replay producing identical decision outputs', () => {
    const service = new CapitalAllocationService();
    const propA = buildProposal('prop-1', { confidence: 0.9, sizing: { requestedQuantity: '0.2', requestedCapital: '15000' } });
    const propB = buildProposal('prop-2', { confidence: 0.8, sizing: { requestedQuantity: '0.3', requestedCapital: '20000' } });

    const context = buildContext({ proposals: [propA, propB] });
    const res1 = service.allocate(context);
    const res2 = service.allocate(context);

    assert.equal(res1.decisions.length, res2.decisions.length);
    assert.equal(res1.decisions[0].portfolioDecisionId, res2.decisions[0].portfolioDecisionId);
    assert.equal(res1.decisions[0].approvedCapital, res2.decisions[0].approvedCapital);
    assert.equal(res1.decisions[1].portfolioDecisionId, res2.decisions[1].portfolioDecisionId);
    assert.equal(res1.decisions[1].approvedCapital, res2.decisions[1].approvedCapital);
  });

  it('is input-permutation invariant for competing proposals', () => {
    const service = new CapitalAllocationService();
    const propA = buildProposal('prop-A', { confidence: 0.9, sizing: { requestedQuantity: '0.2', requestedCapital: '15000' } });
    const propB = buildProposal('prop-B', { confidence: 0.7, sizing: { requestedQuantity: '0.3', requestedCapital: '20000' } });

    const run1 = service.allocate(buildContext({ proposals: [propA, propB] }));
    const run2 = service.allocate(buildContext({ proposals: [propB, propA] }));

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

  it('detects and flags opposing directional exposure against existing position', () => {
    const service = new CapitalAllocationService();
    // Snapshot has existing net LONG BTC position
    // Proposal proposes SELL/SHORT BTC
    const shortProp = buildProposal('prop-short', {
      action: 'sell',
      instrument: 'BTC-USDT',
    });
    const context = buildContext({ proposals: [shortProp] });
    const result = service.allocate(context);

    const evaluation = result.evaluations[0];
    assert.ok(evaluation.violations.some((v) => v.includes('Opposing position exists')));
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
      now: '2026-09-19T12:06:00.000Z', // past decision.expiresAt 12:05:00
      currentSnapshot: context.portfolioSnapshot,
      proposals: [prop],
    });
    assert.equal(expired.valid, false);
    assert.equal(expired.status, 'EXPIRED');

    // Capital shortage in snapshot
    const depletedSnapshot = buildSnapshot({ availableCapital: '5000' }); // decision requires 10000
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

    // Invariant: PortfolioDecision outcomes are APPROVED | MODIFIED | REJECTED (NOT ALLOW | MODIFY | REJECT | HALT)
    assert.ok(['APPROVED', 'MODIFIED', 'REJECTED'].includes(decision.outcome));
    assert.notEqual(decision.outcome, 'ALLOW');
    assert.notEqual(decision.outcome, 'HALT');

    // Invariant: No RiskDecision, TradingIntent, or Execution fields
    assert.equal('riskDecisionId' in decision, false);
    assert.equal('killSwitch' in decision, false);
    assert.equal('intentId' in decision, false);
    assert.equal('orderId' in decision, false);
    assert.equal('executionPolicyRef' in decision, false);
  });
});
