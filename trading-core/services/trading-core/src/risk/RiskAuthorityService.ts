import type {
  PortfolioDecision,
  RiskDecision,
  RiskDecisionOutcome,
  TradeProposal,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  FixedDecimal,
  validateRiskDecision,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  validateRiskDecisionProperties,
  validateRiskEvaluationContext,
} from './RiskDecisionValidator.js';
import type {
  HaltScope,
  RiskEvaluationContext,
  RiskEvaluationResult,
  RiskPolicyLimits,
  RiskReasonCode,
  RiskRuleModification,
  RiskRuleViolation,
} from './RiskTypes.js';

export class RiskAuthorityService {
  evaluate(context: RiskEvaluationContext): RiskEvaluationResult {
    const validation = validateRiskEvaluationContext(context);
    if (!validation.valid) {
      return this.failClosed(
        context,
        'INVALID_INPUT',
        `RiskEvaluationContext validation failed: ${validation.issues.join('; ')}`,
        'REJECT'
      );
    }

    const violations: RiskRuleViolation[] = [];
    const modifications: RiskRuleModification[] = [];
    const reasonCodes: RiskReasonCode[] = [];

    // 1. System-level halt check
    if (context.policy.systemHaltActive) {
      violations.push({
        code: 'KILL_SWITCH_ACTIVE',
        message: `System halt active: ${context.policy.systemHaltReference ?? 'kill switch engaged'}`,
        severity: 'HALT',
        haltScope: 'SYSTEM',
      });
      reasonCodes.push('KILL_SWITCH_ACTIVE');
    }

    // 2. Portfolio state consistency check
    const snap = context.exposureSnapshot;
    const totalCap = FixedDecimal.from(snap.totalCapital);
    const availCap = FixedDecimal.from(snap.availableCapital);
    const resCap = FixedDecimal.from(snap.reservedCapital);
    if (availCap.add(resCap).gt(totalCap)) {
      violations.push({
        code: 'PORTFOLIO_STATE_INCONSISTENT',
        message: `Portfolio state inconsistent: available (${availCap.toString()}) + reserved (${resCap.toString()}) > total (${totalCap.toString()})`,
        severity: 'HALT',
        haltScope: 'PORTFOLIO',
      });
      reasonCodes.push('PORTFOLIO_STATE_INCONSISTENT');
    }

    // 3. Global drawdown limit check
    if (context.policy.maxDrawdownLimitPct && snap.drawdownContext?.currentDrawdownPct) {
      const maxDd = FixedDecimal.from(context.policy.maxDrawdownLimitPct);
      const currDd = FixedDecimal.from(snap.drawdownContext.currentDrawdownPct);
      if (currDd.gt(maxDd)) {
        violations.push({
          code: 'GLOBAL_DRAWDOWN_LIMIT_BREACHED',
          message: `Portfolio drawdown limit breached: current ${currDd.toString()} > limit ${maxDd.toString()}`,
          severity: 'HALT',
          haltScope: 'PORTFOLIO',
        });
        reasonCodes.push('GLOBAL_DRAWDOWN_LIMIT_BREACHED');
      }
    }

    // 4. Stale PortfolioDecision check
    const evalTimeMs = Date.parse(context.evaluationTime);
    const pdCreatedMs = Date.parse(context.portfolioDecision.createdAt);
    if (evalTimeMs - pdCreatedMs > context.policy.maxPortfolioDecisionAgeMs) {
      violations.push({
        code: 'STALE_PORTFOLIO_DECISION',
        message: `PortfolioDecision is stale: age ${evalTimeMs - pdCreatedMs}ms > max ${context.policy.maxPortfolioDecisionAgeMs}ms`,
        severity: 'REJECT',
      });
      reasonCodes.push('STALE_PORTFOLIO_DECISION');
    }

    const pdExpiresMs = Date.parse(context.portfolioDecision.expiresAt);
    if (evalTimeMs >= pdExpiresMs) {
      violations.push({
        code: 'STALE_PORTFOLIO_DECISION',
        message: `PortfolioDecision expired at ${context.portfolioDecision.expiresAt}`,
        severity: 'REJECT',
      });
      reasonCodes.push('STALE_PORTFOLIO_DECISION');
    }

    // 5. Stale MarketState check
    if (context.marketState) {
      const msObservedMs = Date.parse(context.marketState.observedAt);
      if (context.environment === 'live' && evalTimeMs - msObservedMs > context.policy.maxMarketStateAgeMs) {
        violations.push({
          code: 'STALE_MARKET_STATE',
          message: `MarketState is stale: age ${evalTimeMs - msObservedMs}ms > max ${context.policy.maxMarketStateAgeMs}ms`,
          severity: 'REJECT',
        });
        reasonCodes.push('STALE_MARKET_STATE');
      }
      if (context.environment === 'live' && context.marketState.freshness !== 'current') {
        violations.push({
          code: 'STALE_MARKET_STATE',
          message: `Live MarketState freshness is ${context.marketState.freshness}, required current`,
          severity: 'REJECT',
        });
        reasonCodes.push('STALE_MARKET_STATE');
      }
    }

    // 6. StrategyHealth Gate
    if (context.strategyHealth) {
      const healthState = context.strategyHealth.state;
      if (healthState === 'SUSPENDED') {
        violations.push({
          code: 'STRATEGY_HEALTH_SUSPENDED',
          message: 'Strategy is in SUSPENDED health state',
          severity: 'REJECT',
        });
        reasonCodes.push('STRATEGY_HEALTH_SUSPENDED');
      } else if (healthState === 'RETIRED') {
        violations.push({
          code: 'STRATEGY_HEALTH_RETIRED',
          message: 'Strategy is in RETIRED health state',
          severity: 'REJECT',
        });
        reasonCodes.push('STRATEGY_HEALTH_RETIRED');
      } else if (healthState === 'UNKNOWN') {
        violations.push({
          code: 'STRATEGY_HEALTH_UNKNOWN',
          message: 'Strategy is in UNKNOWN health state; fail-closed',
          severity: 'REJECT',
        });
        reasonCodes.push('STRATEGY_HEALTH_UNKNOWN');
      } else if (healthState === 'REVALIDATION_REQUIRED') {
        violations.push({
          code: 'STRATEGY_HEALTH_REVALIDATION_REQUIRED',
          message: 'Strategy requires revalidation; cannot authorize new exposure',
          severity: 'REJECT',
        });
        reasonCodes.push('STRATEGY_HEALTH_REVALIDATION_REQUIRED');
      } else if (healthState === 'DEGRADED') {
        const degradedAction = context.policy.degradedStrategyAction ?? 'MODIFY';
        if (degradedAction === 'REJECT') {
          violations.push({
            code: 'STRATEGY_HEALTH_DEGRADED',
            message: 'Strategy is in DEGRADED health state; policy requires rejection',
            severity: 'REJECT',
          });
          reasonCodes.push('STRATEGY_HEALTH_DEGRADED');
        } else if (degradedAction === 'MODIFY') {
          const mult = FixedDecimal.from(context.policy.degradedCapitalMultiplier ?? '0.5');
          const currentCap = FixedDecimal.from(context.portfolioDecision.approvedCapital);
          const reducedCap = currentCap.mul(mult);
          modifications.push({
            code: 'STRATEGY_HEALTH_DEGRADED',
            message: `Strategy DEGRADED: applying ${mult.toString()} capital multiplier`,
            effectiveCapital: reducedCap.toString(),
            effectiveLeverage: context.policy.degradedLeverageCap ?? '1.0',
          });
          reasonCodes.push('STRATEGY_HEALTH_DEGRADED');
        }
      }
    } else {
      // Absence of strategy health in operational contexts fails closed
      if (context.environment !== 'historical' && context.environment !== 'simulation') {
        violations.push({
          code: 'STRATEGY_HEALTH_UNKNOWN',
          message: 'StrategyHealth context is absent; failing closed by default',
          severity: 'REJECT',
        });
        reasonCodes.push('STRATEGY_HEALTH_UNKNOWN');
      }
    }

    // 7. PromotionEligibility check
    if (context.eligibility && context.eligibility.decision !== 'ELIGIBLE') {
      violations.push({
        code: 'PROMOTION_INELIGIBLE',
        message: `Strategy is not eligible for promotion: decision is ${context.eligibility.decision}`,
        severity: 'REJECT',
      });
      reasonCodes.push('PROMOTION_INELIGIBLE');
    }

    // 8. Capital Risk check & Monotonicity
    const upstreamApprovedCapital = FixedDecimal.from(context.portfolioDecision.approvedCapital);
    const maxCapPerTrade = FixedDecimal.from(context.policy.maxCapitalPerTrade);
    let effectiveCapital = upstreamApprovedCapital;

    if (upstreamApprovedCapital.gt(maxCapPerTrade)) {
      if (context.policy.allowModifyOnCapitalBreach) {
        effectiveCapital = maxCapPerTrade;
        modifications.push({
          code: 'CAPITAL_LIMIT_EXCEEDED',
          message: `Approved capital (${upstreamApprovedCapital.toString()}) exceeds maxCapitalPerTrade (${maxCapPerTrade.toString()}); modified down`,
          effectiveCapital: maxCapPerTrade.toString(),
        });
        reasonCodes.push('CAPITAL_LIMIT_EXCEEDED');
      } else {
        violations.push({
          code: 'CAPITAL_LIMIT_EXCEEDED',
          message: `Approved capital (${upstreamApprovedCapital.toString()}) exceeds maxCapitalPerTrade (${maxCapPerTrade.toString()})`,
          severity: 'REJECT',
        });
        reasonCodes.push('CAPITAL_LIMIT_EXCEEDED');
      }
    }

    // Also check if any degraded modification reduced capital further
    for (const mod of modifications) {
      if (mod.effectiveCapital) {
        const modCap = FixedDecimal.from(mod.effectiveCapital);
        effectiveCapital = FixedDecimal.min(effectiveCapital, modCap);
      }
    }

    // Monotonicity check: effectiveCapital must be <= upstreamApprovedCapital
    if (effectiveCapital.gt(upstreamApprovedCapital)) {
      violations.push({
        code: 'MONOTONICITY_VIOLATION',
        message: 'Risk effective capital cannot exceed Portfolio approved capital',
        severity: 'REJECT',
      });
      reasonCodes.push('MONOTONICITY_VIOLATION');
    }

    // 9. Leverage Authority & Monotonicity
    const upstreamLeverageStr = context.proposal.sizing.leverage ?? '1.0';
    const upstreamLeverage = FixedDecimal.from(upstreamLeverageStr);
    const maxLeverage = FixedDecimal.from(context.policy.maxLeverageCeiling);
    let effectiveLeverage = upstreamLeverage;

    if (upstreamLeverage.gt(maxLeverage)) {
      if (context.policy.allowModifyOnLeverageBreach) {
        effectiveLeverage = maxLeverage;
        modifications.push({
          code: 'LEVERAGE_LIMIT_EXCEEDED',
          message: `Upstream leverage (${upstreamLeverage.toString()}) exceeds ceiling (${maxLeverage.toString()}); modified down`,
          effectiveLeverage: maxLeverage.toString(),
        });
        reasonCodes.push('LEVERAGE_LIMIT_EXCEEDED');
      } else {
        violations.push({
          code: 'LEVERAGE_LIMIT_EXCEEDED',
          message: `Upstream leverage (${upstreamLeverage.toString()}) exceeds ceiling (${maxLeverage.toString()})`,
          severity: 'REJECT',
        });
        reasonCodes.push('LEVERAGE_LIMIT_EXCEEDED');
      }
    }

    // Also check degraded leverage caps
    for (const mod of modifications) {
      if (mod.effectiveLeverage) {
        const modLev = FixedDecimal.from(mod.effectiveLeverage);
        effectiveLeverage = FixedDecimal.min(effectiveLeverage, modLev);
      }
    }

    // Monotonicity check: effectiveLeverage must be <= upstreamLeverage
    if (effectiveLeverage.gt(upstreamLeverage)) {
      violations.push({
        code: 'MONOTONICITY_VIOLATION',
        message: 'Risk effective leverage cannot exceed upstream leverage',
        severity: 'REJECT',
      });
      reasonCodes.push('MONOTONICITY_VIOLATION');
    }

    // 10. Gross vs Net Exposure & Concentration Checks
    const instrument = context.proposal.opportunity.instrument;
    let currentInstGross = FixedDecimal.zero();
    let currentInstLong = FixedDecimal.zero();
    let currentInstShort = FixedDecimal.zero();
    let totalPortfolioGross = FixedDecimal.zero();
    let currentStrategyGross = FixedDecimal.zero();

    for (const pos of snap.positions) {
      const notional = FixedDecimal.from(pos.notional);
      totalPortfolioGross = totalPortfolioGross.add(notional);
      if (pos.instrument === instrument) {
        currentInstGross = currentInstGross.add(notional);
        if (pos.side === 'LONG') currentInstLong = currentInstLong.add(notional);
        else if (pos.side === 'SHORT') currentInstShort = currentInstShort.add(notional);
      }
      if (pos.strategyId === context.strategyRevision.strategy.strategyId) {
        currentStrategyGross = currentStrategyGross.add(notional);
      }
    }

    // Opposing position check (fail-closed unless explicit policy)
    const isLong = context.proposal.action === 'buy';
    const isShort = context.proposal.action === 'sell';
    const hasNetShort = currentInstShort.gt(currentInstLong);
    const hasNetLong = currentInstLong.gt(currentInstShort);
    const isOpposing = (isLong && hasNetShort) || (isShort && hasNetLong);

    if (isOpposing && !context.policy.allowOpposingPositions) {
      violations.push({
        code: 'OPPOSING_POSITION_FAIL_CLOSED',
        message: `Opposing position on ${instrument} without explicit netting/hedge policy; rejected fail-closed`,
        severity: 'REJECT',
      });
      reasonCodes.push('OPPOSING_POSITION_FAIL_CLOSED');
    }

    // Total gross exposure ceiling check
    const maxGrossTotal = FixedDecimal.from(context.policy.maxGrossExposureTotal);
    const projectedTotalGross = totalPortfolioGross.add(effectiveCapital);
    if (projectedTotalGross.gt(maxGrossTotal)) {
      violations.push({
        code: 'GROSS_EXPOSURE_LIMIT_EXCEEDED',
        message: `Projected total gross exposure (${projectedTotalGross.toString()}) exceeds limit (${maxGrossTotal.toString()})`,
        severity: 'REJECT',
      });
      reasonCodes.push('GROSS_EXPOSURE_LIMIT_EXCEEDED');
    }

    // Instrument gross concentration check
    const maxInstGross = FixedDecimal.from(
      context.policy.maxInstrumentGrossExposure[instrument] ?? context.policy.defaultMaxInstrumentGrossExposure
    );
    const projectedInstGross = currentInstGross.add(effectiveCapital);
    if (projectedInstGross.gt(maxInstGross)) {
      violations.push({
        code: 'INSTRUMENT_CONCENTRATION_EXCEEDED',
        message: `Projected instrument gross exposure for ${instrument} (${projectedInstGross.toString()}) exceeds limit (${maxInstGross.toString()})`,
        severity: 'REJECT',
      });
      reasonCodes.push('INSTRUMENT_CONCENTRATION_EXCEEDED');
    }

    // Strategy gross concentration check
    const stratId = context.strategyRevision.strategy.strategyId;
    const maxStratGross = FixedDecimal.from(
      context.policy.maxStrategyGrossExposure[stratId] ?? context.policy.defaultMaxStrategyGrossExposure
    );
    const projectedStratGross = currentStrategyGross.add(effectiveCapital);
    if (projectedStratGross.gt(maxStratGross)) {
      violations.push({
        code: 'STRATEGY_CONCENTRATION_EXCEEDED',
        message: `Projected strategy gross exposure for ${stratId} (${projectedStratGross.toString()}) exceeds limit (${maxStratGross.toString()})`,
        severity: 'REJECT',
      });
      reasonCodes.push('STRATEGY_CONCENTRATION_EXCEEDED');
    }

    // Net exposure limit check (if configured)
    if (context.policy.maxNetExposureTotal) {
      const maxNetTotal = FixedDecimal.from(context.policy.maxNetExposureTotal);
      // calculate rough net: notional additions
      let totalLong = FixedDecimal.zero();
      let totalShort = FixedDecimal.zero();
      for (const pos of snap.positions) {
        const notional = FixedDecimal.from(pos.notional);
        if (pos.side === 'LONG') totalLong = totalLong.add(notional);
        else if (pos.side === 'SHORT') totalShort = totalShort.add(notional);
      }
      if (isLong) totalLong = totalLong.add(effectiveCapital);
      if (isShort) totalShort = totalShort.add(effectiveCapital);
      const netExposure = totalLong.sub(totalShort).abs();
      if (netExposure.gt(maxNetTotal)) {
        violations.push({
          code: 'NET_EXPOSURE_LIMIT_EXCEEDED',
          message: `Projected net exposure (${netExposure.toString()}) exceeds limit (${maxNetTotal.toString()})`,
          severity: 'REJECT',
        });
        reasonCodes.push('NET_EXPOSURE_LIMIT_EXCEEDED');
      }
    }

    // 11. Disposition Precedence Determination: HALT > REJECT > MODIFY > ALLOW
    let outcome: RiskDecisionOutcome = 'ALLOW';
    let haltScope: HaltScope | undefined;

    const haltViolation = violations.find((v) => v.severity === 'HALT');
    if (haltViolation) {
      outcome = 'HALT';
      haltScope = haltViolation.haltScope ?? 'SYSTEM';
    } else if (violations.length > 0) {
      outcome = 'REJECT';
    } else if (modifications.length > 0) {
      outcome = 'MODIFY';
    } else {
      outcome = 'ALLOW';
    }

    const rationale = this.composeRationale(outcome, violations, modifications);
    const decision = this.createRiskDecision(context, outcome, effectiveCapital.toString(), effectiveLeverage.toString(), violations, modifications, rationale, haltScope);

    validateRiskDecision(decision);
    validateRiskDecisionProperties(decision, context);

    return {
      outcome,
      effectiveCapital: outcome === 'ALLOW' || outcome === 'MODIFY' ? effectiveCapital.toString() : '0',
      effectiveLeverage: outcome === 'ALLOW' || outcome === 'MODIFY' ? effectiveLeverage.toString() : '0',
      reasons: [...new Set(reasonCodes)],
      violations,
      modifications,
      haltScope,
      rationale,
      decision,
    };
  }

