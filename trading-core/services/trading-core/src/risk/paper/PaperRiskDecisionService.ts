import type { PaperRiskDecision, PaperRiskEvaluationInput } from '../../../../../packages/trading-contracts/src/index.js';
import { PaperControlledResumePolicy } from './PaperControlledResumePolicy.js';
import { PaperRiskAuditService } from './PaperRiskAuditService.js';
import { PaperSessionRiskSignalService } from './PaperSessionRiskSignalService.js';

export class PaperRiskBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaperRiskBoundaryError';
  }
}

export interface PaperRiskDecisionServiceDependencies {
  signals?: PaperSessionRiskSignalService;
  policy?: PaperControlledResumePolicy;
  audit?: PaperRiskAuditService;
}

export class PaperRiskDecisionService {
  private readonly signals: PaperSessionRiskSignalService;
  private readonly policy: PaperControlledResumePolicy;
  private readonly audit: PaperRiskAuditService;

  constructor(deps: PaperRiskDecisionServiceDependencies = {}) {
    this.signals = deps.signals ?? new PaperSessionRiskSignalService();
    this.policy = deps.policy ?? new PaperControlledResumePolicy();
    this.audit = deps.audit ?? new PaperRiskAuditService();
  }

  async evaluate(input: PaperRiskEvaluationInput): Promise<PaperRiskDecision[]> {
    this.assertTenantScope(input);
    const signals = this.signals.createSignals(input);
    const decisions = signals.length > 0 ? signals.map((signal) => this.policy.decide(signal)) : [this.allowDecision(input)];
    return this.audit.record(input, decisions);
  }

  private allowDecision(input: PaperRiskEvaluationInput): PaperRiskDecision {
    const now = new Date().toISOString();
    return {
      id: `${input.correlationId}:paper-risk-allow`,
      correlationId: input.correlationId,
      tenantId: input.tenantId,
      decision: 'allow-continue-paper',
      status: 'allowed',
      reason: 'Paper telemetry produced no risk signals. This does not authorize live execution.',
      requiresAcs: false,
      requiresRiskReview: false,
      authorizedExecution: false,
      controlledResumeEligible: false,
      mutatesRuntime: false,
      mutatesProvider: false,
      mutatesStrategy: false,
      createdAt: now,
    };
  }

  private assertTenantScope(input: PaperRiskEvaluationInput): void {
    const expected = input.executionDomain === 'treasury' ? input.daoId : input.userId;
    if (!expected || expected !== input.tenantId) {
      throw new PaperRiskBoundaryError('Cross-tenant paper risk evaluation rejected.');
    }
  }
}

