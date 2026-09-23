import type {
  TradeProtectionLifecycleStateV1,
  EmergencyCloseCommandV1,
  ProtectionReconciliationResultV1,
} from './PositionProtectionContracts.js';
import {
  type ProtectionRecoveryClassificationV1,
} from './DurablePositionProtectionContracts.js';
import type { PostgresPositionProtectionRepository } from './PostgresPositionProtectionRepository.js';
import type { PostgresTradingSafetyStateRepository } from './PostgresTradingSafetyStateRepository.js';
import type {
  BinanceConditionalProtectionAdapter,
  BinancePositionRiskItemV1,
} from './BinanceConditionalProtectionAdapter.js';

export interface PositionProtectionRecoveryParams {
  environment: string;
  provider: string;
  ownerId: string;
  leaseDurationMs: number;
}

export interface ReconstructedProtectionStateV1 {
  planId: string;
  environment: string;
  instrument: string;
  lifecycleState: TradeProtectionLifecycleStateV1;
  isFullyArmed: boolean;
  classification: ProtectionRecoveryClassificationV1;
  venuePositions: BinancePositionRiskItemV1[];
  activeVenueProtectionOrders: ProtectionReconciliationResultV1[];
  emergencyCloseRequired: boolean;
  emergencyCloseCommand?: EmergencyCloseCommandV1;
}

export class PositionProtectionRecoveryService {
  constructor(
    private readonly protectionRepo: PostgresPositionProtectionRepository,
    private readonly safetyStateRepo: PostgresTradingSafetyStateRepository,
    private readonly venueAdapter: BinanceConditionalProtectionAdapter,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /**
   * Execute full state recovery for all active protection plans in an environment:
   * 1. Query durable state from PostgreSQL
   * 2. Safely acquire ownership lease with monotonic fencing token
   * 3. Fetch live venue positions and open algo protection orders
   * 4. Reconcile venue vs durable state
   * 5. Reconstruct safe current state and issue emergency close if exposure is unprotected
   */
  async recoverActiveProtectionPlans(
    params: PositionProtectionRecoveryParams,
  ): Promise<ReconstructedProtectionStateV1[]> {
    await this.safetyStateRepo.getSafetyState(params.environment);
    const activePlans = await this.protectionRepo.getActivePlans(params.environment, params.provider);

    const reconstructedStates: ReconstructedProtectionStateV1[] = [];

    // Fetch live venue open positions
    const livePositions = await this.venueAdapter.getPositionRisk();

    for (const plan of activePlans) {
      // Step 1: Acquire exclusive leased ownership
      const lease = await this.protectionRepo.acquireOwnership({
        protectionPlanId: plan.id,
        ownerId: params.ownerId,
        ownerType: 'RECOVERY_WORKER',
        leaseDurationMs: params.leaseDurationMs,
      });

      // Step 2: Fetch open protection orders for this symbol
      const liveAlgoOrders = await this.venueAdapter.getOpenProtectionOrders(plan.instrument);

      // Step 3: Classify venue position for this instrument
      const matchedPosition = livePositions.find(
        (p: BinancePositionRiskItemV1) =>
          p.symbol.toUpperCase() === plan.instrument.toUpperCase() &&
          Number(p.positionAmt) !== 0,
      );
      const positionQuantity = matchedPosition ? matchedPosition.positionAmt : '0.0000';
      const isFlatOnVenue = !matchedPosition || Number(matchedPosition.positionAmt) === 0;

      let classification: ProtectionRecoveryClassificationV1 = 'POSITION_STATE_UNKNOWN';
      let emergencyCloseRequired = false;
      let emergencyCommand: EmergencyCloseCommandV1 | undefined = undefined;
      let targetLifecycleState: TradeProtectionLifecycleStateV1 = plan.lifecycleState;
      let isFullyArmed = false;

      if (isFlatOnVenue) {
        // Flat confirmed on venue
        classification = 'FLAT_CONFIRMED';
        targetLifecycleState = 'TERMINAL_CLOSED';
        isFullyArmed = false;

        // Clean up any dangling/orphaned algo orders on venue
        for (const algo of liveAlgoOrders) {
          try {
            await this.venueAdapter.cancelProtectionOrder(plan.instrument, algo.clientProtectionOrderId, algo.providerProtectionOrderId);
          } catch {
            // Best effort cancellation for flat state
          }
        }
      } else {
        // Venue has open position. Check if protection orders are active and matching.
        const matchingRule = plan.rules.find((r) => r.canonicalStatus === 'RECONCILED_ACTIVE' || r.canonicalStatus === 'SUBMITTED');
        const activeMatchingAlgo = liveAlgoOrders.find(
          (a: ProtectionReconciliationResultV1) =>
            (matchingRule?.providerAlgoId && a.providerProtectionOrderId === matchingRule.providerAlgoId) ||
            (matchingRule?.providerClientAlgoId && a.clientProtectionOrderId === matchingRule.providerClientAlgoId),
        );

        if (activeMatchingAlgo) {
          classification = 'PROTECTED_POSITION_CONFIRMED';
          targetLifecycleState = 'TRADE_FULLY_ARMED';
          isFullyArmed = true;
        } else if (liveAlgoOrders.length > 0 && !matchingRule) {
          classification = 'PROTECTION_ORPHANED';
          targetLifecycleState = 'UNPROTECTED_EXPOSURE';
          isFullyArmed = false;
          emergencyCloseRequired = true;
        } else {
          classification = 'POSITION_UNPROTECTED';
          targetLifecycleState = 'UNPROTECTED_EXPOSURE';
          isFullyArmed = false;
          emergencyCloseRequired = true;
        }

        if (emergencyCloseRequired) {
          emergencyCommand = {
            commandId: `cmd_emg_rec_${Date.now().toString(36)}`,
            symbol: plan.instrument,
            market: plan.instrument,
            providerId: plan.provider,
            positionSide: plan.positionSide,
            positionMode: plan.positionMode,
            quantity: Math.abs(Number(positionQuantity)).toString(),
            executionMode: 'CLOSE_ALL',
            reason: `Recovery classified as ${classification}. Venue position unhedged/unprotected without valid active stop order.`,
            initiatedBy: 'safety-supervisor',
            createdAt: this.now(),
          };
        }
      }

      // Step 4: CAS update PostgreSQL durable state under acquired fencing token
      if (targetLifecycleState !== plan.lifecycleState) {
        await this.protectionRepo.transitionPlanStateCas({
          protectionPlanId: plan.id,
          expectedState: plan.lifecycleState,
          targetState: targetLifecycleState,
          expectedVersion: plan.version,
          fencingToken: lease.fencingToken,
          ownerId: params.ownerId,
          unprotectedReason: emergencyCloseRequired ? `Recovery detected ${classification}` : undefined,
          lastReconciledAt: this.now(),
        });
      }

      // Step 5: Release lease cleanly
      await this.protectionRepo.releaseOwnership({
        protectionPlanId: plan.id,
        ownerId: params.ownerId,
        leaseId: lease.leaseId,
        fencingToken: lease.fencingToken,
      });

      reconstructedStates.push({
        planId: plan.id,
        environment: plan.environment,
        instrument: plan.instrument,
        lifecycleState: targetLifecycleState,
        isFullyArmed,
        classification,
        venuePositions: livePositions.filter((p: BinancePositionRiskItemV1) => p.symbol.toUpperCase() === plan.instrument.toUpperCase()),
        activeVenueProtectionOrders: liveAlgoOrders,
        emergencyCloseRequired,
        emergencyCloseCommand: emergencyCommand,
      });
    }

    return reconstructedStates;
  }
}
