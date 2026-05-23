import type {
  AcsRuntimeCommand,
  AcsRuntimeInspectionRequest,
  AcsTradingFeedbackEvent,
  AcsTradingIntent,
  AcsTradingRecommendation,
  TradingEvent,
  TradingExecutionContext,
  UserRuntimeInstance,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingExecutionReceipt } from '../application/ExecutionIntent.js';
import type { ExecutionOrchestrator } from '../application/ExecutionOrchestrator.js';
import type { RuntimeRecord, RuntimeLifecycleService } from '../runtime/RuntimeLifecycleService.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import type { TradingEventQueryService } from '../state/TradingEventQueryService.js';

export class AcsTradingBoundaryError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_TENANT_CONTEXT' | 'MISSING_RUNTIME_CONTEXT' | 'UNSUPPORTED_ACS_COMMAND',
  ) {
    super(message);
    this.name = 'AcsTradingBoundaryError';
  }
}

export interface NormalizedRuntimeInspection {
  runtime?: UserRuntimeInstance;
  telemetry?: RuntimeRecord['telemetry'];
  events: TradingEvent[];
}

export interface AcsTradingAccessServiceDependencies {
  orchestrator: ExecutionOrchestrator;
  eventBus: TradingEventBus;
  runtimeLifecycle?: RuntimeLifecycleService;
  eventQuery?: TradingEventQueryService;
}

export class AcsTradingAccessService {
  constructor(private readonly deps: AcsTradingAccessServiceDependencies) {}

  async requestExecution(intent: AcsTradingIntent): Promise<TradingExecutionReceipt> {
    this.assertTenantContext(intent.context);
    await this.publishAcsCommand(intent.id, intent.correlationId, intent.context, 'request-execution', intent.requestedBy);

    return this.deps.orchestrator.execute({
      id: intent.id,
      correlationId: intent.correlationId,
      context: intent.context,
      request: intent.request,
    });
  }

  async executeCommand(command: AcsRuntimeCommand): Promise<UserRuntimeInstance | undefined> {
    this.assertTenantContext(command.context);
    await this.publishAcsCommand(command.id, command.correlationId, command.context, command.commandType, command.requestedBy, command.reason);

    if (command.commandType === 'pause-runtime') {
      const runtime = this.deps.runtimeLifecycle?.pause(this.requireRuntimeId(command.context));
      await this.publishRuntimeLifecycle(command, 'USER_RUNTIME_PAUSED');
      return runtime;
    }

    if (command.commandType === 'resume-runtime') {
      const runtime = this.deps.runtimeLifecycle?.resume(this.requireRuntimeId(command.context));
      await this.publishRuntimeLifecycle(command, 'USER_RUNTIME_RESUMED');
      return runtime;
    }

    if (command.commandType === 'stop-runtime') {
      const runtime = this.deps.runtimeLifecycle?.stop(this.requireRuntimeId(command.context));
      await this.publishRuntimeLifecycle(command, 'USER_RUNTIME_STOPPED');
      return runtime;
    }

    if (command.commandType === 'inspect-runtime') {
      this.requireRuntimeId(command.context);
      await this.publishInspection(command.id, command.correlationId, command.context, command.requestedBy);
      return undefined;
    }

    if ([
      'request-risk-review',
      'request-strategy-simulation',
      'request-strategy-backtest',
      'request-telemetry-summary',
      'request-execution',
      'request-runtime-provisioning',
      'request-strategy-activation',
      'request-disclosure-acceptance',
    ].includes(command.commandType)) {
      return undefined;
    }

    throw new AcsTradingBoundaryError(`Unsupported ACS command: ${command.commandType}`, 'UNSUPPORTED_ACS_COMMAND');
  }

  inspectRuntime(request: AcsRuntimeInspectionRequest): NormalizedRuntimeInspection {
    this.assertTenantContext(request.context);
    const runtimeInstanceId = this.requireRuntimeId(request.context);
    const record = this.deps.runtimeLifecycle?.get(runtimeInstanceId);
    return {
      runtime: record?.runtime,
      telemetry: record?.telemetry,
      events: this.deps.eventQuery?.byRuntimeInstanceId(runtimeInstanceId) ?? [],
    };
  }

