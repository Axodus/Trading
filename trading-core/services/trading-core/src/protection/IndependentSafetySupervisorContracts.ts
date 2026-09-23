import type {
  TradeProtectionLifecycleStateV1,
  EmergencyCloseCommandV1,
  ProtectionReconciliationResultV1,
} from './PositionProtectionContracts.js';
import type {
  DurablePositionProtectionPlanRecordV1,
  ProtectionRecoveryClassificationV1,
  DurableProtectionOwnershipRecordV1,
  DurableTradingSafetyStateV1,
} from './DurablePositionProtectionContracts.js';
import type { BinancePositionRiskItemV1 } from './BinanceConditionalProtectionAdapter.js';

export type SafetySupervisorLifecycleStatusV1 =
  | 'INITIALIZING'
  | 'RUNNING'
  | 'DRAINING'
  | 'STOPPED'
  | 'DEGRADED';

export interface SafetySupervisorConfigV1 {
  supervisorId: string;
  environment: string;
  provider: string;
  leaseDurationMs: number;
  heartbeatIntervalMs: number;
  reconciliationIntervalMs: number;
  healthPort?: number;
  dryRun?: boolean;
}

export interface SafetySupervisorMetricsV1 {
  reconciliationCyclesCompleted: number;
  heartbeatsCompleted: number;
  plansDiscovered: number;
  activeLeasesHeld: number;
  unprotectedExposuresDetected: number;
  emergencyClosesExecuted: number;
  orphanedOrdersCleaned: number;
  fencingRejectionsObserved: number;
  lastReconciliationDurationMs: number;
  lastReconciliationAt?: string;
  lastHeartbeatAt?: string;
}

export interface PlanSupervisionSummaryV1 {
  planId: string;
  instrument: string;
  lifecycleState: TradeProtectionLifecycleStateV1;
  isFullyArmed: boolean;
  fencingToken: number;
  leaseExpiresAt: string;
  classification: ProtectionRecoveryClassificationV1;
  venuePositionAmt: string;
  activeProtectionAlgoIds: string[];
  lastReconciledAt: string;
}

export interface SafetySupervisorHealthSnapshotV1 {
  supervisorId: string;
  pid: number;
  status: SafetySupervisorLifecycleStatusV1;
  environment: string;
  provider: string;
  uptimeSeconds: number;
  startedAt: string;
  timestamp: string;
  killSwitchActive: boolean;
  killSwitchReason?: string;
  metrics: SafetySupervisorMetricsV1;
  activeSupervisedPlans: PlanSupervisionSummaryV1[];
  lastError?: string;
}

export interface SupervisorReconciliationCycleResultV1 {
  timestamp: string;
  plansEvaluated: number;
  unprotectedDetected: number;
  emergencyClosesTriggered: number;
  orphansCancelled: number;
  reconstructedPlans: PlanSupervisionSummaryV1[];
}