  private failClosed(
    context: RiskEvaluationContext,
    code: RiskReasonCode,
    message: string,
    severity: 'REJECT' | 'HALT',
    haltScope?: HaltScope
  ): RiskEvaluationResult {
    const violation: RiskRuleViolation = { code, message, severity, haltScope };
    const outcome: RiskDecisionOutcome = severity === 'HALT' ? 'HALT' : 'REJECT';
    const rationale = `Fail-closed ${outcome}: ${message}`;
    const decision = this.createRiskDecision(
      context,
      outcome,
      '0',
      '0',
      [violation],
      [],
      rationale,
      haltScope
    );

    return {
      outcome,
      effectiveCapital: '0',
      effectiveLeverage: '0',
      reasons: [code],
      violations: [violation],
      modifications: [],
      haltScope,
      rationale,
      decision,
    };
  }

  private composeRationale(
    outcome: RiskDecisionOutcome,
    violations: readonly RiskRuleViolation[],
    modifications: readonly RiskRuleModification[]
  ): string {
    if (outcome === 'HALT') {
      const msgs = violations.filter((v) => v.severity === 'HALT').map((v) => v.message).join('; ');
      return `Risk HALT triggered: ${msgs}`;
    }
    if (outcome === 'REJECT') {
      const msgs = violations.map((v) => v.message).join('; ');
      return `Risk REJECT: ${msgs}`;
    }
    if (outcome === 'MODIFY') {
      const msgs = modifications.map((m) => m.message).join('; ');
      return `Risk MODIFY approved with restrictions: ${msgs}`;
    }
    return 'Risk criteria satisfied; all hard limits and health gates passed';
  }

