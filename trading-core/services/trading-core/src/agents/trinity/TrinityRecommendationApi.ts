import type {
  TradingWorkflowRequest,
  TrinityRecommendationRequest,
  WorkflowApprovalDecision,
} from '../../../../../packages/trading-contracts/src/index.js';
import { TradingWorkflowRequestService } from '../../acs/TradingWorkflowRequestService.js';

export class TrinityRecommendationApi {
  constructor(private readonly workflows: TradingWorkflowRequestService) {}

  async submit(request: TrinityRecommendationRequest): Promise<WorkflowApprovalDecision> {
    return this.workflows.submit(this.toWorkflowRequest(request));
  }

  private toWorkflowRequest(request: TrinityRecommendationRequest): TradingWorkflowRequest {
    return {
      id: request.id,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      requestedBy: request.requestedBy,
      source: 'trinity',
      workflowType: 'trinity-recommendation',
      context: request.recommendation.context,
      autonomyLevel: request.autonomyLevel,
      governanceContext: request.governanceContext,
      recommendationId: request.recommendation.id,
      reason: request.recommendation.rationale,
      payload: {
        recommendationType: request.recommendation.recommendationType,
        confidence: request.recommendation.confidence,
        proposedAction: request.recommendation.proposedAction,
        requiresAcs: request.recommendation.requiresAcs,
        authorizedExecution: request.recommendation.authorizedExecution,
      },
    };
  }
}
