/**
 * AXODUS-TRADING-EPIC-01 / REQ-12
 * Strategy Operational Governance Typed Domain Errors
 */

export class StrategyOperationalGovernanceError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StrategyOperationalGovernanceError';
  }
}

export class GovernanceRevisionMismatchError extends StrategyOperationalGovernanceError {
  constructor(message: string) {
    super(message, 'GOVERNANCE_REVISION_MISMATCH');
    this.name = 'GovernanceRevisionMismatchError';
  }
}

export class GovernanceSnapshotStaleError extends StrategyOperationalGovernanceError {
  constructor(message: string) {
    super(message, 'GOVERNANCE_SNAPSHOT_STALE');
    this.name = 'GovernanceSnapshotStaleError';
  }
}

export class GovernanceIdempotencyConflictError extends StrategyOperationalGovernanceError {
  constructor(message: string) {
    super(message, 'GOVERNANCE_IDEMPOTENCY_CONFLICT');
    this.name = 'GovernanceIdempotencyConflictError';
  }
}

export class GovernanceAuthorityBypassAttemptError extends StrategyOperationalGovernanceError {
  constructor(message: string) {
    super(message, 'GOVERNANCE_AUTHORITY_BYPASS_ATTEMPT');
    this.name = 'GovernanceAuthorityBypassAttemptError';
  }
}

export class InterventionDependencyCycleError extends StrategyOperationalGovernanceError {
  constructor(message: string) {
    super(message, 'INTERVENTION_DEPENDENCY_CYCLE');
    this.name = 'InterventionDependencyCycleError';
  }
}

export class GovernanceBlockedError extends StrategyOperationalGovernanceError {
  constructor(message: string) {
    super(message, 'GOVERNANCE_BLOCKED');
    this.name = 'GovernanceBlockedError';
  }
}
