import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateTradeProposal,
  TradingContractValidationError,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import {
  StrategyIntelligenceService,
  DirectionalSwingSpecialist,
  FuturesScalpingSpecialist,
  AgentAssistedStrategySpecialist,
  buildTradeProposal,
  revalidateTradeProposal,
  validateStrategyContext,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function buildMarketState(overrides = {}) {
  return {
    marketStateId: 'ms-live-100',
    instrument: 'BTC-USDT',
    venue: 'binance',
    timeframe: '1m',
    marketTime: '2026-09-19T12:00:00.000Z',
    observedAt: '2026-09-19T12:00:00.000Z',
    constructedAt: '2026-09-19T12:00:00.100Z',
    validityContext: 'live',
    freshness: 'current',
    schemaVersion: '1.0.0',
    features: [
      { featureId: 'spread_bps', featureVersion: '1.0.0', value: 12, computedAt: '2026-09-19T12:00:00.100Z' },
      { featureId: 'momentum', featureVersion: '1.0.0', value: 0.05, computedAt: '2026-09-19T12:00:00.100Z' },
      { featureId: 'trend', featureVersion: '1.0.0', value: 'bullish', computedAt: '2026-09-19T12:00:00.100Z' },
    ],
    sourceRefs: ['source:binance:feed'],
    completeness: 'complete',
    validationRefs: ['val-ms-100'],
    ...overrides,
  };
}

function buildStrategyRevision(overrides = {}) {
  return {
    strategy: {
      strategyId: 'strat-swing-1',
      family: 'spot-swing',
      name: 'Momentum Swing Alpha',
      organizationId: 'org-axodus',
    },
    revision: 1,
    revisionId: 'strat-swing-1:1',
    artifactRef: 'ipfs://strat-swing-1-v1',
    parameterSchemaRef: 'schema://swing-params/v1',
    featureDefinitions: [
      { featureId: 'spread_bps', featureVersion: '1.0.0' },
      { featureId: 'trend', featureVersion: '1.0.0' },
    ],
    marketStateSchemaVersion: '1.0.0',
    lifecycleState: 'TESTNET',
    createdAt: '2026-09-19T10:00:00.000Z',
    createdBy: 'agent-strategist',
    ...overrides,
  };
}

function buildOpportunity(overrides = {}) {
  return {
    opportunityId: 'opp-100',
    instrument: 'BTC-USDT',
    venue: 'binance',
    strategyId: 'strat-swing-1',
    strategyRevisionId: 'strat-swing-1:1',
    timeframe: '1m',
    marketStateId: 'ms-live-100',
    qualification: 'qualified',
    expectedCharacteristics: {
      discoveryRelevance: 0.85,
      direction: 'long',
    },
    evidenceRefs: ['ev-opp-100'],
    createdAt: '2026-09-19T12:00:00.200Z',
    expiresAt: '2026-09-19T12:05:00.000Z',
    status: 'QUALIFIED',
    applicability: 'APPLICABLE',
    ...overrides,
  };
}

function buildEligibility(overrides = {}) {
  return {
    eligibilityId: 'elig-100',
    strategyRevisionId: 'strat-swing-1:1',
    targetState: 'TESTNET',
    decision: 'ELIGIBLE',
    evidenceRefs: ['ev-elig-100'],
    policyVersion: '1.0.0',
    checks: ['robustness', 'walk-forward'],
    violations: [],
    decidedAt: '2026-09-19T11:00:00.000Z',
    authorityRef: 'gov-risk-council',
    ...overrides,
  };
}

function buildContext(overrides = {}) {
  const strategyRevision = overrides.strategyRevision ?? buildStrategyRevision();
  const opportunity = overrides.opportunity ?? buildOpportunity();
  const marketState = overrides.marketState ?? buildMarketState();
  const eligibility = overrides.eligibility ?? buildEligibility();

  return {
    strategyRevision,
    opportunity,
    marketState,
    eligibility,
    environment: 'live',
    now: '2026-09-19T12:00:01.000Z',
    correlationId: 'corr-req04-test',
    ...overrides,
  };
}

describe('REQ-04 Strategy Intelligence & TradeProposal Foundation', () => {
  it('evaluates deterministic Strategy Specialist and produces canonical TradeProposal', async () => {
    const service = new StrategyIntelligenceService();
    const specialist = new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' });
    service.registerSpecialist(specialist);

    const context = buildContext();
    const result = await service.evaluate(context);

    assert.equal(result.status, 'PROPOSED');
    assert.equal(result.deduplicated, false);
    assert.ok(result.proposal);

    const proposal = result.proposal;
    assert.equal(proposal.strategyId, 'strat-swing-1');
    assert.equal(proposal.strategyRevisionId, 'strat-swing-1:1');
    assert.equal(proposal.action, 'buy');
    assert.equal(proposal.sizing.requestedQuantity, '0.25');
    assert.equal(proposal.sizing.requestedCapital, '15000');
    assert.equal(proposal.opportunity.opportunityId, 'opp-100');
    assert.equal(proposal.marketState.marketStateId, 'ms-live-100');
    assert.ok(proposal.evidenceRefs.includes('ev-opp-100'));
    assert.ok(proposal.evidenceRefs.includes('val-ms-100'));
    assert.ok(proposal.evidenceRefs.includes('evidence:swing-model-v1'));

    // Assert full canonical contract validity
    assert.doesNotThrow(() => validateTradeProposal(proposal));
  });

  it('preserves Opportunity -> TradeProposal lineage and exact StrategyRevision attribution', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const context = buildContext();
    const result = await service.evaluate(context);
    const proposal = result.proposal;

    assert.equal(proposal.opportunity.opportunityId, context.opportunity.opportunityId);
    assert.equal(proposal.opportunity.marketStateId, context.marketState.marketStateId);
    assert.equal(proposal.strategyRevision.revisionId, context.strategyRevision.revisionId);
    assert.equal(proposal.strategyRevision.strategy.strategyId, context.strategyRevision.strategy.strategyId);
    assert.equal(proposal.strategyRevision.revision, 1);
  });

  it('returns NO_PROPOSAL when strategy criteria/thresholds are not met', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const lowRelevanceOpp = buildOpportunity({
      expectedCharacteristics: { discoveryRelevance: 0.2, direction: 'long' },
    });
    const context = buildContext({ opportunity: lowRelevanceOpp });
    const result = await service.evaluate(context);

    assert.equal(result.status, 'NO_PROPOSAL');
    assert.equal(result.proposal, null);
    assert.match(result.reason, /below threshold/);
  });

  it('supports deterministic replay producing identical semantic proposals', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const context = buildContext();
    const res1 = await service.evaluate(context);
    service.clearDeduplicationCache();
    const res2 = await service.evaluate(context);

    assert.equal(res1.proposal.proposalId, res2.proposal.proposalId);
    assert.equal(res1.proposal.idempotencyKey, res2.proposal.idempotencyKey);
    assert.deepEqual(res1.proposal.sizing, res2.proposal.sizing);
  });

  it('suppresses duplicate proposal evaluation via idempotency key deduplication', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const context = buildContext();
    const first = await service.evaluate(context);
    const second = await service.evaluate(context);

    assert.equal(first.deduplicated, false);
    assert.equal(second.deduplicated, true);
    assert.equal(first.proposal.proposalId, second.proposal.proposalId);
  });

  it('supports futures scalping specialist with requested leverage and short duration', async () => {
    const service = new StrategyIntelligenceService();
    const scalpingRevision = buildStrategyRevision({
      strategy: { strategyId: 'strat-scalp-1', family: 'futures-scalping', name: 'Micro Scalper', organizationId: 'org-axodus' },
      revisionId: 'strat-scalp-1:1',
      featureDefinitions: [{ featureId: 'spread_bps', featureVersion: '1.0.0' }],
    });
    const scalpingOpp = buildOpportunity({
      strategyId: 'strat-scalp-1',
      strategyRevisionId: 'strat-scalp-1:1',
      expectedCharacteristics: { direction: 'buy' },
    });
    const scalpingEligibility = buildEligibility({
      strategyRevisionId: 'strat-scalp-1:1',
    });

    service.registerSpecialist(new FuturesScalpingSpecialist({ strategyId: 'strat-scalp-1' }));

    const context = buildContext({
      strategyRevision: scalpingRevision,
      opportunity: scalpingOpp,
      eligibility: scalpingEligibility,
    });

    const result = await service.evaluate(context);
    assert.equal(result.status, 'PROPOSED');
    assert.equal(result.proposal.sizing.leverage, '3.0');
    assert.equal(result.proposal.duration.horizon, '5m');
    assert.doesNotThrow(() => validateTradeProposal(result.proposal));
  });

  it('revalidates proposal without mutating it and detects expired or invalidated states', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const context = buildContext();
    const result = await service.evaluate(context);
    const proposal = result.proposal;

    // Valid revalidation
    const validReval = revalidateTradeProposal(proposal, {
      now: '2026-09-19T12:00:30.000Z',
      opportunity: context.opportunity,
      marketState: context.marketState,
      eligibility: context.eligibility,
    });
    assert.equal(validReval.valid, true);
    assert.equal(validReval.status, 'PROPOSED');

    // Expired revalidation (past proposal.expiresAt)
    const expiredReval = revalidateTradeProposal(proposal, {
      now: '2026-09-19T12:02:00.000Z',
      opportunity: context.opportunity,
      marketState: context.marketState,
      eligibility: context.eligibility,
    });
    assert.equal(expiredReval.valid, false);
    assert.equal(expiredReval.status, 'EXPIRED');

    // Invalidated by state change (supporting MarketState changed)
    const invalidatedReval = revalidateTradeProposal(proposal, {
      now: '2026-09-19T12:00:30.000Z',
      opportunity: { ...context.opportunity, marketStateId: 'ms-newer-200' },
      marketState: buildMarketState({ marketStateId: 'ms-newer-200' }),
      eligibility: context.eligibility,
    });
    assert.equal(invalidatedReval.valid, false);
    assert.equal(invalidatedReval.status, 'INVALIDATED');
  });

  it('demonstrates multi-strategy specialization over the same MarketState', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));
    service.registerSpecialist(new FuturesScalpingSpecialist({ strategyId: 'strat-scalp-1' }));

    const marketState = buildMarketState({
      features: [
        { featureId: 'spread_bps', featureVersion: '1.0.0', value: 35, computedAt: '2026-09-19T12:00:00.100Z' }, // spread too wide for scalping (max 25)
        { featureId: 'trend', featureVersion: '1.0.0', value: 'bullish', computedAt: '2026-09-19T12:00:00.100Z' },
      ],
    });

    // Swing strategy evaluates
    const swingCtx = buildContext({
      marketState,
      strategyRevision: buildStrategyRevision({ strategy: { strategyId: 'strat-swing-1', family: 'spot-swing', name: 'Swing', organizationId: 'org' } }),
      opportunity: buildOpportunity({ strategyId: 'strat-swing-1', strategyRevisionId: 'strat-swing-1:1', marketStateId: marketState.marketStateId }),
    });
    const swingResult = await service.evaluate(swingCtx);
    assert.equal(swingResult.status, 'PROPOSED');

    // Scalping strategy evaluates the wide spread state -> NO_PROPOSAL
    const scalpRevision = buildStrategyRevision({
      strategy: { strategyId: 'strat-scalp-1', family: 'futures-scalping', name: 'Scalper', organizationId: 'org' },
      revisionId: 'strat-scalp-1:1',
      featureDefinitions: [{ featureId: 'spread_bps', featureVersion: '1.0.0' }],
    });
    const scalpCtx = buildContext({
      marketState,
      strategyRevision: scalpRevision,
      opportunity: buildOpportunity({ strategyId: 'strat-scalp-1', strategyRevisionId: 'strat-scalp-1:1', marketStateId: marketState.marketStateId }),
      eligibility: buildEligibility({ strategyRevisionId: 'strat-scalp-1:1' }),
    });
    const scalpResult = await service.evaluate(scalpCtx);
    assert.equal(scalpResult.status, 'NO_PROPOSAL');
    assert.match(scalpResult.reason, /Spread \(35 bps\) is too wide for scalping/);
  });

  it('supports Agent-assisted specialist with structured candidate validation', async () => {
    const service = new StrategyIntelligenceService();
    const agentAttribution = {
      agentId: 'acs-agent-specialist-01',
      agentRevision: '1.2.0',
      workforceId: 'trading-specialists-wf',
      runId: 'run-agent-401',
    };

    const agentSpecialist = new AgentAssistedStrategySpecialist({
      specialistId: 'spec-agent-swing',
      strategyId: 'strat-swing-1',
      supportedFamilies: ['spot-swing'],
      agentAttribution,
      runner: async (ctx) => {
        return {
          action: 'buy',
          sizing: { requestedQuantity: '0.5', requestedCapital: '30000', leverage: '1.0' },
          expectedReturn: { alpha: '0.02' },
          expectedRisk: { maxDrawdown: '0.01' },
          liquidityAssumptions: { depth: 'high' },
          duration: { horizon: '1d' },
          costAssumptions: { feeBps: 1.5 },
          confidence: 0.92,
          expiresInMs: 45_000,
          evidenceRefs: ['evidence:llm-reasoning-trace'],
          rationale: 'Agent model identified high-probability swing breakout',
        };
      },
    });

    service.registerSpecialist(agentSpecialist);
    const context = buildContext();
    const result = await service.evaluate(context);

    assert.equal(result.status, 'PROPOSED');
    assert.equal(result.proposal.agentAttribution.agentId, 'acs-agent-specialist-01');
    assert.equal(result.proposal.sizing.requestedQuantity, '0.5');
    assert.doesNotThrow(() => validateTradeProposal(result.proposal));
  });

  it('fails closed when Agent returns malformed or invalid candidate proposal', async () => {
    const service = new StrategyIntelligenceService();
    const badAgentSpecialist = new AgentAssistedStrategySpecialist({
      specialistId: 'spec-agent-broken',
      strategyId: 'strat-swing-1',
      supportedFamilies: ['spot-swing'],
      agentAttribution: { agentId: 'acs-agent-broken' },
      runner: async () => {
        // Returns invalid action and negative sizing
        return {
          action: 'invalid_action',
          sizing: { requestedQuantity: '-5', requestedCapital: '0' },
          expiresInMs: -10,
        };
      },
    });

    service.registerSpecialist(badAgentSpecialist);
    const result = await service.evaluate(buildContext());
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.proposal, null);
    assert.match(result.reason, /validation/);
  });

  it('rejects evaluation when StrategyRevision is DISQUALIFIED or NOT_ELIGIBLE', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const ineligibleContext = buildContext({
      eligibility: buildEligibility({ decision: 'NOT_ELIGIBLE' }),
    });
    const result = await service.evaluate(ineligibleContext);
    assert.equal(result.status, 'REJECTED');
    assert.match(result.reason, /PromotionEligibility must be ELIGIBLE/);
  });

  it('rejects evaluation when StrategyHealth is SUSPENDED or RETIRED in operational context', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const suspendedContext = buildContext({
      strategyHealth: {
        strategyId: 'strat-swing-1',
        strategyRevisionId: 'strat-swing-1:1',
        state: 'SUSPENDED',
        observedAt: '2026-09-19T12:00:00.000Z',
        expectedEvidenceRefs: [],
        observedEvidenceRefs: [],
        divergenceRefs: ['divergence:drawdown-spike'],
        rationale: 'Severe drawdown anomaly',
      },
    });
    const result = await service.evaluate(suspendedContext);
    assert.equal(result.status, 'REJECTED');
    assert.match(result.reason, /StrategyHealth state SUSPENDED prohibits proposal generation/);
  });

  it('fails closed when MarketState is missing required features for StrategyRevision', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const missingFeatureState = buildMarketState({
      features: [{ featureId: 'unrelated_feature', featureVersion: '1.0.0', value: 1, computedAt: '2026-09-19T12:00:00.000Z' }],
    });
    const context = buildContext({ marketState: missingFeatureState });
    const result = await service.evaluate(context);
    assert.equal(result.status, 'REJECTED');
    assert.match(result.reason, /Missing required features/);
  });

  it('fails closed when Opportunity is expired or marketState lineage does not match', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    // Expired Opportunity
    const expiredOppContext = buildContext({
      now: '2026-09-19T12:10:00.000Z', // past expiresAt: 12:05:00
    });
    const expiredResult = await service.evaluate(expiredOppContext);
    assert.equal(expiredResult.status, 'REJECTED');
    assert.match(expiredResult.reason, /Opportunity has expired/);

    // Lineage mismatch
    const mismatchContext = buildContext({
      opportunity: buildOpportunity({ marketStateId: 'ms-different-999' }),
    });
    const mismatchResult = await service.evaluate(mismatchContext);
    assert.equal(mismatchResult.status, 'REJECTED');
    assert.match(mismatchResult.reason, /MarketStateId mismatch/);
  });

  it('guarantees StrategyIdentity != AgentIdentity and TradeProposal != RiskDecision / Capital Allocation', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const context = buildContext({
      agentAttribution: {
        agentId: 'acs-agent-evaluator-01',
        agentRevision: '2.0.0',
      },
    });
    const result = await service.evaluate(context);
    const proposal = result.proposal;

    // Invariant: StrategyIdentity != AgentIdentity
    assert.notEqual(proposal.strategyId, proposal.agentAttribution.agentId);
    assert.equal(proposal.strategyId, 'strat-swing-1');
    assert.equal(proposal.agentAttribution.agentId, 'acs-agent-evaluator-01');

    // Invariant: TradeProposal has NO risk decision or capital allocation authority fields
    assert.equal('approvedCapital' in proposal, false);
    assert.equal('approvedQuantity' in proposal, false);
    assert.equal('riskDecision' in proposal, false);
    assert.equal('portfolioDecision' in proposal, false);
    assert.equal('tradingIntent' in proposal, false);
    assert.equal('orderId' in proposal, false);
  });

  it('supports historical / backtest / research simulation context', async () => {
    const service = new StrategyIntelligenceService();
    service.registerSpecialist(new DirectionalSwingSpecialist({ strategyId: 'strat-swing-1' }));

    const historicalState = buildMarketState({
      marketStateId: 'ms-hist-500',
      validityContext: 'historical',
      freshness: 'historical',
      marketTime: '2024-01-01T00:00:00.000Z',
      observedAt: '2024-01-01T00:00:00.000Z',
    });
    const historicalOpp = buildOpportunity({
      opportunityId: 'opp-hist-500',
      marketStateId: 'ms-hist-500',
      createdAt: '2024-01-01T00:00:00.000Z',
      expiresAt: '2024-01-01T01:00:00.000Z',
    });

    const context = buildContext({
      environment: 'historical',
      marketState: historicalState,
      opportunity: historicalOpp,
      now: '2024-01-01T00:05:00.000Z',
    });

    const result = await service.evaluate(context);
    assert.equal(result.status, 'PROPOSED');
    assert.equal(result.proposal.marketState.validityContext, 'historical');
    assert.doesNotThrow(() => validateTradeProposal(result.proposal));
  });
});
