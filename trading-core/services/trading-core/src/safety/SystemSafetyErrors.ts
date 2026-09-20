/**
 * AXODUS-TRADING-EPIC-01 / REQ-13
 * System Safety & Recovery Typed Domain Errors
 */

export class SystemSafetyError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SystemSafetyError';
  }
}

export class SafetySnapshotStaleError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'SAFETY_SNAPSHOT_STALE');
    this.name = 'SafetySnapshotStaleError';
  }
}

export class SafetyIdempotencyConflictError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'SAFETY_IDEMPOTENCY_CONFLICT');
    this.name = 'SafetyIdempotencyConflictError';
  }
}

export class SafetyAuthorityBypassAttemptError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'SAFETY_AUTHORITY_BYPASS_ATTEMPT');
    this.name = 'SafetyAuthorityBypassAttemptError';
  }
}

export class KillSwitchAlreadyActiveError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'KILL_SWITCH_ALREADY_ACTIVE');
    this.name = 'KillSwitchAlreadyActiveError';
  }
}

export class KillSwitchReleaseBlockedError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'KILL_SWITCH_RELEASE_BLOCKED');
    this.name = 'KillSwitchReleaseBlockedError';
  }
}

export class RecoveryDependencyCycleError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'RECOVERY_DEPENDENCY_CYCLE');
    this.name = 'RecoveryDependencyCycleError';
  }
}

export class RecoveryFencingTokenError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'FENCING_REJECTED');
    this.name = 'RecoveryFencingTokenError';
  }
}

export class ResumePrerequisiteFailedError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'RESUME_PREREQUISITES_FAILED');
    this.name = 'ResumePrerequisiteFailedError';
  }
}

export class UnauthorizedSafetyActionError extends SystemSafetyError {
  constructor(message: string) {
    super(message, 'UNAUTHORIZED_SAFETY_ACTION');
    this.name = 'UnauthorizedSafetyActionError';
  }
}

