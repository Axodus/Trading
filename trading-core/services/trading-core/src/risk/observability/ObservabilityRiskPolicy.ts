import type {
  ObservabilityRiskDecision,
  ObservabilityRiskDecisionType,
  ObservabilityRiskPolicy as ObservabilityRiskPolicyContract,
  ObservabilityRiskSignal,
} from '../../../../../packages/trading-contracts/src/index.js';

export class ObservabilityRiskPolicy {
  constructor(private readonly policy: ObservabilityRiskPolicyContract = defaultObservabilityRiskPolicy()) {}

  decide(signal: ObservabilityRiskSignal): ObservabilityRiskDecision {
    const decision = this.decisionFor(signal);
    const createdAt = new Date().toISOString();
    return {
      id: `observability-risk-decision:${decision}:${signal.id}`,
      correlationId: signal.correlationId,
      tenantId: signal.tenantId,
      decision,
      status: this.statusFor(decision),
      reason: this.reasonFor(signal, decision),
      signal,
      requiresAcs: decision !== 'allow',
      requiresGovernance: decision === 'recommend-block' || decision === 'require-controlled-resume-approval',
      authorizedExecution: false,
      mutatesRuntime: false,
      mutatesProvider: false,
      mutatesStrategy: false,
      approvalPath: 'ACS -> Trading Core -> Governance/Product/Compliance/Risk -> Runtime/Provider',
      createdAt,
    };
  }

  private decisionFor(signal: ObservabilityRiskSignal): ObservabilityRiskDecisionType {
    if (signal.signalType === 'provider-critical') {
      return this.policy.providerCriticalDecision;
    }
    if (signal.signalType === 'provider-degraded') {
      return this.policy.providerDegradedDecision;
    }
    if (signal.signalType === 'runtime-critical') {
      return this.policy.runtimeCriticalDecision;
    }
    if (signal.signalType === 'runtime-degraded') {
      return this.policy.runtimeDegradedDecision;
    }
    if (signal.signalType === 'strategy-degraded') {
      return this.policy.strategyDegradedDecision;
    }
    if (signal.signalType === 'execution-latency-spike') {
      return this.policy.latencySpikeDecision;
    }
    if (signal.signalType === 'telemetry-ingestion-degraded') {
      return this.policy.telemetryDegradedDecision;
    }
    if (signal.signalType === 'repeated-runtime-recovery') {
      return 'require-controlled-resume-approval';
    }
    if (signal.signalType === 'repeated-reconciliation-drift') {
      return 'require-review';
    }
    return 'allow';
  }

  private statusFor(decision: ObservabilityRiskDecisionType): ObservabilityRiskDecision['status'] {
    if (decision === 'allow') {
      return 'allowed';
    }
    if (decision === 'warn') {
      return 'warning';
    }
    if (decision === 'recommend-block') {
      return 'proposal';
    }
    return 'review-required';
  }

  private reasonFor(signal: ObservabilityRiskSignal, decision: ObservabilityRiskDecisionType): string {
    return `Observability signal ${signal.signalType} produced risk decision ${decision}.`;
  }
}

export function defaultObservabilityRiskPolicy(): ObservabilityRiskPolicyContract {
  return {
    providerCriticalDecision: 'recommend-block',
    providerDegradedDecision: 'require-review',
    runtimeCriticalDecision: 'require-recovery',
    runtimeDegradedDecision: 'require-review',
    strategyDegradedDecision: 'require-simulation',
    latencySpikeDecision: 'require-review',
    telemetryDegradedDecision: 'require-review',
    controlledResumeRequiredAfterCritical: true,
  };
}
