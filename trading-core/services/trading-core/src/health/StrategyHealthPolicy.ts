import type { StrategyHealthState, StrategyLifecycleState } from '../../../../packages/trading-contracts/src/index.js';
import type {
  OperationalCompatibility,
  StrategyHealthPolicy,
  StrategyHealthTransitionRule,
} from './StrategyHealthTypes.js';

export const DEFAULT_STRATEGY_HEALTH_POLICY_REVISION = 'strategy-health-policy-v1.0';

const RECOVERY_AUTHORITY_REQUIRED: StrategyHealthTransitionRule[] = [
  { fromHealth: 'UNKNOWN', toHealth: 'HEALTHY', requiredEvidence: true, requiredAuthorization: true },
  { fromHealth: 'DEGRADED', toHealth: 'HEALTHY', requiredEvidence: true, requiredAuthorization: true },
  { fromHealth: 'REVALIDATION_REQUIRED', toHealth: 'HEALTHY', requiredEvidence: true, requiredAuthorization: true },
  { fromHealth: 'SUSPENDED', toHealth: 'HEALTHY', requiredEvidence: true, requiredAuthorization: true },
];

export const DEFAULT_STRATEGY_HEALTH_POLICY: StrategyHealthPolicy = {
  policyRevision: DEFAULT_STRATEGY_HEALTH_POLICY_REVISION,
  name: 'Canonical Axodus Strategy Health Policy v1.0',
  createdAt: '2026-09-20T00:00:00.000Z',
  allowedTransitions: [
    ...RECOVERY_AUTHORITY_REQUIRED,
    { fromHealth: 'UNKNOWN', toHealth: 'DEGRADED', requiredEvidence: true },
    { fromHealth: 'UNKNOWN', toHealth: 'REVALIDATION_REQUIRED', requiredEvidence: true },
    { fromHealth: 'UNKNOWN', toHealth: 'SUSPENDED', requiredEvidence: true, requiredAuthorization: true },
    { fromHealth: 'UNKNOWN', toHealth: 'RETIRED', requiredAuthorization: true },
    { fromHealth: 'HEALTHY', toHealth: 'DEGRADED', requiredEvidence: true },
    { fromHealth: 'HEALTHY', toHealth: 'REVALIDATION_REQUIRED', requiredEvidence: true },
    { fromHealth: 'HEALTHY', toHealth: 'SUSPENDED', requiredEvidence: true, requiredAuthorization: true },
    { fromHealth: 'HEALTHY', toHealth: 'RETIRED', requiredAuthorization: true },
    { fromHealth: 'DEGRADED', toHealth: 'REVALIDATION_REQUIRED', requiredEvidence: true },
    { fromHealth: 'DEGRADED', toHealth: 'SUSPENDED', requiredEvidence: true, requiredAuthorization: true },
    { fromHealth: 'DEGRADED', toHealth: 'RETIRED', requiredAuthorization: true },
    { fromHealth: 'REVALIDATION_REQUIRED', toHealth: 'SUSPENDED', requiredEvidence: true, requiredAuthorization: true },
    { fromHealth: 'REVALIDATION_REQUIRED', toHealth: 'RETIRED', requiredAuthorization: true },
    { fromHealth: 'SUSPENDED', toHealth: 'REVALIDATION_REQUIRED', requiredEvidence: true, requiredAuthorization: true },
    { fromHealth: 'SUSPENDED', toHealth: 'RETIRED', requiredAuthorization: true },
  ],
};

const ACTIVE_LIFECYCLES = new Set<StrategyLifecycleState>(['PAPER', 'TESTNET', 'LIMITED_LIVE', 'PRODUCTION']);

export function lifecycleHealthCompatibility(
  lifecycleState: StrategyLifecycleState,
  healthState: StrategyHealthState,
): OperationalCompatibility {
  if (healthState === 'HEALTHY' && ACTIVE_LIFECYCLES.has(lifecycleState)) {
    return 'FULL';
  }
  if (healthState === 'DEGRADED' && (ACTIVE_LIFECYCLES.has(lifecycleState) || lifecycleState === 'MONITOR')) {
    return 'CONDITIONAL';
  }
  if (healthState === 'HEALTHY' && lifecycleState === 'MONITOR') {
    return 'RISK_REDUCING_ONLY';
  }
  return 'REJECTED';
}

export function transitionRule(
  policy: StrategyHealthPolicy,
  fromHealth: StrategyHealthState,
  toHealth: StrategyHealthState,
): StrategyHealthTransitionRule | undefined {
  return policy.allowedTransitions.find((rule) => rule.fromHealth === fromHealth && rule.toHealth === toHealth);
}
