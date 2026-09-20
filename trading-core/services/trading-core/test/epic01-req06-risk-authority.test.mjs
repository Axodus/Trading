import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FixedDecimal,
  validateRiskDecision,
  TradingContractValidationError,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';
import {
  RiskAuthorityService,
  validateRiskDecisionProperties,
  validateRiskEvaluationContext,
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
    policyVersion: 'risk-policy-v1',
    policyRevision: 1,
    maxCapitalPerTrade: '25000', // 25k limit per trade
    maxGrossExposureTotal: '80000', // 80k max total gross portfolio exposure
    maxInstrumentGrossExposure: {
      'BTC-USDT': '40000', // max 40k gross in BTC
    },
    defaultMaxInstrumentGrossExposure: '30000',
    maxStrategyGrossExposure: {
      'strat-swing-1': '35000',
    },
    defaultMaxStrategyGrossExposure: '25000',
    maxLeverageCeiling: '3.0',
    maxMarketStateAgeMs: 10_000,
    maxPortfolioDecisionAgeMs: 15_000,
    allowOpposingPositions: false,
    allowModifyOnCapitalBreach: true,
    allowModifyOnLeverageBreach: true,
    degradedStrategyAction: 'MODIFY',
    degradedCapitalMultiplier: '0.5',
    degradedLeverageCap: '1.5',
    ...overrides,
  };
}

function buildStrategyRevision(overrides = {}) {
  return {
    strategy: {
      strategyId: 'strat-swing-1',
      family: 'spot-swing',
      name: 'Alpha Swing',
      organizationId: 'org-axodus',
    },
    revision: 1,
    revisionId: 'strat-swing-1:1',
    artifactRef: 'ipfs://strat-swing-1-v1',
    parameterSchemaRef: 'schema://swing/v1',
    featureDefinitions: [{ featureId: 'spread', featureVersion: '1.0.0' }],
    marketStateSchemaVersion: '1.0.0',
    lifecycleState: 'TESTNET',
    createdAt: '2026-09-19T10:00:00.000Z',
    createdBy: 'agent-dev',
    ...overrides,
  };
}

function buildProposal(overrides = {}) {
  return {
    proposalId: 'prop-1',
    strategyId: 'strat-swing-1',
    strategyRevisionId: 'strat-swing-1:1',
    strategyRevision: {
      strategy: {
        strategyId: 'strat-swing-1',
        family: 'spot-swing',
        name: 'Alpha Swing',
        organizationId: 'org-axodus',
      },
      revision: 1,
      revisionId: 'strat-swing-1:1',
    },
    opportunity: {
      opportunityId: 'opp-1',
      marketStateId: 'ms-1',
      instrument: 'BTC-USDT',
      venue: 'binance',
      timeframe: '1m',
    },
    marketState: {
      marketStateId: 'ms-1',
      schemaVersion: '1.0.0',
      validityContext: 'live',
    },
    action: 'buy',
    sizing: {
      requestedQuantity: '0.25',
      requestedCapital: '20000',
      leverage: '2.0',
    },
    expectedReturn: { alpha: '0.02' },
    expectedRisk: { stopLossBps: 50 },
    liquidityAssumptions: { depth: 'high' },
    duration: { horizon: '4h' },
    costAssumptions: { feeBps: 2 },
    confidence: 0.9,
    eligibility: {
      eligibilityId: 'elig-1',
      strategyRevisionId: 'strat-swing-1:1',
      decision: 'ELIGIBLE',
      policyVersion: '1.0.0',
    },
    correlationId: 'corr-1',
    idempotencyKey: 'idemp-1',
    createdAt: '2026-09-19T12:00:01.000Z',
    expiresAt: '2026-09-19T12:05:00.000Z',
    evidenceRefs: ['ev-prop-1'],
    ...overrides,
  };
}

function buildPortfolioDecision(overrides = {}) {
  return {
    portfolioDecisionId: 'pdec-1',
    proposalIds: ['prop-1'],
    outcome: 'APPROVED',
    requestedCapital: '20000',
    approvedCapital: '20000',
    currentExposure: { instrument: 'BTC-USDT', notional: '12000' },
    correlatedExposure: { status: 'unknown' },
    concentration: { instrument: 'BTC-USDT' },
    leverage: { requestedLeverage: '2.0' },
    liquidity: { status: 'evaluated' },
    duration: { horizon: '4h' },
    drawdown: { status: 'healthy' },
    executionCost: { feeBps: 2 },
    modifications: {},
    rationale: 'Portfolio approved full requested capital',
    evidenceRefs: ['ev-pdec-1'],
    createdAt: '2026-09-19T12:00:02.000Z',
    expiresAt: '2026-09-19T12:05:00.000Z',
    ...overrides,
  };
}

