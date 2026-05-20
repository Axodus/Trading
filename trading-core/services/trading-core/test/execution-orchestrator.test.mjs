import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ExecutionBlockedError,
  ExecutionOrchestrator,
  ExecutionProviderRegistry,
  GovernanceExecutionGuard,
  ProductExecutionGate,
  RiskGateway,
  SimulationProvider,
  TradingEventBus,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function userIntent(overrides = {}) {
  return {
    id: 'intent-user-1',
    correlationId: 'corr-user-1',
    context: {
      executionDomain: 'user',
      userId: 'user-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
    },
    request: {
      requestId: 'request-user-1',
      providerId: 'simulation',
      market: 'BTC-USDT',
      side: 'buy',
      orderType: 'market',
      quantity: '0.01',
    },
    ...overrides,
  };
}

function treasuryIntent(overrides = {}) {
  return {
    id: 'intent-treasury-1',
    correlationId: 'corr-treasury-1',
    context: {
      executionDomain: 'treasury',
      daoId: 'dao-1',
      federationId: 'federation-1',
      providerId: 'simulation',
      strategyId: 'treasury-rebalance',
    },
    request: {
      requestId: 'request-treasury-1',
      providerId: 'simulation',
      market: 'ETH-USDT',
      side: 'sell',
      orderType: 'market',
      quantity: '0.25',
    },
    ...overrides,
  };
}

function createHarness(options = {}) {
  const providers = new ExecutionProviderRegistry();
  const eventBus = new TradingEventBus();
  const simulationProvider = new SimulationProvider({ eventBus, deterministicPrice: '100' });

  if (options.registerProvider ?? true) {
    providers.register(simulationProvider);
  }

  const orchestrator = new ExecutionOrchestrator({
    providers,
    productGate: options.productGate ?? new ProductExecutionGate(options.productApproved ?? false),
    governanceGuard: options.governanceGuard ?? new GovernanceExecutionGuard(options.governanceApproved ?? false),
    riskGateway: options.riskGateway ?? new RiskGateway(options.riskApproved ?? false),
    eventBus,
  });

  return { orchestrator, simulationProvider, eventBus };
}

function validProductAccessState(overrides = {}) {
  const product = {
    id: 'whiterabbit-scalper-futures',
    name: 'WhiteRabbit Scalper Futures',
    visibility: 'premium',
    accessPolicy: {
      entitlementKey: 'strategy.whiterabbit.scalper',
      tokenPolicy: {
        neuronMinimum: 100n,
      },
      allowedSubscriptionTiers: ['pro'],
    },
    runtimeLimits: {
      maxActiveStrategies: 3,
      maxConcurrentRuntimes: 3,
      maxDailyExecutions: 10,
    },
    supportedProviders: ['simulation'],
    monetization: 'subscription',
    lifecycleStatus: 'active',
    ...(overrides.product ?? {}),
  };
  const profile = {
    userId: 'user-1',
    wallet: '0xuser',
    neuronBalance: 1000n,
    unlockedStrategies: ['whiterabbit-scalper-futures'],
    runtimeQuota: {
      maxActiveStrategies: 3,
      maxConcurrentRuntimes: 3,
      maxDailyExecutions: 10,
    },
    executionLimits: {},
    subscriptionTier: 'pro',
    entitlementState: {
      status: 'active',
      checkedAt: new Date().toISOString(),
      entitlementKeys: ['strategy.whiterabbit.scalper'],
    },
    ...(overrides.profile ?? {}),
  };
  const runtime = {
    id: 'runtime-1',
    userId: 'user-1',
    strategyProductId: 'whiterabbit-scalper-futures',
    providerId: 'simulation',
    executionDomain: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(overrides.runtime ?? {}),
  };

  return {
    strategyProducts: [product],
    userProfiles: [profile],
    runtimeInstances: [runtime],
    executionQuotas: overrides.executionQuotas ?? [{ strategyId: 'whiterabbit-scalper-futures', maxOrdersPerDay: 10, maxConcurrentPositions: 2 }],
    dailyExecutionCounts: overrides.dailyExecutionCounts ?? { 'user-1:whiterabbit-scalper-futures': 0 },
    activeRuntimeCounts: overrides.activeRuntimeCounts ?? { 'user-1': 1 },
    activeStrategyCounts: overrides.activeStrategyCounts ?? { 'user-1': 1 },
    concurrentPositionCounts: overrides.concurrentPositionCounts ?? { 'user-1:whiterabbit-scalper-futures': 0 },
    daoMemberships: overrides.daoMemberships ?? {},
  };
}

