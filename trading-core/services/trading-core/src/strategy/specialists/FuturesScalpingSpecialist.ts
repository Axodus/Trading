import type { StrategyFamily } from '../../../../../packages/trading-contracts/src/index.js';
import type { StrategyContext, StrategySpecialistResult } from '../StrategyContext.js';
import type { StrategySpecialist } from '../StrategySpecialist.js';

export class FuturesScalpingSpecialist implements StrategySpecialist {
  readonly specialistId: string;
  readonly strategyId: string;
  readonly supportedFamilies: readonly StrategyFamily[] = ['futures-scalping'];

  constructor(params: { specialistId?: string; strategyId: string }) {
    this.specialistId = params.specialistId ?? `specialist-scalp-${params.strategyId}`;
    this.strategyId = params.strategyId;
  }

  evaluate(context: StrategyContext): StrategySpecialistResult {
    const spreadFeature = context.marketState.features.find((f) => f.featureId === 'spread_bps');
    const spreadValue = typeof spreadFeature?.value === 'number' ? spreadFeature.value : undefined;

    if (spreadValue !== undefined && spreadValue > 25) {
      return {
        status: 'NO_PROPOSAL',
        reason: `Spread (${spreadValue} bps) is too wide for scalping (max 25 bps)`,
      };
    }

    const directionHint = context.opportunity.expectedCharacteristics['direction'] ?? 'buy';
    const action = directionHint === 'sell' || directionHint === 'short' ? 'sell' : 'buy';

    return {
      status: 'PROPOSED',
      candidate: {
        action,
        sizing: {
          requestedQuantity: '1.0',
          requestedCapital: '20000',
          maxQuantity: '2.0',
          maxCapital: '40000',
          leverage: '3.0',
        },
        expectedReturn: {
          targetReturnBps: 20,
          expectedEdgeBps: 15,
        },
        expectedRisk: {
          stopLossBps: 10,
          maxRiskPerTradeBps: 10,
        },
        liquidityAssumptions: {
          maxSlippageBps: 2,
          immediateFillRequired: true,
        },
        duration: {
          horizon: '5m',
          maxHoldMinutes: 5,
        },
        costAssumptions: {
          makerFeeBps: 1,
          takerFeeBps: 3,
        },
        confidence: 0.9,
        expiresInMs: 15_000,
        evidenceRefs: ['evidence:scalping-model-v1'],
        rationale: `Scalping hypothesis for ${action.toUpperCase()} on ${context.opportunity.instrument} with 3x requested leverage`,
      },
    };
  }
}