function buildMarketState(overrides = {}) {
  return {
    marketStateId: 'ms-1',
    instrument: 'BTC-USDT',
    venue: 'binance',
    timeframe: '1m',
    marketTime: '2026-09-19T12:00:00.000Z',
    observedAt: '2026-09-19T12:00:01.000Z',
    constructedAt: '2026-09-19T12:00:01.100Z',
    validityContext: 'live',
    freshness: 'current',
    schemaVersion: '1.0.0',
    features: [{ featureId: 'spread', featureVersion: '1.0.0', value: 10, computedAt: '2026-09-19T12:00:01.000Z' }],
    sourceRefs: ['src-1'],
    completeness: 'complete',
    validationRefs: ['val-1'],
    ...overrides,
  };
}

function buildContext(overrides = {}) {
  const strategyHealth = overrides.strategyHealth ?? {
    strategyId: 'strat-swing-1',
    strategyRevisionId: 'strat-swing-1:1',
    state: 'HEALTHY',
    observedAt: '2026-09-19T12:00:00.000Z',
    expectedEvidenceRefs: [],
    observedEvidenceRefs: [],
    divergenceRefs: [],
    rationale: 'All health checks green',
  };
  return {
    portfolioDecision: overrides.portfolioDecision ?? buildPortfolioDecision(),
    proposal: overrides.proposal ?? buildProposal(),
    strategyRevision: overrides.strategyRevision ?? buildStrategyRevision(),
    policy: overrides.policy ?? buildPolicy(),
    exposureSnapshot: overrides.exposureSnapshot ?? buildSnapshot(),
    strategyHealth,
    operationalSnapshot: overrides.operationalSnapshot ?? {
      snapshotId: 'ops-risk-1',
      strategyId: 'strat-swing-1',
      strategyRevisionId: 'strat-swing-1:1',
      lifecycleState: 'PRODUCTION',
      lifecycleVersion: 1,
      healthState: strategyHealth.state,
      healthVersion: 1,
      compatibility: strategyHealth.state === 'HEALTHY' ? 'FULL' : strategyHealth.state === 'DEGRADED' ? 'CONDITIONAL' : 'REJECTED',
      effectiveAt: '2026-09-19T12:00:00.000Z',
      expiresAt: '2026-09-19T12:10:00.000Z',
      snapshotVersion: 'ops-risk-v1',
    },
    marketState: overrides.marketState ?? buildMarketState(),
    eligibility: overrides.eligibility ?? {
      eligibilityId: 'elig-1',
      strategyRevisionId: 'strat-swing-1:1',
      targetState: 'TESTNET',
      decision: 'ELIGIBLE',
      evidenceRefs: [],
      policyVersion: '1.0.0',
      checks: [],
      violations: [],
      decidedAt: '2026-09-19T10:00:00.000Z',
      authorityRef: 'gov',
    },
    evaluationTime: '2026-09-19T12:00:03.000Z',
    correlationId: 'corr-risk-1',
    environment: 'live',
    ...overrides,
  };
}

