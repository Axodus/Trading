import type {
  CexConnectorCapabilities,
  CexExecutionAttemptRepository,
  CexExecutionLifecycleState,
  CexOrderEvidence,
  CexReconciliationProvider,
  CexReconciliationResult,
  CexSubmissionAttempt,
} from '../../../../packages/trading-contracts/src/index.js';

export type CexLifecycleFailureCode =
  | 'ATTEMPT_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'RECONCILIATION_CAPABILITY_NOT_ADMITTED'
  | 'PROVIDER_MISMATCH'
  | 'DUPLICATE_EXECUTION_CLIENT_ORDER_ID';

export class CexExecutionLifecycleError extends Error {
  constructor(
    public readonly code: CexLifecycleFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'CexExecutionLifecycleError';
  }
}

export class InMemoryCexExecutionAttemptRepository implements CexExecutionAttemptRepository {
  private readonly attempts = new Map<string, CexSubmissionAttempt>();

  async save(attempt: CexSubmissionAttempt): Promise<void> {
    this.attempts.set(attempt.attemptId, structuredClone(attempt));
  }

  async get(attemptId: string): Promise<CexSubmissionAttempt | undefined> {
    const attempt = this.attempts.get(attemptId);
    return attempt ? structuredClone(attempt) : undefined;
  }

  async listByStates(states: CexExecutionLifecycleState[]): Promise<CexSubmissionAttempt[]> {
    return [...this.attempts.values()]
      .filter((attempt) => states.includes(attempt.state))
      .map((attempt) => structuredClone(attempt));
  }

  async hasExecutionClientOrderId(executionClientOrderId: string): Promise<boolean> {
    return [...this.attempts.values()].some((attempt) => attempt.executionClientOrderId === executionClientOrderId);
  }
}

export interface CreateCexSubmissionAttemptInput {
  attemptId: string;
  intentId: string;
  correlationId: string;
  providerId: string;
  connector: string;
  market: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: string;
  price?: string;
  now?: string;
}