function validGovernanceState(overrides = {}) {
  return {
    constitutional: {
      governanceStatus: 'active',
      constitutionalStanding: 'compliant',
      strategyWhitelist: ['treasury-rebalance'],
      ...(overrides.constitutional ?? {}),
    },
    federation: {
      federationTier: 'governed',
      delegatedExecutionAllowed: true,
      allowedStrategyIds: ['treasury-rebalance'],
      ...(overrides.federation ?? {}),
    },
    treasury: {
      treasuryAuthorized: true,
      allowedStrategyIds: ['treasury-rebalance'],
      ...(overrides.treasury ?? {}),
    },
  };
}

function validRiskState(overrides = {}) {
  return {
    global: {
      emergencyShutdown: false,
      blockedProviderIds: [],
      volatilityBlocked: false,
      liquidityBlocked: false,
      ...(overrides.global ?? {}),
    },
    treasury: {
      requestedTreasuryExposure: 100,
      maxTreasuryExposure: 1000,
      requestedLeverage: 1,
      maxLeverage: 3,
      federationAllocationAllowed: true,
      ...(overrides.treasury ?? {}),
    },
    userRuntime: {
      requestedUserExposure: 10,
      maxUserExposure: 100,
      beginnerSafeMode: false,
      exchangeWhitelist: ['simulation'],
      quoteCurrencyWhitelist: ['USDT'],
      ...(overrides.userRuntime ?? {}),
    },
  };
}

async function assertBlocked(promise, expectedCode) {
  await assert.rejects(
    promise,
    (error) => {
      assert.ok(error instanceof ExecutionBlockedError);
      assert.equal(error.code, expectedCode);
      return true;
    },
  );
}

