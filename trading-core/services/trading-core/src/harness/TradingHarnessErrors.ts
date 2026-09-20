/**
 * AXODUS-TRADING-EPIC-01 / REQ-14
 * Typed Domain Errors for Trading Harness Integration
 */

export class HarnessEnvironmentProhibitedError extends Error {
  public readonly code = 'HARNESS_ENVIRONMENT_PROHIBITED';
  constructor(message: string) {
    super(message);
    this.name = 'HarnessEnvironmentProhibitedError';
  }
}

export class HarnessRevisionMismatchError extends Error {
  public readonly code = 'HARNESS_REVISION_MISMATCH';
  constructor(message: string) {
    super(message);
    this.name = 'HarnessRevisionMismatchError';
  }
}

export class HarnessStaleStateError extends Error {
  public readonly code = 'HARNESS_STALE_STATE';
  constructor(message: string) {
    super(message);
    this.name = 'HarnessStaleStateError';
  }
}

export class HarnessAuthorityBypassAttemptError extends Error {
  public readonly code = 'HARNESS_AUTHORITY_BYPASS_ATTEMPT';
  constructor(message: string) {
    super(message);
    this.name = 'HarnessAuthorityBypassAttemptError';
  }
}

export class HarnessIdempotencyConflictError extends Error {
  public readonly code = 'HARNESS_IDEMPOTENCY_CONFLICT';
  constructor(message: string) {
    super(message);
    this.name = 'HarnessIdempotencyConflictError';
  }
}

export class HarnessFencingTokenError extends Error {
  public readonly code = 'HARNESS_FENCING_TOKEN_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'HarnessFencingTokenError';
  }
}

export class HarnessKillSwitchActiveError extends Error {
  public readonly code = 'HARNESS_KILL_SWITCH_ACTIVE';
  constructor(message: string) {
    super(message);
    this.name = 'HarnessKillSwitchActiveError';
  }
}
