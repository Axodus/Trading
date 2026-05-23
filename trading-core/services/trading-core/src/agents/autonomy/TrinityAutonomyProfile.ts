import type { TradingRecommendationType, TrinityAutonomyProfile } from '../../../../../packages/trading-contracts/src/index.js';

export function createTrinityAutonomyProfile(overrides: Partial<TrinityAutonomyProfile> = {}): TrinityAutonomyProfile {
  const allowedRecommendationTypes: TradingRecommendationType[] = [
    'pause-strategy',
    'resume-strategy',
    'adjust-parameter',
    'rotate-pair',
    'reduce-exposure',
    'increase-hedge',
    'request-backtest',
    'request-simulation',
    'recommend-provider-block',
    'recommend-runtime-recovery',
  ];
  const profile: TrinityAutonomyProfile = {
    agentId: 'trinity',
    autonomyLevel: 0,
    governanceApproved: false,
    riskApproved: false,
    complianceApproved: false,
    treasuryMutationAllowed: false,
    simulationRequiredBeforeMutation: true,
    selfEscalationAllowed: false,
    allowedRecommendationTypes,
    ...overrides,
  };
  return {
    ...profile,
    agentId: 'trinity',
    treasuryMutationAllowed: false,
    simulationRequiredBeforeMutation: true,
    selfEscalationAllowed: false,
  };
}
