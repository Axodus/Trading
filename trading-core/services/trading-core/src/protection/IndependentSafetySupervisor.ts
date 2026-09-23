import type {
  EmergencyCloseCommandV1,
  ProtectionReconciliationResultV1,
  TradeProtectionLifecycleStateV1,
} from './PositionProtectionContracts.js';
import type {
  DurablePositionProtectionPlanRecordV1,
  ProtectionRecoveryClassificationV1,
  DurableProtectionOwnershipRecordV1,
} from './DurablePositionProtectionContracts.js';
import type { PostgresPositionProtectionRepository } from './PostgresPositionProtectionRepository.js';
import type { PostgresTradingSafetyStateRepository } from './PostgresTradingSafetyStateRepository.js';
import type {
  BinanceConditionalProtectionAdapter,
  BinancePositionRiskItemV1,
} from './BinanceConditionalProtectionAdapter.js';
import type {
  SafetySupervisorConfigV1,
  SafetySupervisorHealthSnapshotV1,
  SafetySupervisorLifecycleStatusV1,
  SafetySupervisorMetricsV1,
  PlanSupervisionSummaryV1,
  SupervisorReconciliationCycleResultV1,
} from './IndependentSafetySupervisorContracts.js';

export interface MinimalHttpServer {
  listen(port: number, cb?: () => void): void;
  close(cb?: (err?: Error) => void): void;
}

export interface MinimalHttpServer {
  listen(port: number, cb?: () => void): void;
  close(cb?: (err?: Error) => void): void;
}

export interface ActiveLeaseHandle {
  planId: string;
  leaseId: string;
  fencingToken: number;
  leaseExpiresAt: string;
}

export class IndependentSafetySupervisor {
  private status: SafetySupervisorLifecycleStatusV1 = 'INITIALIZING';
  private readonly startedAt: string;
  private readonly heldLeases = new Map<string, ActiveLeaseHandle>();
  private readonly planSummaries = new Map<string, PlanSupervisionSummaryV1>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconciliationTimer: ReturnType<typeof setInterval> | null = null;
  private healthServer: MinimalHttpServer | null = null;
  private isReconciling = false;
  private killSwitchActive = false;
  private killSwitchReason?: string;
  private lastError?: string;

  private readonly metrics: SafetySupervisorMetricsV1 = {
    reconciliationCyclesCompleted: 0,
    heartbeatsCompleted: 0,
    plansDiscovered: 0,
    activeLeasesHeld: 0,
    unprotectedExposuresDetected: 0,
    emergencyClosesExecuted: 0,
    orphanedOrdersCleaned: 0,
    fencingRejectionsObserved: 0,
    lastReconciliationDurationMs: 0,
  };

  constructor(
    private readonly config: SafetySupervisorConfigV1,
    private readonly protectionRepo: PostgresPositionProtectionRepository,
    private readonly safetyStateRepo: PostgresTradingSafetyStateRepository,
    private readonly venueAdapter: BinanceConditionalProtectionAdapter,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.startedAt = this.now();
  }

