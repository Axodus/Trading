import type {
  ReconciliationApprovalDecision,
  ReconciliationRemediationRequest,
  ReconciliationRemediationWorkflow,
  RemediationWorkflowPolicy,
} from '../../../../packages/trading-contracts/src/index.js';
import { ReconciliationRemediationAuditService } from './ReconciliationRemediationAuditService.js';
import { ReconciliationRemediationRequestService } from './ReconciliationRemediationRequestService.js';
import { ReconciliationRemediationWorkflowRepository } from './ReconciliationRemediationWorkflowRepository.js';
import { defaultRemediationWorkflowPolicy } from './RemediationWorkflowPolicy.js';

export interface ReconciliationRemediationWorkflowServiceDependencies {
  workflows?: ReconciliationRemediationWorkflowRepository;
  requests?: ReconciliationRemediationRequestService;
  audit?: ReconciliationRemediationAuditService;
  policy?: RemediationWorkflowPolicy;
}

export class ReconciliationRemediationWorkflowService {
  private readonly workflows: ReconciliationRemediationWorkflowRepository;
  private readonly requests: ReconciliationRemediationRequestService;
  private readonly audit: ReconciliationRemediationAuditService;
  private readonly policy: RemediationWorkflowPolicy;

  constructor(deps: ReconciliationRemediationWorkflowServiceDependencies = {}) {
    this.workflows = deps.workflows ?? new ReconciliationRemediationWorkflowRepository();
    this.requests = deps.requests ?? new ReconciliationRemediationRequestService();
    this.audit = deps.audit ?? new ReconciliationRemediationAuditService();
    this.policy = deps.policy ?? defaultRemediationWorkflowPolicy;
  }

  async start(decision: ReconciliationApprovalDecision): Promise<ReconciliationRemediationWorkflow> {
    const request = decision.remediationRequest;
    if (!decision.approved || !request) {
      const blocked = this.workflow(this.blockedRequest(decision), 'blocked', decision.reason ?? 'Reconciliation remediation workflow requires an approved review decision.');
      await this.workflows.save(blocked);
      await this.audit.workflowBlocked(blocked);
      return blocked;
    }

    const initialState = this.initialState(request);
    const workflow = this.workflow(request, initialState, decision.reason);
    await this.workflows.save(workflow);
    await this.audit.workflowRequested(workflow);

    if (workflow.state === 'blocked') {
      await this.audit.workflowBlocked(workflow);
      return workflow;
    }
    if (workflow.state === 'pending-risk-review' || workflow.state === 'pending-governance-review') {
      return workflow;
    }

    const approved = this.route({
      ...workflow,
      state: 'completed-as-request-only',
      updatedAt: new Date().toISOString(),
    });
    await this.workflows.save(approved);
    await this.audit.workflowApproved(approved);
    await this.audit.runtimeRecoveryRouted(approved);
    await this.audit.providerResyncRouted(approved);
    await this.audit.manualOperatorReviewRequested(approved);
    return approved;
  }

  async get(id: string): Promise<ReconciliationRemediationWorkflow | undefined> {
    return this.workflows.get(id);
  }

  private initialState(request: ReconciliationRemediationRequest): ReconciliationRemediationWorkflow['state'] {
    if (this.policy.requireRuntimeContextForUser && request.context.executionDomain === 'user' && !request.context.runtimeInstanceId) {
      return 'blocked';
    }
    if (request.context.executionDomain === 'user' && !this.policy.allowUserRuntimeRemediation) {
      return 'pending-risk-review';
    }
    if (request.context.executionDomain === 'treasury' && (this.policy.requireGovernanceForTreasury || this.policy.requireTreasuryPolicyForTreasury)) {
      return 'approved';
    }
    if (this.policy.requireRiskApproval) {
      return 'approved';
    }
    return 'approved';
  }

  private route(workflow: ReconciliationRemediationWorkflow): ReconciliationRemediationWorkflow {
    return {
      ...workflow,
      runtimeRecoveryRequest: this.requests.runtimeRecoveryRequest(workflow.remediationRequest),
      providerResyncRequest: this.requests.providerResyncRequest(workflow.remediationRequest),
      manualOperatorReviewRequest: this.requests.manualOperatorReviewRequest(workflow.remediationRequest, workflow.reason),
    };
  }

  private workflow(
    request: ReconciliationRemediationRequest,
    state: ReconciliationRemediationWorkflow['state'],
    reason?: string,
  ): ReconciliationRemediationWorkflow {
    const now = new Date().toISOString();
    return {
      id: `${request.id}:workflow`,
      remediationRequest: { ...request, context: { ...request.context } },
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      executionDomain: request.context.executionDomain,
      state,
      reason,
      requestOnly: true,
      autoHealing: false,
      mutatesProvider: false,
      mutatesRuntime: false,
      mutatesSovereignState: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  private blockedRequest(decision: ReconciliationApprovalDecision): ReconciliationRemediationRequest {
    return {
      id: `${decision.id}:blocked-remediation-request`,
      proposalId: decision.proposalId,
      correlationId: decision.correlationId,
      tenantId: decision.tenantId ?? 'unknown',
      context: {
        correlationId: decision.correlationId,
        executionDomain: 'user',
        providerId: 'unknown',
      },
      requestType: 'manual-operator-review-request',
      status: 'blocked',
      reason: decision.reason,
      autoHealing: false,
      mutatesProvider: false,
      mutatesSovereignState: false,
      createdAt: new Date().toISOString(),
    };
  }
}