  async intakeRecommendation(recommendation: AcsTradingRecommendation): Promise<AcsTradingFeedbackEvent> {
    this.assertTenantContext(recommendation.context);
    await this.deps.eventBus.publish({
      id: `${recommendation.id}:acs-recommendation-received`,
      type: 'ACS_RECOMMENDATION_RECEIVED',
      occurredAt: new Date().toISOString(),
      correlationId: recommendation.correlationId,
      source: 'acs',
      daoId: recommendation.context.daoId,
      federationId: recommendation.context.federationId,
      userId: recommendation.context.userId,
      strategyId: recommendation.context.strategyId,
      strategyProductId: recommendation.context.strategyProductId,
      runtimeInstanceId: recommendation.context.runtimeInstanceId,
      payload: {
        providerId: recommendation.context.providerId,
        recommendationId: recommendation.id,
        recommendationType: recommendation.recommendationType,
        producedByAgent: recommendation.producedByAgent,
        authorizedExecution: false,
      },
    });

    const feedback: AcsTradingFeedbackEvent = {
      id: `${recommendation.id}:feedback`,
      correlationId: recommendation.correlationId,
      tenantId: recommendation.tenantId,
      context: recommendation.context,
      feedbackType: 'requires-review',
      recommendationId: recommendation.id,
      message: 'Recommendation recorded. Execution still requires Trading Core gates.',
    };

    await this.deps.eventBus.publish({
      id: feedback.id,
      type: 'ACS_TRADING_FEEDBACK_RECORDED',
      occurredAt: new Date().toISOString(),
      correlationId: feedback.correlationId,
      source: 'acs',
      daoId: feedback.context.daoId,
      federationId: feedback.context.federationId,
      userId: feedback.context.userId,
      strategyId: feedback.context.strategyId,
      strategyProductId: feedback.context.strategyProductId,
      runtimeInstanceId: feedback.context.runtimeInstanceId,
      payload: {
        providerId: feedback.context.providerId,
        recommendationId: feedback.recommendationId,
        feedbackType: feedback.feedbackType,
        message: feedback.message,
      },
    });

    return feedback;
  }

  private async publishAcsCommand(
    id: string,
    correlationId: string,
    context: TradingExecutionContext,
    commandType: AcsRuntimeCommand['commandType'],
    requestedBy: string,
    reason?: string,
  ): Promise<void> {
    await this.deps.eventBus.publish({
      id: `${id}:acs-command-received`,
      type: 'ACS_COMMAND_RECEIVED',
      occurredAt: new Date().toISOString(),
      correlationId,
      source: 'acs',
      daoId: context.daoId,
      federationId: context.federationId,
      userId: context.userId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      runtimeInstanceId: context.runtimeInstanceId,
      payload: {
        commandType,
        requestedBy,
        providerId: context.providerId,
        reason,
      },
    });
  }

  private async publishRuntimeLifecycle(command: AcsRuntimeCommand, type: 'USER_RUNTIME_PAUSED' | 'USER_RUNTIME_RESUMED' | 'USER_RUNTIME_STOPPED'): Promise<void> {
    await this.deps.eventBus.publish({
      id: `${command.id}:${type.toLowerCase()}`,
      type,
      occurredAt: new Date().toISOString(),
      correlationId: command.correlationId,
      source: 'acs',
      daoId: command.context.daoId,
      federationId: command.context.federationId,
      userId: command.context.userId,
      strategyId: command.context.strategyId,
      strategyProductId: command.context.strategyProductId,
      runtimeInstanceId: command.context.runtimeInstanceId,
      payload: {
        providerId: command.context.providerId,
        reason: command.reason,
      },
    });
  }

  private async publishInspection(id: string, correlationId: string, context: TradingExecutionContext, requestedBy: string): Promise<void> {
    await this.deps.eventBus.publish({
      id: `${id}:acs-runtime-inspected`,
      type: 'ACS_RUNTIME_INSPECTED',
      occurredAt: new Date().toISOString(),
      correlationId,
      source: 'acs',
      daoId: context.daoId,
      federationId: context.federationId,
      userId: context.userId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      runtimeInstanceId: context.runtimeInstanceId,
      payload: {
        requestedBy,
        providerId: context.providerId,
      },
    });
  }

  private assertTenantContext(context: TradingExecutionContext): void {
    if (!context?.executionDomain || !context.providerId || (!context.userId && !context.daoId)) {
      throw new AcsTradingBoundaryError('ACS trading access requires execution domain, provider, and tenant context.', 'MISSING_TENANT_CONTEXT');
    }
  }

  private requireRuntimeId(context: TradingExecutionContext): string {
    if (!context.runtimeInstanceId) {
      throw new AcsTradingBoundaryError('ACS runtime command requires runtimeInstanceId.', 'MISSING_RUNTIME_CONTEXT');
    }
    return context.runtimeInstanceId;
  }
}
