export class ExecutionControlError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ExecutionControlError';
  }
}

export class ExecutionLifecycleHaltActiveError extends ExecutionControlError {
  constructor(message: string = 'Execution halt is currently active.') {
    super(message, 'EXECUTION_HALT_ACTIVE');
  }
}

export class EnvironmentUnauthorizedError extends ExecutionControlError {
  constructor(message: string = 'Execution environment is not authorized.') {
    super(message, 'ENVIRONMENT_UNAUTHORIZED');
  }
}

export class ExecutionAttemptExpiredError extends ExecutionControlError {
  constructor(message: string = 'Execution attempt has expired.') {
    super(message, 'EXECUTION_ATTEMPT_EXPIRED');
  }
}

export class ExecutionAttemptConflictError extends ExecutionControlError {
  constructor(message: string) {
    super(message, 'EXECUTION_ATTEMPT_CONFLICT');
  }
}

export class ReconciliationInvariantError extends Error {
  constructor(message: string, public readonly code: string = 'EXECUTION_INVARIANT_VIOLATION') {
    super(message);
    this.name = 'ReconciliationInvariantError';
  }
}

