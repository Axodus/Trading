import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TradingContractValidationError,
  validateMarketState,
  validateRiskDecision,
  validateStrategyRevision,
  validateTradeProposal,
  validateTradingIntent,
} from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';

function validEntities() {
  const strategy = {
    strategyId: 'strat-arb-1',
    family: 'arbitrage',
    name: 'Binance Neutral Basis',
    organizationId: 'org-axodus',
  };
  const strategyRevision = {
    strategy,
    revision: 1,
    revisionId: 'strat-arb-1:1',
    artifactRef: 'ipfs://strat-arb-1-v1',
    parameterSchemaRef: 'schema://arb-params/v1',
    featureDefinitions: [{ featureId: 'basis_spread', featureVersion: '1.0.0' }],
    marketStateSchemaVersion: '1.0.0',
    lifecycleState: 'TESTNET',
    createdAt: '2026-09-19T12:00:00.000Z',
    createdBy: 'agent-alice',
  };
  const marketState = {
    marketStateId: 'ms-live-1',
    instrument: 'BTC-USDT',
    venue: 'binance',
    timeframe: '1m',
    marketTime: '2026-09-19T12:00:00.000Z',
    observedAt: '2026-09-19T12:00:01.000Z',
    constructedAt: '2026-09-19T12:00:01.100Z',
    validityContext: 'live',
    freshness: 'current',
    schemaVersion: '1.0.0',
    features: [{ featureId: 'basis_spread', featureVersion: '1.0.0', value: 12.5, computedAt: '2026-09-19T12:00:01.000Z' }],
    sourceRefs: ['book:binance:BTC-USDT'],
    completeness: 'complete',
    validationRefs: ['val-market-pass'],
  };
  const opportunity = {
    opportunityId: 'opp-1',
    instrument: 'BTC-USDT',
    venue: 'binance',
    strategyId: 'strat-arb-1',
    strategyRevisionId: 'strat-arb-1:1',
    timeframe: '1m',
    marketStateId: 'ms-live-1',
    qualification: 'qualified',
    expectedCharacteristics: { edgeBps: 15 },
    evidenceRefs: ['ev-opp-1'],
    createdAt: '2026-09-19T12:00:01.200Z',
    expiresAt: '2026-09-19T12:01:00.000Z',
  };
  const eligibility = {
    eligibilityId: 'elig-1',
    strategyRevisionId: 'strat-arb-1:1',
    targetState: 'TESTNET',
    decision: 'ELIGIBLE',
    evidenceRefs: ['ev-quant-1'],
    policyVersion: '1.0.0',
    checks: ['robustness', 'deflated-sharpe'],
    violations: [],
    decidedAt: '2026-09-19T11:00:00.000Z',
    authorityRef: 'gov-risk-board',
  };
  const tradeProposal = {
    proposalId: 'prop-1',
    strategyId: 'strat-arb-1',
    strategyRevisionId: 'strat-arb-1:1',
    strategyRevision,
    opportunity,
    marketState,
    action: 'buy',
    sizing: { requestedQuantity: '0.1', requestedCapital: '5000' },
    expectedReturn: { alpha: '0.002' },
    expectedRisk: { maxDrawdown: '0.01' },
    liquidityAssumptions: { depth: 'sufficient' },
    duration: { horizon: '5m' },
    costAssumptions: { feeBps: '2' },
    eligibility,
    correlationId: 'corr-req01-1',
    idempotencyKey: 'idemp-req01-1',
    createdAt: '2026-09-19T12:00:01.300Z',
    expiresAt: '2026-09-19T12:00:10.000Z',
    evidenceRefs: ['ev-prop-1'],
  };
  const portfolioDecision = {
    portfolioDecisionId: 'pdec-1',
    proposalIds: ['prop-1'],
    outcome: 'APPROVED',
    requestedCapital: '5000',
    approvedCapital: '5000',
    currentExposure: { notional: '15000' },
    correlatedExposure: { score: 0.1 },
    concentration: { btc: 0.2 },
    leverage: { current: '1.0' },
    liquidity: { status: 'healthy' },
    duration: { maxMinutes: 10 },
    drawdown: { portfolio: '0.02' },
    executionCost: { estimated: '1.5' },
    modifications: {},
    rationale: 'Approved within risk limits',
    evidenceRefs: ['ev-portfolio-1'],
    createdAt: '2026-09-19T12:00:01.400Z',
    expiresAt: '2026-09-19T12:00:10.000Z',
  };
  const riskDecision = {
    riskDecisionId: 'risk-1',
    proposalId: 'prop-1',
    portfolioDecisionId: 'pdec-1',
    marketStateId: 'ms-live-1',
    strategyRevisionId: 'strat-arb-1:1',
    outcome: 'ALLOW',
    policyVersion: '1.0.0',
    hardLimitEvaluation: { maxNotionalAllowed: '10000', passed: true },
    killSwitch: { active: false },
    modifications: {},
    rationale: 'Risk criteria satisfied',
    evidenceRefs: ['ev-risk-1'],
    decidedAt: '2026-09-19T12:00:01.500Z',
    expiresAt: '2026-09-19T12:00:10.000Z',
  };
  const tradingIntent = {
    intentId: 'intent-1',
    strategyId: 'strat-arb-1',
    strategyRevisionId: 'strat-arb-1:1',
    marketStateId: 'ms-live-1',
    opportunityId: 'opp-1',
    proposalId: 'prop-1',
    portfolioDecisionId: 'pdec-1',
    riskDecisionId: 'risk-1',
    eligibilityId: 'elig-1',
    instrument: 'BTC-USDT',
    venue: 'binance',
    action: 'buy',
    approvedQuantity: '0.1',
    approvedCapital: '5000',
    executionPolicyRef: 'policy://exec/neutral',
    correlationId: 'corr-req01-1',
    idempotencyKey: 'idemp-req01-1',
    createdAt: '2026-09-19T12:00:01.600Z',
    expiresAt: '2026-09-19T12:00:10.000Z',
    evidenceRefs: ['ev-intent-1'],
  };
  return {
    strategy,
    strategyRevision,
    marketState,
    opportunity,
    eligibility,
    tradeProposal,
    portfolioDecision,
    riskDecision,
    tradingIntent,
  };
}

