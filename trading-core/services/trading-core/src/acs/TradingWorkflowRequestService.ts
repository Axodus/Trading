import type {
  TradingEvent,
  TradingWorkflowRequest,
  WorkflowApprovalDecision,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { RecommendationApprovalService } from './RecommendationApprovalService.js';

export class TradingWorkflowRequestService {
  constructor(
    private readonly eventBus: TradingEventBus,
    private readonly approvalService: RecommendationApprovalService = new RecommendationApprovalService(),
  ) {}

  async submit(request: TradingWorkflowRequest): Promise<WorkflowApprovalDecision> {
    this.assertWorkflowContext(request);
    await this.eventBus.publish(this.toRequestedEvent(request));

    const decision = this.approvalService.decide(request);
    await this.eventBus.publish(this.toDecisionEvent(request, decision));
    return decision;
  }

  private assertWorkflowContext(request: TradingWorkflowRequest): void {
    if (!request.tenantId || !request.correlationId || !request.context.executionDomain || !request.context.providerId) {
      throw new Error('Trading workflow request requires tenantId, correlationId, execution domain, and provider context.');
    }
  }

  private toRequestedEvent(request: TradingWorkflowRequest): TradingEvent {
    const type = request.source === 'trinity' ? 'TRINITY_RECOMMENDATION_SUBMITTED' : 'TRADING_WORKFLOW_REQUESTED';
    return {
      id: `${request.id}:${type.toLowerCase()}`,
      type,
      occurredAt: new Date().toISOString(),
      correlationId: request.correlationId,
      source: request.source === 'trinity' ? 'agent' : 'acs',
      daoId: request.context.daoId,
      federationId: request.context.federationId,
      userId: request.context.userId,
      strategyId: request.context.strategyId,
      strategyProductId: request.context.strategyProductId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      payload: {
        tenantId: request.tenantId,
        workflowType: request.workflowType,
        requestedBy: request.requestedBy,
        providerId: request.context.providerId,
        autonomyLevel: request.autonomyLevel,
        recommendationId: request.recommendationId,
        reason: request.reason,
        authorizedExecution: false,
      },
    };
  }

  private toDecisionEvent(request: TradingWorkflowRequest, decision: WorkflowApprovalDecision): TradingEvent {
    const type = decision.approved ? 'TRADING_WORKFLOW_APPROVED' : 'TRADING_WORKFLOW_REJECTED';
    return {
      id: `${decision.id}:${type.toLowerCase()}`,
      type,
      occurredAt: decision.decidedAt,
      correlationId: decision.correlationId,
      source: 'acs',
      daoId: decision.context.daoId,
      federationId: decision.context.federationId,
      userId: decision.context.userId,
      strategyId: decision.context.strategyId,
      strategyProductId: decision.context.strategyProductId,
      runtimeInstanceId: decision.context.runtimeInstanceId,
      payload: {
        tenantId: decision.tenantId,
        workflowRequestId: decision.workflowRequestId,
        workflowType: decision.workflowType,
        providerId: decision.context.providerId,
        approved: decision.approved,
        blockedBy: decision.blockedBy,
        reason: decision.reason,
        requiresAcs: decision.requiresAcs,
        authorizedExecution: decision.authorizedExecution,
        source: request.source,
      },
    };
  }
}
