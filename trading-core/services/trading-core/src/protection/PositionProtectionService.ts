import type {
  PositionProtectionPlanV1,
  ProtectionRuleV1,
  TradeProtectionLifecycleStateV1,
  EmergencyCloseCommandV1,
  PositionSideModeV1,
  TriggerPriceSourceV1,
  ProtectionExecutionModeV1,
} from './PositionProtectionContracts.js';
import type { BinanceConditionalProtectionAdapter } from './BinanceConditionalProtectionAdapter.js';

export interface ArmProtectionParams {
  planId?: string;
  symbol: string;
  market?: string;
  providerId?: string;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  positionMode: PositionSideModeV1;
  confirmedExposureQuantity: string;
  stopPrice: string;
  takeProfitPrice?: string;
  executionMode?: ProtectionExecutionModeV1;
  triggerPriceSource?: TriggerPriceSourceV1;
  enablePriceProtection?: boolean;
}

export interface ArmProtectionResult {
  plan: PositionProtectionPlanV1;
  status: TradeProtectionLifecycleStateV1;
  isFullyArmed: boolean;
  isUnprotected: boolean;
  unprotectedReason?: string;
  activeRule?: ProtectionRuleV1;
  emergencyCommand?: EmergencyCloseCommandV1;
}

export class PositionProtectionService {
  private readonly plans = new Map<string, PositionProtectionPlanV1>();