describe('REQ-01 Canonical Harness Contract Foundations', () => {
  it('validates canonical objects and cross-contract lineage', () => {
    const { strategyRevision, marketState, tradeProposal, riskDecision, tradingIntent } = validEntities();
    assert.doesNotThrow(() => validateStrategyRevision(strategyRevision));
    assert.doesNotThrow(() => validateMarketState(marketState));
    assert.doesNotThrow(() => validateTradeProposal(tradeProposal));
    assert.doesNotThrow(() => validateRiskDecision(riskDecision));
    assert.doesNotThrow(() => validateTradingIntent(tradingIntent));
  });

  it('allows historical MarketState with the same schema and feature versions', () => {
    const { marketState } = validEntities();
    const historicalState = {
      ...marketState,
      marketStateId: 'ms-hist-1',
      validityContext: 'historical',
      freshness: 'historical',
      marketTime: '2024-01-01T00:00:00.000Z',
      observedAt: '2024-01-01T00:00:00.000Z',
      constructedAt: '2026-09-19T12:00:00.000Z',
    };
    assert.doesNotThrow(() => validateMarketState(historicalState));
  });

  it('rejects stale live MarketState', () => {
    const { marketState } = validEntities();
    const staleLive = { ...marketState, freshness: 'stale' };
    assert.throws(() => validateMarketState(staleLive), TradingContractValidationError);
  });

  it('rejects TradeProposal with ineligible StrategyRevision', () => {
    const { tradeProposal, eligibility } = validEntities();
    const ineligibleProposal = {
      ...tradeProposal,
      eligibility: { ...eligibility, decision: 'NOT_ELIGIBLE' },
    };
    assert.throws(() => validateTradeProposal(ineligibleProposal), TradingContractValidationError);
  });

  it('rejects RiskDecision ALLOW when kill-switch is active', () => {
    const { riskDecision } = validEntities();
    const badRisk = { ...riskDecision, outcome: 'ALLOW', killSwitch: { active: true } };
    assert.throws(() => validateRiskDecision(badRisk), TradingContractValidationError);
  });

  it('requires RiskDecision HALT when kill-switch is active', () => {
    const { riskDecision } = validEntities();
    const haltedRisk = { ...riskDecision, outcome: 'HALT', killSwitch: { active: true } };
    assert.doesNotThrow(() => validateRiskDecision(haltedRisk));
  });
});
