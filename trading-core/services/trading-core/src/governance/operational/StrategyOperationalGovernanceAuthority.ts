/**
 * AXODUS-TRADING-EPIC-01 / REQ-12
 * Strategy Operational Governance Authority
 */

import type {
  StrategyGovernanceSnapshot,
  StrategyGovernanceDecision,
  StrategyInterventionRequest,
  StrategyInterventionPlan,
  StrategyOperationalGovernancePolicy,
  GovernanceClassification,
  TargetAuthority,
  InterventionType,
  InterventionSeverity,
} from '../../../../../packages/trading-contracts/src/index.js';
import {
  DEFAULT_STRATEGY_OPERATIONAL_GOVERNANCE_POLICY_V1,
} from '../../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../../repositories/postgres/PostgresClient.js';
import {
  GovernanceRevisionMismatchError,
  GovernanceSnapshotStaleError,
  InterventionDependencyCycleError,
  GovernanceAuthorityBypassAttemptError,
} from './StrategyOperationalGovernanceErrors.js';

export interface EvaluateGovernanceParams {
  snapshot: StrategyGovernanceSnapshot;
  currentLifecycleVersion: number;
  currentHealthVersion: number;
  currentOperationalSnapshotId: string;
  policy?: StrategyOperationalGovernancePolicy;
  evaluationTime?: string;
}

export class StrategyOperationalGovernanceAuthority {
  private readonly defaultPolicy: StrategyOperationalGovernancePolicy;

  constructor(policy: StrategyOperationalGovernancePolicy = DEFAULT_STRATEGY_OPERATIONAL_GOVERNANCE_POLICY_V1) {
    this.defaultPolicy = policy;
  }

