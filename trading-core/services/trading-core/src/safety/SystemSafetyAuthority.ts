/**
 * AXODUS-TRADING-EPIC-01 / REQ-13
 * System Safety Authority
 */

import type {
  SystemSafetySnapshot,
  SystemSafetyAssessment,
  SystemSafetyPolicy,
  SystemSafetyState,
  SafetySeverity,
  SafetyScope,
  KillSwitchLevel,
  SafetyDomain,
  SafetyObservationStatus,
} from '../../../../packages/trading-contracts/src/index.js';
import {
  DEFAULT_SYSTEM_SAFETY_POLICY_V1,
} from '../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import {
  SafetySnapshotStaleError,
  SafetyAuthorityBypassAttemptError,
} from './SystemSafetyErrors.js';

export interface EvaluateSafetyParams {
  snapshot: SystemSafetySnapshot;
  policy?: SystemSafetyPolicy;
  evaluationTime?: string;
}

export class SystemSafetyAuthority {
  private readonly defaultPolicy: SystemSafetyPolicy;

  constructor(policy: SystemSafetyPolicy = DEFAULT_SYSTEM_SAFETY_POLICY_V1) {
    this.defaultPolicy = policy;
  }

  /**
   * Evaluates current system safety state and produces an immutable assessment.
   */
  public evaluateSafety(params: EvaluateSafetyParams): SystemSafetyAssessment {
    const policy = params.policy ?? this.defaultPolicy;
    const now = params.evaluationTime ?? params.snapshot.asOf ?? new Date().toISOString();
    const snapshot = params.snapshot;

    // 1. Validate snapshot freshness (TOCTOU)
    if (new Date(snapshot.expiresAt).getTime() < new Date(now).getTime()) {
      throw new SafetySnapshotStaleError(
        `Safety snapshot expired at ${snapshot.expiresAt}, evaluation time is ${now}`
      );
    }

    // 2. Evaluate Domain States & Fail-Closed Unknowns
    let state: SystemSafetyState = 'NORMAL';
    let severity: SafetySeverity = 'INFO';
    let scope: SafetyScope = 'SYSTEM';
    let scopeId: string | undefined = undefined;
    const reasonCodes: string[] = [];
    const activeKillLevels: KillSwitchLevel[] = [];
    const requiredActions: string[] = [];

    // Critical domains check
    const criticalDomainStates: Array<{ domain: SafetyDomain; status: SafetyObservationStatus }> = [
      { domain: 'DATABASE', status: snapshot.databaseState },
      { domain: 'MARKET_DATA', status: snapshot.marketDataState },
      { domain: 'EVENT_SYSTEM', status: snapshot.eventSystemState },
      { domain: 'EXECUTION', status: snapshot.executionState },
      { domain: 'RECONCILIATION', status: snapshot.reconciliationState },
      { domain: 'ACCOUNTING', status: snapshot.accountingState },
      { domain: 'GOVERNANCE', status: snapshot.governanceState },
      { domain: 'RUNTIME', status: snapshot.runtimeState },
    ];

    // Check for UNKNOWN critical dependencies -> fail-closed
    for (const item of criticalDomainStates) {
      if (item.status === 'UNKNOWN') {
        state = 'CONTAINED';
        severity = 'HIGH';
        reasonCodes.push(`CRITICAL_DEPENDENCY_UNKNOWN_${item.domain}`);
        activeKillLevels.push('KILL_NEW_RISK');
        requiredActions.push(`RESOLVE_UNKNOWN_${item.domain}`);
      }
    }

    // Database failure -> EMERGENCY SYSTEM KILL
    if (snapshot.databaseState === 'UNAVAILABLE' || snapshot.databaseState === 'INVALID') {
      state = 'EMERGENCY';
      severity = 'CRITICAL';
      scope = 'SYSTEM';
      reasonCodes.push('DATABASE_UNAVAILABLE');
      activeKillLevels.push('KILL_SYSTEM');
      requiredActions.push('RESTORE_DATABASE', 'CONTAIN_EXECUTION');
    }

    // Market data stale or gap
    if (snapshot.marketDataState === 'UNAVAILABLE' || snapshot.marketDataState === 'INVALID') {
      if (state !== 'EMERGENCY') {
        state = 'CONTAINED';
        severity = 'HIGH';
      }
      reasonCodes.push('MARKET_DATA_STALE');
      activeKillLevels.push('KILL_NEW_RISK');
      requiredActions.push('RESYNC_MARKET_DATA');
    } else if (snapshot.marketDataState === 'DEGRADED') {
      if (state === 'NORMAL') state = 'DEGRADED';
      reasonCodes.push('MARKET_DATA_DEGRADED');
      requiredActions.push('MONITOR_MARKET_DATA');
    }

    // Event system backlog or outage
    if (snapshot.eventSystemState === 'UNAVAILABLE' || snapshot.eventSystemState === 'INVALID') {
      if (state !== 'EMERGENCY') {
        state = 'EMERGENCY';
        severity = 'CRITICAL';
      }
      reasonCodes.push('OUTBOX_BACKLOG_EXCEEDED');
      activeKillLevels.push('KILL_EXECUTION');
      requiredActions.push('RESTORE_EVENT_FLOW');
    } else if (snapshot.eventSystemState === 'DEGRADED') {
      if (state === 'NORMAL') state = 'DEGRADED';
      reasonCodes.push('EVENT_SYSTEM_DEGRADED');
    }

    // Execution & Reconciliation ambiguity
    if (snapshot.executionState === 'UNAVAILABLE' || snapshot.executionState === 'INVALID') {
      if (state !== 'EMERGENCY') {
        state = 'EMERGENCY';
        severity = 'CRITICAL';
      }
      reasonCodes.push('EXECUTION_STATE_AMBIGUOUS');
      activeKillLevels.push('KILL_EXECUTION');
      requiredActions.push('RECONCILE_OPEN_ORDERS');
    }

    if (snapshot.reconciliationState === 'DEGRADED' || snapshot.reconciliationState === 'UNAVAILABLE') {
      if (state !== 'EMERGENCY') {
        state = 'CONTAINED';
        severity = 'HIGH';
      }
      reasonCodes.push('ORDER_RECONCILIATION_REQUIRED');
      activeKillLevels.push('KILL_EXECUTION');
      requiredActions.push('RECONCILE_OPEN_ORDERS', 'RECONCILE_FILLS', 'RECONCILE_POSITIONS');
    }

    // Provider / Venue specific failures
    for (const p of snapshot.providerStates) {
      if (p.status === 'UNAVAILABLE' || p.status === 'INVALID') {
        if (state === 'NORMAL') state = 'CONTAINED';
        reasonCodes.push(`PROVIDER_UNAVAILABLE_${p.provider.toUpperCase()}`);
        activeKillLevels.push('KILL_VENUE');
        if (p.venue) {
          scope = 'VENUE';
          scopeId = p.venue;
        }
        requiredActions.push(`RESTORE_PROVIDER_${p.provider.toUpperCase()}`);
      }
    }

    // Normal state fallback
    if (reasonCodes.length === 0) {
      state = 'NORMAL';
      severity = 'INFO';
      reasonCodes.push('SYSTEM_ALL_DOMAINS_HEALTHY');
      activeKillLevels.push('KILL_NONE');
    }

    const expiresAt = new Date(new Date(now).getTime() + 60000).toISOString();

    const payload = {
      safetySnapshotId: snapshot.safetySnapshotId,
      policyId: policy.policyId,
      policyRevision: policy.policyRevision,
      state,
      severity,
      scope,
      scopeId,
      reasonCodes,
      activeKillLevels,
      requiredActions,
      asOf: now,
    };

    const inputDigest = stableJson(payload);
    const assessmentId = `safe_ass_${scope.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      assessmentId,
      safetySnapshotId: snapshot.safetySnapshotId,
      policyId: policy.policyId,
      policyRevision: policy.policyRevision,
      state,
      severity,
      scope,
      scopeId,
      reasonCodes,
      activeKillLevels,
      requiredActions,
      createdAt: now,
      asOf: now,
      expiresAt,
      inputDigest,
    };
  }

  /**
   * Non-bypass verification check: Prohibits passing direct sovereign domain table writes.
   */
  public assertNoDirectAuthorityMutation(target: string): void {
    const forbiddenDirectTargets = [
      'risk_decisions',
      'strategy_health_heads',
      'strategy_lifecycle_heads',
      'portfolio_allocations',
      'canonical_orders',
      'canonical_fills',
    ];
    if (forbiddenDirectTargets.includes(target.toLowerCase())) {
      throw new SafetyAuthorityBypassAttemptError(
        `Direct mutation of sovereign domain table ${target} by System Safety is strictly prohibited`
      );
    }
  }
}
