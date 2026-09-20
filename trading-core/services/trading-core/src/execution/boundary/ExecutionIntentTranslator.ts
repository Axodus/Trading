import type {
  ExecutionIntent,
  ExecutionPolicy,
  ExecutionTranslationCommand,
  ExecutionTranslationReasonCode,
} from '../../../../../packages/trading-contracts/src/index.js';
import {
  DEFAULT_EXECUTION_POLICY_V1,
  FixedDecimal,
} from '../../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import type { ExecutionTranslationOutcome } from './ExecutionBoundaryTypes.js';

export function stableExecutionHash(value: unknown): string {
  return stableJson(value);
}

function alignQuantityToStep(quantity: FixedDecimal, step: FixedDecimal): FixedDecimal {
  if (step.raw === 0n) return quantity;
  const stepCount = quantity.raw / step.raw;
  const alignedRaw = stepCount * step.raw;
  const intPart = alignedRaw / 1000000000000n;
  const fracPart = alignedRaw % 1000000000000n;
  const str = fracPart === 0n ? intPart.toString() : `${intPart}.${fracPart.toString().padStart(12, '0')}`;
  return FixedDecimal.from(str);
}

export class ExecutionIntentTranslator {
  public static translate(command: ExecutionTranslationCommand): ExecutionTranslationOutcome {
    const reasonCodes: ExecutionTranslationReasonCode[] = [];
    const {
      tradingIntent,
      targetAdapterType,
      adapterCapabilities,
      evaluationTime,
      killSwitchActive,
      operationalHealthState,
      operationalLifecycleState,
    } = command;
    const policy: ExecutionPolicy = command.policy ?? DEFAULT_EXECUTION_POLICY_V1;

    // 1. Check HALT / Kill Switch (Top Precedence)
    if (killSwitchActive) {
      reasonCodes.push('EXECUTION_HALT_ACTIVE');
    }

    // 2. Check Operational Health & Lifecycle Stale/Invalidation
    if (operationalHealthState === 'SUSPENDED') {
      reasonCodes.push('STRATEGY_HEALTH_SUSPENDED');
    } else if (operationalHealthState === 'RETIRED') {
      reasonCodes.push('STRATEGY_HEALTH_RETIRED');
    } else if (operationalHealthState === 'REVALIDATION_REQUIRED') {
      reasonCodes.push('STRATEGY_HEALTH_REVALIDATION_REQUIRED');
    } else if (operationalHealthState === 'UNKNOWN') {
      reasonCodes.push('STRATEGY_HEALTH_UNKNOWN');
    }

    if (operationalLifecycleState === 'RETIRED') {
      reasonCodes.push('STRATEGY_RETIRED');
    }

    // 3. Check TradingIntent Expiry
    const evalTimeMs = new Date(evaluationTime).getTime();
    const intentExpiryMs = new Date(tradingIntent.expiresAt).getTime();
    if (evalTimeMs >= intentExpiryMs) {
      reasonCodes.push('TRADING_INTENT_EXPIRED');
    }

    // 4. Validate Adapter Capabilities
    if (targetAdapterType !== adapterCapabilities.adapterType) {
      reasonCodes.push('ADAPTER_CAPABILITY_UNSUPPORTED');
    }

    if (tradingIntent.venue && !adapterCapabilities.supportedVenues.includes(tradingIntent.venue)) {
      reasonCodes.push('VENUE_SUBSTITUTION_PROHIBITED');
    }

    // 5. Parse and Validate Numerical Financial Sizing with Exact Arithmetic
    let authCapital: FixedDecimal;
    let authQuantity: FixedDecimal;
    let authLeverage: FixedDecimal;
    try {
      authCapital = FixedDecimal.from(tradingIntent.approvedCapital);
      authQuantity = FixedDecimal.from(tradingIntent.approvedQuantity);
      authLeverage = tradingIntent.approvedLeverage
        ? FixedDecimal.from(tradingIntent.approvedLeverage)
        : FixedDecimal.from('1');
    } catch {
      reasonCodes.push('INVALID_INPUT');
      return {
        decision: 'REJECTED',
        reasonCodes,
        effectiveCapital: '0',
        effectiveQuantity: '0',
        effectiveLeverage: '1',
        rationale: 'Failed to parse approved financial sizing with exact precision.',
      };
    }

    // Step Alignment (Rounding strictly towards lower exposure)
    let alignedQuantity: FixedDecimal;
    try {
      const step = FixedDecimal.from(adapterCapabilities.quantityStep);
      alignedQuantity = alignQuantityToStep(authQuantity, step);
    } catch {
      alignedQuantity = authQuantity;
    }

    if (alignedQuantity.isZero()) {
      reasonCodes.push('QUANTITY_STEP_ALIGNMENT_ZERO');
    }

    // Minimum Quantity Check (Never expand to minimum!)
    try {
      const minQty = FixedDecimal.from(adapterCapabilities.minQuantity);
      if (alignedQuantity.lt(minQty)) {
        reasonCodes.push('BELOW_PROVIDER_MIN_QUANTITY');
      }
    } catch {
      // ignore
    }

    // Quantity Monotonicity Check
    if (alignedQuantity.gt(authQuantity)) {
      reasonCodes.push('QUANTITY_EXPANSION_PROHIBITED');
    }

    // Capital Monotonicity & Scaling
    let effectiveCapital = authCapital;
    if (alignedQuantity.lt(authQuantity) && !authQuantity.isZero()) {
      const ratio = alignedQuantity.div(authQuantity);
      effectiveCapital = authCapital.mul(ratio);
    }

    if (effectiveCapital.gt(authCapital)) {
      reasonCodes.push('CAPITAL_EXPANSION_PROHIBITED');
    }

    // Leverage Monotonicity
    let effectiveLeverage = authLeverage;
    if (adapterCapabilities.supportsLeverage) {
      if (adapterCapabilities.maxLeverage) {
        try {
          const adapterMax = FixedDecimal.from(adapterCapabilities.maxLeverage);
          if (effectiveLeverage.gt(adapterMax)) {
            effectiveLeverage = adapterMax;
          }
        } catch {
          // ignore
        }
      }
    } else {
      effectiveLeverage = FixedDecimal.from('1');
    }

    if (effectiveLeverage.gt(authLeverage)) {
      reasonCodes.push('LEVERAGE_EXPANSION_PROHIBITED');
    }

    // 6. Final Decision Resolution
    const isStale =
      reasonCodes.includes('TRADING_INTENT_EXPIRED') ||
      reasonCodes.includes('STRATEGY_HEALTH_SUSPENDED') ||
      reasonCodes.includes('STRATEGY_HEALTH_RETIRED') ||
      reasonCodes.includes('STRATEGY_HEALTH_REVALIDATION_REQUIRED') ||
      reasonCodes.includes('STRATEGY_HEALTH_UNKNOWN') ||
      reasonCodes.includes('STRATEGY_RETIRED');

    const isRejected =
      reasonCodes.includes('EXECUTION_HALT_ACTIVE') ||
      reasonCodes.includes('ADAPTER_CAPABILITY_UNSUPPORTED') ||
      reasonCodes.includes('VENUE_SUBSTITUTION_PROHIBITED') ||
      reasonCodes.includes('QUANTITY_STEP_ALIGNMENT_ZERO') ||
      reasonCodes.includes('BELOW_PROVIDER_MIN_QUANTITY') ||
      reasonCodes.includes('QUANTITY_EXPANSION_PROHIBITED') ||
      reasonCodes.includes('CAPITAL_EXPANSION_PROHIBITED') ||
      reasonCodes.includes('LEVERAGE_EXPANSION_PROHIBITED') ||
      reasonCodes.includes('INVALID_INPUT');

    if (isStale) {
      return {
        decision: 'STALE',
        reasonCodes,
        effectiveCapital: '0',
        effectiveQuantity: '0',
        effectiveLeverage: '1',
        rationale: `Execution translation failed: ${reasonCodes.join(', ')}`,
      };
    }

    if (isRejected) {
      return {
        decision: 'REJECTED',
        reasonCodes,
        effectiveCapital: '0',
        effectiveQuantity: '0',
        effectiveLeverage: '1',
        rationale: `Execution translation rejected: ${reasonCodes.join(', ')}`,
      };
    }

    const isReduced =
      alignedQuantity.lt(authQuantity) ||
      effectiveCapital.lt(authCapital) ||
      effectiveLeverage.lt(authLeverage);

    const decision = isReduced ? 'REDUCED' : 'AUTHORIZED';

    const executionIntent: ExecutionIntent = {
      executionIntentId: globalThis.crypto.randomUUID(),
      tradingIntentId: tradingIntent.intentId,
      strategyId: tradingIntent.strategyId,
      strategyRevisionId: tradingIntent.strategyRevisionId,
      instrument: tradingIntent.instrument,
      marketType: 'perpetual',
      side: tradingIntent.action === 'buy' ? 'buy' : 'sell',
      authorizedCapital: authCapital.toString(),
      authorizedQuantity: authQuantity.toString(),
      authorizedLeverage: authLeverage.toString(),
      executionCapital: effectiveCapital.toString(),
      executionQuantity: alignedQuantity.toString(),
      executionLeverage: effectiveLeverage.toString(),
      venue: tradingIntent.venue ?? adapterCapabilities.supportedVenues[0] ?? 'binance',
      targetAdapterType,
      constraints: {
        orderType: policy.defaultOrderType,
        timeInForce: policy.defaultTimeInForce,
        reduceOnly: tradingIntent.action === 'reduce' || tradingIntent.action === 'close',
        positionMode: 'one-way',
      },
      tradingIntentDigest: stableExecutionHash(tradingIntent),
      authorizationContextDigest: stableExecutionHash({
        strategyRevisionId: tradingIntent.strategyRevisionId,
        riskDecisionId: tradingIntent.riskDecisionId,
        portfolioDecisionId: tradingIntent.portfolioDecisionId,
      }),
      executionPolicyRef: policy.policyRevision,
      correlationId: command.correlationId ?? tradingIntent.correlationId,
      idempotencyKey: command.idempotencyKey,
      createdAt: evaluationTime,
      expiresAt: tradingIntent.expiresAt,
      evidenceRefs: tradingIntent.evidenceRefs,
    };

    return {
      decision,
      reasonCodes,
      effectiveCapital: effectiveCapital.toString(),
      effectiveQuantity: alignedQuantity.toString(),
      effectiveLeverage: effectiveLeverage.toString(),
      intent: executionIntent,
      rationale: isReduced
        ? 'Execution intent authorized with monotonic downward reduction for provider constraints.'
        : 'Execution intent authorized matching exact upstream authorization.',
    };
  }
}
