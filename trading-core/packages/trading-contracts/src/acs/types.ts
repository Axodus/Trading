import type { ExecutionRequest } from '../execution/types.js';
import type { TradingExecutionContext } from '../runtime/types.js';

export type AcsRuntimeCommandType =
  | 'request-execution'
  | 'pause-runtime'
  | 'resume-runtime'
  | 'stop-runtime'
  | 'inspect-runtime'
  | 'request-risk-review'
  | 'request-strategy-simulation'
  | 'request-strategy-backtest'
  | 'request-telemetry-summary'
  | 'request-runtime-provisioning'
  | 'request-strategy-activation'
  | 'request-disclosure-acceptance';

export type AcsTradingCommandType =
  | 'request-simulation'
  | 'request-backtest'
  | 'request-provisioning'
  | 'request-runtime-recovery'
  | 'request-provider-suspension'
  | 'request-strategy-pause'
  | 'request-telemetry-inspection'
  | 'request-strategy-activation-review';

export type AcsCommandAutonomyLevel = 0 | 1 | 2 | 3 | 4;

export interface AcsGovernanceWorkflowContext {
  governanceApproved?: boolean;
  riskApproved?: boolean;
  complianceApproved?: boolean;
  constitutionalStanding?: 'compliant' | 'blocked' | 'review-required';
  reason?: string;
}

export interface AcsTradingIntent {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  context: TradingExecutionContext;
  request: ExecutionRequest;
  recommendationId?: string;
}

export interface AcsRuntimeCommand {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  commandType: AcsRuntimeCommandType;
  context: TradingExecutionContext;
  reason?: string;
}

export interface AcsSupervisionRequest {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  commandType: Extract<AcsRuntimeCommandType, 'request-risk-review' | 'request-strategy-simulation' | 'request-telemetry-summary'>;
  context: TradingExecutionContext;
  summary?: string;
}

export interface AcsTradingRecommendation {
  id: string;
  correlationId: string;
  tenantId: string;
  producedByAgent: 'trinity' | 'morpheus' | 'agent-smith' | string;
  context: TradingExecutionContext;
  recommendationType: 'execution' | 'risk-review' | 'pause-runtime' | 'strategy-simulation' | 'telemetry-summary';
  confidence?: number;
  rationale?: string;
  proposedRequest?: ExecutionRequest;
}

export interface AcsRuntimeInspectionRequest {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  context: TradingExecutionContext;
}

export interface AcsTradingFeedbackEvent {
  id: string;
  correlationId: string;
  tenantId: string;
  context: TradingExecutionContext;
  feedbackType: 'accepted' | 'rejected' | 'observed' | 'requires-review';
  message?: string;
  recommendationId?: string;
}

export interface AcsTradingCommand {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  commandType: AcsTradingCommandType;
  context: TradingExecutionContext;
  autonomyLevel: AcsCommandAutonomyLevel;
  governanceContext: AcsGovernanceWorkflowContext;
  runtimeContext?: {
    runtimeInstanceId?: string;
    providerId?: string;
    strategyId?: string;
    strategyProductId?: string;
  };
  reason?: string;
  payload?: Record<string, unknown>;
}

export type TradingWorkflowRequestType =
  | 'simulation'
  | 'backtest'
  | 'provisioning'
  | 'runtime-recovery'
  | 'provider-suspension'
  | 'strategy-pause'
  | 'telemetry-inspection'
  | 'strategy-activation-review'
  | 'trinity-recommendation';

export interface TradingWorkflowRequest {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: string;
  source: 'acs' | 'trinity';
  workflowType: TradingWorkflowRequestType;
  context: TradingExecutionContext;
  autonomyLevel: AcsCommandAutonomyLevel;
  governanceContext: AcsGovernanceWorkflowContext;
  runtimeContext?: AcsTradingCommand['runtimeContext'];
  recommendationId?: string;
  reason?: string;
  payload?: Record<string, unknown>;
}

export interface WorkflowApprovalDecision {
  id: string;
  correlationId: string;
  tenantId: string;
  workflowRequestId: string;
  workflowType: TradingWorkflowRequestType;
  context: TradingExecutionContext;
  approved: boolean;
  reason?: string;
  blockedBy?: 'governance' | 'risk' | 'compliance' | 'runtime' | 'autonomy';
  requiresAcs: true;
  authorizedExecution: false;
  decidedAt: string;
}

export interface RuntimeSupervisionDecision extends WorkflowApprovalDecision {
  commandType: AcsTradingCommandType;
  mutatesRuntime: false;
}
