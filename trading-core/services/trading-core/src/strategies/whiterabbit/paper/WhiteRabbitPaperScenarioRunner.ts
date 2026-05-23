import type {
  PaperRiskDecision,
  PaperRiskEvaluationInput,
  ReconciliationWorkerCandidate,
  WhiteRabbitPaperValidationDecision,
  WhiteRabbitPaperValidationRequest,
} from '../../../../../../packages/trading-contracts/src/index.js';
import { TrinityRecommendationEngine } from '../../../agents/trinity/TrinityRecommendationEngine.js';
import { ExecutionProviderRegistry } from '../../../execution/ExecutionProviderRegistry.js';
import { SimulationProvider } from '../../../execution/providers/simulation/SimulationProvider.js';
import { ReconciliationCandidateDiscoveryService } from '../../../reconciliation/ReconciliationCandidateDiscoveryService.js';
import { ReconciliationProposalRepository } from '../../../reconciliation/ReconciliationProposalRepository.js';
import { ReconciliationWorker } from '../../../reconciliation/ReconciliationWorker.js';
import { ReconciliationWorkerAuditService } from '../../../reconciliation/ReconciliationWorkerAuditService.js';
import { PaperRiskDecisionService } from '../../../risk/paper/PaperRiskDecisionService.js';
import { PaperTradingSessionService } from '../../../runtime/paper/PaperTradingSessionService.js';
import { InMemoryTradingEventRepository } from '../../../state/InMemoryTradingEventRepository.js';
import { TradingEventBus } from '../../../telemetry/TradingEventBus.js';
import { RuntimeObservabilityService } from '../../../telemetry/RuntimeObservabilityService.js';
import { WhiteRabbitPaperValidationService } from '../WhiteRabbitPaperValidationService.js';
import {
  createWhiteRabbitPaperScenarioFixtures,
  type WhiteRabbitPaperScenarioFixtureOverrides,
} from './WhiteRabbitPaperScenarioFixtures.js';
import {
  WhiteRabbitPaperScenarioReportService,
  type WhiteRabbitPaperScenarioReport,
} from './WhiteRabbitPaperScenarioReportService.js';

export interface WhiteRabbitPaperScenarioRunOptions extends WhiteRabbitPaperScenarioFixtureOverrides {
  paperRiskOverrides?: Partial<PaperRiskEvaluationInput>;
  requestOverrides?: Partial<WhiteRabbitPaperValidationRequest>;
}

export interface WhiteRabbitPaperScenarioRunResult {
  report: WhiteRabbitPaperScenarioReport;
  decision: WhiteRabbitPaperValidationDecision;
  paperRiskDecisions: PaperRiskDecision[];
  repository: InMemoryTradingEventRepository;
}

export class WhiteRabbitPaperScenarioRunner {
  constructor(
    private readonly reports = new WhiteRabbitPaperScenarioReportService(),
  ) {}

  async run(options: WhiteRabbitPaperScenarioRunOptions = {}): Promise<WhiteRabbitPaperScenarioRunResult> {
    const fixtures = createWhiteRabbitPaperScenarioFixtures(options);
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const registry = new ExecutionProviderRegistry();
    registry.register(new SimulationProvider({ deterministicPrice: '100', eventBus }));

    const reconciliationWorker = this.reconciliationWorker(fixtures.reconciliationCandidate, eventBus);
    const paperSessions = new PaperTradingSessionService({
      registry,
      eventBus,
      observability: new RuntimeObservabilityService(eventBus),
      reconciliationWorker,
    });
    const trinity = new TrinityRecommendationEngine(eventBus);
    const trinityResult = await trinity.evaluate(fixtures.trinityIntent);
    const request: WhiteRabbitPaperValidationRequest = {
      ...fixtures.request,
      ...options.requestOverrides,
      trinityRecommendations: trinityResult.recommendations,
    };
    const validation = new WhiteRabbitPaperValidationService({
      paperSessions,
      eventBus,
    });
    const decision = await validation.validate(request, fixtures.reconciliationCandidate);
    const paperRiskInput: PaperRiskEvaluationInput = {
      ...fixtures.paperRiskDefaults,
      ...options.paperRiskOverrides,
      fills: decision.fills.map((fill) => ({
        price: fill.price,
        quantity: fill.quantity,
        filledAt: fill.filledAt,
      })),
      unresolvedReconciliationProposals: decision.reconciliationProposals.filter((proposal) => proposal.reviewState !== 'rejected' && proposal.reviewState !== 'expired').length,
    };
    const paperRiskDecisions = await new PaperRiskDecisionService().evaluate(paperRiskInput);
    const events = repository.queryByCorrelationId(decision.correlationId);
    const report = this.reports.create({
      id: `${request.id}:scenario-report`,
      decision,
      paperRiskDecisions,
      trinityRecommendations: trinityResult.recommendations,
      events,
    });
    return {
      report,
      decision,
      paperRiskDecisions,
      repository,
    };
  }

  private reconciliationWorker(candidate: ReconciliationWorkerCandidate | undefined, eventBus: TradingEventBus): ReconciliationWorker | undefined {
    if (!candidate) {
      return undefined;
    }
    return new ReconciliationWorker({
      discovery: new ReconciliationCandidateDiscoveryService([candidate]),
      proposals: new ReconciliationProposalRepository(),
      audit: new ReconciliationWorkerAuditService(eventBus),
    });
  }
}

