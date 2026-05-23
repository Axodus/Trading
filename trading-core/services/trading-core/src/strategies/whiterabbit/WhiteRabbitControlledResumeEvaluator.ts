import type {
  ReconciliationProposal,
  WhiteRabbitPaperValidationDecision,
  WhiteRabbitPaperValidationPolicy,
  WhiteRabbitSimulationEvidence,
  WhiteRabbitTelemetrySummary,
} from '../../../../../packages/trading-contracts/src/index.js';
import { whiteRabbitPaperValidationPolicy } from './WhiteRabbitPaperValidationPolicy.js';

export class WhiteRabbitControlledResumeEvaluator {
  constructor(private readonly policy: WhiteRabbitPaperValidationPolicy = whiteRabbitPaperValidationPolicy) {}

  evaluate(input: {
    validationCompleted: boolean;
    telemetrySummary?: WhiteRabbitTelemetrySummary;
    reconciliationProposals: ReconciliationProposal[];
    evidence?: WhiteRabbitSimulationEvidence;
  }): Pick<WhiteRabbitPaperValidationDecision, 'controlledResumeEligible' | 'blockers' | 'approvalPath'> {
    const blockers: string[] = [];
    if (!input.validationCompleted) {
      blockers.push('paper validation is not completed');
    }
    if (this.policy.requireTelemetrySummary && !input.telemetrySummary) {
      blockers.push('telemetry summary is required');
    }
    if (input.telemetrySummary?.health === 'offline') {
      blockers.push('runtime health is critical or offline');
    }
    if (input.telemetrySummary?.health === 'degraded') {
      blockers.push('runtime health is degraded');
    }
    if (this.policy.requireReconciliationDryRun && input.reconciliationProposals.some((proposal) => proposal.reviewState !== 'rejected' && proposal.reviewState !== 'expired')) {
      blockers.push('unresolved reconciliation proposal requires review');
    }
    if (!input.evidence) {
      blockers.push('controlled resume evidence is required');
    }

    return {
      controlledResumeEligible: blockers.length === 0,
      blockers,
      approvalPath: {
        acsRequired: true,
        governanceRequired: true,
        riskReviewRequired: this.policy.requireRiskReviewEligibility,
        liveExecutionAuthorized: false,
      },
    };
  }
}

