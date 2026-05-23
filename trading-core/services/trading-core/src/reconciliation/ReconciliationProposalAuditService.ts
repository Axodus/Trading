import type {
  AcsReconciliationReviewCommand,
  ReconciliationApprovalDecision,
  ReconciliationProposal,
  ReconciliationRemediationRequest,
  TradingEvent,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';

export class ReconciliationProposalAuditService {
  private sequence = 0;

  constructor(private readonly eventBus?: TradingEventBus) {}

  async reviewRequested(command: AcsReconciliationReviewCommand, proposal?: ReconciliationProposal): Promise<void> {
    await this.publish({
      id: `${command.id}:reconciliation-review-requested:${this.sequence++}`,
      type: 'RECONCILIATION_REVIEW_REQUESTED',
      occurredAt: new Date().toISOString(),
      correlationId: command.correlationId,
      source: 'acs',
      daoId: proposal?.context.daoId,
      federationId: proposal?.context.federationId,
      userId: proposal?.context.userId,
      strategyId: proposal?.context.strategyId,
      strategyProductId: proposal?.context.strategyProductId,
      runtimeInstanceId: proposal?.context.runtimeInstanceId,
      payload: {
        commandId: command.id,
        proposalId: command.proposalId,
        tenantId: command.tenantId,
        requestedBy: command.requestedBy,
        decisionIntent: command.decisionIntent,
        autoHealing: false,
      },
    });
  }

  async reviewApproved(decision: ReconciliationApprovalDecision, proposal: ReconciliationProposal): Promise<void> {
    await this.publish(this.decisionEvent('RECONCILIATION_REVIEW_APPROVED', decision, proposal));
  }

  async reviewRejected(decision: ReconciliationApprovalDecision, proposal?: ReconciliationProposal): Promise<void> {
    await this.publish(this.decisionEvent('RECONCILIATION_REVIEW_REJECTED', decision, proposal));
  }

  async remediationRequested(request: ReconciliationRemediationRequest): Promise<void> {
    await this.publish(this.remediationEvent('RECONCILIATION_REMEDIATION_REQUESTED', request));
  }

  async remediationBlocked(decision: ReconciliationApprovalDecision, proposal?: ReconciliationProposal): Promise<void> {
    await this.publish(this.decisionEvent('RECONCILIATION_REMEDIATION_BLOCKED', decision, proposal));
  }

  private decisionEvent(type: TradingEvent['type'], decision: ReconciliationApprovalDecision, proposal?: ReconciliationProposal): TradingEvent {
    return {
      id: `${decision.id}:${type.toLowerCase()}:${this.sequence++}`,
      type,
      occurredAt: decision.createdAt,
      correlationId: decision.correlationId,
      source: 'core',
      daoId: proposal?.context.daoId,
      federationId: proposal?.context.federationId,
      userId: proposal?.context.userId,
      strategyId: proposal?.context.strategyId,
      strategyProductId: proposal?.context.strategyProductId,
      runtimeInstanceId: proposal?.context.runtimeInstanceId,
      payload: {
        decision,
        proposalId: decision.proposalId,
        tenantId: decision.tenantId,
        approved: decision.approved,
        reviewState: decision.reviewState,
        blockedBy: decision.blockedBy,
        autoHealing: false,
      },
    };
  }

  private remediationEvent(type: TradingEvent['type'], request: ReconciliationRemediationRequest): TradingEvent {
    return {
      id: `${request.id}:${type.toLowerCase()}:${this.sequence++}`,
      type,
      occurredAt: request.createdAt,
      correlationId: request.correlationId,
      source: 'core',
      daoId: request.context.daoId,
      federationId: request.context.federationId,
      userId: request.context.userId,
      strategyId: request.context.strategyId,
      strategyProductId: request.context.strategyProductId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      payload: {
        request,
        proposalId: request.proposalId,
        tenantId: request.tenantId,
        requestType: request.requestType,
        autoHealing: false,
        mutatesProvider: false,
        mutatesSovereignState: false,
      },
    };
  }

  private async publish(event: TradingEvent): Promise<void> {
    await this.eventBus?.publish(event);
  }
}

