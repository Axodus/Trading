import type {
  ReconciliationProposal,
  ReconciliationWorkerCandidate,
  ReconciliationWorkerRunResult,
  TradingEvent,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';

export class ReconciliationWorkerAuditService {
  private sequence = 0;

  constructor(private readonly eventBus?: TradingEventBus) {}

  async workerStarted(runId: string, correlationId: string, tenantId: string | undefined, startedAt: string): Promise<void> {
    await this.publish({
      id: `${runId}:started`,
      type: 'RECONCILIATION_WORKER_STARTED',
      occurredAt: startedAt,
      correlationId,
      source: 'core',
      payload: {
        runId,
        tenantId,
        autoHealing: false,
      },
    });
  }

  async candidateFound(candidate: ReconciliationWorkerCandidate): Promise<void> {
    await this.publish({
      id: `${candidate.id}:candidate-found:${this.sequence++}`,
      type: 'RECONCILIATION_CANDIDATE_FOUND',
      occurredAt: candidate.discoveredAt,
      correlationId: candidate.request.context.correlationId,
      source: 'core',
      daoId: candidate.request.context.daoId,
      federationId: candidate.request.context.federationId,
      userId: candidate.request.context.userId,
      strategyId: candidate.request.context.strategyId,
      strategyProductId: candidate.request.context.strategyProductId,
      runtimeInstanceId: candidate.request.context.runtimeInstanceId,
      payload: {
        candidateId: candidate.id,
        candidateType: candidate.candidateType,
        tenantId: candidate.tenantId,
        providerId: candidate.request.context.providerId,
        executionDomain: candidate.request.context.executionDomain,
        reason: candidate.reason,
        autoHealing: false,
      },
    });
  }

  async proposalCreated(proposal: ReconciliationProposal): Promise<void> {
    await this.publish(this.proposalEvent(proposal, 'RECONCILIATION_PROPOSAL_CREATED'));
    if (proposal.reviewState === 'pending-review') {
      await this.publish(this.proposalEvent(proposal, 'RECONCILIATION_PROPOSAL_REVIEW_REQUIRED'));
    }
  }

  async workerCompleted(result: ReconciliationWorkerRunResult): Promise<void> {
    await this.publish({
      id: `${result.id}:completed`,
      type: 'RECONCILIATION_WORKER_COMPLETED',
      occurredAt: result.completedAt,
      correlationId: result.correlationId,
      source: 'core',
      payload: {
        runId: result.id,
        status: result.status,
        candidatesScanned: result.candidatesScanned,
        proposalsCreated: result.proposalsCreated,
        errors: result.errors,
        autoHealing: false,
      },
    });
  }

  private proposalEvent(proposal: ReconciliationProposal, type: TradingEvent['type']): TradingEvent {
    return {
      id: `${proposal.id}:${type.toLowerCase()}:${this.sequence++}`,
      type,
      occurredAt: proposal.createdAt,
      correlationId: proposal.correlationId,
      source: 'core',
      daoId: proposal.context.daoId,
      federationId: proposal.context.federationId,
      userId: proposal.context.userId,
      strategyId: proposal.context.strategyId,
      strategyProductId: proposal.context.strategyProductId,
      runtimeInstanceId: proposal.context.runtimeInstanceId,
      payload: {
        proposalId: proposal.id,
        tenantId: proposal.context.daoId ?? proposal.context.userId,
        providerId: proposal.context.providerId,
        executionDomain: proposal.context.executionDomain,
        state: proposal.state,
        reviewState: proposal.reviewState,
        findingsCount: proposal.findings.length,
        recommendedActions: proposal.recommendedActions,
        mutatesSovereignState: proposal.mutatesSovereignState,
        autoHealing: false,
      },
    };
  }

  private async publish(event: TradingEvent): Promise<void> {
    await this.eventBus?.publish(event);
  }
}
