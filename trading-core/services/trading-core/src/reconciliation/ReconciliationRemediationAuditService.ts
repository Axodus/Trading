import type {
  ReconciliationRemediationWorkflow,
  TradingEvent,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';

export class ReconciliationRemediationAuditService {
  private sequence = 0;

  constructor(private readonly eventBus?: TradingEventBus) {}

  async workflowRequested(workflow: ReconciliationRemediationWorkflow): Promise<void> {
    await this.publish(this.event('REMEDIATION_WORKFLOW_REQUESTED', workflow));
  }

  async workflowApproved(workflow: ReconciliationRemediationWorkflow): Promise<void> {
    await this.publish(this.event('REMEDIATION_WORKFLOW_APPROVED', workflow));
  }

  async workflowRejected(workflow: ReconciliationRemediationWorkflow): Promise<void> {
    await this.publish(this.event('REMEDIATION_WORKFLOW_REJECTED', workflow));
  }

  async workflowBlocked(workflow: ReconciliationRemediationWorkflow): Promise<void> {
    await this.publish(this.event('REMEDIATION_WORKFLOW_BLOCKED', workflow));
  }

  async runtimeRecoveryRouted(workflow: ReconciliationRemediationWorkflow): Promise<void> {
    if (workflow.runtimeRecoveryRequest) {
      await this.publish(this.event('RUNTIME_RECOVERY_REQUEST_ROUTED', workflow));
    }
  }

  async providerResyncRouted(workflow: ReconciliationRemediationWorkflow): Promise<void> {
    if (workflow.providerResyncRequest) {
      await this.publish(this.event('PROVIDER_RESYNC_REQUEST_ROUTED', workflow));
    }
  }

  async manualOperatorReviewRequested(workflow: ReconciliationRemediationWorkflow): Promise<void> {
    if (workflow.manualOperatorReviewRequest) {
      await this.publish(this.event('MANUAL_OPERATOR_REVIEW_REQUESTED', workflow));
    }
  }

  private event(type: TradingEvent['type'], workflow: ReconciliationRemediationWorkflow): TradingEvent {
    return {
      id: `${workflow.id}:${type.toLowerCase()}:${this.sequence++}`,
      type,
      occurredAt: workflow.updatedAt,
      correlationId: workflow.correlationId,
      source: 'core',
      daoId: workflow.remediationRequest.context.daoId,
      federationId: workflow.remediationRequest.context.federationId,
      userId: workflow.remediationRequest.context.userId,
      strategyId: workflow.remediationRequest.context.strategyId,
      strategyProductId: workflow.remediationRequest.context.strategyProductId,
      runtimeInstanceId: workflow.remediationRequest.context.runtimeInstanceId,
      payload: {
        workflow,
        requestOnly: true,
        autoHealing: false,
        mutatesProvider: false,
        mutatesRuntime: false,
        mutatesSovereignState: false,
      },
    };
  }

  private async publish(event: TradingEvent): Promise<void> {
    await this.eventBus?.publish(event);
  }
}