export class CexExecutionLifecycleService {
  constructor(
    private readonly repository: CexExecutionAttemptRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createAttempt(input: CreateCexSubmissionAttemptInput): Promise<CexSubmissionAttempt> {
    const executionClientOrderId = createExecutionClientOrderId(input.attemptId);
    const repositoryWithIdentityCheck = this.repository as CexExecutionAttemptRepository & {
      hasExecutionClientOrderId?: (id: string) => Promise<boolean>;
    };
    if (repositoryWithIdentityCheck.hasExecutionClientOrderId
      && await repositoryWithIdentityCheck.hasExecutionClientOrderId(executionClientOrderId)) {
      throw new CexExecutionLifecycleError(
        'DUPLICATE_EXECUTION_CLIENT_ORDER_ID',
        `Execution client order ID ${executionClientOrderId} is already assigned to another attempt`,
      );
    }
    const timestamp = input.now ?? this.now();
    const attempt: CexSubmissionAttempt = {
      ...input,
      executionClientOrderId,
      state: 'attempt-created',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repository.save(attempt);
    return attempt;
  }

  async markSubmissionInProgress(attemptId: string): Promise<CexSubmissionAttempt> {
    return this.transition(attemptId, 'submission-in-progress', ['attempt-created']);
  }

  async recordAcknowledged(attemptId: string, evidence: CexOrderEvidence): Promise<CexSubmissionAttempt> {
    const attempt = await this.requireAttempt(attemptId);
    this.assertState(attempt, ['submission-in-progress']);
    return this.save({
      ...attempt,
      state: 'provider-acknowledged',
      providerOrderId: evidence.providerOrderId,
      evidence,
    });
  }

  async recordRejected(attemptId: string, reason: string): Promise<CexSubmissionAttempt> {
    const attempt = await this.requireAttempt(attemptId);
    this.assertState(attempt, ['submission-in-progress']);
    return this.save({ ...attempt, state: 'rejected', lastFailure: reason });
  }

  async recordUnknown(attemptId: string, reason: string): Promise<CexSubmissionAttempt> {
    const attempt = await this.requireAttempt(attemptId);
    this.assertState(attempt, ['submission-in-progress']);
    return this.save({ ...attempt, state: 'execution-unknown', lastFailure: reason });
  }

  async reconcile(attemptId: string, provider: CexReconciliationProvider): Promise<CexSubmissionAttempt> {
    const attempt = await this.requireAttempt(attemptId);
    this.assertState(attempt, ['execution-unknown', 'reconciling']);
    this.assertProvider(attempt, provider);
    assertReconciliationCapabilities(provider.capabilities);
    const reconciling = await this.save({ ...attempt, state: 'reconciling' });
    const result = await provider.reconcileByClientOrderId({
      attemptId: reconciling.attemptId,
      providerId: reconciling.providerId,
      connector: reconciling.connector,
      market: reconciling.market,
      executionClientOrderId: reconciling.executionClientOrderId,
      requestedAt: this.now(),
    });
    return this.applyReconciliationResult(reconciling, result);
  }

  async requestCancellation(attemptId: string): Promise<CexSubmissionAttempt> {
    const attempt = await this.requireAttempt(attemptId);
    this.assertState(attempt, ['provider-acknowledged', 'reconciled-found']);
    if (!attempt.providerOrderId) {
      throw new CexExecutionLifecycleError('INVALID_TRANSITION', 'Cancellation requires provider order evidence');
    }
    return this.save({ ...attempt, state: 'cancel-requested' });
  }

  async recordCancellation(attemptId: string, outcome: 'cancelled' | 'rejected' | 'failed', reason?: string): Promise<CexSubmissionAttempt> {
    const attempt = await this.requireAttempt(attemptId);
    this.assertState(attempt, ['cancel-requested']);
    const state = outcome === 'cancelled' ? 'cancelled' : outcome === 'rejected' ? 'cancellation-rejected' : 'cancellation-failed';
    return this.save({ ...attempt, state, lastFailure: reason });
  }

  async recoverableAttempts(): Promise<CexSubmissionAttempt[]> {
    return this.repository.listByStates(['submission-in-progress', 'execution-unknown', 'reconciling', 'cancel-requested']);
  }

  private async applyReconciliationResult(attempt: CexSubmissionAttempt, result: CexReconciliationResult): Promise<CexSubmissionAttempt> {
    if (result.outcome === 'found') {
      return this.save({
        ...attempt,
        state: 'reconciled-found',
        providerOrderId: result.evidence.providerOrderId,
        evidence: result.evidence,
      });
    }
    if (result.outcome === 'not-found') {
      return this.save({ ...attempt, state: 'reconciled-not-found', evidence: result.evidence });
    }
    return this.save({ ...attempt, state: 'reconciled-indeterminate', evidence: result.evidence, lastFailure: result.reason });
  }

  private async transition(attemptId: string, state: CexExecutionLifecycleState, allowed: CexExecutionLifecycleState[]): Promise<CexSubmissionAttempt> {
    const attempt = await this.requireAttempt(attemptId);
    this.assertState(attempt, allowed);
    return this.save({ ...attempt, state });
  }

  private async requireAttempt(attemptId: string): Promise<CexSubmissionAttempt> {
    const attempt = await this.repository.get(attemptId);
    if (!attempt) throw new CexExecutionLifecycleError('ATTEMPT_NOT_FOUND', `Submission attempt ${attemptId} was not found`);
    return attempt;
  }

  private assertState(attempt: CexSubmissionAttempt, allowed: CexExecutionLifecycleState[]): void {
    if (!allowed.includes(attempt.state)) {
      throw new CexExecutionLifecycleError('INVALID_TRANSITION', `Cannot transition attempt ${attempt.attemptId} from ${attempt.state}`);
    }
  }

  private assertProvider(attempt: CexSubmissionAttempt, provider: CexReconciliationProvider): void {
    if (attempt.providerId !== provider.providerId || attempt.connector !== provider.connector) {
      throw new CexExecutionLifecycleError('PROVIDER_MISMATCH', 'Reconciliation provider does not match the submission attempt');
    }
  }

  private async save(attempt: CexSubmissionAttempt): Promise<CexSubmissionAttempt> {
    const updated = { ...attempt, updatedAt: this.now() };
    await this.repository.save(updated);
    return updated;
  }
}

export function assertReconciliationCapabilities(capabilities: CexConnectorCapabilities): void {
  if (!capabilities.supportsCallerOrderIdentity
    || !capabilities.supportsExactOrderLookup
    || !capabilities.supportsDeterministicReconciliation) {
    throw new CexExecutionLifecycleError(
      'RECONCILIATION_CAPABILITY_NOT_ADMITTED',
      'CEX reconciliation requires caller identity, exact lookup and deterministic reconciliation capabilities',
    );
  }
}

export function createExecutionClientOrderId(attemptId: string): string {
  const normalized = attemptId.replace(/[^A-Za-z0-9_-]/g, '-');
  const value = `ax-${normalized}`.slice(0, 32);
  if (value.length < 3) throw new CexExecutionLifecycleError('INVALID_TRANSITION', 'Attempt ID cannot produce an execution client order ID');
  return value;
}