  /**
   * Start the Independent Safety Supervisor:
   * 1. Check safety kill switch state.
   * 2. Start HTTP health inspection server if configured.
   * 3. Run initial recovery & reconciliation cycle immediately.
   * 4. Start background heartbeat & reconciliation timers.
   */
  async start(): Promise<void> {
    if (this.status === 'RUNNING') return;
    this.status = 'INITIALIZING';

    // 1. Check safety kill state
    try {
      const safety = await this.safetyStateRepo.getSafetyState(this.config.environment);
      this.killSwitchActive = safety.autonomousEntryKillActive;
      this.killSwitchReason = safety.reason;
    } catch (err: unknown) {
      this.lastError = `Initial safety state check failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    // 2. Start HTTP health server if port is configured
    if (this.config.healthPort && this.config.healthPort > 0) {
      this.startHealthServer(this.config.healthPort);
    }

    // 3. Initial reconciliation cycle
    await this.runReconciliationCycle();

    // 4. Start timers
    this.heartbeatTimer = setInterval(() => {
      this.runHeartbeatCycle().catch((err) => {
        this.lastError = `Heartbeat error: ${err instanceof Error ? err.message : String(err)}`;
      });
    }, this.config.heartbeatIntervalMs);

    this.reconciliationTimer = setInterval(() => {
      this.runReconciliationCycle().catch((err) => {
        this.lastError = `Reconciliation error: ${err instanceof Error ? err.message : String(err)}`;
      });
    }, this.config.reconciliationIntervalMs);

    this.status = 'RUNNING';
  }

  /**
   * Graceful shutdown:
   * 1. Set status to DRAINING.
   * 2. Stop timers and health server.
   * 3. Cooperatively release all held leases.
   * 4. Set status to STOPPED.
   */
  async shutdown(): Promise<void> {
    this.status = 'DRAINING';

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }

    // Cooperatively release held leases
    for (const [planId, handle] of this.heldLeases.entries()) {
      try {
        await this.protectionRepo.releaseOwnership({
          protectionPlanId: planId,
          ownerId: this.config.supervisorId,
          leaseId: handle.leaseId,
          fencingToken: handle.fencingToken,
        });
      } catch {
        // Best effort lease release on exit
      }
    }
    this.heldLeases.clear();
    this.metrics.activeLeasesHeld = 0;

    if (this.healthServer) {
      await new Promise<void>((resolve) => {
        this.healthServer?.close(() => resolve());
      });
      this.healthServer = null;
    }

    this.status = 'STOPPED';
  }

  /**
   * Run periodic heartbeat to renew active leases before expiration.
   */
  async runHeartbeatCycle(): Promise<void> {
    const nowIso = this.now();
    for (const [planId, handle] of this.heldLeases.entries()) {
      try {
        const renewed = await this.protectionRepo.renewOwnership({
          protectionPlanId: planId,
          ownerId: this.config.supervisorId,
          leaseId: handle.leaseId,
          fencingToken: handle.fencingToken,
          leaseDurationMs: this.config.leaseDurationMs,
        });
        handle.leaseExpiresAt = renewed.leaseExpiresAt;
      } catch (err: unknown) {
        this.metrics.fencingRejectionsObserved += 1;
        this.heldLeases.delete(planId);
        this.lastError = `Failed to renew lease for ${planId}: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    this.metrics.heartbeatsCompleted += 1;
    this.metrics.lastHeartbeatAt = nowIso;
    this.metrics.activeLeasesHeld = this.heldLeases.size;
  }

  /**
   * Full reconciliation loop:
   * 1. Query active plans from PostgreSQL.
   * 2. Acquire or renew leased ownership for each plan.
   * 3. Fetch live venue positions and open algo protection orders.
   * 4. Reconcile state & execute emergency actions if unprotected.
   * 5. Record updated state in PostgreSQL under verified fencing token.
   */
  async runReconciliationCycle(): Promise<SupervisorReconciliationCycleResultV1> {
    if (this.isReconciling) {
      return {
        timestamp: this.now(),
        plansEvaluated: 0,
        unprotectedDetected: 0,
        emergencyClosesTriggered: 0,
        orphansCancelled: 0,
        reconstructedPlans: Array.from(this.planSummaries.values()),
      };
    }

    this.isReconciling = true;
    const startTime = Date.now();
    const cycleTimestamp = this.now();

    let plansEvaluated = 0;
    let unprotectedDetected = 0;
    let emergencyClosesTriggered = 0;
    let orphansCancelled = 0;
    const reconstructedSummaries: PlanSupervisionSummaryV1[] = [];

    try {
      // Refresh safety kill switch state
      const safety = await this.safetyStateRepo.getSafetyState(this.config.environment);
      this.killSwitchActive = safety.autonomousEntryKillActive;
      this.killSwitchReason = safety.reason;

      // Fetch active plans from database
      const activePlans = await this.protectionRepo.getActivePlans(
        this.config.environment,
        this.config.provider,
      );
      this.metrics.plansDiscovered = activePlans.length;

      // Fetch live venue positions
      const livePositions = await this.venueAdapter.getPositionRisk();

      for (const plan of activePlans) {
        plansEvaluated += 1;
        let leaseHandle = this.heldLeases.get(plan.id);

        // Acquire lease if not already held
        if (!leaseHandle) {
          try {
            const lease = await this.protectionRepo.acquireOwnership({
              protectionPlanId: plan.id,
              ownerId: this.config.supervisorId,
              ownerType: 'SAFETY_SUPERVISOR',
              leaseDurationMs: this.config.leaseDurationMs,
            });
            leaseHandle = {
              planId: plan.id,
              leaseId: lease.leaseId,
              fencingToken: lease.fencingToken,
              leaseExpiresAt: lease.leaseExpiresAt,
            };
            this.heldLeases.set(plan.id, leaseHandle);
          } catch (err: unknown) {
            this.metrics.fencingRejectionsObserved += 1;
            this.lastError = `Lease acquisition conflict for plan ${plan.id}: ${err instanceof Error ? err.message : String(err)}`;
            continue;
          }
        }

        // Fetch active venue algo orders for instrument
        const liveAlgoOrders = await this.venueAdapter.getOpenProtectionOrders(plan.instrument);

        // Find live position
        const matchedPosition = livePositions.find(
          (p: BinancePositionRiskItemV1) =>
            p.symbol.toUpperCase() === plan.instrument.toUpperCase() &&
            Number(p.positionAmt) !== 0,
        );
        const positionAmt = matchedPosition ? matchedPosition.positionAmt : '0.0000';
        const isFlat = !matchedPosition || Number(matchedPosition.positionAmt) === 0;

        let classification: ProtectionRecoveryClassificationV1 = 'POSITION_STATE_UNKNOWN';
        let targetState: TradeProtectionLifecycleStateV1 = plan.lifecycleState;
        let isFullyArmed = false;
        let emergencyCloseRequired = false;

        if (isFlat) {
          classification = 'FLAT_CONFIRMED';
          targetState = 'TERMINAL_CLOSED';
          isFullyArmed = false;

          // Clean up orphaned algo orders
          for (const algo of liveAlgoOrders) {
            try {
              await this.venueAdapter.cancelProtectionOrder(
                plan.instrument,
                algo.clientProtectionOrderId,
                algo.providerProtectionOrderId,
              );
              orphansCancelled += 1;
              this.metrics.orphanedOrdersCleaned += 1;
            } catch {
              // Best effort orphan cleanup
            }
          }
        } else {
          // Position exists on venue
          const matchingRule = plan.rules.find(
            (r) => r.canonicalStatus === 'RECONCILED_ACTIVE' || r.canonicalStatus === 'SUBMITTED',
          );
          const activeAlgo = liveAlgoOrders.find(
            (a: ProtectionReconciliationResultV1) =>
              (matchingRule?.providerAlgoId && a.providerProtectionOrderId === matchingRule.providerAlgoId) ||
              (matchingRule?.providerClientAlgoId && a.clientProtectionOrderId === matchingRule.providerClientAlgoId),
          );

          if (activeAlgo) {
            classification = 'PROTECTED_POSITION_CONFIRMED';
            targetState = 'TRADE_FULLY_ARMED';
            isFullyArmed = true;
          } else if (liveAlgoOrders.length > 0 && !matchingRule) {
            classification = 'PROTECTION_ORPHANED';
            targetState = 'UNPROTECTED_EXPOSURE';
            isFullyArmed = false;
            emergencyCloseRequired = true;
          } else {
            classification = 'POSITION_UNPROTECTED';
            targetState = 'UNPROTECTED_EXPOSURE';
            isFullyArmed = false;
            emergencyCloseRequired = true;
          }

          if (emergencyCloseRequired) {
            unprotectedDetected += 1;
            this.metrics.unprotectedExposuresDetected += 1;

            if (!this.config.dryRun) {
              const cmd: EmergencyCloseCommandV1 = {
                commandId: `cmd_emg_sup_${Date.now().toString(36)}`,
                symbol: plan.instrument,
                market: plan.instrument,
                providerId: plan.provider,
                positionSide: plan.positionSide,
                positionMode: plan.positionMode,
                quantity: Math.abs(Number(positionAmt)).toString(),
                executionMode: 'CLOSE_ALL',
                reason: `Supervisor detected ${classification}. Immediate liquidation mandated.`,
                initiatedBy: 'safety-supervisor',
                createdAt: cycleTimestamp,
              };

              const res = await this.venueAdapter.executeEmergencyClose(cmd);
              if (res.success) {
                targetState = 'EMERGENCY_RESOLVED';
                emergencyClosesTriggered += 1;
                this.metrics.emergencyClosesExecuted += 1;
              } else {
                targetState = 'UNPROTECTED_EXPOSURE';
                this.lastError = `Emergency close failed for ${plan.id}: ${res.error}`;
              }
            }
          }
        }

        // Persist CAS state change if needed
        if (targetState !== plan.lifecycleState) {
          try {
            await this.protectionRepo.transitionPlanStateCas({
              protectionPlanId: plan.id,
              expectedState: plan.lifecycleState,
              targetState,
              expectedVersion: plan.version,
              fencingToken: leaseHandle.fencingToken,
              ownerId: this.config.supervisorId,
              unprotectedReason: emergencyCloseRequired ? `Supervisor classified: ${classification}` : undefined,
              lastReconciledAt: cycleTimestamp,
            });
          } catch (err: unknown) {
            this.lastError = `CAS transition failed for ${plan.id}: ${err instanceof Error ? err.message : String(err)}`;
          }
        }

        const summary: PlanSupervisionSummaryV1 = {
          planId: plan.id,
          instrument: plan.instrument,
          lifecycleState: targetState,
          isFullyArmed,
          fencingToken: leaseHandle.fencingToken,
          leaseExpiresAt: leaseHandle.leaseExpiresAt,
          classification,
          venuePositionAmt: positionAmt,
          activeProtectionAlgoIds: liveAlgoOrders.map((o) => o.providerProtectionOrderId ?? o.clientProtectionOrderId),
          lastReconciledAt: cycleTimestamp,
        };
        this.planSummaries.set(plan.id, summary);
        reconstructedSummaries.push(summary);
      }
    } catch (err: unknown) {
      this.lastError = `Reconciliation loop error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.isReconciling = false;
      this.metrics.reconciliationCyclesCompleted += 1;
      this.metrics.lastReconciliationDurationMs = Date.now() - startTime;
      this.metrics.lastReconciliationAt = cycleTimestamp;
      this.metrics.activeLeasesHeld = this.heldLeases.size;
    }

    return {
      timestamp: cycleTimestamp,
      plansEvaluated,
      unprotectedDetected,
      emergencyClosesTriggered,
      orphansCancelled,
      reconstructedPlans: reconstructedSummaries,
    };
  }

  /**
   * Generate an observable health snapshot for status reporting.
   */
  getHealthSnapshot(): SafetySupervisorHealthSnapshotV1 {
    const startedMs = new Date(this.startedAt).getTime();
    const uptimeSeconds = Math.floor((Date.now() - startedMs) / 1000);
    const proc = (globalThis as unknown as { process?: { pid?: number } }).process;
    const pid = proc?.pid ?? 0;

    return {
      supervisorId: this.config.supervisorId,
      pid,
      status: this.status,
      environment: this.config.environment,
      provider: this.config.provider,
      uptimeSeconds,
      startedAt: this.startedAt,
      timestamp: this.now(),
      killSwitchActive: this.killSwitchActive,
      killSwitchReason: this.killSwitchReason,
      metrics: { ...this.metrics },
      activeSupervisedPlans: Array.from(this.planSummaries.values()),
      lastError: this.lastError,
    };
  }

  private startHealthServer(port: number): void {
    try {
      const httpModuleSpecifier = 'node:http';
      import(httpModuleSpecifier).then((httpModule: any) => {
        const server = httpModule.createServer((req: any, res: any) => {
          if (req.url === '/health' || req.url === '/status') {
            const snapshot = this.getHealthSnapshot();
            const statusCode = snapshot.status === 'RUNNING' && !snapshot.killSwitchActive ? 200 : 503;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(snapshot, null, 2));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found' }));
          }
        });

        server.listen(port, () => {
          // Listening
        });
        this.healthServer = server;
      }).catch(() => {});
    } catch {
      // Best effort health server start
    }
  }
}
