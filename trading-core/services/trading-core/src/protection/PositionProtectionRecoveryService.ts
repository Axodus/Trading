import type {
  PositionProtectionPlanV1,
  ProtectionRuleV1,
  TradeProtectionLifecycleStateV1,
  ProtectionLifecycleStateV1,
  EmergencyCloseCommandV1,
  ProtectionReconciliationResultV1,
} from './PositionProtectionContracts.js';
import {
  type DurablePositionProtectionPlanRecordV1,
  type ProtectionRecoveryClassificationV1,
  type ProtectionRecoverySnapshotV1,
  ProtectionRecoveryStateInvalidError,
} from './DurablePositionProtectionContracts.js';
import type { PostgresPositionProtectionRepository } from './PostgresPositionProtectionRepository.js';
import type { PostgresTradingSafetyStateRepository } from './PostgresTradingSafetyStateRepository.js';
import type { BinanceConditionalProtectionAdapter } from './BinanceConditionalProtectionAdapter.js';

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
  venuePositions: {
    symbol: string;
    positionAmt: string;
    entryPrice: string;
    unRealizedProfit: string;
  }[];
  activeVenueProtectionOrders: {
    algoId: string;
    clientAlgoId: string;
    symbol: string;
    orderType: string;
    triggerPrice: string;
    algoStatus: string;
  }[];
  emergencyCloseRequired: boolean;
  emergencyCloseCommand?: EmergencyCloseCommandV1;
  actionRequiredNote?: string;
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
    const safetyState = await this.safetyStateRepo.getSafetyState(params.environment);
    const activePlans = await this.protectionRepo.getActivePlans(params.environment, params.provider);

    const reconstructedStates: ReconstructedProtectionStateV1[] = [];

    // Fetch live venue open positions and active conditional algo orders
    const livePositions = await this.venueAdapter.fetchOpenPositions();
    const liveAlgoOrders = await this.venueAdapter.fetchOpenAlgoOrders();

    for (const plan of activePlans) {
      // Step 1: Acquire exclusive leased ownership
      const lease = await this.protectionRepo.acquireOwnership({
        protectionPlanId: plan.id,
        ownerId: params.ownerId,
        ownerType: 'RECOVERY_WORKER',
        leaseDurationMs: params.leaseDurationMs,
      });

      // Step 2: Classify venue position for this instrument
      const matchedPosition = livePositions.find(
        (p) => p.symbol.toUpperCase() === plan.instrument.toUpperCase() && Number(p.positionAmt) !== 0,
      );
      const positionQuantity = matchedPosition ? matchedPosition.positionAmt : '0.0000';
      const isFlatOnVenue = !matchedPosition || Number(matchedPosition.positionAmt) === 0;

      // Step 3: Match active venue algo protection orders
      const matchedAlgoOrders = liveAlgoOrders.filter(
        (o) => o.symbol.toUpperCase() === plan.instrument.toUpperCase(),
      );

      let classification: ProtectionRecoveryClassificationV1 = 'POSITION_STATE_UNKNOWN';
      let emergencyCloseRequired = false;
      let emergencyCommand: EmergencyCloseCommandV1 | undefined = undefined;
      let targetLifecycleState: TradeProtectionLifecycleStateV1 = plan.lifecycleState;
      let isFullyArmed = false;

      if (isFlatOnVenue) {
        // Flat confirmed on venue
        classification = 'FLAT_CONFIRMED';
        targetLifecycleState = 'FLAT';
        isFullyArmed = false;

        // Clean up any dangling/orphaned algo orders on venue
        for (const algo of matchedAlgoOrders) {
          try {
            await this.venueAdapter.cancelProtectionOrder(plan.instrument, algo.clientAlgoId, algo.algoId);
          } catch {
            // Best effort cancellation for flat state
          }
        }
      } else {
        // Venue has open position. Check if protection orders are active and matching.
        const matchingRule = plan.rules.find((r) => r.canonicalStatus === 'ACTIVE' || r.canonicalStatus === 'CONFIRMED_LIVE');
        const activeMatchingAlgo = matchedAlgoOrders.find(
          (a) =>
            (matchingRule?.providerAlgoId && a.algoId === matchingRule.providerAlgoId) ||
            (matchingRule?.providerClientAlgoId && a.clientAlgoId === matchingRule.providerClientAlgoId),
        );

        if (activeMatchingAlgo) {
          classification = 'PROTECTED_POSITION_CONFIRMED';
          targetLifecycleState = 'TRADE_FULLY_ARMED';
          isFullyArmed = true;
        } else if (matchedAlgoOrders.length > 0 && !matchingRule) {
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
            environment: plan.environment,
            instrument: plan.instrument,
            positionMode: plan.positionMode,
            closeSide: Number(positionQuantity) > 0 ? 'SELL' : 'BUY',
            quantity: Math.abs(Number(positionQuantity)).toString(),
            reason: `Recovery classified as ${classification}. Venue position unhedged/unprotected without valid active stop order.`,
            executionMode: 'MARKET_IOC',
            triggeredAt: this.now(),
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
        venuePositions: livePositions.filter((p) => p.symbol.toUpperCase() === plan.instrument.toUpperCase()),
        activeVenueProtectionOrders: matchedAlgoOrders,
        emergencyCloseRequired,
        emergencyCloseCommand: emergencyCommand,
      });
    }

    return reconstructedStates;
  }
}
