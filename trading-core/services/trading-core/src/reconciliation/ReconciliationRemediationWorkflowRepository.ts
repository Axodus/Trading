import type { ReconciliationRemediationWorkflow } from '../../../../packages/trading-contracts/src/index.js';

export class ReconciliationRemediationWorkflowRepository {
  private readonly workflows = new Map<string, ReconciliationRemediationWorkflow>();

  async save(workflow: ReconciliationRemediationWorkflow): Promise<void> {
    this.workflows.set(workflow.id, this.clone(workflow));
  }

  async get(id: string): Promise<ReconciliationRemediationWorkflow | undefined> {
    const workflow = this.workflows.get(id);
    return workflow ? this.clone(workflow) : undefined;
  }

  async listByTenant(tenantId: string): Promise<ReconciliationRemediationWorkflow[]> {
    return [...this.workflows.values()]
      .filter((workflow) => workflow.tenantId === tenantId)
      .map((workflow) => this.clone(workflow));
  }

  async listByCorrelationId(correlationId: string): Promise<ReconciliationRemediationWorkflow[]> {
    return [...this.workflows.values()]
      .filter((workflow) => workflow.correlationId === correlationId)
      .map((workflow) => this.clone(workflow));
  }

  private clone(workflow: ReconciliationRemediationWorkflow): ReconciliationRemediationWorkflow {
    return JSON.parse(JSON.stringify(workflow)) as ReconciliationRemediationWorkflow;
  }
}