  constructor(
    private readonly adapter: BinanceConditionalProtectionAdapter,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async armProtection(params: ArmProtectionParams): Promise<ArmProtectionResult> {
    const planId = params.planId ?? `axd_pln_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
    const confirmedQtyNum = Number(params.confirmedExposureQuantity);

    // Rule: Idempotency — If plan already exists and is fully armed, return existing plan without duplicate mutation
    const existingPlan = this.plans.get(planId);
    if (
      existingPlan &&
      existingPlan.tradeState === 'TRADE_FULLY_ARMED' &&
      existingPlan.confirmedExposureQuantity === params.confirmedExposureQuantity
    ) {
      const activeRule = existingPlan.rules.find((r) => r.state === 'RECONCILED_ACTIVE' || r.state === 'SUBMITTED');
      return {
        plan: existingPlan,
        status: 'TRADE_FULLY_ARMED',
        isFullyArmed: true,
        isUnprotected: false,
        activeRule,
      };
    }

    // Rule: If position is flat (quantity 0), do not establish stale protection
    if (isNaN(confirmedQtyNum) || confirmedQtyNum <= 0) {
      const flatPlan: PositionProtectionPlanV1 = {
        planId,
        symbol: params.symbol.toUpperCase(),
        market: params.market ?? params.symbol.toUpperCase(),
        providerId: params.providerId ?? 'binance-perpetual-futures',
        positionSide: params.positionSide,
        positionMode: params.positionMode,
        confirmedExposureQuantity: '0',
        rules: [],
        tradeState: 'TERMINAL_CLOSED',
        unprotectedReason: 'Position is flat (confirmed quantity is zero). Stale protection aborted.',
        createdAt: this.now(),
        updatedAt: this.now(),
      };
      this.plans.set(planId, flatPlan);
      return {
        plan: flatPlan,
        status: 'TERMINAL_CLOSED',
        isFullyArmed: false,
        isUnprotected: false,
        unprotectedReason: flatPlan.unprotectedReason,
      };
    }

    const executionMode = params.executionMode ?? 'QUANTITY_BOUNDED';
    const clientProtectionOrderId = `axd_stp_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;

    const hardStopRule: ProtectionRuleV1 = {
      ruleId: `rule_${clientProtectionOrderId}`,
      ruleType: 'HARD_STOP',
      executionMode,
      triggerPrice: params.stopPrice,
      triggerPriceSource: params.triggerPriceSource ?? 'CONTRACT_PRICE',
      enablePriceProtection: params.enablePriceProtection ?? true,
      quantity: executionMode === 'QUANTITY_BOUNDED' ? params.confirmedExposureQuantity : undefined,
      clientProtectionOrderId,
      state: 'PENDING_SUBMISSION',
      createdAt: this.now(),
      updatedAt: this.now(),
    };

    const plan: PositionProtectionPlanV1 = {
      planId,
      symbol: params.symbol.toUpperCase(),
      market: params.market ?? params.symbol.toUpperCase(),
      providerId: params.providerId ?? 'binance-perpetual-futures',
      positionSide: params.positionSide,
      positionMode: params.positionMode,
      confirmedExposureQuantity: params.confirmedExposureQuantity,
      rules: [hardStopRule],
      tradeState: 'EXPOSURE_CONFIRMED',
      createdAt: this.now(),
      updatedAt: this.now(),
    };

    // Transition: PROTECTION_REQUIRED -> PROTECTION_SUBMITTED
    plan.tradeState = 'PROTECTION_SUBMITTED';
    hardStopRule.state = 'SUBMITTED';

    const submissionResult = await this.adapter.submitProtectionRule(hardStopRule, plan);

    if (submissionResult.success && submissionResult.providerProtectionOrderId) {
      hardStopRule.providerProtectionOrderId = submissionResult.providerProtectionOrderId;
      hardStopRule.state = 'SUBMITTED';

      // Transition: PROTECTION_SUBMITTED -> PROTECTION_RECONCILED -> TRADE_FULLY_ARMED
      const reconciliation = await this.adapter.reconcileProtectionRule(
        plan.symbol,
        hardStopRule.clientProtectionOrderId,
        hardStopRule.ruleId,
      );

      if (reconciliation?.state === 'RECONCILED_ACTIVE') {
        hardStopRule.state = 'RECONCILED_ACTIVE';
        plan.tradeState = 'TRADE_FULLY_ARMED';
        plan.updatedAt = this.now();
        this.plans.set(planId, plan);
        const isFullyArmed = plan.tradeState === 'TRADE_FULLY_ARMED';

        return {
          plan,
          status: plan.tradeState,
          isFullyArmed,
          isUnprotected: false,
          activeRule: hardStopRule,
        };
      }
    }

    // If submission failed, timed out, or reconciliation failed:
    // Try lookup by clientProtectionOrderId before giving up to avoid duplicate retry
    const recovered = await this.adapter.reconcileProtectionRule(
      plan.symbol,
      hardStopRule.clientProtectionOrderId,
      hardStopRule.ruleId,
    );

    if (recovered && recovered.state === 'RECONCILED_ACTIVE') {
      hardStopRule.providerProtectionOrderId = recovered.providerProtectionOrderId;
      hardStopRule.state = 'RECONCILED_ACTIVE';
      plan.tradeState = 'TRADE_FULLY_ARMED';
      plan.updatedAt = this.now();
      this.plans.set(planId, plan);

      const isFullyArmed = plan.tradeState === 'TRADE_FULLY_ARMED';
      return {
        plan,
        status: plan.tradeState,
        isFullyArmed,
        isUnprotected: false,
        activeRule: hardStopRule,
      };
    }

    // Transition to UNPROTECTED_EXPOSURE
    plan.tradeState = 'UNPROTECTED_EXPOSURE';
    plan.unprotectedReason = submissionResult.error ?? 'Failed to confirm venue-resident protection';
    hardStopRule.state = submissionResult.state;
    plan.updatedAt = this.now();
    this.plans.set(planId, plan);

    const emergencyCommand: EmergencyCloseCommandV1 = {
      commandId: `axd_emg_cmd_${Date.now().toString(36)}`,
      symbol: plan.symbol,
      market: plan.market,
      providerId: plan.providerId,
      positionSide: plan.positionSide,
      positionMode: plan.positionMode,
      executionMode: 'CLOSE_ALL',
      reason: `UNPROTECTED_EXPOSURE: ${plan.unprotectedReason}`,
      initiatedBy: 'risk-envelope',
      createdAt: this.now(),
    };

    return {
      plan,
      status: 'UNPROTECTED_EXPOSURE',
      isFullyArmed: false,
      isUnprotected: true,
      unprotectedReason: plan.unprotectedReason,
      activeRule: hardStopRule,
      emergencyCommand,
    };
  }

  getPlan(planId: string): PositionProtectionPlanV1 | undefined {
    return this.plans.get(planId);
  }

  async resolveEmergencyClose(planId: string): Promise<{ success: boolean; error?: string }> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Protection plan ${planId} not found`);
    }

    plan.tradeState = 'EMERGENCY_RESOLVING';
    const emergencyCommand: EmergencyCloseCommandV1 = {
      commandId: `axd_emg_cmd_${Date.now().toString(36)}`,
      symbol: plan.symbol,
      market: plan.market,
      providerId: plan.providerId,
      positionSide: plan.positionSide,
      positionMode: plan.positionMode,
      executionMode: 'CLOSE_ALL',
      reason: `EMERGENCY_RESOLUTION for plan ${planId}`,
      initiatedBy: 'safety-supervisor',
      createdAt: this.now(),
    };

    const res = await this.adapter.executeEmergencyClose(emergencyCommand);
    if (res.success) {
      plan.tradeState = 'EMERGENCY_RESOLVED';
      plan.updatedAt = this.now();
      return { success: true };
    } else {
      plan.tradeState = 'UNPROTECTED_EXPOSURE';
      plan.unprotectedReason = `Emergency resolution failed: ${res.error}`;
      plan.updatedAt = this.now();
      return { success: false, error: res.error };
    }
  }
}
