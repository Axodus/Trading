import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IndependentSafetySupervisor,
  BinanceConditionalProtectionAdapter,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

class MockQueryClient {
  constructor() {
    this.plans = new Map();
    this.rules = new Map();
    this.ownership = new Map();
    this.safetyState = new Map();
  }

  async query(sql, params = []) {
    const s = sql.trim();

    // 1. trading_safety_state
    if (s.startsWith('SELECT * FROM trading_safety_state WHERE environment = $1')) {
      const env = params[0];
      const state = this.safetyState.get(env);
      return { rows: state ? [state] : [] };
    }

    // 2. trading_position_protection_plans active list
    if (s.includes('FROM trading_position_protection_plans') && s.includes('lifecycle_state NOT IN')) {
      const env = params[0];
      const prov = params[1];
      const activeRows = Array.from(this.plans.values()).filter(
        (p) => p.environment === env && p.provider === prov && !['FLAT', 'CLOSED', 'TERMINAL_CLOSED'].includes(p.lifecycle_state),
      );
      return { rows: activeRows.map((r) => ({ id: r.id })) };
    }

    // 3. trading_position_protection_plans single get
    if (s.startsWith('SELECT * FROM trading_position_protection_plans WHERE id = $1')) {
      const plan = this.plans.get(params[0]);
      return { rows: plan ? [plan] : [] };
    }

    // 4. trading_position_protection_rules list
    if (s.includes('FROM trading_position_protection_rules WHERE protection_plan_id = $1')) {
      const rules = Array.from(this.rules.values()).filter((r) => r.protection_plan_id === params[0]);
      return { rows: rules };
    }

    // 5. trading_position_protection_ownership single get
    if (s.includes('FROM trading_position_protection_ownership WHERE protection_plan_id = $1')) {
      const o = this.ownership.get(params[0]);
      return { rows: o ? [o] : [] };
    }

    // 6. insert / update ownership
    if (s.includes('INSERT INTO trading_position_protection_ownership')) {
      const record = {
        protection_plan_id: params[0],
        owner_id: params[1],
        owner_type: params[2],
        lease_id: params[3],
        fencing_token: Number(params[4]),
        acquired_at: params[5],
        lease_expires_at: params[6],
        last_heartbeat_at: params[5],
        status: params[7] ?? 'ACTIVE',
        version: 1,
        updated_at: params[5],
      };
      this.ownership.set(record.protection_plan_id, record);
      return { rows: [record], rowCount: 1 };
    }

    if (s.includes('UPDATE trading_position_protection_ownership SET')) {
      const planId = params[params.length - 1]; // or second to last
      const existing = this.ownership.get(planId) ?? Array.from(this.ownership.values()).find((o) => o.protection_plan_id === params[2] || o.protection_plan_id === params[6]);
      if (existing) {
        if (s.includes("status = 'RELEASED'")) {
          existing.status = 'RELEASED';
        } else {
          existing.lease_expires_at = params[0] ?? existing.lease_expires_at;
          existing.status = 'ACTIVE';
          existing.version += 1;
        }
        return { rows: [existing], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 7. CAS transition plan state
    if (s.includes('UPDATE trading_position_protection_plans SET')) {
      const targetState = params[0];
      const unprotectedReason = params[1];
      const planId = params[4];
      const expectedVersion = Number(params[5]);
      const expectedStates = params[6];

      const plan = this.plans.get(planId);
      if (plan && plan.version === expectedVersion && expectedStates.includes(plan.lifecycle_state)) {
        plan.lifecycle_state = targetState;
        plan.unprotected_reason = unprotectedReason;
        plan.version += 1;
        plan.updated_at = new Date().toISOString();
        return { rows: [plan], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    return { rows: [] };
  }
}

function createMockAdapter(venueState = {}) {
  const calls = {
    positionRisk: 0,
    openAlgos: 0,
    cancelOrder: [],
    emergencyClose: [],
  };

  return {
    calls,
    getCapabilitySnapshot() {
      return {
        providerId: 'binance-perpetual-futures',
        environment: 'testnet',
        supportsCloseAll: true,
        supportsQuantityBounded: true,
        supportsStopMarket: true,
        supportsTakeProfitMarket: true,
        supportsTrailingStop: true,
        supportsMarkPriceTrigger: true,
        supportsPriceProtection: true,
        supportedPositionModes: ['ONE_WAY', 'HEDGE'],
        timestamp: new Date().toISOString(),
      };
    },
    async getPositionRisk(symbol) {
      calls.positionRisk += 1;
      return venueState.positions ?? [];
    },
    async getOpenProtectionOrders(symbol) {
      calls.openAlgos += 1;
      return venueState.algoOrders ?? [];
    },
    async cancelProtectionOrder(symbol, clientProtectionOrderId, providerProtectionOrderId) {
      calls.cancelOrder.push({ symbol, clientProtectionOrderId, providerProtectionOrderId });
      return { success: true };
    },
    async executeEmergencyClose(command) {
      calls.emergencyClose.push(command);
      return { success: true, orderId: 'emg_order_889911' };
    },
  };
}

describe('AXODUS-TRADING-IMP-TRINITY-SAFETY-01D: Independent Autonomous Safety Supervisor Tests', () => {
  it('Scenario 1: Startup Recovery & Plan Discovery — acquires exclusive lease with monotonic fencing token', async () => {
    const db = new MockQueryClient();
    db.plans.set('plan_btc_01', {
      id: 'plan_btc_01',
      environment: 'testnet',
      provider: 'binance-perpetual-futures',
      instrument: 'BTCUSDT',
      position_mode: 'ONE_WAY',
      position_side: 'LONG',
      execution_intent_id: 'intent_btc_01',
      confirmed_exposure_quantity: '0.0050',
      entry_reference_price: '85000.0',
      lifecycle_state: 'TRADE_FULLY_ARMED',
      semantic_fingerprint: 'fp_01',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    db.rules.set('rule_btc_01', {
      id: 'rule_btc_01',
      protection_plan_id: 'plan_btc_01',
      generation: 1,
      rule_type: 'HARD_STOP',
      execution_mode: 'QUANTITY_BOUNDED',
      trigger_price: '84000.0',
      trigger_price_source: 'CONTRACT_PRICE',
      enable_price_protection: true,
      protected_quantity: '0.0050',
      canonical_status: 'RECONCILED_ACTIVE',
      provider_client_algo_id: 'axd_stp_client_01',
      provider_algo_id: '1000000215672484',
      provider_status: 'NEW',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const venueAdapter = createMockAdapter({
      positions: [{ symbol: 'BTCUSDT', positionAmt: '0.0050', entryPrice: '85000.0' }],
      algoOrders: [
        {
          ruleId: 'rule_btc_01',
          clientProtectionOrderId: 'axd_stp_client_01',
          providerProtectionOrderId: '1000000215672484',
          symbol: 'BTCUSDT',
          state: 'RECONCILED_ACTIVE',
          stopPrice: '84000.0',
        },
      ],
    });

    const supervisor = new IndependentSafetySupervisor(
      {
        supervisorId: 'safety_supervisor_proc_01',
        environment: 'testnet',
        provider: 'binance-perpetual-futures',
        leaseDurationMs: 15000,
        heartbeatIntervalMs: 2000,
        reconciliationIntervalMs: 5000,
        healthPort: 0,
      },
      {
        getActivePlans: async () => [
          {
            id: 'plan_btc_01',
            environment: 'testnet',
            provider: 'binance-perpetual-futures',
            instrument: 'BTCUSDT',
            positionMode: 'ONE_WAY',
            positionSide: 'LONG',
            executionIntentId: 'intent_btc_01',
            confirmedExposureQuantity: '0.0050',
            entryReferencePrice: '85000.0',
            lifecycleState: 'TRADE_FULLY_ARMED',
            version: 1,
            rules: [
              {
                id: 'rule_btc_01',
                protectionPlanId: 'plan_btc_01',
                generation: 1,
                ruleType: 'HARD_STOP',
                executionMode: 'QUANTITY_BOUNDED',
                triggerPrice: '84000.0',
                triggerPriceSource: 'CONTRACT_PRICE',
                enablePriceProtection: true,
                protectedQuantity: '0.0050',
                canonicalStatus: 'RECONCILED_ACTIVE',
                providerClientAlgoId: 'axd_stp_client_01',
                providerAlgoId: '1000000215672484',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            semanticFingerprint: 'fp_01',
            correlationId: 'corr_01',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        acquireOwnership: async (params) => ({
          protectionPlanId: params.protectionPlanId,
          ownerId: params.ownerId,
          ownerType: params.ownerType,
          leaseId: 'lease_mock_01',
          fencingToken: 1,
          acquiredAt: new Date().toISOString(),
          leaseExpiresAt: new Date(Date.now() + params.leaseDurationMs).toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          status: 'ACTIVE',
          version: 1,
          updatedAt: new Date().toISOString(),
        }),
        renewOwnership: async (params) => ({
          protectionPlanId: params.protectionPlanId,
          ownerId: params.ownerId,
          ownerType: 'SAFETY_SUPERVISOR',
          leaseId: params.leaseId,
          fencingToken: params.fencingToken,
          acquiredAt: new Date().toISOString(),
          leaseExpiresAt: new Date(Date.now() + params.leaseDurationMs).toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          status: 'ACTIVE',
          version: 2,
          updatedAt: new Date().toISOString(),
        }),
        releaseOwnership: async () => {},
        transitionPlanStateCas: async () => ({}),
      },
      {
        getSafetyState: async () => ({
          environment: 'testnet',
          autonomousEntryKillActive: false,
          generation: 1,
          updatedAt: new Date().toISOString(),
        }),
      },
      venueAdapter,
    );

    const result = await supervisor.runReconciliationCycle();

    assert.equal(result.plansEvaluated, 1);
    assert.equal(result.unprotectedDetected, 0);
    assert.equal(result.emergencyClosesTriggered, 0);
    assert.equal(result.reconstructedPlans[0].isFullyArmed, true);
    assert.equal(result.reconstructedPlans[0].classification, 'PROTECTED_POSITION_CONFIRMED');

    const health = supervisor.getHealthSnapshot();
    assert.equal(health.supervisorId, 'safety_supervisor_proc_01');
    assert.equal(health.killSwitchActive, false);
    assert.equal(health.metrics.reconciliationCyclesCompleted, 1);
  });

  it('Scenario 2: Unprotected Exposure Detection & Emergency Close Trigger — fail-closed handling', async () => {
    let capturedCasTransition = null;
    const venueAdapter = createMockAdapter({
      positions: [{ symbol: 'ETHUSDT', positionAmt: '0.05', entryPrice: '2300.0' }],
      algoOrders: [], // NO active algo orders on venue!
    });

    const supervisor = new IndependentSafetySupervisor(
      {
        supervisorId: 'safety_supervisor_proc_02',
        environment: 'testnet',
        provider: 'binance-perpetual-futures',
        leaseDurationMs: 15000,
        heartbeatIntervalMs: 2000,
        reconciliationIntervalMs: 5000,
        dryRun: false,
      },
      {
        getActivePlans: async () => [
          {
            id: 'plan_eth_01',
            environment: 'testnet',
            provider: 'binance-perpetual-futures',
            instrument: 'ETHUSDT',
            positionMode: 'ONE_WAY',
            positionSide: 'LONG',
            executionIntentId: 'intent_eth_01',
            confirmedExposureQuantity: '0.05',
            entryReferencePrice: '2300.0',
            lifecycleState: 'EXPOSURE_CONFIRMED',
            version: 1,
            rules: [],
            semanticFingerprint: 'fp_eth',
            correlationId: 'corr_eth',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        acquireOwnership: async (params) => ({
          protectionPlanId: params.protectionPlanId,
          ownerId: params.ownerId,
          ownerType: 'SAFETY_SUPERVISOR',
          leaseId: 'lease_eth_01',
          fencingToken: 4,
          acquiredAt: new Date().toISOString(),
          leaseExpiresAt: new Date(Date.now() + params.leaseDurationMs).toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          status: 'ACTIVE',
          version: 1,
          updatedAt: new Date().toISOString(),
        }),
        renewOwnership: async () => ({}),
        releaseOwnership: async () => {},
        transitionPlanStateCas: async (params) => {
          capturedCasTransition = params;
          return {};
        },
      },
      {
        getSafetyState: async () => ({
          environment: 'testnet',
          autonomousEntryKillActive: false,
          generation: 1,
          updatedAt: new Date().toISOString(),
        }),
      },
      venueAdapter,
    );

    const result = await supervisor.runReconciliationCycle();

    assert.equal(result.unprotectedDetected, 1);
    assert.equal(result.emergencyClosesTriggered, 1);
    assert.equal(venueAdapter.calls.emergencyClose.length, 1);
    assert.equal(venueAdapter.calls.emergencyClose[0].symbol, 'ETHUSDT');
    assert.equal(venueAdapter.calls.emergencyClose[0].quantity, '0.05');
    assert.equal(capturedCasTransition?.targetState, 'EMERGENCY_RESOLVED');
  });

  it('Scenario 3: Flat Position Invariant & Orphan Algo Cleanup', async () => {
    let capturedCasTransition = null;
    const venueAdapter = createMockAdapter({
      positions: [{ symbol: 'SOLUSDT', positionAmt: '0.00', entryPrice: '0.0' }], // Flat position
      algoOrders: [
        {
          ruleId: 'rule_sol_orphan',
          clientProtectionOrderId: 'axd_stp_sol_orphan',
          providerProtectionOrderId: '9900112233',
          symbol: 'SOLUSDT',
          state: 'RECONCILED_ACTIVE',
          stopPrice: '120.0',
        },
      ],
    });

    const supervisor = new IndependentSafetySupervisor(
      {
        supervisorId: 'safety_supervisor_proc_03',
        environment: 'testnet',
        provider: 'binance-perpetual-futures',
        leaseDurationMs: 15000,
        heartbeatIntervalMs: 2000,
        reconciliationIntervalMs: 5000,
      },
      {
        getActivePlans: async () => [
          {
            id: 'plan_sol_01',
            environment: 'testnet',
            provider: 'binance-perpetual-futures',
            instrument: 'SOLUSDT',
            positionMode: 'ONE_WAY',
            positionSide: 'LONG',
            executionIntentId: 'intent_sol_01',
            confirmedExposureQuantity: '0.1',
            entryReferencePrice: '130.0',
            lifecycleState: 'TRADE_FULLY_ARMED',
            version: 2,
            rules: [
              {
                id: 'rule_sol_orphan',
                protectionPlanId: 'plan_sol_01',
                generation: 1,
                ruleType: 'HARD_STOP',
                executionMode: 'CLOSE_ALL',
                triggerPrice: '120.0',
                triggerPriceSource: 'CONTRACT_PRICE',
                enablePriceProtection: true,
                canonicalStatus: 'RECONCILED_ACTIVE',
                providerClientAlgoId: 'axd_stp_sol_orphan',
                providerAlgoId: '9900112233',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            semanticFingerprint: 'fp_sol',
            correlationId: 'corr_sol',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        acquireOwnership: async (params) => ({
          protectionPlanId: params.protectionPlanId,
          ownerId: params.ownerId,
          ownerType: 'SAFETY_SUPERVISOR',
          leaseId: 'lease_sol_01',
          fencingToken: 7,
          acquiredAt: new Date().toISOString(),
          leaseExpiresAt: new Date(Date.now() + params.leaseDurationMs).toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          status: 'ACTIVE',
          version: 1,
          updatedAt: new Date().toISOString(),
        }),
        renewOwnership: async () => ({}),
        releaseOwnership: async () => {},
        transitionPlanStateCas: async (params) => {
          capturedCasTransition = params;
          return {};
        },
      },
      {
        getSafetyState: async () => ({
          environment: 'testnet',
          autonomousEntryKillActive: false,
          generation: 1,
          updatedAt: new Date().toISOString(),
        }),
      },
      venueAdapter,
    );

    const result = await supervisor.runReconciliationCycle();

    assert.equal(result.orphansCancelled, 1);
    assert.equal(venueAdapter.calls.cancelOrder.length, 1);
    assert.equal(venueAdapter.calls.cancelOrder[0].symbol, 'SOLUSDT');
    assert.equal(venueAdapter.calls.cancelOrder[0].providerProtectionOrderId, '9900112233');
    assert.equal(capturedCasTransition?.targetState, 'TERMINAL_CLOSED');
  });

  it('Scenario 4: Graceful Drain & Cooperative Lease Release on Shutdown', async () => {
    let releaseCalledWith = null;
    const venueAdapter = createMockAdapter({ positions: [], algoOrders: [] });

    const supervisor = new IndependentSafetySupervisor(
      {
        supervisorId: 'safety_supervisor_drain_test',
        environment: 'testnet',
        provider: 'binance-perpetual-futures',
        leaseDurationMs: 15000,
        heartbeatIntervalMs: 1000,
        reconciliationIntervalMs: 2000,
      },
      {
        getActivePlans: async () => [
          {
            id: 'plan_drain_01',
            environment: 'testnet',
            provider: 'binance-perpetual-futures',
            instrument: 'BNBUSDT',
            positionMode: 'ONE_WAY',
            positionSide: 'SHORT',
            executionIntentId: 'intent_drain_01',
            confirmedExposureQuantity: '0.0',
            entryReferencePrice: '580.0',
            lifecycleState: 'EXPOSURE_CONFIRMED',
            version: 1,
            rules: [],
            semanticFingerprint: 'fp_drain',
            correlationId: 'corr_drain',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        acquireOwnership: async (params) => ({
          protectionPlanId: params.protectionPlanId,
          ownerId: params.ownerId,
          ownerType: 'SAFETY_SUPERVISOR',
          leaseId: 'lease_drain_01',
          fencingToken: 12,
          acquiredAt: new Date().toISOString(),
          leaseExpiresAt: new Date(Date.now() + params.leaseDurationMs).toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          status: 'ACTIVE',
          version: 1,
          updatedAt: new Date().toISOString(),
        }),
        renewOwnership: async () => ({}),
        releaseOwnership: async (params) => {
          releaseCalledWith = params;
        },
        transitionPlanStateCas: async () => ({}),
      },
      {
        getSafetyState: async () => ({
          environment: 'testnet',
          autonomousEntryKillActive: false,
          generation: 1,
          updatedAt: new Date().toISOString(),
        }),
      },
      venueAdapter,
    );

    await supervisor.runReconciliationCycle();
    assert.equal(supervisor.getHealthSnapshot().metrics.activeLeasesHeld, 1);

    await supervisor.shutdown();

    assert.equal(supervisor.getHealthSnapshot().status, 'STOPPED');
    assert.equal(supervisor.getHealthSnapshot().metrics.activeLeasesHeld, 0);
    assert.equal(releaseCalledWith?.protectionPlanId, 'plan_drain_01');
    assert.equal(releaseCalledWith?.fencingToken, 12);
  });
});
