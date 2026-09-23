import type {
  PositionProtectionPlanV1,
  ProtectionRuleV1,
  TradeProtectionLifecycleStateV1,
  ProtectionLifecycleStateV1,
  PositionSideModeV1,
  ProtectionExecutionModeV1,
  TriggerPriceSourceV1,
  ProtectionRuleTypeV1,
} from './PositionProtectionContracts.js';

export type DurableProtectionOwnerTypeV1 = 'TRADING_RUNTIME' | 'SAFETY_SUPERVISOR' | 'RECOVERY_WORKER';

export type DurableProtectionOwnershipStatusV1 = 'ACTIVE' | 'RELEASED' | 'EXPIRED';

export interface DurableProtectionOwnershipRecordV1 {
  protectionPlanId: string;
  ownerId: string;
  ownerType: DurableProtectionOwnerTypeV1;
  leaseId: string;
  fencingToken: number;
  acquiredAt: string;
  leaseExpiresAt: string;
  lastHeartbeatAt: string;
  status: DurableProtectionOwnershipStatusV1;
  version: number;
  updatedAt: string;
}

export interface DurablePositionProtectionPlanRecordV1 {
  id: string;
  environment: string;
  provider: string;
  instrument: string;
  positionMode: PositionSideModeV1;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  executionIntentId: string;
  sourceEntryAttemptId?: string;
  strategyId?: string;
  confirmedExposureQuantity: string;
  entryReferencePrice: string;
  lifecycleState: TradeProtectionLifecycleStateV1;
  semanticFingerprint: string;
  unprotectedReason?: string;
  correlationId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastReconciledAt?: string;
  rules: DurableProtectionRuleRecordV1[];
  ownership?: DurableProtectionOwnershipRecordV1;
}

export interface DurableProtectionRuleRecordV1 {
  id: string;
  protectionPlanId: string;
  generation: number;
  ruleType: ProtectionRuleTypeV1;
  executionMode: ProtectionExecutionModeV1;
  triggerPrice: string;
  limitPrice?: string;
  triggerPriceSource: TriggerPriceSourceV1;
  enablePriceProtection: boolean;
  protectedQuantity?: string;
  canonicalStatus: ProtectionLifecycleStateV1;
  providerClientAlgoId: string;
  providerAlgoId?: string;
  providerStatus?: string;
  createdAt: string;
  updatedAt: string;
  lastProviderObservationAt?: string;
}

export interface CreateDurableProtectionPlanParams {
  id?: string;
  environment: string;
  provider: string;
  instrument: string;
  positionMode: PositionSideModeV1;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  executionIntentId: string;
  sourceEntryAttemptId?: string;
  strategyId?: string;
  confirmedExposureQuantity: string;
  entryReferencePrice: string;
  lifecycleState?: TradeProtectionLifecycleStateV1;
  correlationId: string;
  rules: {
    id?: string;
    generation?: number;
    ruleType: ProtectionRuleTypeV1;
    executionMode: ProtectionExecutionModeV1;
    triggerPrice: string;
    limitPrice?: string;
    triggerPriceSource: TriggerPriceSourceV1;
    enablePriceProtection?: boolean;
    protectedQuantity?: string;
    providerClientAlgoId: string;
    providerAlgoId?: string;
    providerStatus?: string;
    canonicalStatus?: ProtectionLifecycleStateV1;
  }[];
}

export interface AcquireOwnershipParams {
  protectionPlanId: string;
  ownerId: string;
  ownerType: DurableProtectionOwnerTypeV1;
  leaseDurationMs: number;
}

export interface RenewOwnershipParams {
  protectionPlanId: string;
  ownerId: string;
  leaseId: string;
  fencingToken: number;
  leaseDurationMs: number;
}

export interface ReleaseOwnershipParams {
  protectionPlanId: string;
  ownerId: string;
  leaseId: string;
  fencingToken: number;
}

export interface TransitionPlanStateCasParams {
  protectionPlanId: string;
  expectedState: TradeProtectionLifecycleStateV1 | TradeProtectionLifecycleStateV1[];
  targetState: TradeProtectionLifecycleStateV1;
  expectedVersion: number;
  fencingToken: number;
  ownerId: string;
  unprotectedReason?: string;
  lastReconciledAt?: string;
}

