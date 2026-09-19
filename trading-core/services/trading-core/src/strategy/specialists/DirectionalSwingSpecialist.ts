import type { StrategyFamily } from '../../../../../packages/trading-contracts/src/index.js';
import type { StrategyContext, StrategySpecialistResult } from '../StrategyContext.js';
import type { StrategySpecialist } from '../StrategySpecialist.js';

export class DirectionalSwingSpecialist implements StrategySpecialist {
  readonly specialistId: string;
  readonly strategyId: string;
  readonly supportedFamilies: readonly StrategyFamily[] = ['spot-swing', 'futures-day-trading'];

  constructor(params: { specialistId?: string; strategyId: string }) {
    this.specialistId = params.specialistId ?? `specialist-swing-${params.strategyId}`;
    this.strategyId = params.strategyId;
  }

  evaluate(context: StrategyContext): StrategySpecialistResult {
    const trendFeature = context.marketState.features.find((f) => f.featureId === 'trend' || f.featureId === 'momentum');
    const trendValue = trendFeature?.value;

    const relevance = context.opportunity.expectedCharacteristics['discoveryRelevance'];
    const directionHint = context.opportunity.expectedCharacteristics['direction'];

    if (typeof relevance === 'number' && relevance < 0.5) {
      return {
        status: 'NO_PROPOSAL',
        reason: 'Opportunity discoveryRelevance is below threshold (0.5)',
      };
    }

    let action: 'buy' | 'sell' | undefined;
    if (directionHint === 'long' || trendValue === 'bullish' || (typeof trendValue === 'number' && trendValue > 0)) {
      action = 'buy';
    } else if (directionHint === 'short' || trendValue === 'bearish' || (typeof trendValue === 'number' && trendValue < 0)) {
      action = 'sell';
    } else if (directionHint === 'buy') {
      action = 'buy';
    } else if (directionHint === 'sell') {
      action = 'sell';
    }

    if (!action) {
      return {
        status: 'NO_PROPOSAL',
        reason: 'Directional criteria not satisfied: no clear directional signal',
      };
    }

    return {
      status: 'PROPOSED',
      candidate: {
        action,
        sizing: {
          requestedQuantity: '0.25',
          requestedCapital: '15000',
          maxQuantity: '0.5',
          maxCapital: '30000',
          leverage: '1.0',
        },
        expectedReturn: {
          targetReturnBps: 150,
          alpha: '0.015',
        },
        expectedRisk: {
          stopLossBps: 75,
          maxDrawdown: '0.0075',
        },
        liquidityAssumptions: {
          maxSlippageBps: 5,
          minimumMarketDepth: 'sufficient',
        },
        duration: {
          horizon: '4h',
          maxHoldMinutes: 240,
        },
        costAssumptions: {
          feeBps: 2,
          estimatedFundingBps: 0,
        },
        confidence: typeof relevance === 'number' ? Math.min(1, Math.max(0, relevance)) : 0.85,
        expiresInMs: 60_000,
        evidenceRefs: ['evidence:swing-model-v1'],
        rationale: `Directional swing signal for ${action.toUpperCase()} on ${context.opportunity.instrument}`,
      },
    };
  }
}
