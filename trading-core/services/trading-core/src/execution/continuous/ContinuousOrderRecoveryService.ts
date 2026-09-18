import type {
  CexConnectorCapabilities,
  CexOrderEvidence,
  CexReconciliationProvider,
  CexReconciliationResult,
} from '../../../../../packages/trading-contracts/src/index.js';
import type {
  DurableSubmissionAttempt,
  PostgresDurableExecutionRepository,
} from '../../repositories/postgres/PostgresDurableExecutionRepository.js';
import {
  DurableCexExecutionLifecycleService,
  type DurableCexCancellationProvider,
} from '../DurableCexExecutionLifecycleService.js';

export interface ContinuousRecoveryResult {
  recoveredCount: number;
  terminalCount: number;
  indeterminateCount: number;
  errorCount: number;
  outcomes: Array<{
    attemptId: string;
    executionClientOrderId: string;
    initialState: string;
    finalState: string;
    outcome: 'found' | 'not-found' | 'indeterminate' | 'error';
    providerOrderId?: string;
    error?: string;
  }>;
}

export interface ContinuousOrderRecoveryServiceOptions {
  maxRecoveryAttempts?: number;
}

export class ContinuousOrderRecoveryService {
  constructor(
    private readonly repository: PostgresDurableExecutionRepository,
    private readonly lifecycleService: DurableCexExecutionLifecycleService,
    private readonly reconciliationProvider: CexReconciliationProvider,
    private readonly cancellationProvider?: DurableCexCancellationProvider,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async findRecoveryCandidates(): Promise<DurableSubmissionAttempt[]> {
    return this.repository.listRecoveryCandidates();
  }

  async recoverAttempt(attemptId: string): Promise<DurableSubmissionAttempt> {
    const attempt = await this.repository.get(attemptId);
    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found in durable repository`);
    }

    if (this.isTerminal(attempt.state)) {
      return attempt;
    }

    return this.lifecycleService.reconcile(attemptId, this.reconciliationProvider);
  }

  async recoverAll(): Promise<ContinuousRecoveryResult> {
    const candidates = await this.findRecoveryCandidates();
    const result: ContinuousRecoveryResult = {
      recoveredCount: 0,
      terminalCount: 0,
      indeterminateCount: 0,
      errorCount: 0,
      outcomes: [],
    };

    for (const candidate of candidates) {
      try {
        const recovered = await this.recoverAttempt(candidate.attemptId);
        const isTerm = this.isTerminal(recovered.state);
        
        let outcome: 'found' | 'not-found' | 'indeterminate' = 'indeterminate';
        if (recovered.state === 'reconciled-found' || recovered.state === 'provider-acknowledged') {
          outcome = 'found';
          result.recoveredCount += 1;
        } else if (recovered.state === 'reconciled-not-found' || recovered.state === 'failed' || recovered.state === 'rejected' || recovered.state === 'cancelled') {
          outcome = 'not-found';
          result.recoveredCount += 1;
        } else {
          result.indeterminateCount += 1;
        }

        if (isTerm) {
          result.terminalCount += 1;
        }

        result.outcomes.push({
          attemptId: candidate.attemptId,
          executionClientOrderId: candidate.executionClientOrderId,
          initialState: candidate.state,
          finalState: recovered.state,
          outcome,
          providerOrderId: recovered.providerOrderId,
        });
      } catch (err) {
        result.errorCount += 1;
        result.outcomes.push({
          attemptId: candidate.attemptId,
          executionClientOrderId: candidate.executionClientOrderId,
          initialState: candidate.state,
          finalState: candidate.state,
          outcome: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  private isTerminal(state: string): boolean {
    return [
      'provider-acknowledged',
      'failed',
      'rejected',
      'cancelled',
      'cancellation-rejected',
      'cancellation-failed',
      'reconciled-found',
      'reconciled-not-found',
    ].includes(state);
  }
}

