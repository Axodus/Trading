import type {
  AcsGovernanceWorkflowContext,
  TradingWorkflowRequest,
  WorkflowApprovalDecision,
} from '../../../../packages/trading-contracts/src/index.js';

export class RecommendationApprovalService {
  decide(request: TradingWorkflowRequest): WorkflowApprovalDecision {
    const rejection = this.findRejection(request.governanceContext);
    return {
      id: `${request.id}:workflow-decision`,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      workflowRequestId: request.id,
      workflowType: request.workflowType,
      context: request.context,
      approved: rejection === undefined,
      reason: rejection?.reason ?? 'Workflow may continue through governed Trading Core pipelines.',
      blockedBy: rejection?.blockedBy,
      requiresAcs: true,
      authorizedExecution: false,
      decidedAt: new Date().toISOString(),
    };
  }

  private findRejection(context: AcsGovernanceWorkflowContext): Pick<WorkflowApprovalDecision, 'blockedBy' | 'reason'> | undefined {
    if (context.governanceApproved === false || context.constitutionalStanding === 'blocked') {
      return {
        blockedBy: 'governance',
        reason: context.reason ?? 'Governance rejected workflow escalation.',
      };
    }

    if (context.riskApproved === false) {
      return {
        blockedBy: 'risk',
        reason: context.reason ?? 'Risk rejected workflow continuation.',
      };
    }

    if (context.complianceApproved === false) {
      return {
        blockedBy: 'compliance',
        reason: context.reason ?? 'Compliance rejected workflow continuation.',
      };
    }

    return undefined;
  }
}
