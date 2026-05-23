import type {
  AcsTradingCommand,
  TradingWorkflowRequest,
  TradingWorkflowRequestType,
  WorkflowApprovalDecision,
} from '../../../../packages/trading-contracts/src/index.js';
import { TradingWorkflowRequestService } from './TradingWorkflowRequestService.js';

export class AcsTradingCommandApi {
  constructor(private readonly workflows: TradingWorkflowRequestService) {}

  async submit(command: AcsTradingCommand): Promise<WorkflowApprovalDecision> {
    return this.workflows.submit(this.toWorkflowRequest(command));
  }

  private toWorkflowRequest(command: AcsTradingCommand): TradingWorkflowRequest {
    return {
      id: command.id,
      correlationId: command.correlationId,
      tenantId: command.tenantId,
      requestedBy: command.requestedBy,
      source: 'acs',
      workflowType: this.toWorkflowType(command.commandType),
      context: command.context,
      autonomyLevel: command.autonomyLevel,
      governanceContext: command.governanceContext,
      runtimeContext: command.runtimeContext,
      reason: command.reason,
      payload: command.payload,
    };
  }

  private toWorkflowType(commandType: AcsTradingCommand['commandType']): TradingWorkflowRequestType {
    const mapping: Record<AcsTradingCommand['commandType'], TradingWorkflowRequestType> = {
      'request-simulation': 'simulation',
      'request-backtest': 'backtest',
      'request-provisioning': 'provisioning',
      'request-runtime-recovery': 'runtime-recovery',
      'request-provider-suspension': 'provider-suspension',
      'request-strategy-pause': 'strategy-pause',
      'request-telemetry-inspection': 'telemetry-inspection',
      'request-strategy-activation-review': 'strategy-activation-review',
    };
    return mapping[commandType];
  }
}
