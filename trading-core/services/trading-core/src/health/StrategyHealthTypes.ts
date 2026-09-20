import type {
  StrategyHealth,
  StrategyHealthState,
  StrategyLifecycleState,
} from '../../../../packages/trading-contracts/src/index.js';

export type OperationalCompatibility = 'FULL' | 'RISK_REDUCING_ONLY' | 'CONDITIONAL' | 'REJECTED';

export interface StrategyHealthPolicy {
  readonly policyRevision: string;
  readonly name: string;
  readonly allowedTransitions: readonly StrategyHealthTransitionRule[];
  readonly createdAt: string;
}

export interface StrategyHealthTransitionRule {
  readonly fromHealth: StrategyHealthState;
  readonly toHealth: StrategyHealthState;
  readonly requiredEvidence?: boolean;
  readonly requiredAuthorization?: boolean;
}

export interface StrategyHealthHead extends StrategyHealth {
  readonly healthState: StrategyHealthState;
  readonly healthVersion: number;
  readonly effectiveAt: string;
  readonly evaluationPolicyRevision: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly previousHealthVersion?: number;
  readonly lastTransitionId?: string;
}

export interface StrategyHealthTransitionCommand {
  readonly commandId: string;
  readonly strategyId: string;
  readonly strategyRevisionId: string;
  readonly expectedHealthVersion: number;
  readonly fromHealth: StrategyHealthState;
  readonly toHealth: StrategyHealthState;
  readonly policyRevision: string;
  readonly evidenceRefs: readonly string[];
  readonly authorizationRefs: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly evaluationTime: string;
  readonly idempotencyKey: string;
  readonly actorType: 'system' | 'operator' | 'governance' | 'agent' | 'quant';
  readonly actorId: string;
}

export interface StrategyHealthTransitionResult {
  readonly transitionId: string;
  readonly strategyId: string;
  readonly strategyRevisionId: string;
  readonly previousHealth: StrategyHealthState;
  readonly newHealth: StrategyHealthState;
  readonly previousVersion: number;
  readonly newVersion: number;
  readonly policyRevision: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly decision: 'ACCEPTED' | 'REJECTED' | 'CONFLICT';
  readonly decidedAt: string;
  readonly eventRef?: string;
}

export interface StrategyHealthTransitionRecord extends StrategyHealthTransitionResult {
  readonly idempotencyKey: string;
  readonly commandHash: string;
  readonly authorizationRefs: readonly string[];
  readonly actorType: StrategyHealthTransitionCommand['actorType'];
  readonly actorId: string;
  readonly createdAt: string;
}

export interface StrategyOperationalSnapshot {
  readonly snapshotId: string;
  readonly strategyId: string;
  readonly strategyRevisionId: string;
  readonly lifecycleState: StrategyLifecycleState;
  readonly lifecycleVersion: number;
  readonly healthState: StrategyHealthState;
  readonly healthVersion: number;
  readonly compatibility: OperationalCompatibility;
  readonly effectiveAt: string;
  readonly expiresAt: string;
  readonly snapshotVersion: string;
}

export const STRATEGY_HEALTH_STATES: readonly StrategyHealthState[] = [
  'UNKNOWN',
  'HEALTHY',
  'DEGRADED',
  'REVALIDATION_REQUIRED',
  'SUSPENDED',
  'RETIRED',
] as const;