describe('REQ-06 Risk Authority & Execution Boundary', () => {
  const service = new RiskAuthorityService();

  it('produces ALLOW when all limits, health, freshness, and exposures are respected', () => {
    const ctx = buildContext();
    const result = service.evaluate(ctx);

    assert.equal(result.outcome, 'ALLOW');
    assert.equal(result.effectiveCapital, '20000');
    assert.equal(result.effectiveLeverage, '2');
    assert.equal(result.violations.length, 0);
    assert.equal(result.modifications.length, 0);
    assert.doesNotThrow(() => validateRiskDecision(result.decision));
  });

  it('produces MODIFY when capital exceeds policy limit and allowModifyOnCapitalBreach is true', () => {
    const ctx = buildContext({
      portfolioDecision: buildPortfolioDecision({ approvedCapital: '30000' }), // policy max is 25000
      proposal: buildProposal({ sizing: { requestedQuantity: '0.4', requestedCapital: '30000' } }),
      policy: buildPolicy({ maxStrategyGrossExposure: { 'strat-swing-1': '50000' } }), // ensure strategy gross doesn't block MODIFY
    });
    const result = service.evaluate(ctx);

    assert.equal(result.outcome, 'MODIFY');
    assert.equal(result.effectiveCapital, '25000');
    assert.ok(result.reasons.includes('CAPITAL_LIMIT_EXCEEDED'));
    assert.doesNotThrow(() => validateRiskDecision(result.decision));
    assert.equal(result.decision.outcome, 'MODIFY');
  });

  it('produces REJECT when capital exceeds policy limit and allowModifyOnCapitalBreach is false', () => {
    const ctx = buildContext({
      policy: buildPolicy({ allowModifyOnCapitalBreach: false }),
      portfolioDecision: buildPortfolioDecision({ approvedCapital: '30000' }),
    });
    const result = service.evaluate(ctx);

    assert.equal(result.outcome, 'REJECT');
    assert.equal(result.effectiveCapital, '0');
    assert.ok(result.reasons.includes('CAPITAL_LIMIT_EXCEEDED'));
    assert.equal(result.decision.outcome, 'REJECT');
  });

  it('produces MODIFY when leverage exceeds ceiling and allowModifyOnLeverageBreach is true', () => {
    const ctx = buildContext({
      proposal: buildProposal({ sizing: { requestedQuantity: '0.1', requestedCapital: '10000', leverage: '5.0' } }), // policy max is 3.0
    });
    const result = service.evaluate(ctx);

    assert.equal(result.outcome, 'MODIFY');
    assert.equal(result.effectiveLeverage, '3');
    assert.ok(result.reasons.includes('LEVERAGE_LIMIT_EXCEEDED'));
    assert.equal(result.decision.outcome, 'MODIFY');
  });

  it('strictly enforces Risk Monotonicity: cannot increase upstream capital or leverage', () => {
    const ctx = buildContext({
      portfolioDecision: buildPortfolioDecision({ approvedCapital: '15000' }),
      proposal: buildProposal({ sizing: { requestedQuantity: '0.2', requestedCapital: '15000', leverage: '2.0' } }),
      policy: buildPolicy({ maxCapitalPerTrade: '50000', maxLeverageCeiling: '10.0' }),
    });
    const result = service.evaluate(ctx);

    assert.equal(result.outcome, 'ALLOW');
    // Upstream was 15k and 2x; Risk cannot expand it even though policy allows 50k and 10x
    assert.equal(result.effectiveCapital, '15000');
    assert.equal(result.effectiveLeverage, '2');
  });

  it('rejects SUSPENDED and RETIRED StrategyHealth states fail-closed', () => {
    const suspendedCtx = buildContext({
      strategyHealth: {
        strategyId: 'strat-swing-1',
        strategyRevisionId: 'strat-swing-1:1',
        state: 'SUSPENDED',
        observedAt: '2026-09-19T12:00:00.000Z',
        expectedEvidenceRefs: [],
        observedEvidenceRefs: [],
        divergenceRefs: ['anomaly'],
        rationale: 'Suspended by telemetry monitor',
      },
    });
    const suspendedResult = service.evaluate(suspendedCtx);
    assert.equal(suspendedResult.outcome, 'REJECT');
    assert.ok(suspendedResult.reasons.includes('STRATEGY_HEALTH_SUSPENDED'));

    const retiredCtx = buildContext({
      strategyHealth: {
        strategyId: 'strat-swing-1',
        strategyRevisionId: 'strat-swing-1:1',
        state: 'RETIRED',
        observedAt: '2026-09-19T12:00:00.000Z',
        expectedEvidenceRefs: [],
        observedEvidenceRefs: [],
        divergenceRefs: [],
        rationale: 'Strategy retired',
      },
    });
    const retiredResult = service.evaluate(retiredCtx);
    assert.equal(retiredResult.outcome, 'REJECT');
    assert.ok(retiredResult.reasons.includes('STRATEGY_HEALTH_RETIRED'));
  });

  it('rejects UNKNOWN StrategyHealth and REVALIDATION_REQUIRED fail-closed', () => {
    const unknownCtx = buildContext({
      strategyHealth: {
        strategyId: 'strat-swing-1',
        strategyRevisionId: 'strat-swing-1:1',
        state: 'UNKNOWN',
        observedAt: '2026-09-19T12:00:00.000Z',
        expectedEvidenceRefs: [],
        observedEvidenceRefs: [],
        divergenceRefs: [],
        rationale: 'Unknown state',
      },
    });
    const unknownResult = service.evaluate(unknownCtx);
    assert.equal(unknownResult.outcome, 'REJECT');
    assert.ok(unknownResult.reasons.includes('STRATEGY_HEALTH_UNKNOWN'));

    const revalCtx = buildContext({
      strategyHealth: {
        strategyId: 'strat-swing-1',
        strategyRevisionId: 'strat-swing-1:1',
        state: 'REVALIDATION_REQUIRED',
        observedAt: '2026-09-19T12:00:00.000Z',
        expectedEvidenceRefs: [],
        observedEvidenceRefs: [],
        divergenceRefs: [],
        rationale: 'Performance drift detected in paper',
      },
    });
    const revalResult = service.evaluate(revalCtx);
    assert.equal(revalResult.outcome, 'REJECT');
    assert.ok(revalResult.reasons.includes('STRATEGY_HEALTH_REVALIDATION_REQUIRED'));
  });

  it('handles DEGRADED StrategyHealth according to policy (MODIFY with capital reduction)', () => {
    const degradedCtx = buildContext({
      strategyHealth: {
        strategyId: 'strat-swing-1',
        strategyRevisionId: 'strat-swing-1:1',
        state: 'DEGRADED',
        observedAt: '2026-09-19T12:00:00.000Z',
        expectedEvidenceRefs: [],
        observedEvidenceRefs: [],
        divergenceRefs: ['minor-slippage'],
        rationale: 'Degraded execution quality',
      },
    });
    const result = service.evaluate(degradedCtx);
    assert.equal(result.outcome, 'MODIFY');
    assert.equal(result.effectiveCapital, '10000'); // 50% multiplier on 20k approved
    assert.equal(result.effectiveLeverage, '1.5'); // degraded leverage cap is 1.5
    assert.ok(result.reasons.includes('STRATEGY_HEALTH_DEGRADED'));
  });

  it('fails closed when MarketState is stale or not current', () => {
    const staleTimeCtx = buildContext({
      evaluationTime: '2026-09-19T12:00:25.000Z', // 24s after observedAt (policy max is 10s)
    });
    const staleTimeResult = service.evaluate(staleTimeCtx);
    assert.equal(staleTimeResult.outcome, 'REJECT');
    assert.ok(staleTimeResult.reasons.includes('STALE_MARKET_STATE'));

    const staleFreshnessCtx = buildContext({
      marketState: buildMarketState({ freshness: 'stale' }),
    });
    const staleFreshnessResult = service.evaluate(staleFreshnessCtx);
    assert.equal(staleFreshnessResult.outcome, 'REJECT');
    assert.ok(staleFreshnessResult.reasons.includes('STALE_MARKET_STATE'));
  });

  it('fails closed when PortfolioDecision is stale or expired', () => {
    const expiredCtx = buildContext({
      evaluationTime: '2026-09-19T12:06:00.000Z', // past pdec expiresAt 12:05:00
    });
    const result = service.evaluate(expiredCtx);
    assert.equal(result.outcome, 'REJECT');
    assert.ok(result.reasons.includes('STALE_PORTFOLIO_DECISION'));
  });

  it('fails closed on opposing position without explicit hedge/netting policy', () => {
    const opposingCtx = buildContext({
      // snapshot has existing net LONG BTC (12k)
      proposal: buildProposal({ action: 'sell', instrument: 'BTC-USDT' }),
    });
    const result = service.evaluate(opposingCtx);
    assert.equal(result.outcome, 'REJECT');
    assert.ok(result.reasons.includes('OPPOSING_POSITION_FAIL_CLOSED'));
  });

  it('preserves gross exposure semantics so netting does not hide concentration', () => {
    // Snapshot has 12k BTC long. Max instrument gross is 40k.
    // Max capital per trade is 50k so capital limit doesn't reject first.
    // If proposal requests 30k BTC buy, projected gross is 12k + 30k = 42k > 40k -> REJECT
    const ctx = buildContext({
      policy: buildPolicy({ maxCapitalPerTrade: '50000', maxStrategyGrossExposure: { 'strat-swing-1': '50000' } }),
      portfolioDecision: buildPortfolioDecision({ approvedCapital: '30000' }),
      proposal: buildProposal({ sizing: { requestedQuantity: '0.4', requestedCapital: '30000' } }),
    });
    const result = service.evaluate(ctx);
    assert.equal(result.outcome, 'REJECT');
    assert.ok(result.reasons.includes('INSTRUMENT_CONCENTRATION_EXCEEDED'));
  });

  it('produces HALT with SYSTEM scope when system kill-switch is active', () => {
    const haltCtx = buildContext({
      policy: buildPolicy({
        systemHaltActive: true,
        systemHaltReference: 'EMERGENCY_KILL_SWITCH_ACTIVE',
      }),
    });
    const result = service.evaluate(haltCtx);

    assert.equal(result.outcome, 'HALT');
    assert.equal(result.haltScope, 'SYSTEM');
    assert.equal(result.decision.killSwitch.active, true);
    assert.equal(result.decision.killSwitch.reference, 'HALT_SCOPE:SYSTEM');
    assert.doesNotThrow(() => validateRiskDecision(result.decision));
  });

  it('produces HALT with PORTFOLIO scope when portfolio state is inconsistent', () => {
    const badSnapshot = buildSnapshot({
      totalCapital: '100000',
      availableCapital: '70000',
      reservedCapital: '40000', // 70k + 40k = 110k > 100k
    });
    const ctx = buildContext({ exposureSnapshot: badSnapshot });
    const result = service.evaluate(ctx);

    assert.equal(result.outcome, 'HALT');
    assert.equal(result.haltScope, 'PORTFOLIO');
    assert.ok(result.reasons.includes('PORTFOLIO_STATE_INCONSISTENT'));
  });

  it('enforces disposition precedence: HALT > REJECT > MODIFY > ALLOW', () => {
    // Case 1: leverage breach (MODIFY) + health SUSPENDED (REJECT) -> REJECT wins
    const rejectWinsCtx = buildContext({
      proposal: buildProposal({ sizing: { requestedQuantity: '0.1', requestedCapital: '10000', leverage: '5.0' } }),
      strategyHealth: {
        strategyId: 'strat-swing-1',
        strategyRevisionId: 'strat-swing-1:1',
        state: 'SUSPENDED',
        observedAt: '2026-09-19T12:00:00.000Z',
        expectedEvidenceRefs: [],
        observedEvidenceRefs: [],
        divergenceRefs: [],
        rationale: 'Suspended',
      },
    });
    const rejectWinsResult = service.evaluate(rejectWinsCtx);
    assert.equal(rejectWinsResult.outcome, 'REJECT');

    // Case 2: capital breach (MODIFY) + kill switch (HALT) -> HALT wins
    const haltWinsCtx = buildContext({
      portfolioDecision: buildPortfolioDecision({ approvedCapital: '30000' }),
      policy: buildPolicy({ systemHaltActive: true, systemHaltReference: 'OPS_HALT' }),
    });
    const haltWinsResult = service.evaluate(haltWinsCtx);
    assert.equal(haltWinsResult.outcome, 'HALT');
  });

  it('supports deterministic replay producing identical decision hashes and outputs', () => {
    const ctx = buildContext();
    const res1 = service.evaluate(ctx);
    const res2 = service.evaluate(ctx);

    assert.equal(res1.decision.riskDecisionId, res2.decision.riskDecisionId);
    assert.equal(res1.decision.outcome, res2.decision.outcome);
    assert.equal(res1.effectiveCapital, res2.effectiveCapital);
    assert.equal(res1.effectiveLeverage, res2.effectiveLeverage);
  });

  it('uses exact FixedDecimal arithmetic without floating point drift on financial boundaries', () => {
    const borderCtx = buildContext({
      proposal: buildProposal({ sizing: { requestedQuantity: '0.4', requestedCapital: '25000.000000000000' } }),
      portfolioDecision: buildPortfolioDecision({ approvedCapital: '25000.000000000000' }),
      policy: buildPolicy({ maxCapitalPerTrade: '25000.000000000000', maxStrategyGrossExposure: { 'strat-swing-1': '50000' } }),
    });
    const result = service.evaluate(borderCtx);
    assert.equal(result.outcome, 'ALLOW');
    assert.equal(result.effectiveCapital, '25000');

    // Exactly 1 smallest unit (10^-12) over limit -> triggers capital breach
    const overBorderCtx = buildContext({
      proposal: buildProposal({ sizing: { requestedQuantity: '0.4', requestedCapital: '25000.000000000001' } }),
      portfolioDecision: buildPortfolioDecision({ approvedCapital: '25000.000000000001' }),
      policy: buildPolicy({ maxCapitalPerTrade: '25000.000000000000', allowModifyOnCapitalBreach: false, maxStrategyGrossExposure: { 'strat-swing-1': '50000' } }),
    });
    const overResult = service.evaluate(overBorderCtx);
    assert.equal(overResult.outcome, 'REJECT');
  });

  it('guarantees RiskDecision != TradingIntent and does not emit execution authority', () => {
    const ctx = buildContext();
    const result = service.evaluate(ctx);
    const decision = result.decision;

    // Verify it is a valid RiskDecision
    assert.doesNotThrow(() => validateRiskDecision(decision));

    // Invariant: RiskDecision does NOT have TradingIntent or execution provider fields
    assert.equal('intentId' in decision, false);
    assert.equal('approvedQuantity' in decision, false);
    assert.equal('executionPolicyRef' in decision, false);
    assert.equal('orderId' in decision, false);
    assert.equal('clientOrderId' in decision, false);
    assert.equal('connector' in decision, false);
  });
});
