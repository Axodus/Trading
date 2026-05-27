import type {
  PaperRiskDecision,
  TradingEvent,
  TradingRecommendation,
  WhiteRabbitPaperValidationDecision,
} from '../../../../../../packages/trading-contracts/src/index.js';

export interface WhiteRabbitPaperScenarioReport {
  id: string;
  correlationId: string;
  tenantId: string;
  status: 'completed' | 'rejected';
  deterministic: true;
  liveExecutionAuthorized: false;
  productionApproval: false;
  providerDirectCallFromWhiteRabbit: false;
  runtimeMutatedByTrinity: false;
  signalTrace: {
    signalId?: string;
    action?: string;
    runtimeInstanceId?: string;
    correlationId: string;
    normalized: boolean;
  };
  paperExecution: {
    paperSessionId?: string;
    normalizedFillCount: number;
    fillIds: string[];
    sensitiveFieldsExcluded: true;
  };
  telemetry: {
    summaryPresent: boolean;
    health?: string;
    tenantScoped: boolean;
  };
  reconciliation: {
    dryRunExecuted: boolean;
    proposalsCreated: number;
    proposalOnly: boolean;
    unresolvedProposalBlocksEligibility: boolean;
  };
  paperRisk: {
    decisions: PaperRiskDecision[];
    blocksControlledResume: boolean;
  };
  controlledResume: {
    eligible: boolean;
    blockers: string[];
    approvalPath: WhiteRabbitPaperValidationDecision['approvalPath'];
  };
  trinity: {
    recommendationIds: string[];
    requiresAcs: boolean;
    authorizedExecution: false;
    mutatesRuntime: false;
  };
  trace: {
    eventCount: number;
    eventTypes: string[];
    correlationIdPreserved: boolean;
    tenantIsolationPreserved: boolean;
  };
}

export class WhiteRabbitPaperScenarioReportService {
  create(input: {
    id: string;
    decision: WhiteRabbitPaperValidationDecision;
    paperRiskDecisions: PaperRiskDecision[];
    trinityRecommendations: TradingRecommendation[];
    events: TradingEvent[];
  }): WhiteRabbitPaperScenarioReport {
    const paperRiskBlocks = input.paperRiskDecisions.some((decision) => decision.decision !== 'allow-continue-paper');
    const blockers = [
      ...input.decision.blockers,
      ...input.paperRiskDecisions
        .filter((decision) => decision.decision !== 'allow-continue-paper')
        .map((decision) => decision.reason),
    ];
    const eventTypes = input.events.map((event) => event.type);
    const tenantId = input.decision.tenantId;
    return {
      id: input.id,
      correlationId: input.decision.correlationId,
      tenantId,
      status: input.decision.status === 'completed' ? 'completed' : 'rejected',
      deterministic: true,
      liveExecutionAuthorized: false,
      productionApproval: false,
      providerDirectCallFromWhiteRabbit: false,
      runtimeMutatedByTrinity: false,
      signalTrace: {
        signalId: input.decision.signal?.id,
        action: input.decision.signal?.action,
        runtimeInstanceId: input.decision.signal?.runtimeInstanceId,
        correlationId: input.decision.correlationId,
        normalized: Boolean(input.decision.signal?.trace),
      },
      paperExecution: {
        paperSessionId: input.decision.paperSession?.id,
        normalizedFillCount: input.decision.fills.length,
        fillIds: input.decision.fills.map((fill) => fill.fillId),
        sensitiveFieldsExcluded: true,
      },
      telemetry: {
        summaryPresent: Boolean(input.decision.telemetrySummary),
        health: input.decision.telemetrySummary?.health,
        tenantScoped: input.decision.telemetrySummary?.runtimeInstanceId === input.decision.context.runtimeInstanceId,
      },
      reconciliation: {
        dryRunExecuted: eventTypes.includes('PAPER_RECONCILIATION_DRY_RUN_COMPLETED'),
        proposalsCreated: input.decision.reconciliationProposals.length,
        proposalOnly: input.decision.reconciliationProposals.every((proposal) => proposal.mutatesSovereignState === false),
        unresolvedProposalBlocksEligibility: input.decision.blockers.includes('unresolved reconciliation proposal requires review'),
      },
      paperRisk: {
        decisions: input.paperRiskDecisions,
        blocksControlledResume: paperRiskBlocks,
      },
      controlledResume: {
        eligible: input.decision.controlledResumeEligible && !paperRiskBlocks,
        blockers,
        approvalPath: input.decision.approvalPath,
      },
      trinity: {
        recommendationIds: input.trinityRecommendations.map((recommendation) => recommendation.id),
        requiresAcs: input.trinityRecommendations.every((recommendation) => recommendation.requiresAcs),
        authorizedExecution: false,
        mutatesRuntime: false,
      },
      trace: {
        eventCount: input.events.length,
        eventTypes,
        correlationIdPreserved: input.events.every((event) => event.correlationId === input.decision.correlationId),
        tenantIsolationPreserved: input.events.every((event) => this.eventBelongsToTenant(event, tenantId)),
      },
    };
  }

  private eventBelongsToTenant(event: TradingEvent, tenantId: string): boolean {
    return event.userId === undefined || event.userId === tenantId || event.daoId === tenantId;
  }
}

