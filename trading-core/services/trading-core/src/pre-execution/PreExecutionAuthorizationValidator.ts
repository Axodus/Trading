import type {
  PreExecutionAuthorizationCommand,
  PreExecutionReasonCode,
  TradingIntent,
} from '../../../../packages/trading-contracts/src/index.js';
import { FixedDecimal } from '../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import type { PreExecutionValidationOutcome } from './PreExecutionTypes.js';

export function stableHash(value: unknown): string {
  return stableJson(value);
}

export class PreExecutionAuthorizationValidator {
  public static validate(command: PreExecutionAuthorizationCommand): PreExecutionValidationOutcome {
    const reasonCodes: PreExecutionReasonCode[] = [];
    const { proposal, portfolioDecision, riskDecision, operationalSnapshot, evaluationTime } = command;

    // 1. Check HALT / Kill Switch (Highest Precedence)
    const killSwitchActive = Boolean(riskDecision.killSwitch?.active);
    const isHaltOutcome = riskDecision.outcome === 'HALT';
    if (killSwitchActive || isHaltOutcome) {
      reasonCodes.push('RISK_HALT_ACTIVE');
      return {
        decision: 'REJECTED',
        reasonCodes,
        effectiveCapital: '0',
        effectiveLeverage: '1',
        effectiveQuantity: '0',
        rationale: 'Risk HALT or Kill Switch active for execution authorization.',
      };
    }

    // 2. Actor Validation: Agent cannot directly create TradingIntent
    if (command.actorType === 'agent') {
      reasonCodes.push('AGENT_UNAUTHORIZED_INTENT_CREATION');
      return {
        decision: 'REJECTED',
        reasonCodes,
        effectiveCapital: '0',
        effectiveLeverage: '1',
        effectiveQuantity: '0',
        rationale: 'Agents may propose trades but cannot directly request TradingIntent authorization.',
      };
    }

    // 3. Portfolio Bypass Validation
    if (!portfolioDecision || !portfolioDecision.portfolioDecisionId) {
      reasonCodes.push('PORTFOLIO_BYPASS');
    } else if (!portfolioDecision.proposalIds || !portfolioDecision.proposalIds.includes(proposal.proposalId)) {
      reasonCodes.push('PORTFOLIO_BYPASS');
    } else if (portfolioDecision.outcome === 'REJECTED') {
      reasonCodes.push('PORTFOLIO_BYPASS');
    }

    // 4. Risk Decision Outcome Validation
    if (!riskDecision || !riskDecision.riskDecisionId) {
      reasonCodes.push('RISK_DECISION_REQUIRED');
    } else if (riskDecision.outcome === 'REJECT') {
      reasonCodes.push('RISK_DECISION_REJECTED');
    }

    // 5. Exact StrategyRevision Binding
    const proposalRev = proposal.strategyRevisionId;
    const riskRev = riskDecision.strategyRevisionId;
    const snapshotRev = operationalSnapshot.strategyRevisionId;
    const commandRev = command.strategyRevision?.revisionId;

    if (riskRev !== proposalRev || snapshotRev !== proposalRev || (commandRev && commandRev !== proposalRev)) {
      reasonCodes.push('STRATEGY_REVISION_MISMATCH');
    }

    if (operationalSnapshot.strategyId !== proposal.strategyId) {
      reasonCodes.push('STRATEGY_REVISION_MISMATCH');
    }

    // 6. Portfolio and Risk Decision IDs matching
    if (riskDecision.portfolioDecisionId !== portfolioDecision.portfolioDecisionId) {
      reasonCodes.push('PORTFOLIO_DECISION_MISMATCH');
    }
    if (riskDecision.proposalId !== proposal.proposalId) {
      reasonCodes.push('PORTFOLIO_DECISION_MISMATCH');
    }

    // 7. Lifecycle & Health State and Version Consistency
    if (operationalSnapshot.healthState === 'SUSPENDED') {
      reasonCodes.push('STRATEGY_HEALTH_SUSPENDED');
    } else if (operationalSnapshot.healthState === 'RETIRED') {
      reasonCodes.push('STRATEGY_HEALTH_RETIRED');
    } else if (operationalSnapshot.healthState === 'REVALIDATION_REQUIRED') {
      reasonCodes.push('STRATEGY_HEALTH_REVALIDATION_REQUIRED');
    } else if (operationalSnapshot.healthState === 'UNKNOWN') {
      reasonCodes.push('STRATEGY_HEALTH_UNKNOWN');
    }

    if (operationalSnapshot.lifecycleState === 'RETIRED') {
      reasonCodes.push('STRATEGY_RETIRED');
    }

    // 8. Expiration checks using evaluationTime
    const evalMs = new Date(evaluationTime).getTime();
    if (isNaN(evalMs)) {
      reasonCodes.push('INVALID_INPUT');
    }

    if (operationalSnapshot.expiresAt && evalMs > new Date(operationalSnapshot.expiresAt).getTime()) {
      reasonCodes.push('OPERATIONAL_SNAPSHOT_EXPIRED');
    }

    if (riskDecision.expiresAt && evalMs > new Date(riskDecision.expiresAt).getTime()) {
      reasonCodes.push('RISK_DECISION_EXPIRED');
    }

    if (portfolioDecision.expiresAt && evalMs > new Date(portfolioDecision.expiresAt).getTime()) {
      reasonCodes.push('PORTFOLIO_DECISION_EXPIRED');
    }

    if (command.marketState && (command.marketState.freshness === 'stale' || command.marketState.freshness === 'unknown')) {
      reasonCodes.push('MARKET_STATE_EXPIRED');
    }

    // 9. Operational Compatibility Check
    if (operationalSnapshot.compatibility === 'REJECTED') {
      reasonCodes.push('OPERATIONAL_SNAPSHOT_INCOMPATIBLE');
    } else if (operationalSnapshot.compatibility === 'RISK_REDUCING_ONLY' && (proposal.action === 'buy' || proposal.action === 'sell')) {
      reasonCodes.push('OPERATIONAL_SNAPSHOT_INCOMPATIBLE');
    }

    // 10. Monotonicity & Exact Financial Arithmetic
    let effectiveCapital = '0';
    let effectiveLeverage = '1';
    let effectiveQuantity = '0';

    try {
      const requestedCap = FixedDecimal.from(proposal.sizing.requestedCapital || '0');
      const approvedPortfolioCap = FixedDecimal.from(portfolioDecision.approvedCapital || '0');
      const requestedQty = FixedDecimal.from(proposal.sizing.requestedQuantity || '0');
      const requestedLev = FixedDecimal.from(proposal.sizing.leverage || '1');

      // Monotonicity between Proposal and Portfolio
      if (approvedPortfolioCap.gt(requestedCap)) {
        reasonCodes.push('CAPITAL_MONOTONICITY_VIOLATION');
      }

      let riskApprovedCap = approvedPortfolioCap;
      let riskApprovedLev = requestedLev;

      if (riskDecision.outcome === 'MODIFY' && riskDecision.modifications) {
        const mods = riskDecision.modifications as Record<string, unknown>;
        if (mods.approvedCapital !== undefined || mods.effectiveCapital !== undefined || mods.capital !== undefined) {
          const modCapStr = String(mods.approvedCapital ?? mods.effectiveCapital ?? mods.capital);
          riskApprovedCap = FixedDecimal.from(modCapStr);
        }
        if (mods.effectiveLeverage !== undefined || mods.approvedLeverage !== undefined || mods.leverage !== undefined) {
          const modLevStr = String(mods.effectiveLeverage ?? mods.approvedLeverage ?? mods.leverage);
          riskApprovedLev = FixedDecimal.from(modLevStr);
        }
      }

      // Check Risk monotonicity: Risk effective capital cannot exceed Portfolio approved or Proposal requested
      if (riskApprovedCap.gt(approvedPortfolioCap) || riskApprovedCap.gt(requestedCap)) {
        reasonCodes.push('CAPITAL_MONOTONICITY_VIOLATION');
      }

      // Check Risk leverage monotonicity
      if (riskApprovedLev.gt(requestedLev)) {
        reasonCodes.push('LEVERAGE_MONOTONICITY_VIOLATION');
      }

      effectiveCapital = riskApprovedCap.toString();
      effectiveLeverage = riskApprovedLev.toString();

      // Compute scaled quantity for MODIFY if capital was reduced
      const zero = FixedDecimal.zero();
      if (riskApprovedCap.eq(zero) || requestedCap.eq(zero)) {
        effectiveQuantity = '0';
      } else if (riskApprovedCap.eq(requestedCap)) {
        effectiveQuantity = requestedQty.toString();
      } else {
        effectiveQuantity = requestedQty.mul(riskApprovedCap).div(requestedCap).toString();
      }
    } catch {
      reasonCodes.push('INVALID_INPUT');
    }

    if (reasonCodes.length > 0) {
      const isStale = reasonCodes.some((code) =>
        code.includes('EXPIRED') ||
        code.includes('STALE') ||
        code === 'LIFECYCLE_VERSION_MISMATCH' ||
        code === 'HEALTH_VERSION_MISMATCH' ||
        code === 'OPERATIONAL_SNAPSHOT_MISMATCH',
      );

      return {
        decision: isStale ? 'STALE' : 'REJECTED',
        reasonCodes,
        effectiveCapital,
        effectiveLeverage,
        effectiveQuantity,
        rationale: 'Pre-execution authorization failed: ' + reasonCodes.join(', '),
      };
    }

    // 11. Construct Deterministic TradingIntent
    const intentId = 'intent-' + proposal.strategyId + '-' + proposal.strategyRevisionId + '-' + command.commandId + '-' + riskDecision.riskDecisionId;

    const expiryCandidates: number[] = [];
    if (proposal.expiresAt) expiryCandidates.push(new Date(proposal.expiresAt).getTime());
    if (portfolioDecision.expiresAt) expiryCandidates.push(new Date(portfolioDecision.expiresAt).getTime());
    if (riskDecision.expiresAt) expiryCandidates.push(new Date(riskDecision.expiresAt).getTime());
    if (operationalSnapshot.expiresAt) expiryCandidates.push(new Date(operationalSnapshot.expiresAt).getTime());

    const minExpiryMs = Math.min(...expiryCandidates.filter((t) => !isNaN(t)));
    const intentExpiresAt = isFinite(minExpiryMs) ? new Date(minExpiryMs).toISOString() : operationalSnapshot.expiresAt;

    const intent: TradingIntent = {
      intentId,
      strategyId: proposal.strategyId,
      strategyRevisionId: proposal.strategyRevisionId,
      marketStateId: proposal.marketState.marketStateId,
      opportunityId: proposal.opportunity.opportunityId,
      proposalId: proposal.proposalId,
      portfolioDecisionId: portfolioDecision.portfolioDecisionId,
      riskDecisionId: riskDecision.riskDecisionId,
      eligibilityId: proposal.eligibility.eligibilityId,
      instrument: proposal.opportunity.instrument,
      venue: proposal.opportunity.venue,
      action: proposal.action,
      approvedQuantity: effectiveQuantity,
      approvedCapital: effectiveCapital,
      approvedLeverage: effectiveLeverage !== '1' ? effectiveLeverage : undefined,
      executionPolicyRef: riskDecision.policyVersion,
      correlationId: proposal.correlationId,
      idempotencyKey: command.idempotencyKey,
      createdAt: evaluationTime,
      expiresAt: intentExpiresAt,
      evidenceRefs: [
        ...(proposal.evidenceRefs ?? []),
        ...(portfolioDecision.evidenceRefs ?? []),
        ...(riskDecision.evidenceRefs ?? []),
      ],
    };

    return {
      decision: 'AUTHORIZED',
      reasonCodes: [],
      effectiveCapital,
      effectiveLeverage,
      effectiveQuantity,
      rationale: 'Pre-execution authorization confirmed all upstream risk, portfolio, and snapshot boundaries.',
      intent,
    };
  }
}
