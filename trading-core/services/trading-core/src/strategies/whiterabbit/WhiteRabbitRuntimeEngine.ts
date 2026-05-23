import type {
  TradingExecutionContext,
  WhiteRabbitMarketCandle,
  WhiteRabbitParameterProposal,
  WhiteRabbitRuntimeConfig,
  WhiteRabbitRuntimeSignal,
  WhiteRabbitStrategyState as WhiteRabbitStrategyStateContract,
  WhiteRabbitRuntimeTelemetry,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';
import { WhiteRabbitSignalPipeline } from './WhiteRabbitSignalPipeline.js';
import { defaultWhiteRabbitRuntimeConfig, WhiteRabbitStrategyState } from './WhiteRabbitStrategyState.js';
import { WhiteRabbitRuntimeTelemetryService } from './WhiteRabbitRuntimeTelemetryService.js';

export class WhiteRabbitRuntimeEngine {
  private readonly telemetry: WhiteRabbitRuntimeTelemetryService;

  constructor(
    private readonly stateStore = new WhiteRabbitStrategyState(),
    private readonly signalPipeline = new WhiteRabbitSignalPipeline(),
    telemetry?: WhiteRabbitRuntimeTelemetryService,
    private readonly eventBus?: TradingEventBus,
  ) {
    this.telemetry = telemetry ?? new WhiteRabbitRuntimeTelemetryService(eventBus);
  }

  async provision(
    context: TradingExecutionContext,
    config: WhiteRabbitRuntimeConfig = defaultWhiteRabbitRuntimeConfig,
    correlationId = `${context.runtimeInstanceId}:whiterabbit-provision`,
  ): Promise<WhiteRabbitStrategyStateContract> {
    const state = this.stateStore.provision(context, config);
    await this.publishLifecycle('WHITERABBIT_RUNTIME_STARTED', state, correlationId);
    return state;
  }

  async simulate(
    runtimeInstanceId: string,
    candles: WhiteRabbitMarketCandle[],
    generatedAt = new Date().toISOString(),
  ): Promise<WhiteRabbitRuntimeSignal> {
    const current = this.requireState(runtimeInstanceId);
    const simulating = this.stateStore.update({ ...current, status: 'simulating', updatedAt: generatedAt });
    const signal = this.signalPipeline.generate(simulating, candles, generatedAt);
    this.stateStore.update({ ...simulating, lastSignal: signal, updatedAt: generatedAt });
    await this.telemetry.recordSignal(simulating, signal);
    return signal;
  }

  async pause(runtimeInstanceId: string, correlationId = `${runtimeInstanceId}:whiterabbit-pause`): Promise<WhiteRabbitStrategyStateContract> {
    const current = this.requireState(runtimeInstanceId);
    const state = this.stateStore.update({ ...current, status: 'paused', updatedAt: new Date().toISOString() });
    await this.publishLifecycle('WHITERABBIT_RUNTIME_PAUSED', state, correlationId);
    return state;
  }

  async resume(runtimeInstanceId: string): Promise<WhiteRabbitStrategyStateContract> {
    const current = this.requireState(runtimeInstanceId);
    return this.stateStore.update({ ...current, status: 'running', updatedAt: new Date().toISOString() });
  }

  async degrade(runtimeInstanceId: string, reason: string, correlationId = `${runtimeInstanceId}:whiterabbit-degraded`): Promise<WhiteRabbitStrategyStateContract> {
    const current = this.requireState(runtimeInstanceId);
    const state = this.stateStore.update({ ...current, status: 'degraded', updatedAt: new Date().toISOString() });
    await this.publishLifecycle('WHITERABBIT_RUNTIME_DEGRADED', state, correlationId, { reason });
    return state;
  }

  async proposeParameterMutation(request: {
    correlationId: string;
    context: TradingExecutionContext;
    proposedBy: WhiteRabbitParameterProposal['proposedBy'];
    proposedConfig: Partial<WhiteRabbitRuntimeConfig>;
    simulationCompleted: boolean;
    governanceApproved: boolean;
    riskApproved: boolean;
  }): Promise<WhiteRabbitParameterProposal> {
    const proposal: WhiteRabbitParameterProposal = {
      id: `${request.correlationId}:whiterabbit-parameter-proposal`,
      correlationId: request.correlationId,
      context: { ...request.context },
      proposedBy: request.proposedBy,
      proposedConfig: request.proposedConfig,
      simulationCompleted: request.simulationCompleted,
      governanceApproved: request.governanceApproved,
      riskApproved: request.riskApproved,
      productionMutationAllowed: false,
      createdAt: new Date().toISOString(),
    };
    await this.eventBus?.publish({
      id: `${proposal.id}:event`,
      type: 'WHITERABBIT_PARAMETER_PROPOSAL_CREATED',
      occurredAt: proposal.createdAt,
      correlationId: proposal.correlationId,
      source: 'core',
      daoId: request.context.daoId,
      userId: request.context.userId,
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: request.context.runtimeInstanceId,
      payload: {
        proposal,
        approvedForControlledExecutionProposal: request.simulationCompleted && request.governanceApproved && request.riskApproved,
      },
    });
    return proposal;
  }

  getState(runtimeInstanceId: string): WhiteRabbitStrategyStateContract | undefined {
    return this.stateStore.get(runtimeInstanceId);
  }

  getTelemetry(runtimeInstanceId: string): WhiteRabbitRuntimeTelemetry | undefined {
    return this.telemetry.get(runtimeInstanceId);
  }

  private requireState(runtimeInstanceId: string): WhiteRabbitStrategyStateContract {
    const state = this.stateStore.get(runtimeInstanceId);
    if (!state) {
      throw new Error(`WhiteRabbit runtime not found: ${runtimeInstanceId}`);
    }
    return state;
  }

  private async publishLifecycle(
    type: 'WHITERABBIT_RUNTIME_STARTED' | 'WHITERABBIT_RUNTIME_PAUSED' | 'WHITERABBIT_RUNTIME_DEGRADED',
    state: WhiteRabbitStrategyStateContract,
    correlationId: string,
    extraPayload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.eventBus?.publish({
      id: `${correlationId}:${type}`,
      type,
      occurredAt: state.updatedAt,
      correlationId,
      source: 'core',
      daoId: state.context.daoId,
      userId: state.context.userId,
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: state.runtimeInstanceId,
      payload: {
        state,
        ...extraPayload,
      },
    });
  }
}