export interface RegisterProviderIdentityParams {
  ruleId: string;
  protectionPlanId: string;
  fencingToken: number;
  ownerId: string;
  providerAlgoId: string;
  providerStatus?: string;
  canonicalStatus?: ProtectionLifecycleStateV1;
  lastProviderObservationAt?: string;
}

export interface DurableTradingSafetyStateV1 {
  environment: string;
  autonomousEntryKillActive: boolean;
  reason?: string;
  generation: number;
  activatedAt?: string;
  activatedBy?: string;
  updatedAt: string;
}

export type ProtectionRecoveryClassificationV1 =
  | 'FLAT_CONFIRMED'
  | 'PROTECTED_POSITION_CONFIRMED'
  | 'POSITION_UNPROTECTED'
  | 'PROTECTION_ORPHANED'
  | 'PROTECTION_QUANTITY_MISMATCH'
  | 'PROTECTION_IDENTITY_MISMATCH'
  | 'POSITION_STATE_UNKNOWN'
  | 'PROTECTION_STATE_UNKNOWN';

export interface ProtectionRecoverySnapshotV1 {
  protectionPlanId: string;
  environment: string;
  instrument: string;
  lastCanonicalState: TradeProtectionLifecycleStateV1;
  confirmedExposureQuantity: string;
  providerProtectionIdentity?: string;
  lastKnownProviderState?: string;
  lastReconciledAt?: string;
  ownerId?: string;
  fencingToken?: number;
  classification: ProtectionRecoveryClassificationV1;
  requiresReconciliation: boolean;
  isFullyArmed: boolean;
}

// Typed Errors for Safety and Durable State
export class ProtectionDurableStateError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(`[${code}] ${message}`);
    this.name = 'ProtectionDurableStateError';
  }
}

export class ProtectionIdempotencyConflictError extends ProtectionDurableStateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('PROTECTION_IDEMPOTENCY_CONFLICT', message, details);
  }
}

export class ProtectionStateConflictError extends ProtectionDurableStateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('PROTECTION_STATE_CONFLICT', message, details);
  }
}

export class ProtectionOwnershipConflictError extends ProtectionDurableStateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('PROTECTION_OWNERSHIP_CONFLICT', message, details);
  }
}

export class ProtectionLeaseExpiredError extends ProtectionDurableStateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('PROTECTION_LEASE_EXPIRED', message, details);
  }
}

export class ProtectionFencingRejectedError extends ProtectionDurableStateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('PROTECTION_FENCING_REJECTED', message, details);
  }
}

export class ProtectionRepositoryUnavailableError extends ProtectionDurableStateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('PROTECTION_REPOSITORY_UNAVAILABLE', message, details);
  }
}

export class ProtectionTransactionFailedError extends ProtectionDurableStateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('PROTECTION_TRANSACTION_FAILED', message, details);
  }
}

export class ProtectionRecoveryStateInvalidError extends ProtectionDurableStateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('PROTECTION_RECOVERY_STATE_INVALID', message, details);
  }
}

/**
 * Compute semantic fingerprint of safety-critical plan inputs.
 */
export function computeSemanticFingerprint(params: {
  environment: string;
  instrument: string;
  positionMode: string;
  positionSide: string;
  executionIntentId: string;
  confirmedExposureQuantity: string;
  entryReferencePrice: string;
  rules: {
    ruleType: string;
    executionMode: string;
    triggerPrice: string;
    triggerPriceSource: string;
    protectedQuantity?: string;
  }[];
}): string {
  const normalizedRules = params.rules
    .map((r) => `${r.ruleType}|${r.executionMode}|${r.triggerPrice}|${r.triggerPriceSource}|${r.protectedQuantity ?? ''}`)
    .sort()
    .join(';');

  const payload = [
    params.environment.toLowerCase(),
    params.instrument.toUpperCase(),
    params.positionMode,
    params.positionSide,
    params.executionIntentId,
    params.confirmedExposureQuantity,
    params.entryReferencePrice,
    normalizedRules,
  ].join('::');

  return payload;
}