describe('ExecutionOrchestrator', () => {
  it('blocks user execution without entitlement before provider call', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productApproved: false,
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'PRODUCT_GATE_BLOCKED');

    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks treasury execution without governance approval before provider call', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      governanceApproved: false,
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(treasuryIntent()), 'GOVERNANCE_GATE_BLOCKED');

    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks provider call when risk rejects execution', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productApproved: true,
      riskApproved: false,
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'RISK_REJECTED');

    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('returns controlled error for an unknown provider', async () => {
    const { orchestrator } = createHarness({
      productApproved: true,
      riskApproved: true,
      registerProvider: false,
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'PROVIDER_NOT_FOUND');
  });

  it('fails safely when execution context is missing', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productApproved: true,
      riskApproved: true,
    });

    const invalidIntent = {
      id: 'intent-invalid-1',
      correlationId: 'corr-invalid-1',
      request: {
        requestId: 'request-invalid-1',
        providerId: 'simulation',
        market: 'BTC-USDT',
        side: 'buy',
        orderType: 'market',
        quantity: '0.01',
      },
    };

    await assertBlocked(orchestrator.execute(invalidIntent), 'INVALID_EXECUTION_CONTEXT');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('preserves correlationId through successful execution events', async () => {
    const { orchestrator } = createHarness({
      productApproved: true,
      riskApproved: true,
    });

    const receipt = await orchestrator.execute(userIntent({ correlationId: 'corr-preserved' }));

    assert.equal(receipt.correlationId, 'corr-preserved');
    assert.ok(receipt.events.length >= 3);
    assert.ok(receipt.events.every((event) => event.correlationId === 'corr-preserved'));
  });

  it('sends execution to SimulationProvider only after gates approve', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productApproved: true,
      riskApproved: true,
    });

    const intent = userIntent();
    const receipt = await orchestrator.execute(intent);

    assert.equal(receipt.result.status, 'submitted');
    assert.equal(simulationProvider.receivedExecutions.length, 1);
    assert.equal(simulationProvider.receivedExecutions[0]?.requestId, intent.request.requestId);
  });

  it('blocks user execution when entitlement is missing', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState({
        profile: {
          entitlementState: {
            status: 'eligible',
            checkedAt: new Date().toISOString(),
            entitlementKeys: [],
          },
          subscriptionTier: undefined,
        },
      })),
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'PRODUCT_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks user execution when token gate fails', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState({
        profile: {
          neuronBalance: 10n,
        },
      })),
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'PRODUCT_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks user execution when runtime is suspended', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState({
        runtime: {
          status: 'suspended',
        },
      })),
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'PRODUCT_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks user execution when runtime quota is exhausted', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState({
        dailyExecutionCounts: { 'user-1:whiterabbit-scalper-futures': 10 },
      })),
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'PRODUCT_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('lets treasury execution bypass the product layer', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState({
        profile: {
          entitlementState: {
            status: 'revoked',
            checkedAt: new Date().toISOString(),
            entitlementKeys: [],
          },
        },
      })),
      governanceApproved: true,
      riskApproved: true,
    });

    const receipt = await orchestrator.execute(treasuryIntent());
    assert.equal(receipt.result.status, 'submitted');
    assert.equal(simulationProvider.receivedExecutions.length, 1);
  });

  it('blocks user execution when trial is expired', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState({
        product: {
          visibility: 'trial-enabled',
          accessPolicy: {
            entitlementKey: 'strategy.whiterabbit.trial',
            tokenPolicy: {
              allowTrial: true,
            },
            trialExpiresAt: '2020-01-01T00:00:00.000Z',
            trialExecutionLimit: 5,
          },
        },
        profile: {
          subscriptionTier: undefined,
          entitlementState: {
            status: 'trial',
            checkedAt: new Date().toISOString(),
            entitlementKeys: [],
            expiresAt: '2020-01-01T00:00:00.000Z',
          },
        },
      })),
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'PRODUCT_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks dao-only strategy for non-member context', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState({
        product: {
          visibility: 'dao-only',
          monetization: 'dao-access',
        },
      })),
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(userIntent({
      context: {
        ...userIntent().context,
        daoId: 'dao-unknown',
      },
    })), 'PRODUCT_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks execution when governance status rejects treasury execution', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      governanceGuard: new GovernanceExecutionGuard(validGovernanceState({
        constitutional: {
          governanceStatus: 'halted',
        },
      })),
      riskGateway: new RiskGateway(validRiskState()),
    });

    await assertBlocked(orchestrator.execute(treasuryIntent()), 'GOVERNANCE_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks execution when treasury policy rejects strategy', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      governanceGuard: new GovernanceExecutionGuard(validGovernanceState({
        treasury: {
          allowedStrategyIds: ['different-strategy'],
        },
      })),
      riskGateway: new RiskGateway(validRiskState()),
    });

    await assertBlocked(orchestrator.execute(treasuryIntent()), 'GOVERNANCE_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks provider call when sovereign risk rejects treasury execution', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      governanceGuard: new GovernanceExecutionGuard(validGovernanceState()),
      riskGateway: new RiskGateway(validRiskState({
        treasury: {
          requestedTreasuryExposure: 2000,
          maxTreasuryExposure: 1000,
        },
      })),
    });

    await assertBlocked(orchestrator.execute(treasuryIntent()), 'RISK_REJECTED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks all execution during platform emergency shutdown', async () => {
    const treasuryHarness = createHarness({
      governanceGuard: new GovernanceExecutionGuard(validGovernanceState()),
      riskGateway: new RiskGateway(validRiskState({
        global: {
          emergencyShutdown: true,
        },
      })),
    });
    await assertBlocked(treasuryHarness.orchestrator.execute(treasuryIntent()), 'RISK_REJECTED');
    assert.equal(treasuryHarness.simulationProvider.receivedExecutions.length, 0);

    const userHarness = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState()),
      riskGateway: new RiskGateway(validRiskState({
        global: {
          emergencyShutdown: true,
        },
      })),
    });
    await assertBlocked(userHarness.orchestrator.execute(userIntent()), 'RISK_REJECTED');
    assert.equal(userHarness.simulationProvider.receivedExecutions.length, 0);
  });

  it('does not allow user execution to inherit treasury permissions', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate(false),
      governanceGuard: new GovernanceExecutionGuard(validGovernanceState()),
      riskGateway: new RiskGateway(validRiskState()),
    });

    await assertBlocked(orchestrator.execute(userIntent()), 'PRODUCT_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('blocks federation-restricted unauthorized treasury strategy', async () => {
    const { orchestrator, simulationProvider } = createHarness({
      governanceGuard: new GovernanceExecutionGuard(validGovernanceState({
        federation: {
          allowedStrategyIds: ['federation-approved-strategy'],
        },
      })),
      riskGateway: new RiskGateway(validRiskState()),
    });

    await assertBlocked(orchestrator.execute(treasuryIntent()), 'GOVERNANCE_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });
});

