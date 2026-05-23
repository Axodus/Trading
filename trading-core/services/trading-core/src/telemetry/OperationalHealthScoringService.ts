import type {
  OperationalHealthScore,
  OperationalHealthState,
  ProviderTelemetrySample,
  RuntimeTelemetrySample,
  StrategyTelemetrySample,
} from '../../../../packages/trading-contracts/src/index.js';

export class OperationalHealthScoringService {
  scoreRuntime(sample: RuntimeTelemetrySample): OperationalHealthScore {
    const reasons: string[] = [];
    let score = this.baseScore(sample.status, reasons);
    score -= Math.min(0.25, (sample.failedExecutions ?? 0) * 0.05);
    score -= Math.min(0.2, (sample.executionDriftFrequency ?? 0) * 0.1);
    score -= this.latencyPenalty(sample.averageLatencyMs ?? 0);
    score -= this.ingestionPenalty(sample.telemetryIngestionQuality, reasons);
    return this.toScore(score, sample.status, reasons, sample.measuredAt);
  }

  scoreProvider(sample: ProviderTelemetrySample): OperationalHealthScore {
    const reasons: string[] = [];
    let score = this.baseScore(sample.status, reasons);
    score -= this.latencyPenalty(sample.latencyMs ?? 0);
    score -= Math.min(0.25, (sample.slippageBps ?? 0) / 400);
    score -= Math.min(0.25, (sample.rejectionRate ?? 0) * 0.5);
    score -= Math.min(0.3, sample.degradationScore ?? 0);
    if ((sample.fillRate ?? 1) < 0.8) {
      reasons.push('provider fill rate below operational threshold');
      score -= 0.15;
    }
    return this.toScore(score, sample.status, reasons, sample.measuredAt);
  }

  scoreStrategy(sample: StrategyTelemetrySample): OperationalHealthScore {
    const reasons: string[] = [];
    let score = 1;
    score -= Math.min(0.4, sample.degradationScore ?? 0);
    score -= Math.min(0.25, (sample.drawdownPct ?? 0) / 40);
    score -= Math.min(0.25, sample.signalFailureRate ?? 0);
    score -= Math.min(0.15, (sample.failedExecutions ?? 0) * 0.03);
    score -= this.ingestionPenalty(sample.telemetryIngestionQuality, reasons);
    return this.toScore(score, undefined, reasons, sample.measuredAt);
  }

  scoreTelemetryPipeline(quality: number, measuredAt = new Date().toISOString()): OperationalHealthScore {
    const reasons = quality < 0.8 ? ['telemetry ingestion quality below threshold'] : [];
    return this.toScore(Math.max(0, Math.min(1, quality)), undefined, reasons, measuredAt);
  }

  private baseScore(status: OperationalHealthState, reasons: string[]): number {
    if (status === 'suspended') {
      reasons.push('entity is suspended');
      return 0;
    }
    if (status === 'critical') {
      reasons.push('entity reported critical health');
      return 0.25;
    }
    if (status === 'degraded') {
      reasons.push('entity reported degraded health');
      return 0.6;
    }
    return 1;
  }

  private latencyPenalty(latencyMs: number): number {
    if (latencyMs >= 2000) {
      return 0.25;
    }
    if (latencyMs >= 1000) {
      return 0.15;
    }
    if (latencyMs >= 500) {
      return 0.05;
    }
    return 0;
  }

  private ingestionPenalty(quality: number | undefined, reasons: string[]): number {
    if (quality === undefined || quality >= 0.8) {
      return 0;
    }
    reasons.push('telemetry ingestion quality below threshold');
    return Math.min(0.25, 0.8 - quality);
  }

  private toScore(score: number, reportedState: OperationalHealthState | undefined, reasons: string[], measuredAt = new Date().toISOString()): OperationalHealthScore {
    const normalizedScore = Math.max(0, Math.min(1, score));
    const state = reportedState === 'suspended' ? 'suspended' : this.stateFromScore(normalizedScore);
    return {
      state,
      score: normalizedScore,
      reasons,
      measuredAt,
    };
  }

  private stateFromScore(score: number): OperationalHealthState {
    if (score >= 0.75) {
      return 'healthy';
    }
    if (score >= 0.35) {
      return 'degraded';
    }
    return 'critical';
  }
}
