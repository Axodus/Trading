import type {
  PerformanceDriftAssessment,
  RevalidationRequest,
  RevalidationRequestPolicy,
  RevalidationScope,
} from '../../../../../packages/trading-contracts/src/index.js';
import {
  DEFAULT_REVALIDATION_REQUEST_POLICY_V1,
} from '../../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';

export interface CreateRevalidationRequestOptions {
  policy?: RevalidationRequestPolicy;
  scope?: RevalidationScope;
  evidenceRefs?: readonly string[];
  asOf?: string;
}

export class RevalidationRequestAuthority {
  public createRequest(
    assessment: PerformanceDriftAssessment,
    options: CreateRevalidationRequestOptions = {}
  ): RevalidationRequest | null {
    const policy = options.policy ?? DEFAULT_REVALIDATION_REQUEST_POLICY_V1;
    const asOf = options.asOf ?? new Date().toISOString();
    const scope = options.scope ?? policy.defaultScope;

    if (!policy.allowedTriggers.includes(assessment.classification)) {
      return null;
    }

    const revalidationRequestId = `req-reval-${assessment.strategyRevisionId.replace(/:/g, '-')}-${Date.now()}`;
    const inputDigest = stableJson({
      strategyId: assessment.strategyId,
      strategyRevisionId: assessment.strategyRevisionId,
      triggerAssessmentId: assessment.assessmentId,
      triggerClassification: assessment.classification,
      requestedValidationScope: scope,
      requestPolicyRevision: policy.policyRevision,
    });

    return {
      revalidationRequestId,
      strategyId: assessment.strategyId,
      strategyRevisionId: assessment.strategyRevisionId,
      triggerAssessmentId: assessment.assessmentId,
      triggerClassification: assessment.classification,
      requestedValidationScope: scope,
      evidenceRefs: options.evidenceRefs ?? [assessment.assessmentId],
      requestedAt: asOf,
      requestPolicyId: policy.policyId,
      requestPolicyRevision: policy.policyRevision,
      status: 'REQUESTED',
      inputDigest,
      updatedAt: asOf,
    };
  }
}