  /**
   * Deterministic evaluation of current operational governance state.
   */
  public evaluateGovernance(params: EvaluateGovernanceParams): StrategyGovernanceDecision {
    const policy = params.policy ?? this.defaultPolicy;
    const now = params.evaluationTime ?? new Date().toISOString();
    const snapshot = params.snapshot;

    // 1. Exact StrategyRevision validation
    if (!snapshot.strategyRevisionId || !snapshot.strategyId) {
      throw new GovernanceRevisionMismatchError('Strategy identity or revision is missing in snapshot');
    }

    // 2. Snapshot Freshness & Coherence Validation (TOCTOU protection)
    if (snapshot.lifecycleVersion !== params.currentLifecycleVersion) {
      throw new GovernanceSnapshotStaleError(
        `Lifecycle version mismatch: snapshot=${snapshot.lifecycleVersion}, current=${params.currentLifecycleVersion}`
      );
    }
    if (snapshot.healthVersion !== params.currentHealthVersion) {
      throw new GovernanceSnapshotStaleError(
        `Health version mismatch: snapshot=${snapshot.healthVersion}, current=${params.currentHealthVersion}`
      );
    }
    if (snapshot.operationalSnapshotId !== params.currentOperationalSnapshotId) {
      throw new GovernanceSnapshotStaleError(
        `Operational snapshot mismatch: snapshot=${snapshot.operationalSnapshotId}, current=${params.currentOperationalSnapshotId}`
      );
    }
    if (new Date(snapshot.expiresAt).getTime() < new Date(now).getTime()) {
      throw new GovernanceSnapshotStaleError(
        `Governance snapshot expired at ${snapshot.expiresAt}, evaluation time is ${now}`
      );
    }

    // 3. Operational Governance Decision Matrix
    let classification: GovernanceClassification;
    const reasonCodes: string[] = [];
    const requiredInterventions: InterventionType[] = [];

    if (snapshot.lifecycleState === 'RETIRED' || snapshot.healthState === 'RETIRED') {
      classification = 'RETIREMENT_REVIEW';
      requiredInterventions.push('REQUEST_RETIREMENT_REVIEW');
      reasonCodes.push('LIFECYCLE_OR_HEALTH_RETIRED');
    } else if (snapshot.healthState === 'SUSPENDED') {
      classification = 'SUSPEND_REQUESTED';
      requiredInterventions.push('REQUEST_SUSPENSION_REVIEW', 'REASSESS_HEALTH');
      reasonCodes.push('STRATEGY_HEALTH_SUSPENDED');
    } else if (snapshot.healthState === 'UNKNOWN') {
      classification = 'BLOCKED';
      requiredInterventions.push('REASSESS_HEALTH');
      reasonCodes.push('HEALTH_UNKNOWN_FAIL_CLOSED');
    } else if (snapshot.revalidationOutcome === 'FAILED' || snapshot.revalidationStatus === 'FAILED') {
      classification = 'INTERVENE';
      requiredInterventions.push('REQUEST_LIFECYCLE_DEMOTION', 'REQUEST_CAPITAL_FREEZE', 'REASSESS_HEALTH');
      reasonCodes.push('REVALIDATION_FAILED');
    } else if (snapshot.revalidationOutcome === 'INCONCLUSIVE') {
      classification = 'BLOCKED';
      requiredInterventions.push('REQUEST_REVALIDATION');
      reasonCodes.push('REVALIDATION_INCONCLUSIVE_FAIL_CLOSED');
    } else if (snapshot.driftClassification === 'CRITICAL') {
      classification = 'INTERVENE';
      requiredInterventions.push('REQUEST_SUSPENSION_REVIEW', 'REQUEST_RISK_HALT_REVIEW', 'REQUEST_CAPITAL_FREEZE');
      reasonCodes.push('CRITICAL_PERFORMANCE_DRIFT');
    } else if (snapshot.driftClassification === 'MATERIAL') {
      classification = 'REVALIDATE';
      requiredInterventions.push('REQUEST_REVALIDATION', 'REQUEST_RISK_RESTRICTION');
      reasonCodes.push('MATERIAL_PERFORMANCE_DRIFT');
    } else if (snapshot.driftClassification === 'DEGRADED') {
      classification = 'OBSERVE';
      requiredInterventions.push('REQUEST_RISK_RESTRICTION');
      reasonCodes.push('DEGRADED_PERFORMANCE_DRIFT');
    } else if (snapshot.driftClassification === 'INSUFFICIENT_DATA') {
      classification = 'OBSERVE';
      reasonCodes.push('INSUFFICIENT_DATA_OBSERVE');
    } else if (snapshot.lifecycleState === 'MONITOR') {
      classification = 'RESTRICT';
      requiredInterventions.push('REQUEST_RISK_RESTRICTION');
      reasonCodes.push('MONITOR_DELEVERAGING_MODE_ONLY');
    } else if (
      snapshot.driftClassification === 'NORMAL' &&
      snapshot.healthState === 'HEALTHY' &&
      ['INCUBATION', 'PRODUCTION', 'PAPER'].includes(snapshot.lifecycleState) &&
      (!snapshot.revalidationOutcome || snapshot.revalidationOutcome === 'PASSED') &&
      (!snapshot.revalidationStatus || snapshot.revalidationStatus === 'COMPLETED' || snapshot.revalidationStatus === 'REQUESTED' || snapshot.revalidationStatus === 'ACKNOWLEDGED' || snapshot.revalidationStatus === 'IN_PROGRESS')
    ) {
      classification = 'CONTINUE';
      reasonCodes.push('NORMAL_HEALTHY_OPERATIONAL');
    } else {
      classification = 'BLOCKED';
      reasonCodes.push('UNRECOGNIZED_STATE_COMBINATION_FAIL_CLOSED');
    }

    const expiresAt = new Date(new Date(now).getTime() + policy.defaultValidityMs).toISOString();

    const payloadToHash = {
      strategyId: snapshot.strategyId,
      strategyRevisionId: snapshot.strategyRevisionId,
      governanceSnapshotId: snapshot.governanceSnapshotId,
      policyId: policy.policyId,
      policyRevision: policy.policyRevision,
      classification,
      reasonCodes,
      requiredInterventions,
      asOf: now,
    };

    const inputDigest = stableJson(payloadToHash);
    const governanceDecisionId = `gov_dec_${snapshot.strategyId}_${snapshot.strategyRevisionId.replace(/:/g, '-')}_${Date.now()}`;

    return {
      governanceDecisionId,
      strategyId: snapshot.strategyId,
      strategyRevisionId: snapshot.strategyRevisionId,
      governanceSnapshotId: snapshot.governanceSnapshotId,
      policyId: policy.policyId,
      policyRevision: policy.policyRevision,
      classification,
      reasonCodes,
      requiredInterventions,
      createdAt: now,
      asOf: now,
      expiresAt,
      inputDigest,
    };
  }

