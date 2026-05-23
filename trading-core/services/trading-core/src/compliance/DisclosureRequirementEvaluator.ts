import type {
  DisclosureRequirementTarget,
  TradingExecutionContext,
  TradingRiskDisclosure,
} from '../../../../packages/trading-contracts/src/index.js';

export class DisclosureRequirementEvaluator {
  getRequiredDisclosures(request: {
    context: TradingExecutionContext;
    target: DisclosureRequirementTarget;
    disclosures: TradingRiskDisclosure[];
  }): TradingRiskDisclosure[] {
    if (request.context.executionDomain === 'treasury') {
      return [];
    }

    return request.disclosures.filter((disclosure) => disclosure.requiredFor.includes(request.target));
  }
}
