/**
 * AXODUS-TRADING-EPIC-01 / REQ-12
 * Intervention Resolution Authority
 */

import type {
  StrategyInterventionPlan,
  AuthorityResponse,
  StrategyInterventionResolution,
  InterventionResolutionStatus,
} from '../../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';

export class InterventionResolutionAuthority {
  /**
   * Deterministically evaluates the resolution of an intervention plan given authority responses.
   */
  public resolvePlan(
    plan: StrategyInterventionPlan,
    responses: AuthorityResponse[],
    resolvedAt?: string
  ): StrategyInterventionResolution {
    const now = resolvedAt ?? new Date().toISOString();
    const responseMap = new Map<string, AuthorityResponse>();
    for (const res of responses) {
      responseMap.set(res.interventionRequestId, res);
    }

    const resolvedInterventions: string[] = [];
    const pendingInterventions: string[] = [];
    const rejectedInterventions: string[] = [];
    const reasons: string[] = [];

    for (const req of plan.requests) {
      const resp = responseMap.get(req.interventionRequestId);
      if (!resp) {
        pendingInterventions.push(req.interventionRequestId);
      } else if (resp.status === 'APPLIED') {
        resolvedInterventions.push(req.interventionRequestId);
        if (resp.canonicalResultRef) {
          reasons.push(`${req.interventionType} APPLIED via ${resp.targetAuthority} (ref: ${resp.canonicalResultRef})`);
        } else {
          reasons.push(`${req.interventionType} APPLIED via ${resp.targetAuthority}`);
        }
      } else if (resp.status === 'REJECTED') {
        rejectedInterventions.push(req.interventionRequestId);
        reasons.push(`${req.interventionType} REJECTED by ${resp.targetAuthority}`);
      } else if (resp.status === 'FAILED') {
        rejectedInterventions.push(req.interventionRequestId);
        reasons.push(`${req.interventionType} FAILED on ${resp.targetAuthority}`);
      } else {
        pendingInterventions.push(req.interventionRequestId);
      }
    }

    let status: InterventionResolutionStatus;
    if (resolvedInterventions.length === plan.requests.length && plan.requests.length > 0) {
      status = 'RESOLVED';
    } else if (resolvedInterventions.length > 0 && (pendingInterventions.length > 0 || rejectedInterventions.length > 0)) {
      status = 'PARTIALLY_APPLIED';
    } else if (rejectedInterventions.length === plan.requests.length && plan.requests.length > 0) {
      status = 'FAILED';
    } else {
      status = 'PENDING';
    }

    const payload = {
      strategyId: plan.strategyId,
      strategyRevisionId: plan.strategyRevisionId,
      governanceDecisionId: plan.governanceDecisionId,
      planId: plan.planId,
      status,
      resolvedInterventions,
      pendingInterventions,
      rejectedInterventions,
      reasons,
      asOf: now,
    };

    const inputDigest = stableJson(payload);
    const resolutionId = `gov_res_${plan.strategyId}_${plan.planId.substring(9, 21)}_${Date.now()}`;

    return {
      resolutionId,
      strategyId: plan.strategyId,
      strategyRevisionId: plan.strategyRevisionId,
      governanceDecisionId: plan.governanceDecisionId,
      planId: plan.planId,
      status,
      resolvedInterventions,
      pendingInterventions,
      rejectedInterventions,
      reasons,
      resolvedAt: now,
      inputDigest,
    };
  }
}