  /**
   * Constructs an immutable StrategyInterventionRequest.
   */
  public createInterventionRequest(
    decision: StrategyGovernanceDecision,
    targetAuthority: TargetAuthority,
    interventionType: InterventionType,
    severity: InterventionSeverity,
    reasonCodes: string[],
    evidenceRefs: string[],
    requestedAt?: string
  ): StrategyInterventionRequest {
    const now = requestedAt ?? new Date().toISOString();

    const payload = {
      strategyId: decision.strategyId,
      strategyRevisionId: decision.strategyRevisionId,
      governanceDecisionId: decision.governanceDecisionId,
      targetAuthority,
      interventionType,
      severity,
      reasonCodes,
      evidenceRefs,
    };

    const inputDigest = stableJson(payload);
    const interventionRequestId = `gov_req_${decision.strategyId}_${targetAuthority.toLowerCase()}_${interventionType.toLowerCase()}_${Date.now()}`;

    return {
      interventionRequestId,
      strategyId: decision.strategyId,
      strategyRevisionId: decision.strategyRevisionId,
      governanceDecisionId: decision.governanceDecisionId,
      targetAuthority,
      interventionType,
      severity,
      reasonCodes,
      evidenceRefs,
      requestedAt: now,
      status: 'REQUESTED',
      inputDigest,
    };
  }

  /**
   * Builds an immutable StrategyInterventionPlan with dependency cycle validation.
   */
  public createInterventionPlan(
    decision: StrategyGovernanceDecision,
    requests: StrategyInterventionRequest[],
    dependencies: Array<{ requestId: string; dependsOnRequestId: string }> = [],
    createdAt?: string
  ): StrategyInterventionPlan {
    const now = createdAt ?? new Date().toISOString();

    // Verify dependency graph has no cycles
    this.assertNoDependencyCycles(requests.map((r) => r.interventionRequestId), dependencies);

    const payload = {
      strategyId: decision.strategyId,
      strategyRevisionId: decision.strategyRevisionId,
      governanceDecisionId: decision.governanceDecisionId,
      requests: requests.map((r) => r.interventionRequestId),
      dependencies,
    };

    const inputDigest = stableJson(payload);
    const planId = `gov_plan_${decision.strategyId}_${decision.strategyRevisionId.replace(/:/g, '-')}_${Date.now()}`;

    return {
      planId,
      strategyId: decision.strategyId,
      strategyRevisionId: decision.strategyRevisionId,
      governanceDecisionId: decision.governanceDecisionId,
      requests: requests.map((r) => ({ ...r, planId })),
      dependencies,
      status: 'PENDING',
      createdAt: now,
      inputDigest,
    };
  }

  /**
   * Asserts that the dependency graph has no circular references.
   */
  private assertNoDependencyCycles(
    nodeIds: string[],
    edges: Array<{ requestId: string; dependsOnRequestId: string }>
  ): void {
    const adj = new Map<string, string[]>();
    for (const id of nodeIds) {
      adj.set(id, []);
    }
    for (const edge of edges) {
      if (!adj.has(edge.requestId)) adj.set(edge.requestId, []);
      adj.get(edge.requestId)!.push(edge.dependsOnRequestId);
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
          throw new InterventionDependencyCycleError(`Circular dependency detected in intervention plan around request ${id}`);
        }
      }
    }
  }

  /**
   * Non-bypass verification check: Ensures caller cannot pass direct table mutation instructions.
   */
  public assertNoDirectAuthorityMutation(target: string): void {
    const forbiddenDirectTargets = [
      'strategy_health_heads',
      'strategy_lifecycle_heads',
      'portfolio_allocations',
      'risk_decisions',
    ];
    if (forbiddenDirectTargets.includes(target.toLowerCase())) {
      throw new GovernanceAuthorityBypassAttemptError(
        `Direct mutation of sovereign domain table ${target} is strictly prohibited`
      );
    }
  }
}
