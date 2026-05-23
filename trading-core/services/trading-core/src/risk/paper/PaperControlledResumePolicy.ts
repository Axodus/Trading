import type { PaperRiskDecision, PaperRiskSignal } from '../../../../../packages/trading-contracts/src/index.js';

export class PaperControlledResumePolicy {
  decide(signal?: PaperRiskSignal): PaperRiskDecision {
    const now = new Date().toISOString();
    if (!signal) {
      return {
        id: `paper-risk:allow:${now}`,
        correlationId: 'paper-risk:allow',
        tenantId: 'unknown',
        decision: 'allow-continue-paper',
        status: 'allowed',
        reason: 'No paper risk signals detected.',
        requiresAcs: false,
        requiresRiskReview: false,
        authorizedExecution: false,
        controlledResumeEligible: false,
        mutatesRuntime: false,
        mutatesProvider: false,
        mutatesStrategy: false,
        createdAt: now,
      };
    }

    const decision = this.decisionType(signal);
    return {
      id: `${signal.id}:decision`,
      correlationId: signal.correlationId,
      tenantId: signal.tenantId,
      decision,
      status: this.status(decision),
      reason: signal.evidence.reasons.join('; '),
      signal,
      requiresAcs: decision !== 'allow-continue-paper',
      requiresRiskReview: decision !== 'allow-continue-paper',
      authorizedExecution: false,
      controlledResumeEligible: false,
      mutatesRuntime: false,
      mutatesProvider: false,
      mutatesStrategy: false,
      createdAt: now,
    };
  }

  private decisionType(signal: PaperRiskSignal): PaperRiskDecision['decision'] {
    if (signal.signalType === 'paper-reconciliation-unresolved') {
      return 'require-reconciliation-review';
    }
    if (signal.signalType === 'paper-runtime-degraded' || signal.signalType === 'paper-provider-degraded') {
      return signal.severity === 'critical' ? 'reject-controlled-resume-eligibility' : 'recommend-pause';
    }
    if (signal.signalType === 'paper-execution-latency-high' || signal.signalType === 'paper-telemetry-ingestion-degraded') {
      return 'require-telemetry-review';
    }
    if (signal.signalType === 'paper-fill-quality-degraded' || signal.signalType === 'paper-slippage-high') {
      return 'require-simulation-retry';
    }
    if (signal.signalType === 'paper-strategy-degraded') {
      return 'require-backtest';
    }
    return 'require-controlled-resume-approval';
  }

  private status(decision: PaperRiskDecision['decision']): PaperRiskDecision['status'] {
    if (decision === 'allow-continue-paper') {
      return 'allowed';
    }
    if (decision === 'require-simulation-retry' || decision === 'require-backtest') {
      return 'retry-required';
    }
    if (decision === 'reject-controlled-resume-eligibility') {
      return 'rejected';
    }
    return 'review-required';
  }
}

