import type { TrinityTradingIntent } from '../../../../../packages/trading-contracts/src/index.js';

export class ProviderQualityScoringService {
  score(intent: TrinityTradingIntent): number {
    const telemetry = intent.providerQualityTelemetry;
    if (!telemetry) {
      return intent.providerSnapshot?.health === 'degraded' ? 0.45 : intent.providerSnapshot?.health === 'offline' ? 0.1 : 0.9;
    }
    const degradation = telemetry.degradationScore ?? 0;
    const slippagePenalty = Math.min(0.35, (telemetry.slippageBps ?? 0) / 100);
    const rejectionPenalty = Math.min(0.35, telemetry.rejectionRate ?? 0);
    const fillRate = telemetry.fillRate ?? 1;
    return Math.max(0, Math.min(1, fillRate - degradation - slippagePenalty - rejectionPenalty));
  }

  degraded(intent: TrinityTradingIntent): boolean {
    return this.score(intent) <= 0.55 || intent.providerSnapshot?.health === 'degraded' || intent.providerSnapshot?.health === 'offline';
  }
}
