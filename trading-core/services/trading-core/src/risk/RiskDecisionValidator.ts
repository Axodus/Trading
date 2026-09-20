import type { RiskDecision } from '../../../../packages/trading-contracts/src/index.js';
import { FixedDecimal, TradingContractValidationError } from '../../../../packages/trading-contracts/src/index.js';
import type { RiskEvaluationContext } from './RiskTypes.js';

export interface RiskValidationResult {
  valid: boolean;
  issues: readonly string[];
}

export function validateRiskEvaluationContext(context: RiskEvaluationContext): RiskValidationResult {
  const issues: string[] = [];

  if (!context.portfolioDecision || typeof context.portfolioDecision !== 'object') {
    issues.push('valid portfolioDecision is required');
  } else {
    const pd = context.portfolioDecision;
    if (!pd.portfolioDecisionId || pd.portfolioDecisionId.trim().length === 0) issues.push('portfolioDecision.portfolioDecisionId is required');
    if (!pd.proposalIds || !Array.isArray(pd.proposalIds) || pd.proposalIds.length === 0) issues.push('portfolioDecision.proposalIds array is required');
    if (!pd.approvedCapital) issues.push('portfolioDecision.approvedCapital is required');
    else {
      try {
        const cap = FixedDecimal.from(pd.approvedCapital);
        if (cap.isNegative()) issues.push('portfolioDecision.approvedCapital must be non-negative');
      } catch (e) {
        issues.push(`portfolioDecision.approvedCapital is malformed decimal: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (!context.proposal || typeof context.proposal !== 'object') {
    issues.push('valid proposal is required');
  } else {
    const p = context.proposal;
    if (!p.proposalId || p.proposalId.trim().length === 0) issues.push('proposal.proposalId is required');
    if (context.portfolioDecision?.proposalIds && !context.portfolioDecision.proposalIds.includes(p.proposalId)) {
      issues.push(`proposal.proposalId (${p.proposalId}) not in portfolioDecision.proposalIds`);
    }
  }

  if (!context.strategyRevision || typeof context.strategyRevision !== 'object') {
    issues.push('valid strategyRevision is required');
  } else {
    const sr = context.strategyRevision;
    if (!sr.strategy?.strategyId) issues.push('strategyRevision.strategy.strategyId is required');
    if (!sr.revisionId) issues.push('strategyRevision.revisionId is required');
    if (context.proposal && context.proposal.strategyId !== sr.strategy.strategyId) {
      issues.push(`StrategyIdentity mismatch: proposal=${context.proposal.strategyId}, strategyRevision=${sr.strategy.strategyId}`);
    }
    if (context.proposal && context.proposal.strategyRevisionId !== sr.revisionId) {
      issues.push(`StrategyRevision mismatch: proposal=${context.proposal.strategyRevisionId}, strategyRevision=${sr.revisionId}`);
    }
  }

  if (!context.policy || typeof context.policy !== 'object') {
    issues.push('valid policy is required');
  } else {
    if (!context.policy.policyVersion) issues.push('policy.policyVersion is required');
  }

  if (!context.exposureSnapshot || typeof context.exposureSnapshot !== 'object') {
    issues.push('valid exposureSnapshot is required');
  } else {
    const snap = context.exposureSnapshot;
    if (!snap.snapshotId) issues.push('exposureSnapshot.snapshotId is required');
  }

  if (!context.evaluationTime || !Number.isFinite(Date.parse(context.evaluationTime))) {
    issues.push('valid evaluationTime ISO timestamp is required');
  }

  if (context.environment === 'live') {
    const snapshot = context.operationalSnapshot;
    if (!snapshot) {
      issues.push('operationalSnapshot is required for live risk evaluation');
    } else {
      if (snapshot.strategyRevisionId !== context.strategyRevision?.revisionId) {
        issues.push('operationalSnapshot strategyRevisionId must match strategyRevision');
      }
      if (context.strategyHealth && snapshot.healthState !== context.strategyHealth.state) {
        issues.push('operationalSnapshot healthState must match strategyHealth');
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateRiskDecisionProperties(decision: RiskDecision, context: RiskEvaluationContext): void {
  const issues: { path: string; message: string }[] = [];

  if (!['ALLOW', 'MODIFY', 'REJECT', 'HALT'].includes(decision.outcome)) {
    issues.push({ path: 'outcome', message: `Invalid risk outcome: ${decision.outcome}` });
  }

  if (decision.killSwitch?.active && decision.outcome !== 'HALT') {
    issues.push({ path: 'outcome', message: 'active kill switch requires HALT' });
  }

  // Check monotonicity: Risk-approved capital <= Portfolio-approved capital
  if (decision.outcome === 'ALLOW' || decision.outcome === 'MODIFY') {
    const modEffectiveCapital = decision.modifications?.effectiveCapital as string | undefined;
    const upstreamCapital = FixedDecimal.from(context.portfolioDecision.approvedCapital);
    if (modEffectiveCapital !== undefined) {
      const effectiveCapital = FixedDecimal.from(modEffectiveCapital);
      if (effectiveCapital.gt(upstreamCapital)) {
        issues.push({
          path: 'modifications.effectiveCapital',
          message: `Monotonicity violation: Risk effective capital (${effectiveCapital.toString()}) exceeds upstream portfolio approved capital (${upstreamCapital.toString()})`,
        });
      }
    }

    const modEffectiveLeverage = decision.modifications?.effectiveLeverage as string | undefined;
    const upstreamLeverageStr = context.proposal.sizing.leverage ?? '1.0';
    if (modEffectiveLeverage !== undefined) {
      const effectiveLev = FixedDecimal.from(modEffectiveLeverage);
      const upstreamLev = FixedDecimal.from(upstreamLeverageStr);
      if (effectiveLev.gt(upstreamLev)) {
        issues.push({
          path: 'modifications.effectiveLeverage',
          message: `Monotonicity violation: Risk effective leverage (${effectiveLev.toString()}) exceeds upstream leverage (${upstreamLev.toString()})`,
        });
      }
    }
  }

  if (issues.length > 0) {
    throw new TradingContractValidationError(issues);
  }
}
