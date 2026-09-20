/**
 * AXODUS-TRADING-EPIC-01 / REQ-13
 * System Recovery Authority
 */

import type {
  SystemSafetyAssessment,
  SystemSafetySnapshot,
  SystemSafetyPolicy,
  KillSwitchRequest,
  SystemRecoveryPlan,
  RecoveryStep,
  RecoveryStepType,
  ResumeEligibility,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  DEFAULT_SYSTEM_SAFETY_POLICY_V1,
} from '../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import {
  RecoveryDependencyCycleError,
  RecoveryFencingTokenError,
} from './SystemSafetyErrors.js';

export interface CreateRecoveryPlanParams {
  assessment: SystemSafetyAssessment;
  policy?: SystemSafetyPolicy;
  killSwitchRequest?: KillSwitchRequest;
  createdAt?: string;
  leaseToken?: number;
}

export interface EvaluateResumeEligibilityParams {
  plan: SystemRecoveryPlan;
  currentSafetySnapshot: SystemSafetySnapshot;
  outboxBacklogCount: number;
  hasUnresolvedSubmittedUnknown: boolean;
  evaluatedAt?: string;
}

export class SystemRecoveryAuthority {
  private readonly defaultPolicy: SystemSafetyPolicy;

  constructor(policy: SystemSafetyPolicy = DEFAULT_SYSTEM_SAFETY_POLICY_V1) {
    this.defaultPolicy = policy;
  }

