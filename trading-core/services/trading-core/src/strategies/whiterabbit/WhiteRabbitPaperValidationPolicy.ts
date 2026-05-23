import type { WhiteRabbitPaperValidationPolicy as WhiteRabbitPaperValidationPolicyContract } from '../../../../../packages/trading-contracts/src/index.js';

export const whiteRabbitPaperValidationPolicy: WhiteRabbitPaperValidationPolicyContract = {
  allowedProviders: ['simulation', 'hummingbot'],
  requireTelemetrySummary: true,
  requireReconciliationDryRun: true,
  requireRiskReviewEligibility: true,
  defaultPaperQuantity: '0.01',
};

