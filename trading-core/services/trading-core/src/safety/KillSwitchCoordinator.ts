/**
 * AXODUS-TRADING-EPIC-01 / REQ-13
 * Kill-Switch Coordinator
 */

import type {
  SystemSafetyAssessment,
  KillSwitchRequest,
  KillSwitchLevel,
  SafetyScope,
  SafetySeverity,
  SystemSafetyState,
} from '../../../../packages/trading-contracts/src/index.js';
import { stableJson } from '../repositories/postgres/PostgresClient.js';
import {
  UnauthorizedSafetyActionError,
  KillSwitchReleaseBlockedError,
} from './SystemSafetyErrors.js';

export const KILL_SWITCH_LEVEL_WEIGHTS: Record<KillSwitchLevel, number> = {
  KILL_SYSTEM: 7,
  KILL_EXECUTION: 6,
  KILL_VENUE: 5,
  KILL_PROVIDER: 4,
  KILL_INSTRUMENT: 3,
  KILL_STRATEGY: 2,
  KILL_NEW_RISK: 1,
  KILL_NONE: 0,
};

export class KillSwitchCoordinator {
  /**
   * Compares two kill switch levels deterministically by precedence weight.
   * Returns positive if a > b, negative if a < b, 0 if equal.
   */
  public compareKillLevels(a: KillSwitchLevel, b: KillSwitchLevel): number {
    return (KILL_SWITCH_LEVEL_WEIGHTS[a] ?? 0) - (KILL_SWITCH_LEVEL_WEIGHTS[b] ?? 0);
  }

  /**
   * Constructs an immutable KillSwitchRequest from a safety assessment.
   */
  public createKillSwitchRequest(
    assessment: SystemSafetyAssessment,
    scope: SafetyScope,
    scopeId: string | undefined,
    level: KillSwitchLevel,
    severity: SafetySeverity,
    activeReasons: string[],
    requestedAt?: string
  ): KillSwitchRequest {
    const now = requestedAt ?? new Date().toISOString();

    const payload = {
      assessmentId: assessment.assessmentId,
      scope,
      scopeId,
      level,
      severity,
      reasonCodes: assessment.reasonCodes,
      activeReasons,
      requestedAt: now,
    };

    const inputDigest = stableJson(payload);
    const killSwitchRequestId = `kill_req_${scope.toLowerCase()}_${level.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      killSwitchRequestId,
      assessmentId: assessment.assessmentId,
      scope,
      scopeId,
      level,
      severity,
      reasonCodes: assessment.reasonCodes,
      activeReasons,
      requestedAt: now,
      status: 'REQUESTED',
      isLatched: true,
      inputDigest,
    };
  }

  /**
   * Evaluates a manual emergency kill command.
   */
  public evaluateManualKill(params: {
    scope: SafetyScope;
    scopeId?: string;
    level: KillSwitchLevel;
    reason: string;
    authorizedOperator: string;
    timestamp?: string;
  }): KillSwitchRequest {
    const now = params.timestamp ?? new Date().toISOString();

    if (!params.authorizedOperator || !params.authorizedOperator.startsWith('op_')) {
      throw new UnauthorizedSafetyActionError(
        `Caller ${params.authorizedOperator} is not an authorized emergency safety operator`
      );
    }

    const payload = {
      scope: params.scope,
      scopeId: params.scopeId,
      level: params.level,
      severity: 'CRITICAL',
      reasonCodes: [params.reason, 'MANUAL_EMERGENCY_KILL'],
      activeReasons: [params.reason],
      authorizedOperator: params.authorizedOperator,
      requestedAt: now,
    };

    const inputDigest = stableJson(payload);
    const killSwitchRequestId = `kill_manual_${params.scope.toLowerCase()}_${params.level.toLowerCase()}_${Date.now()}`;

    return {
      killSwitchRequestId,
      assessmentId: `manual_assessment_${Date.now()}`,
      scope: params.scope,
      scopeId: params.scopeId,
      level: params.level,
      severity: 'CRITICAL',
      reasonCodes: [params.reason, 'MANUAL_EMERGENCY_KILL'],
      activeReasons: [params.reason],
      requestedAt: now,
      status: 'ACTIVE',
      isLatched: true,
      inputDigest,
    };
  }

  /**
   * Evaluates manual release of an active kill switch request.
   */
  public evaluateManualRelease(params: {
    activeRequest: KillSwitchRequest;
    authorizedOperator: string;
    currentSafetyState: SystemSafetyState;
    unresolvedReasons: string[];
    timestamp?: string;
  }): boolean {
    if (!params.authorizedOperator || !params.authorizedOperator.startsWith('op_')) {
      throw new UnauthorizedSafetyActionError(
        `Caller ${params.authorizedOperator} is not an authorized emergency safety operator`
      );
    }

    if (params.unresolvedReasons.length > 0) {
      throw new KillSwitchReleaseBlockedError(
        `Cannot release kill switch ${params.activeRequest.killSwitchRequestId}: unresolved reasons remain: ${params.unresolvedReasons.join(', ')}`
      );
    }

    if (params.currentSafetyState !== 'NORMAL' && params.currentSafetyState !== 'SAFE_TO_RESUME') {
      throw new KillSwitchReleaseBlockedError(
        `Cannot release kill switch ${params.activeRequest.killSwitchRequestId}: current system safety state is ${params.currentSafetyState} (must be NORMAL or SAFE_TO_RESUME)`
      );
    }

    return true;
  }
}

