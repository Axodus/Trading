import type { Opportunity } from '../../../../packages/trading-contracts/src/index.js';

export interface OpportunityRankingContext {
  methodologyId: string;
  methodologyVersion: string;
  strategyId: string;
  timeframe: string;
  universeRef: string;
}

export interface RankedOpportunity {
  opportunity: Opportunity;
  rank: number;
  comparisonValue?: number;
}

export class OpportunityRankingService {
  rank(opportunities: readonly Opportunity[], context: OpportunityRankingContext): readonly RankedOpportunity[] {
    const scoped = opportunities.filter((opportunity) => opportunity.strategyId === context.strategyId && opportunity.timeframe === context.timeframe && opportunity.status === 'QUALIFIED');
    const comparable = scoped.map((opportunity) => ({ opportunity, comparisonValue: comparisonValue(opportunity) }));
    comparable.sort((left, right) => (right.comparisonValue ?? Number.NEGATIVE_INFINITY) - (left.comparisonValue ?? Number.NEGATIVE_INFINITY) || left.opportunity.opportunityId.localeCompare(right.opportunity.opportunityId));
    return comparable.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }
}

function comparisonValue(opportunity: Opportunity): number | undefined {
  const value = opportunity.expectedCharacteristics['discoveryRelevance'];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
