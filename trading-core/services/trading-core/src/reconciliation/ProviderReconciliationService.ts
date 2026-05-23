import type {
  ReconciliationFinding,
  ReconciliationProposal,
  ReconciliationRequest,
  ReconciliationState,
  TradingEvent,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { OrderReconciliationService } from './OrderReconciliationService.js';
import { PositionReconciliationService } from './PositionReconciliationService.js';
import { ProviderDriftDetector } from './ProviderDriftDetector.js';
import { RuntimeReconciliationService } from './RuntimeReconciliationService.js';
import { StaleExecutionStateDetector } from './StaleExecutionStateDetector.js';

export interface ProviderReconciliationDependencies {
  providerDriftDetector?: ProviderDriftDetector;
  orderReconciliation?: OrderReconciliationService;
  positionReconciliation?: PositionReconciliationService;
  runtimeReconciliation?: RuntimeReconciliationService;
  staleExecutionDetector?: StaleExecutionStateDetector;
  eventBus?: TradingEventBus;
}

export class ProviderReconciliationService {
  private eventSequence = 0;
  private readonly providerDriftDetector: ProviderDriftDetector;
  private readonly orderReconciliation: OrderReconciliationService;
  private readonly positionReconciliation: PositionReconciliationService;
  private readonly runtimeReconciliation: RuntimeReconciliationService;
  private readonly staleExecutionDetector: StaleExecutionStateDetector;

  constructor(private readonly dependencies: ProviderReconciliationDependencies = {}) {
    this.providerDriftDetector = dependencies.providerDriftDetector ?? new ProviderDriftDetector();
    this.orderReconciliation = dependencies.orderReconciliation ?? new OrderReconciliationService();
    this.positionReconciliation = dependencies.positionReconciliation ?? new PositionReconciliationService();
    this.runtimeReconciliation = dependencies.runtimeReconciliation ?? new RuntimeReconciliationService();
    this.staleExecutionDetector = dependencies.staleExecutionDetector ?? new StaleExecutionStateDetector();
  }

  async reconcile(request: ReconciliationRequest): Promise<ReconciliationProposal> {
    await this.publish(request, 'PROVIDER_RECONCILIATION_STARTED', {
      providerId: request.context.providerId,
      executionDomain: request.context.executionDomain,
    });

    const findings = [
      ...this.providerDriftDetector.detect(request),
      ...this.orderReconciliation.reconcile(request),
      ...this.positionReconciliation.reconcile(request),
      ...this.runtimeReconciliation.reconcile(request),
      ...this.staleExecutionDetector.detect(request),
    ];

    for (const finding of findings) {
      await this.publishFinding(request, finding);
    }

    const proposal = this.createProposal(request, findings);
    if (proposal.state !== 'synchronized') {
      await this.publish(request, 'RECONCILIATION_REQUIRED', proposal);
    }

    await this.publish(request, 'PROVIDER_RECONCILIATION_COMPLETED', {
      providerId: request.context.providerId,
      state: proposal.state,
      findingsCount: findings.length,
      proposal,
    });

    return proposal;
  }

  private createProposal(request: ReconciliationRequest, findings: ReconciliationFinding[]): ReconciliationProposal {
    const state = this.stateFromFindings(findings);
    const actions = new Set<ReconciliationProposal['recommendedActions'][number]>(['record-audit']);
    for (const finding of findings) {
      if (finding.type === 'provider-state-drift') {
        actions.add('request-provider-health-review');
      }
      if (finding.type === 'runtime-drift' || finding.type === 'orphan-runtime' || finding.type === 'stale-execution-state') {
        actions.add('request-runtime-recovery');
      }
      if (finding.type === 'order-divergence' || finding.type === 'fill-divergence') {
        actions.add('request-order-review');
      }
      if (finding.type === 'position-divergence') {
        actions.add('request-position-review');
      }
      if (finding.state === 'degraded') {
        actions.add('degrade-runtime');
      }
    }

    return {
      id: `${request.context.correlationId}:reconciliation-proposal`,
      correlationId: request.context.correlationId,
      context: request.context,
      state,
      reviewState: 'created',
      findings,
      recommendedActions: [...actions],
      mutatesSovereignState: false,
      createdAt: request.now ?? new Date().toISOString(),
    };
  }

  private stateFromFindings(findings: ReconciliationFinding[]): ReconciliationState {
    if (findings.length === 0) {
      return 'synchronized';
    }
    if (findings.some((finding) => finding.state === 'orphaned')) {
      return 'orphaned';
    }
    if (findings.some((finding) => finding.state === 'degraded')) {
      return 'degraded';
    }
    if (findings.some((finding) => finding.state === 'divergent')) {
      return 'reconciliation-required';
    }
    return findings[0]?.state ?? 'reconciliation-required';
  }

  private async publishFinding(request: ReconciliationRequest, finding: ReconciliationFinding): Promise<void> {
    const eventTypeByFinding: Record<ReconciliationFinding['type'], TradingEvent['type']> = {
      'provider-state-drift': 'PROVIDER_DRIFT_DETECTED',
      'order-divergence': 'ORDER_DIVERGENCE_DETECTED',
      'fill-divergence': 'ORDER_DIVERGENCE_DETECTED',
      'position-divergence': 'POSITION_DIVERGENCE_DETECTED',
      'runtime-drift': 'STALE_RUNTIME_DETECTED',
      'stale-execution-state': 'STALE_RUNTIME_DETECTED',
      'orphan-runtime': 'STALE_RUNTIME_DETECTED',
    };
    await this.publish(request, eventTypeByFinding[finding.type], finding);
  }

  private async publish<TPayload>(
    request: ReconciliationRequest,
    type: TradingEvent['type'],
    payload: TPayload,
  ): Promise<void> {
    await this.dependencies.eventBus?.publish({
      id: `${request.context.correlationId}:${type}:${this.eventSuffix(payload)}:${this.eventSequence++}`,
      type,
      occurredAt: request.now ?? new Date().toISOString(),
      correlationId: request.context.correlationId,
      source: 'core',
      daoId: request.context.daoId,
      federationId: request.context.federationId,
      userId: request.context.userId,
      strategyId: request.context.strategyId,
      strategyProductId: request.context.strategyProductId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      payload,
    });
  }

  private eventSuffix(payload: unknown): string {
    if (typeof payload === 'object' && payload && 'type' in payload) {
      return String(payload.type);
    }
    if (typeof payload === 'object' && payload && 'state' in payload) {
      return String(payload.state);
    }
    return 'event';
  }
}
