import type {
  CexConnectorCapabilities,
  CexExecutionLifecycleState,
  CexOrderEvidence,
  CexReconciliationProvider,
  CexReconciliationResult,
  CexSubmissionAttempt,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  DurableExecutionConcurrencyError,
  PostgresDurableExecutionRepository,
  type DurableSubmissionAttempt,
} from '../repositories/postgres/PostgresDurableExecutionRepository.js';
import type { PostgresTransactionClient, TransactionalPostgresQueryClient } from '../repositories/postgres/PostgresClient.js';
import { CexExecutionLifecycleError, assertReconciliationCapabilities, createExecutionClientOrderId } from './CexExecutionLifecycleService.js';

export interface DurableCexCancellationProvider {
  readonly providerId: string;
  readonly connector: string;
  cancelByProviderOrderId(request: {
    attemptId: string;
    providerId: string;
    connector: string;
    market: string;
    executionClientOrderId: string;
    providerOrderId: string;
    requestedAt: string;
  }): Promise<{
    outcome: 'cancelled' | 'rejected';
    evidence?: CexOrderEvidence;
    reason?: string;
  }>;
}

export class DurableCexExecutionLifecycleService {
  constructor(
    private readonly repository: PostgresDurableExecutionRepository,
    private readonly database: TransactionalPostgresQueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createAttempt(input: {
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
  }): Promise<DurableSubmissionAttempt> {
    const timestamp = input.now ?? this.now();
    const attempt: CexSubmissionAttempt = {
      ...input,
      executionClientOrderId: createExecutionClientOrderId(input.attemptId),
      state: 'attempt-created',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return this.database.transaction(async (tx) => {
      const created = await this.repository.create(attempt, tx);
      await this.appendEvent(created, 'submission-attempt-created', tx);
      return created;
    });
  }

  async get(attemptId: string): Promise<DurableSubmissionAttempt | undefined> {
    return this.repository.get(attemptId);
  }

  async recoveryCandidates(): Promise<DurableSubmissionAttempt[]> {
    return this.repository.listRecoveryCandidates();
  }

  async markSubmissionInProgress(attemptId: string): Promise<DurableSubmissionAttempt> {
    return this.transition(attemptId, 'submission-in-progress', ['attempt-created'], 'submission-started');
  }

  async recordAcknowledged(attemptId: string, evidence: CexOrderEvidence): Promise<DurableSubmissionAttempt> {
    return this.mutate(attemptId, ['submission-in-progress'], 'provider-acknowledged', 'submission-acknowledged', (attempt) => {
      this.assertEvidenceIdentity(attempt, evidence);
      return { providerOrderId: evidence.providerOrderId, evidence };
    });
  }

  async recordRejected(attemptId: string, reason: string): Promise<DurableSubmissionAttempt> {
    return this.mutate(attemptId, ['submission-in-progress'], 'rejected', 'submission-rejected', () => ({ lastFailure: reason }));
  }

  async recordUnknown(attemptId: string, reason: string): Promise<DurableSubmissionAttempt> {
    return this.mutate(attemptId, ['submission-in-progress'], 'execution-unknown', 'submission-unknown', () => ({ lastFailure: reason }));
  }

  async reconcile(attemptId: string, provider: CexReconciliationProvider): Promise<DurableSubmissionAttempt> {
    const current = await this.prepareReconciliation(attemptId, provider);
    if (isTerminal(current.state)) return current;

    let result: CexReconciliationResult;
    try {
      result = await provider.reconcileByClientOrderId({
        attemptId: current.attemptId,
        providerId: current.providerId,
        connector: current.connector,
        market: current.market,
        executionClientOrderId: current.executionClientOrderId,
        requestedAt: this.now(),
      });
    } catch (error) {
      return this.applyReconciliationResult(current.attemptId, current.state, {
        outcome: 'indeterminate',
        reason: `Reconciliation lookup failed: ${error instanceof Error ? error.message : String(error)}`,
        observedAt: this.now(),
      });
    }
    return this.applyReconciliationResult(current.attemptId, current.state, result);
  }

  async requestCancellation(attemptId: string): Promise<DurableSubmissionAttempt> {
    return this.mutate(attemptId, ['provider-acknowledged', 'reconciled-found'], 'cancel-requested', 'cancellation-requested', (attempt) => {
      if (!attempt.providerOrderId) {
        throw new CexExecutionLifecycleError('INVALID_TRANSITION', 'Cancellation requires provider order evidence');
      }
      return {};
    });
  }

  async cancel(attemptId: string, provider: DurableCexCancellationProvider): Promise<DurableSubmissionAttempt> {
    const requested = await this.requestCancellation(attemptId);
    const providerOrderId = requested.providerOrderId;
    if (!providerOrderId) throw new CexExecutionLifecycleError('INVALID_TRANSITION', 'Cancellation requires provider order evidence');
    if (provider.providerId !== requested.providerId || provider.connector !== requested.connector) {
      throw new CexExecutionLifecycleError('PROVIDER_MISMATCH', 'Cancellation provider does not match the submission attempt');
    }

    try {
      const result = await provider.cancelByProviderOrderId({
        attemptId: requested.attemptId,
        providerId: requested.providerId,
        connector: requested.connector,
        market: requested.market,
        executionClientOrderId: requested.executionClientOrderId,
        providerOrderId,
        requestedAt: this.now(),
      });
      return this.recordCancellation(requested.attemptId, result.outcome, result.reason, result.evidence);
    } catch (error) {
      return this.mutate(requested.attemptId, ['cancel-requested'], 'cancellation-unknown', 'cancellation-unknown', () => ({
        lastFailure: `Cancellation result unknown: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  }

  async recordCancellation(
    attemptId: string,
    outcome: 'cancelled' | 'rejected' | 'failed',
    reason?: string,
    evidence?: CexOrderEvidence,
  ): Promise<DurableSubmissionAttempt> {
    const state: CexExecutionLifecycleState = outcome === 'cancelled'
      ? 'cancelled'
      : outcome === 'rejected' ? 'cancellation-rejected' : 'cancellation-failed';
    return this.mutate(attemptId, ['cancel-requested'], state, `cancellation-${outcome}`, (attempt) => {
      if (evidence) this.assertEvidenceIdentity(attempt, evidence);
      return {
      ...(reason ? { lastFailure: reason } : {}),
      ...(evidence ? { evidence } : {}),
      };
    });
  }

  private async prepareReconciliation(attemptId: string, provider: CexReconciliationProvider): Promise<DurableSubmissionAttempt> {
    return this.database.transaction(async (tx) => {
      const attempt = await this.requireAttempt(attemptId, tx);
      if (isTerminal(attempt.state)) return attempt;
      this.assertProvider(attempt, provider);
      assertReconciliationCapabilities(provider.capabilities);
      if (attempt.state === 'execution-unknown') {
        return this.mutateInTransaction(attempt, 'reconciling', 'reconciliation-started', tx, () => ({}));
      }
      if (!['reconciling', 'cancel-requested', 'cancellation-unknown'].includes(attempt.state)) {
        throw new CexExecutionLifecycleError('INVALID_TRANSITION', `Cannot reconcile attempt ${attempt.attemptId} from ${attempt.state}`);
      }
      return attempt;
    });
  }

  private async applyReconciliationResult(
    attemptId: string,
    priorState: CexExecutionLifecycleState,
    result: CexReconciliationResult,
  ): Promise<DurableSubmissionAttempt> {
    return this.database.transaction(async (tx) => {
      const attempt = await this.requireAttempt(attemptId, tx);
      if (isTerminal(attempt.state)) return attempt;
      const cancellationPath = ['cancel-requested', 'cancellation-unknown'].includes(priorState)
        || ['cancel-requested', 'cancellation-unknown'].includes(attempt.state);
      const normalized = this.normalizeReconciliationResult(attempt, result, cancellationPath);
      return this.mutateInTransaction(attempt, normalized.state, normalized.eventType, tx, () => normalized.patch);
    });
  }

  private normalizeReconciliationResult(
    attempt: DurableSubmissionAttempt,
    result: CexReconciliationResult,
    cancellationPath: boolean,
  ): { state: CexExecutionLifecycleState; eventType: string; patch: Partial<DurableSubmissionAttempt> } {
    if (!result || !['found', 'not-found', 'indeterminate'].includes(result.outcome)) {
      return { state: cancellationPath ? 'cancellation-unknown' : 'reconciled-indeterminate', eventType: 'reconciliation-invalid', patch: { lastFailure: 'Invalid reconciliation result' } };
    }
    if (result.outcome === 'found') {
      if (!result.evidence || result.evidence.executionClientOrderId !== attempt.executionClientOrderId) {
        return { state: cancellationPath ? 'cancellation-unknown' : 'reconciled-indeterminate', eventType: 'reconciliation-identity-mismatch', patch: { lastFailure: 'Reconciliation evidence identity mismatch' } };
      }
      if (cancellationPath && result.evidence.cancellationState !== 'cancelled') {
        return { state: 'cancellation-unknown', eventType: 'cancellation-evidence-unresolved', patch: { evidence: result.evidence, lastFailure: 'Order evidence does not prove cancellation' } };
      }
      return {
        state: cancellationPath ? 'cancelled' : 'reconciled-found',
        eventType: cancellationPath ? 'cancellation-reconciled' : 'submission-reconciled',
        patch: { providerOrderId: result.evidence.providerOrderId, evidence: result.evidence },
      };
    }
    if (result.outcome === 'not-found') {
      return {
        state: cancellationPath ? 'cancellation-unknown' : 'reconciled-not-found',
        eventType: cancellationPath ? 'cancellation-not-found' : 'submission-not-found',
        patch: { evidence: result.evidence, lastFailure: cancellationPath ? 'Cancellation remains unresolved after exact lookup' : undefined },
      };
    }
    return {
      state: cancellationPath ? 'cancellation-unknown' : 'reconciled-indeterminate',
      eventType: cancellationPath ? 'cancellation-indeterminate' : 'submission-reconciliation-indeterminate',
      patch: { evidence: result.evidence, lastFailure: result.reason },
    };
  }

  private async transition(
    attemptId: string,
    state: CexExecutionLifecycleState,
    allowed: CexExecutionLifecycleState[],
    eventType: string,
  ): Promise<DurableSubmissionAttempt> {
    return this.mutate(attemptId, allowed, state, eventType, () => ({}));
  }

  private async mutate(
    attemptId: string,
    allowed: CexExecutionLifecycleState[],
    state: CexExecutionLifecycleState,
    eventType: string,
    patch: (attempt: DurableSubmissionAttempt) => Partial<DurableSubmissionAttempt>,
  ): Promise<DurableSubmissionAttempt> {
    return this.database.transaction(async (tx) => {
      const attempt = await this.requireAttempt(attemptId, tx);
      if (!allowed.includes(attempt.state)) {
        throw new CexExecutionLifecycleError('INVALID_TRANSITION', `Cannot transition attempt ${attempt.attemptId} from ${attempt.state}`);
      }
      return this.mutateInTransaction(attempt, state, eventType, tx, patch);
    });
  }

  private async mutateInTransaction(
    attempt: DurableSubmissionAttempt,
    state: CexExecutionLifecycleState,
    eventType: string,
    tx: PostgresTransactionClient,
    patch: (attempt: DurableSubmissionAttempt) => Partial<DurableSubmissionAttempt>,
  ): Promise<DurableSubmissionAttempt> {
    const updated: DurableSubmissionAttempt = {
      ...attempt,
      ...patch(attempt),
      state,
      updatedAt: this.now(),
    };
    const persisted = await this.repository.persistAttemptAndOutbox(updated, attempt.version, this.outbox(persistedEventId(updated, eventType), updated, eventType), tx);
    return persisted;
  }

  private async appendEvent(attempt: DurableSubmissionAttempt, eventType: string, tx: PostgresTransactionClient): Promise<void> {
    await this.repository.appendOutbox(this.outbox(persistedEventId(attempt, eventType), attempt, eventType), tx);
  }

  private outbox(outboxId: string, attempt: DurableSubmissionAttempt, eventType: string) {
    return {
      outboxId,
      aggregateId: attempt.attemptId,
      aggregateVersion: attempt.version,
      eventType,
      correlationId: attempt.correlationId,
      payload: { attemptId: attempt.attemptId, state: attempt.state, version: attempt.version },
      createdAt: attempt.updatedAt,
    };
  }

  private async requireAttempt(attemptId: string, queryClient: PostgresTransactionClient | undefined): Promise<DurableSubmissionAttempt> {
    const attempt = await this.repository.get(attemptId, queryClient);
    if (!attempt) throw new CexExecutionLifecycleError('ATTEMPT_NOT_FOUND', `Submission attempt ${attemptId} was not found`);
    return attempt;
  }

  private assertProvider(attempt: DurableSubmissionAttempt, provider: CexReconciliationProvider): void {
    if (attempt.providerId !== provider.providerId || attempt.connector !== provider.connector) {
      throw new CexExecutionLifecycleError('PROVIDER_MISMATCH', 'Reconciliation provider does not match the submission attempt');
    }
  }

  private assertEvidenceIdentity(attempt: DurableSubmissionAttempt, evidence: CexOrderEvidence): void {
    if (evidence.executionClientOrderId !== attempt.executionClientOrderId) {
      throw new CexExecutionLifecycleError('INVALID_RECONCILIATION_RESULT', 'Provider evidence does not match the execution client order ID');
    }
  }
}

function isTerminal(state: CexExecutionLifecycleState): boolean {
  return ['provider-acknowledged', 'failed', 'rejected', 'cancelled', 'cancellation-rejected', 'cancellation-failed', 'reconciled-found', 'reconciled-not-found'].includes(state);
}

function persistedEventId(attempt: DurableSubmissionAttempt, eventType: string): string {
  return `${attempt.attemptId}-${attempt.version}-${eventType}`;
}

export function durableCexCapabilities(): CexConnectorCapabilities {
  return {
    supportsCallerOrderIdentity: true,
    supportsExactOrderLookup: true,
    supportsDeterministicReconciliation: true,
  };
}
