import type { PaperRiskEvaluationInput, PaperRiskSignal } from '../../../../../packages/trading-contracts/src/index.js';

export class PaperSessionHealthEvaluator {
  evaluate(input: PaperRiskEvaluationInput): PaperRiskSignal[] {
    return [
      ...this.healthSignal(input, input.runtimeHealth?.state, 'paper-runtime-degraded'),
      ...this.healthSignal(input, input.providerHealth?.state, 'paper-provider-degraded'),
      ...this.healthSignal(input, input.strategyHealth?.state, 'paper-strategy-degraded'),
      ...this.healthSignal(input, input.telemetryIngestionQuality?.state, 'paper-telemetry-ingestion-degraded'),
      ...this.reconciliationSignals(input),
    ];
  }

  private healthSignal(
    input: PaperRiskEvaluationInput,
    state: string | undefined,
    signalType: PaperRiskSignal['signalType'],
  ): PaperRiskSignal[] {
    if (!state || state === 'healthy') {
      return [];
    }
    const severity = state === 'critical' || state === 'offline' || state === 'suspended' ? 'critical' : 'high';
    return [this.signal(input, signalType, severity, {
      healthState: state,
      reasons: [`${signalType} observed state=${state}`],
    })];
  }

  private reconciliationSignals(input: PaperRiskEvaluationInput): PaperRiskSignal[] {
    const unresolved = input.unresolvedReconciliationProposals ?? 0;
    if (unresolved <= 0) {
      return [];
    }
    return [this.signal(input, 'paper-reconciliation-unresolved', 'critical', {
      unresolvedReconciliationProposals: unresolved,
      reasons: [`${unresolved} unresolved reconciliation proposal(s) require review`],
    })];
  }

  private signal(
    input: PaperRiskEvaluationInput,
    signalType: PaperRiskSignal['signalType'],
    severity: PaperRiskSignal['severity'],
    evidence: PaperRiskSignal['evidence'],
  ): PaperRiskSignal {
    return {
      id: `${input.correlationId}:${signalType}`,
      correlationId: input.correlationId,
      tenantId: input.tenantId,
      signalType,
      severity,
      providerId: input.providerId,
      runtimeInstanceId: input.runtimeInstanceId,
      strategyId: input.strategyId,
      strategyProductId: input.strategyProductId,
      userId: input.userId,
      daoId: input.daoId,
      evidence,
      createdAt: new Date().toISOString(),
    };
  }
}