describe('SimulationProvider', () => {
  it('returns normalized fills and emits execution events', async () => {
    const eventBus = new TradingEventBus();
    const provider = new SimulationProvider({ eventBus, deterministicPrice: '125' });

    const result = await provider.executeOrder({
      requestId: 'sim-request-1',
      providerId: 'simulation',
      market: 'BTC-USDT',
      side: 'buy',
      orderType: 'market',
      quantity: '2',
      clientOrderId: 'corr-sim-1',
    });

    assert.equal(result.status, 'submitted');
    assert.equal(result.fills?.length, 1);
    assert.equal(result.fills?.[0]?.price, '125');
    assert.equal(result.fills?.[0]?.quantity, '2');

    const events = eventBus.getByCorrelationId('corr-sim-1');
    assert.deepEqual(events.map((event) => event.type), ['ORDER_SUBMITTED', 'ORDER_FILLED']);
  });

  it('updates simulated positions after execution', async () => {
    const provider = new SimulationProvider({ deterministicPrice: '100' });

    await provider.executeOrder({
      requestId: 'sim-request-2',
      providerId: 'simulation',
      market: 'ETH-USDT',
      side: 'buy',
      orderType: 'market',
      quantity: '3',
    });

    const positions = await provider.getPositions();
    assert.equal(positions.positions.length, 1);
    assert.equal(positions.positions[0]?.market, 'ETH-USDT');
    assert.equal(positions.positions[0]?.side, 'long');
    assert.equal(positions.positions[0]?.quantity, '3');
  });

  it('supports cancellation', async () => {
    const provider = new SimulationProvider();

    const result = await provider.cancelOrder({
      requestId: 'cancel-request-1',
      providerId: 'simulation',
      providerOrderId: 'sim-open-order-1',
    });

    assert.equal(result.status, 'cancelled');
    assert.equal(provider.wasCancelled('sim-open-order-1'), true);
  });
});

describe('TradingEventBus', () => {
  it('delivers events to subscribers in order', async () => {
    const eventBus = new TradingEventBus();
    const received = [];

    eventBus.subscribe((event) => {
      received.push(event.type);
    });

    await eventBus.publish({
      id: 'event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: new Date().toISOString(),
      correlationId: 'corr-events-1',
      source: 'core',
      payload: {},
    });
    await eventBus.publish({
      id: 'event-2',
      type: 'RISK_CHECK_APPROVED',
      occurredAt: new Date().toISOString(),
      correlationId: 'corr-events-1',
      source: 'risk',
      payload: {},
    });

    assert.deepEqual(received, ['EXECUTION_REQUESTED', 'RISK_CHECK_APPROVED']);
  });

  it('preserves correlationId in stored event traces', async () => {
    const eventBus = new TradingEventBus();

    await eventBus.publish({
      id: 'event-correlation-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: new Date().toISOString(),
      correlationId: 'corr-events-2',
      source: 'core',
      payload: {},
    });

    assert.equal(eventBus.getByCorrelationId('corr-events-2')[0]?.correlationId, 'corr-events-2');
  });

  it('continues dispatch when a subscriber fails', async () => {
    const eventBus = new TradingEventBus();
    const received = [];

    eventBus.subscribe(() => {
      throw new Error('subscriber failed');
    });
    eventBus.subscribe((event) => {
      received.push(event.type);
    });

    await eventBus.publish({
      id: 'event-failure-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: new Date().toISOString(),
      correlationId: 'corr-events-3',
      source: 'core',
      payload: {},
    });

    assert.deepEqual(received, ['EXECUTION_REQUESTED']);
    assert.equal(eventBus.getDispatchErrors().length, 1);
  });
});