  /**
   * Constructs an immutable SystemRecoveryPlan from a safety assessment.
   */
  public createRecoveryPlan(params: CreateRecoveryPlanParams): SystemRecoveryPlan {
    const policy = params.policy ?? this.defaultPolicy;
    const now = params.createdAt ?? new Date().toISOString();
    const assessment = params.assessment;

    const steps: RecoveryStep[] = [];
    const dependencies: Array<{ stepId: string; dependsOnStepId: string }> = [];

    let stepIndex = 1;
    const addStep = (type: RecoveryStepType, dependsOnType?: RecoveryStepType) => {
      const stepId = `step_${stepIndex++}_${type.toLowerCase()}`;
      steps.push({ stepId, type, status: 'PENDING' });
      if (dependsOnType) {
        const dep = steps.find((s) => s.type === dependsOnType);
        if (dep) {
          dependencies.push({ stepId, dependsOnStepId: dep.stepId });
        }
      }
      return stepId;
    };

    // Determine required recovery workflow based on assessment reason codes
    if (assessment.reasonCodes.includes('DATABASE_UNAVAILABLE')) {
      addStep('RESTORE_DATABASE');
      addStep('RECONCILE_OPEN_ORDERS', 'RESTORE_DATABASE');
      addStep('VALIDATE_RISK_STATE', 'RECONCILE_OPEN_ORDERS');
      addStep('STABILITY_WINDOW', 'VALIDATE_RISK_STATE');
      addStep('READY_FOR_RESUME', 'STABILITY_WINDOW');
    } else if (assessment.reasonCodes.includes('MARKET_DATA_STALE') || assessment.reasonCodes.includes('MARKET_DATA_DEGRADED')) {
      addStep('RESTORE_MARKET_DATA');
      addStep('RESYNC_MARKET_DATA', 'RESTORE_MARKET_DATA');
      addStep('STABILITY_WINDOW', 'RESYNC_MARKET_DATA');
      addStep('READY_FOR_RESUME', 'STABILITY_WINDOW');
    } else if (
      assessment.reasonCodes.includes('EXECUTION_STATE_AMBIGUOUS') ||
      assessment.reasonCodes.includes('ORDER_RECONCILIATION_REQUIRED')
    ) {
      addStep('RESTORE_PROVIDER_CONNECTIVITY');
      addStep('RECONCILE_OPEN_ORDERS', 'RESTORE_PROVIDER_CONNECTIVITY');
      addStep('RECONCILE_FILLS', 'RECONCILE_OPEN_ORDERS');
      addStep('RECONCILE_POSITIONS', 'RECONCILE_FILLS');
      addStep('REBUILD_ACCOUNTING', 'RECONCILE_POSITIONS');
      addStep('VALIDATE_RISK_STATE', 'REBUILD_ACCOUNTING');
      addStep('STABILITY_WINDOW', 'VALIDATE_RISK_STATE');
      addStep('READY_FOR_RESUME', 'STABILITY_WINDOW');
    } else if (assessment.reasonCodes.includes('OUTBOX_BACKLOG_EXCEEDED')) {
      addStep('RESTORE_EVENT_FLOW');
      addStep('STABILITY_WINDOW', 'RESTORE_EVENT_FLOW');
      addStep('READY_FOR_RESUME', 'STABILITY_WINDOW');
    } else {
      // Default comprehensive recovery sequence
      addStep('RESTORE_PROVIDER_CONNECTIVITY');
      addStep('RECONCILE_OPEN_ORDERS', 'RESTORE_PROVIDER_CONNECTIVITY');
      addStep('VALIDATE_RISK_STATE', 'RECONCILE_OPEN_ORDERS');
      addStep('STABILITY_WINDOW', 'VALIDATE_RISK_STATE');
      addStep('READY_FOR_RESUME', 'STABILITY_WINDOW');
    }

    // Validate dependency graph for circular references
    this.assertNoDependencyCycles(steps.map((s: RecoveryStep) => s.stepId), dependencies);

    const payload = {
      triggerAssessmentId: assessment.assessmentId,
      killSwitchRequestId: params.killSwitchRequest?.killSwitchRequestId,
      scope: assessment.scope,
      scopeId: assessment.scopeId,
      steps: steps.map((s: RecoveryStep) => s.stepId),
      dependencies,
      policyId: policy.policyId,
      policyRevision: policy.policyRevision,
    };

    const inputDigest = stableJson(payload);
    const recoveryPlanId = `rec_plan_${assessment.scope.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      recoveryPlanId,
      triggerAssessmentId: assessment.assessmentId,
      killSwitchRequestId: params.killSwitchRequest?.killSwitchRequestId,
      scope: assessment.scope,
      scopeId: assessment.scopeId,
      steps,
      dependencies,
      policyId: policy.policyId,
      policyRevision: policy.policyRevision,
      status: 'PENDING',
      leaseToken: params.leaseToken ?? Date.now(),
      createdAt: now,
      inputDigest,
    };
  }

  /**
   * Asserts worker fencing token validity.
   */
  public validateFencingToken(currentLeaseToken: number | undefined, incomingToken: number): void {
    if (currentLeaseToken !== undefined && incomingToken < currentLeaseToken) {
      throw new RecoveryFencingTokenError(
        `Incoming fencing token ${incomingToken} is older than current lease token ${currentLeaseToken}`
      );
    }
  }

  /**
   * Evaluates deterministic resume eligibility for a recovery plan against live system state.
   */
  public evaluateResumeEligibility(params: EvaluateResumeEligibilityParams): ResumeEligibility {
    const now = params.evaluatedAt ?? new Date().toISOString();
    const plan = params.plan;
    const snap = params.currentSafetySnapshot;

    const validatedPrerequisites: string[] = [];
    const failedPrerequisites: string[] = [];

    // 1. All plan steps must be COMPLETED
    const incompleteSteps = plan.steps.filter((s: RecoveryStep) => s.status !== 'COMPLETED');
    if (incompleteSteps.length === 0) {
      validatedPrerequisites.push('ALL_RECOVERY_STEPS_COMPLETED');
    } else {
      failedPrerequisites.push(`INCOMPLETE_RECOVERY_STEPS: ${incompleteSteps.map((s: RecoveryStep) => s.type).join(', ')}`);
    }

    // 2. No unresolved SUBMITTED_UNKNOWN
    if (!params.hasUnresolvedSubmittedUnknown) {
      validatedPrerequisites.push('NO_UNRESOLVED_SUBMITTED_UNKNOWN');
    } else {
      failedPrerequisites.push('UNRESOLVED_SUBMITTED_UNKNOWN_PRESENT');
    }

    // 3. Outbox backlog within safe threshold
    if (params.outboxBacklogCount <= 100) {
      validatedPrerequisites.push('OUTBOX_BACKLOG_WITHIN_BOUNDS');
    } else {
      failedPrerequisites.push(`OUTBOX_BACKLOG_EXCEEDED: count=${params.outboxBacklogCount}`);
    }

    // 4. Market data fresh (not stale or invalid)
    if (snap.marketDataState === 'HEALTHY') {
      validatedPrerequisites.push('MARKET_DATA_HEALTHY');
    } else {
      failedPrerequisites.push(`MARKET_DATA_NOT_HEALTHY: state=${snap.marketDataState}`);
    }

    // 5. Database writable & healthy
    if (snap.databaseState === 'HEALTHY') {
      validatedPrerequisites.push('DATABASE_HEALTHY');
    } else {
      failedPrerequisites.push(`DATABASE_NOT_HEALTHY: state=${snap.databaseState}`);
    }

    // 6. Reconciliation healthy
    if (snap.reconciliationState === 'HEALTHY') {
      validatedPrerequisites.push('RECONCILIATION_HEALTHY');
    } else {
      failedPrerequisites.push(`RECONCILIATION_NOT_HEALTHY: state=${snap.reconciliationState}`);
    }

    const eligible = failedPrerequisites.length === 0;
    const expiresAt = new Date(new Date(now).getTime() + 60000).toISOString();

    const payload = {
      recoveryPlanId: plan.recoveryPlanId,
      eligible,
      scope: plan.scope,
      scopeId: plan.scopeId,
      validatedPrerequisites,
      failedPrerequisites,
      evaluatedAt: now,
    };

    const inputDigest = stableJson(payload);
    const resumeEligibilityId = `res_elig_${plan.recoveryPlanId}_${Date.now()}`;

    return {
      resumeEligibilityId,
      recoveryPlanId: plan.recoveryPlanId,
      eligible,
      scope: plan.scope,
      scopeId: plan.scopeId,
      validatedPrerequisites,
      failedPrerequisites,
      evaluatedAt: now,
      expiresAt,
      requiresHumanReview: ['SYSTEM', 'EXECUTION_ADAPTER', 'VENUE'].includes(plan.scope),
      inputDigest,
    };
  }

  /**
   * Asserts no circular references exist in the recovery dependency graph.
   */
  private assertNoDependencyCycles(
    nodeIds: string[],
    edges: Array<{ stepId: string; dependsOnStepId: string }>
  ): void {
    const adj = new Map<string, string[]>();
    for (const id of nodeIds) {
      adj.set(id, []);
    }
    for (const edge of edges) {
      if (!adj.has(edge.stepId)) adj.set(edge.stepId, []);
      adj.get(edge.stepId)!.push(edge.dependsOnStepId);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const id of nodeIds) {
      if (!visited.has(id)) {
        if (dfs(id)) {
          throw new RecoveryDependencyCycleError(
            `Circular dependency detected in recovery plan around step ${id}`
          );
        }
      }
    }
  }
}