  private createRiskDecision(
    context: RiskEvaluationContext,
    outcome: RiskDecisionOutcome,
    effectiveCapital: string,
    effectiveLeverage: string,
    violations: readonly RiskRuleViolation[],
    modifications: readonly RiskRuleModification[],
    rationale: string,
    haltScope?: HaltScope
  ): RiskDecision {
    const proposalId = context.proposal?.proposalId ?? 'prop-unknown';
    const portfolioDecisionId = context.portfolioDecision?.portfolioDecisionId ?? 'pdec-unknown';
    const marketStateId = context.marketState?.marketStateId ?? context.proposal?.marketState?.marketStateId ?? 'ms-unknown';
    const strategyRevisionId = context.strategyRevision?.revisionId ?? context.proposal?.strategyRevisionId ?? 'rev-unknown';
    const policyVersion = context.policy?.policyVersion ?? 'policy-unknown';

    const identityPayload = {
      portfolioDecisionId,
      proposalId,
      marketStateId,
      strategyRevisionId,
      policyVersion,
      policyRevision: context.policy?.policyRevision ?? 1,
      outcome,
      effectiveCapital,
      effectiveLeverage,
      correlationId: context.correlationId,
      snapshotId: context.exposureSnapshot?.snapshotId ?? 'snap-unknown',
    };
    const idHash = stableHash(identityPayload);

    const expiresAt = context.portfolioDecision?.expiresAt ?? context.proposal?.expiresAt ?? new Date(Date.parse(context.evaluationTime) + 60_000).toISOString();

    const evidenceRefs = [
      ...new Set([
        ...(context.portfolioDecision?.evidenceRefs ?? []),
        ...(context.proposal?.evidenceRefs ?? []),
        `policy:${policyVersion}`,
        `snapshot:${context.exposureSnapshot?.snapshotId ?? 'none'}`,
      ]),
    ].sort();

    const modsRecord: Record<string, unknown> = {};
    if (outcome === 'MODIFY') {
      modsRecord['effectiveCapital'] = effectiveCapital;
      modsRecord['effectiveLeverage'] = effectiveLeverage;
      modsRecord['modifications'] = modifications;
    }
    if (violations.length > 0) {
      modsRecord['violations'] = violations;
    }
    if (haltScope) {
      modsRecord['haltScope'] = haltScope;
    }

    return {
      riskDecisionId: `risk-${idHash}`,
      proposalId,
      portfolioDecisionId,
      marketStateId,
      strategyRevisionId,
      outcome,
      policyVersion,
      hardLimitEvaluation: {
        maxCapitalPerTrade: context.policy?.maxCapitalPerTrade,
        maxGrossExposureTotal: context.policy?.maxGrossExposureTotal,
        maxLeverageCeiling: context.policy?.maxLeverageCeiling,
        evaluatedAt: context.evaluationTime,
        passed: outcome === 'ALLOW',
      },
      killSwitch: {
        active: outcome === 'HALT',
        reference: haltScope ? `HALT_SCOPE:${haltScope}` : undefined,
      },
      modifications: modsRecord,
      rationale,
      evidenceRefs,
      decidedAt: context.evaluationTime,
      expiresAt,
    };
  }
}

function stableHash(value: unknown): string {
  const canonical = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((k) => `${JSON.stringify(k)}:${stableSerialize(record[k])}`).join(',')}}`;
}
