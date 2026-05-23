import type {
  ExecutionFill,
  ReconciliationWorkerCandidate,
  TradingRecommendation,
  WhiteRabbitPaperValidationDecision,
  WhiteRabbitPaperValidationPolicy,
  WhiteRabbitPaperValidationRequest,
  WhiteRabbitSimulationEvidence,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';
import { PaperTradingSessionService } from '../../runtime/paper/PaperTradingSessionService.js';
import { WhiteRabbitRuntimeEngine } from './WhiteRabbitRuntimeEngine.js';
import { WhiteRabbitPaperSessionAdapter } from './WhiteRabbitPaperSessionAdapter.js';
import { WhiteRabbitPaperTelemetrySummaryService } from './WhiteRabbitPaperTelemetrySummaryService.js';
import { WhiteRabbitControlledResumeEvaluator } from './WhiteRabbitControlledResumeEvaluator.js';
import { whiteRabbitPaperValidationPolicy } from './WhiteRabbitPaperValidationPolicy.js';

export interface WhiteRabbitPaperValidationServiceDependencies {
  paperSessions: PaperTradingSessionService;
  runtimeEngine?: WhiteRabbitRuntimeEngine;
  adapter?: WhiteRabbitPaperSessionAdapter;
  telemetry?: WhiteRabbitPaperTelemetrySummaryService;
  controlledResume?: WhiteRabbitControlledResumeEvaluator;
  eventBus?: TradingEventBus;
  policy?: WhiteRabbitPaperValidationPolicy;
}

export class WhiteRabbitPaperValidationService {
  private readonly runtimeEngine: WhiteRabbitRuntimeEngine;
  private readonly adapter: WhiteRabbitPaperSessionAdapter;
  private readonly telemetry: WhiteRabbitPaperTelemetrySummaryService;
  private readonly controlledResume: WhiteRabbitControlledResumeEvaluator;
  private readonly policy: WhiteRabbitPaperValidationPolicy;

  constructor(private readonly deps: WhiteRabbitPaperValidationServiceDependencies) {
    this.policy = deps.policy ?? whiteRabbitPaperValidationPolicy;
    this.runtimeEngine = deps.runtimeEngine ?? new WhiteRabbitRuntimeEngine(undefined, undefined, undefined, deps.eventBus);
    this.adapter = deps.adapter ?? new WhiteRabbitPaperSessionAdapter(deps.paperSessions, this.policy);
    this.telemetry = deps.telemetry ?? new WhiteRabbitPaperTelemetrySummaryService();
    this.controlledResume = deps.controlledResume ?? new WhiteRabbitControlledResumeEvaluator(this.policy);
  }

  async validate(
    request: WhiteRabbitPaperValidationRequest,
    reconciliationCandidate?: ReconciliationWorkerCandidate,
  ): Promise<WhiteRabbitPaperValidationDecision> {
    const base = this.baseDecision(request);
    const validation = this.validateRequest(request);
    if (validation.length > 0) {
      return this.reject(base, validation);
    }

    await this.publish(request, 'WHITERABBIT_PAPER_VALIDATION_STARTED', { providerId: request.connectorConfig.providerId });
    await this.runtimeEngine.provision(request.context, request.runtimeConfig, request.correlationId);
    const paperSession = await this.adapter.start(request);
    if (paperSession.status !== 'active') {
      return this.reject({ ...base, paperSession }, [paperSession.failureReason ?? `paper session is not active: ${paperSession.status}`]);
    }

    const signal = await this.runtimeEngine.simulate(request.context.runtimeInstanceId ?? '', request.candles);
    const fills: ExecutionFill[] = [];
    if (signal.action === 'buy' || signal.action === 'sell') {
      const result = await this.adapter.ingestSignalOrder(paperSession.id, request, signal.action);
      fills.push(...(result.fills ?? []));
    }

    const telemetrySummary = this.telemetry.summarize({
      runtimeInstanceId: request.context.runtimeInstanceId,
      fills,
      telemetry: request.context.runtimeInstanceId ? this.runtimeEngine.getTelemetry(request.context.runtimeInstanceId) : undefined,
    });

    const reconciliation = reconciliationCandidate
      ? await this.deps.paperSessions.dryRunReconciliation(paperSession.id, reconciliationCandidate)
      : undefined;
    const reconciliationProposals = reconciliation?.proposals ?? [];
    const evidence = this.evidence(request, paperSession.id, signal.id, signal.action, fills.length, Boolean(telemetrySummary), reconciliationProposals.length, request.trinityRecommendations ?? []);
    const resume = this.controlledResume.evaluate({
      validationCompleted: true,
      telemetrySummary,
      reconciliationProposals,
      evidence,
    });
    const decision: WhiteRabbitPaperValidationDecision = {
      ...base,
      status: 'completed',
      paperSession,
      signal,
      fills,
      telemetrySummary,
      reconciliationProposals,
      evidence,
      ...resume,
    };
    await this.publish(request, 'WHITERABBIT_CONTROLLED_RESUME_EVALUATED', {
      controlledResumeEligible: decision.controlledResumeEligible,
      blockers: decision.blockers,
      liveExecutionAuthorized: false,
    });
    await this.publish(request, 'WHITERABBIT_PAPER_VALIDATION_COMPLETED', {
      decision,
      trinityRecommendationIds: evidence.trinityRecommendationIds,
      authorizedExecution: false,
      performanceClaim: false,
    });
    return decision;
  }

  evaluateControlledResume(decision: WhiteRabbitPaperValidationDecision): WhiteRabbitPaperValidationDecision {
    const resume = this.controlledResume.evaluate({
      validationCompleted: decision.status === 'completed',
      telemetrySummary: decision.telemetrySummary,
      reconciliationProposals: decision.reconciliationProposals,
      evidence: decision.evidence,
    });
    return {
      ...decision,
      ...resume,
    };
  }

  private validateRequest(request: WhiteRabbitPaperValidationRequest): string[] {
    const blockers: string[] = [];
    if (request.connectorConfig.mode !== 'paper' && request.connectorConfig.mode !== 'backtest') {
      blockers.push('WhiteRabbit paper validation rejects live execution config');
    }
    if (!this.policy.allowedProviders.includes(request.connectorConfig.providerType)) {
      blockers.push(`provider is not allowed for WhiteRabbit paper validation: ${request.connectorConfig.providerType}`);
    }
    if (!request.context.runtimeInstanceId) {
      blockers.push('runtimeInstanceId is required');
    }
    if (request.context.strategyProductId && request.context.strategyProductId !== 'whiterabbit-scalper-futures') {
      blockers.push('strategyProductId must be whiterabbit-scalper-futures');
    }
    if (request.candles.length === 0) {
      blockers.push('paper validation requires candles for signal generation');
    }
    if (Object.hasOwn(request.connectorConfig as object, 'rawApiKey') || Object.hasOwn(request.connectorConfig as object, 'rawApiSecret')) {
      blockers.push('raw credentials are forbidden in WhiteRabbit paper validation');
    }
    return blockers;
  }

  private baseDecision(request: WhiteRabbitPaperValidationRequest): WhiteRabbitPaperValidationDecision {
    return {
      id: `${request.id}:decision`,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      context: { ...request.context },
      status: 'approved',
      fills: [],
      reconciliationProposals: [],
      controlledResumeEligible: false,
      blockers: [],
      approvalPath: {
        acsRequired: true,
        governanceRequired: true,
        riskReviewRequired: this.policy.requireRiskReviewEligibility,
        liveExecutionAuthorized: false,
      },
    };
  }

  private async reject(decision: WhiteRabbitPaperValidationDecision, blockers: string[]): Promise<WhiteRabbitPaperValidationDecision> {
    const rejected = {
      ...decision,
      status: 'rejected' as const,
      blockers,
      controlledResumeEligible: false,
    };
    await this.publish({
      id: decision.id,
      correlationId: decision.correlationId,
      tenantId: decision.tenantId,
      requestedBy: 'acs',
      context: decision.context,
      connectorConfig: {
        providerId: decision.context.providerId,
        providerType: 'simulation',
        mode: 'paper',
      },
      candles: [],
    }, 'WHITERABBIT_PAPER_VALIDATION_REJECTED', { blockers });
    return rejected;
  }

  private evidence(
    request: WhiteRabbitPaperValidationRequest,
    paperSessionId: string,
    signalId: string,
    signalAction: WhiteRabbitSimulationEvidence['signalAction'],
    normalizedFillCount: number,
    telemetrySummaryPresent: boolean,
    reconciliationProposals: number,
    recommendations: TradingRecommendation[],
  ): WhiteRabbitSimulationEvidence {
    return {
      validationId: request.id,
      paperSessionId,
      runtimeInstanceId: request.context.runtimeInstanceId ?? '',
      signalId,
      signalAction,
      normalizedFillCount,
      telemetrySummaryPresent,
      reconciliationProposals,
      trinityRecommendationIds: recommendations.map((recommendation) => recommendation.id),
      generatedAt: new Date().toISOString(),
      performanceClaim: false,
    };
  }

  private async publish(request: WhiteRabbitPaperValidationRequest, type: 'WHITERABBIT_PAPER_VALIDATION_STARTED' | 'WHITERABBIT_PAPER_VALIDATION_COMPLETED' | 'WHITERABBIT_PAPER_VALIDATION_REJECTED' | 'WHITERABBIT_CONTROLLED_RESUME_EVALUATED', payload: Record<string, unknown>): Promise<void> {
    await this.deps.eventBus?.publish({
      id: `${request.id}:${type}`,
      type,
      occurredAt: new Date().toISOString(),
      correlationId: request.correlationId,
      source: 'core',
      daoId: request.context.daoId,
      federationId: request.context.federationId,
      userId: request.context.userId,
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: request.context.runtimeInstanceId,
      payload,
    });
  }
}

