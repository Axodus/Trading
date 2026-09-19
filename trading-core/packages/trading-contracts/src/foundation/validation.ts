export class TradingContractValidationError extends Error {
  constructor(public readonly issues: readonly { path: string; message: string }[]) {
    super(`Trading contract validation failed: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
    this.name = 'TradingContractValidationError';
  }
}

const required = (value: unknown, path: string, issues: { path: string; message: string }[]) => {
  if (typeof value !== 'string' || value.trim().length === 0) issues.push({ path, message: 'non-empty string required' });
};

const same = (left: unknown, right: unknown, path: string, issues: { path: string; message: string }[]) => {
  if (left !== right) issues.push({ path, message: 'reference does not match related contract' });
};

export function validateStrategyRevision(value: unknown): asserts value is import('../strategy/types.js').StrategyRevision {
  const input = value as Partial<import('../strategy/types.js').StrategyRevision>;
  const issues: { path: string; message: string }[] = [];
  if (!input || typeof input !== 'object') throw new TradingContractValidationError([{ path: '$', message: 'object required' }]);
  required(input.strategy?.strategyId, 'strategy.strategyId', issues);
  required(input.revisionId, 'revisionId', issues);
  required(input.artifactRef, 'artifactRef', issues);
  required(input.parameterSchemaRef, 'parameterSchemaRef', issues);
  if (!Number.isInteger(input.revision) || (input.revision ?? 0) < 1) issues.push({ path: 'revision', message: 'positive integer required' });
  if (!Array.isArray(input.featureDefinitions)) issues.push({ path: 'featureDefinitions', message: 'array required' });
  if (issues.length) throw new TradingContractValidationError(issues);
}

export function validateMarketState(value: unknown): asserts value is import('../market/types.js').MarketState {
  const input = value as Partial<import('../market/types.js').MarketState>;
  const issues: { path: string; message: string }[] = [];
  if (!input || typeof input !== 'object') throw new TradingContractValidationError([{ path: '$', message: 'object required' }]);
  required(input.marketStateId, 'marketStateId', issues);
  required(input.instrument, 'instrument', issues);
  required(input.timeframe, 'timeframe', issues);
  required(input.schemaVersion, 'schemaVersion', issues);
  required(input.validityContext, 'validityContext', issues);

  if (!Array.isArray(input.features)) {
    issues.push({ path: 'features', message: 'array required' });
  } else {
    input.features.forEach((feat, index) => {
      if (!feat || typeof feat !== 'object') {
        issues.push({ path: `features[${index}]`, message: 'feature object required' });
      } else {
        required(feat.featureId, `features[${index}].featureId`, issues);
        required(feat.featureVersion, `features[${index}].featureVersion`, issues);
        required(feat.computedAt, `features[${index}].computedAt`, issues);
        if (feat.value === undefined) {
          issues.push({ path: `features[${index}].value`, message: 'feature value is required' });
        }
      }
    });
  }

  if (input.validityContext === 'live' && input.freshness !== 'current') {
    issues.push({ path: 'freshness', message: 'live state must be current' });
  }
  if (issues.length) throw new TradingContractValidationError(issues);
}

export function validateTradeProposal(value: unknown): asserts value is import('../governance/types.js').TradeProposal {
  const input = value as Partial<import('../governance/types.js').TradeProposal>;
  const issues: { path: string; message: string }[] = [];
  if (!input || typeof input !== 'object') throw new TradingContractValidationError([{ path: '$', message: 'object required' }]);
  required(input.proposalId, 'proposalId', issues);
  required(input.strategyId, 'strategyId', issues);
  required(input.strategyRevisionId, 'strategyRevisionId', issues);
  required(input.opportunity?.opportunityId, 'opportunity.opportunityId', issues);
  required(input.marketState?.marketStateId, 'marketState.marketStateId', issues);
  required(input.correlationId, 'correlationId', issues);
  required(input.idempotencyKey, 'idempotencyKey', issues);
  same(input.strategyId, input.strategyRevision?.strategy.strategyId, 'strategyRevision.strategy.strategyId', issues);
  same(input.strategyRevisionId, input.strategyRevision?.revisionId, 'strategyRevision.revisionId', issues);
  same(input.strategyRevisionId, input.eligibility?.strategyRevisionId, 'eligibility.strategyRevisionId', issues);
  same(input.marketState?.marketStateId, input.opportunity?.marketStateId, 'opportunity.marketStateId', issues);
  if (input.eligibility?.decision !== 'ELIGIBLE') issues.push({ path: 'eligibility.decision', message: 'proposal requires ELIGIBLE strategy revision' });
  if (issues.length) throw new TradingContractValidationError(issues);
}

export function validateRiskDecision(value: unknown): asserts value is import('../governance/types.js').RiskDecision {
  const input = value as Partial<import('../governance/types.js').RiskDecision>;
  const issues: { path: string; message: string }[] = [];
  if (!input || typeof input !== 'object') throw new TradingContractValidationError([{ path: '$', message: 'object required' }]);
  required(input.riskDecisionId, 'riskDecisionId', issues);
  required(input.proposalId, 'proposalId', issues);
  required(input.portfolioDecisionId, 'portfolioDecisionId', issues);
  required(input.policyVersion, 'policyVersion', issues);
  if (!['ALLOW', 'MODIFY', 'REJECT', 'HALT'].includes(input.outcome ?? '')) issues.push({ path: 'outcome', message: 'invalid risk outcome' });
  if (input.killSwitch?.active && input.outcome !== 'HALT') issues.push({ path: 'outcome', message: 'active kill switch requires HALT' });
  if (issues.length) throw new TradingContractValidationError(issues);
}

export function validateTradingIntent(value: unknown): asserts value is import('../governance/types.js').TradingIntent {
  const input = value as Partial<import('../governance/types.js').TradingIntent>;
  const issues: { path: string; message: string }[] = [];
  if (!input || typeof input !== 'object') throw new TradingContractValidationError([{ path: '$', message: 'object required' }]);
  for (const key of ['intentId', 'strategyId', 'strategyRevisionId', 'marketStateId', 'opportunityId', 'proposalId', 'portfolioDecisionId', 'riskDecisionId', 'eligibilityId', 'instrument', 'executionPolicyRef', 'correlationId', 'idempotencyKey'] as const) required(input[key], key, issues);
  if (issues.length) throw new TradingContractValidationError(issues);
}
