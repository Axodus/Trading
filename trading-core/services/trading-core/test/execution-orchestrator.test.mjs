import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AcsTradingAccessService,
  AcsTradingBoundaryError,
  AcsTradingCommandApi,
  assertSafeLocalSeedConfig,
  AutonomousActionBoundary,
  ComplianceGate,
  CredentialGrantLifecycleService,
  CredentialLifecycleService,
  CredentialVaultService,
  CredentialVaultAdapterRegistry,
  DisclosureAcceptanceService,
  ExecutionBlockedError,
  ExecutionLatencyTracker,
  ExecutionOrchestrator,
  ExecutionProviderRegistry,
  CorrelationTraceService,
  GovernanceExecutionGuard,
  HummingbotProvider,
  HummingbotRuntime,
  InMemoryCredentialVaultRepository,
  InMemoryPostgresClient,
  createInMemoryPostgresStorage,
  createLocalTradingDatabaseConfig,
  DatabaseConnectionManager,
  DatabaseHealthService,
  InMemoryTradingEventRepository,
  InMemoryHummingbotRuntimeClient,
  MigrationError,
  MigrationRunner,
  MockEncryptedCredentialVaultAdapter,
  NodePostgresClient,
  ObservabilityRecommendationAuditService,
  ObservabilityRiskAuditService,
  ObservabilityRiskBoundaryError,
  ObservabilityRiskDecisionService,
  PaperTradingSessionService,
  ProductExecutionGate,
  ProviderObservabilityService,
  ProviderReconciliationService,
  ReconciliationCandidateDiscoveryService,
  ReconciliationProposalRepository,
  ReconciliationWorker,
  ReconciliationWorkerAuditService,
  RiskGateway,
  RuntimeComplianceValidator,
  RuntimeSupervisionApi,
  RuntimeLifecycleCoordinator,
  RuntimeLifecycleService,
  RuntimeCredentialBindingService,
  RuntimeProvisioningService,
  RuntimeProvisioningError,
  RuntimeRecoveryService,
  RuntimeObservabilityService,
  runTradingDbCli,
  SimulationProvider,
  StateMutationError,
  PostgresRuntimeRepository,
  PostgresBootstrapService,
  PostgresClientError,
  PostgresTradingEventRepository,
  createNodePostgresEnvConfig,
  redactPostgresEnvConfig,
  TradingEventBus,
  TradingEventQueryService,
  TradingActionRequestApi,
  TradingDatabaseConfigError,
  TradingApiGateway,
  TradingObservabilityApi,
  TradingWorkflowRequestService,
  TradingReadApi,
  TradingRuntimeInspectionApi,
  TradingTelemetryApi,
  TrinityObservabilityAdapter,
  TradingStateService,
  TenantObservabilityQueryService,
  StrategyTelemetryAggregator,
  createTrinityAutonomyProfile,
  RecommendationApprovalService,
  TrinityRecommendationApi,
  TrinityRecommendationEngine,
  UserRuntimeProvisioner,
  WhiteRabbitProductAdapter,
  WhiteRabbitActionRequestService,
  WhiteRabbitSurfaceApi,
  WhiteRabbitProductSurfaceService,
  WhiteRabbitRuntimeEngine,
  WhiteRabbitStrategyProvider,
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

function userProfile(userId) {
  return {
    userId,
    wallet: `0x${userId}`,
    neuronBalance: 1000n,
    unlockedStrategies: ['whiterabbit-scalper-futures'],
    runtimeQuota: {
      maxActiveStrategies: 1,
      maxConcurrentRuntimes: 1,
      maxDailyExecutions: 25,
    },
    executionLimits: {},
    subscriptionTier: 'pro',
    entitlementState: {
      status: 'active',
      checkedAt: new Date().toISOString(),
      entitlementKeys: ['strategy.whiterabbit.scalper'],
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

describe('Postgres repository adapters and event store', () => {
  function persistedEvent(overrides = {}) {
    return {
      id: 'pg-event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-21T18:00:00.000Z',
      correlationId: 'corr-pg-1',
      source: 'core',
      userId: 'alice',
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-pg-1',
      payload: {
        providerId: 'simulation',
        requestId: 'request-pg-1',
      },
      ...overrides,
    };
  }

  function persistentRuntime(overrides = {}) {
    return {
      id: 'runtime-pg-recovery-1',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      providerId: 'simulation',
      executionDomain: 'user',
      status: 'active',
      createdAt: '2026-05-21T18:00:00.000Z',
      updatedAt: '2026-05-21T18:00:00.000Z',
      ...overrides,
    };
  }

  it('persists events across repository instances', async () => {
    const storage = createInMemoryPostgresStorage();
    const writer = new PostgresTradingEventRepository(new InMemoryPostgresClient(storage));
    await writer.append(persistedEvent());

    const restartedRepository = new PostgresTradingEventRepository(new InMemoryPostgresClient(storage));
    const events = await restartedRepository.replayByCorrelationId('corr-pg-1');

    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, 'pg-event-1');
    assert.equal(events[0]?.payload.providerId, 'simulation');
  });

  it('replays an execution lifecycle into normalized state', async () => {
    const repository = new PostgresTradingEventRepository(new InMemoryPostgresClient());
    await repository.append(persistedEvent({
      id: 'pg-life-1',
      correlationId: 'corr-pg-life-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-21T18:00:00.000Z',
    }));
    await repository.append(persistedEvent({
      id: 'pg-life-2',
      correlationId: 'corr-pg-life-1',
      type: 'ORDER_SUBMITTED',
      occurredAt: '2026-05-21T18:00:01.000Z',
      payload: {
        providerId: 'simulation',
        result: {
          requestId: 'request-pg-1',
          providerOrderId: 'order-pg-1',
        },
      },
    }));
    await repository.append(persistedEvent({
      id: 'pg-life-3',
      correlationId: 'corr-pg-life-1',
      type: 'ORDER_FILLED',
      occurredAt: '2026-05-21T18:00:02.000Z',
      payload: {
        providerId: 'simulation',
        fill: {
          fillId: 'fill-pg-1',
          providerOrderId: 'order-pg-1',
          market: 'BTC-USDT',
          side: 'buy',
          quantity: '0.01',
          price: '100',
          filledAt: '2026-05-21T18:00:02.000Z',
        },
      },
    }));

    const state = new TradingStateService();
    for (const event of await repository.replayByCorrelationId('corr-pg-life-1')) {
      await state.applyEvent(event);
    }

    const execution = state.executionState.getByCorrelationId('corr-pg-life-1');
    assert.equal(execution?.status, 'filled');
    assert.equal(execution?.providerOrderId, 'order-pg-1');
    assert.equal(execution?.fills.length, 1);
  });

  it('recovers runtime lifecycle from persistent state', async () => {
    const storage = createInMemoryPostgresStorage();
    const client = new InMemoryPostgresClient(storage);
    const runtimeRepository = new PostgresRuntimeRepository(client);
    await runtimeRepository.save(persistentRuntime());

    const eventRepository = new PostgresTradingEventRepository(new InMemoryPostgresClient(storage));
    const lifecycle = new RuntimeLifecycleService();
    const recovery = new RuntimeRecoveryService(lifecycle, new TradingEventBus(eventRepository), runtimeRepository);

    await recovery.startRecovery({
      runtimeInstanceId: 'runtime-pg-recovery-1',
      correlationId: 'corr-pg-recovery-1',
      reason: 'runtime-crash',
    });

    assert.equal(lifecycle.get('runtime-pg-recovery-1')?.runtime.status, 'recovering');
    const trace = await eventRepository.replayByCorrelationId('corr-pg-recovery-1');
    assert.equal(trace[0]?.type, 'RUNTIME_RECOVERING');
    assert.equal(trace[0]?.runtimeInstanceId, 'runtime-pg-recovery-1');
  });

  it('keeps user and treasury replay traces isolated', async () => {
    const repository = new PostgresTradingEventRepository(new InMemoryPostgresClient());
    await repository.append(persistedEvent({
      id: 'pg-user-trace-1',
      correlationId: 'corr-user-pg-1',
      userId: 'alice',
      daoId: undefined,
    }));
    await repository.append(persistedEvent({
      id: 'pg-treasury-trace-1',
      correlationId: 'corr-treasury-pg-1',
      userId: undefined,
      daoId: 'dao-1',
      runtimeInstanceId: undefined,
      strategyProductId: undefined,
      payload: {
        providerId: 'simulation',
        requestId: 'request-treasury-pg-1',
      },
    }));

    const userTrace = await repository.replayByTenantId('alice');
    const treasuryTrace = await repository.replayByTenantId('dao-1');

    assert.equal(userTrace.length, 1);
    assert.equal(userTrace[0]?.userId, 'alice');
    assert.equal(treasuryTrace.length, 1);
    assert.equal(treasuryTrace[0]?.daoId, 'dao-1');
  });

  it('persists events before subscriber dispatch failures', async () => {
    const storage = createInMemoryPostgresStorage();
    const repository = new PostgresTradingEventRepository(new InMemoryPostgresClient(storage));
    const eventBus = new TradingEventBus(repository);
    eventBus.subscribe(() => {
      throw new Error('subscriber failed');
    });

    await eventBus.publish(persistedEvent({
      id: 'pg-dispatch-failure-1',
      correlationId: 'corr-pg-dispatch-failure-1',
    }));

    const restartedRepository = new PostgresTradingEventRepository(new InMemoryPostgresClient(storage));
    const trace = await restartedRepository.replayByCorrelationId('corr-pg-dispatch-failure-1');
    assert.equal(trace.length, 1);
    assert.equal(eventBus.getDispatchErrors().length, 1);
  });

  it('preserves append-only event store guarantees', async () => {
    const repository = new PostgresTradingEventRepository(new InMemoryPostgresClient());
    const event = persistedEvent({
      id: 'pg-append-only-1',
      correlationId: 'corr-pg-append-only-1',
    });

    await repository.append(event);
    await assert.rejects(() => repository.append(event), /Append-only event store violation/);
    const trace = await repository.replayByCorrelationId('corr-pg-append-only-1');
    assert.equal(trace.length, 1);
  });
});

describe('Postgres bootstrap and migration runner', () => {
  function bootstrapHarness(configOverrides = {}) {
    const storage = createInMemoryPostgresStorage();
    const client = new InMemoryPostgresClient(storage);
    const config = {
      environment: 'test',
      minimumSchemaVersion: '0002_runtime_audit.sql',
      migrations: [
        {
          id: '0002_runtime_audit.sql',
          sql: 'CREATE TABLE IF NOT EXISTS trading_runtime_audit (id TEXT PRIMARY KEY)',
        },
        {
          id: '0001_trading_state.sql',
          sql: 'CREATE TABLE IF NOT EXISTS trading_events (id TEXT PRIMARY KEY)',
        },
      ],
      ...configOverrides,
    };
    const connection = new DatabaseConnectionManager({ client, database: config });
    const runner = new MigrationRunner(client);
    const health = new DatabaseHealthService(connection, runner);
    const bootstrap = new PostgresBootstrapService(connection, runner, health);
    return { storage, client, config, connection, runner, health, bootstrap };
  }

  it('executes migrations in order', async () => {
    const harness = bootstrapHarness();

    const result = await harness.bootstrap.bootstrap();

    assert.deepEqual(result.migrations.applied.map((migration) => migration.id), ['0001_trading_state.sql', '0002_runtime_audit.sql']);
    assert.deepEqual(harness.storage.trading_schema_migrations.map((migration) => migration.id), ['0001_trading_state.sql', '0002_runtime_audit.sql']);
    assert.equal(result.schemaVersion, '0002_runtime_audit.sql');
  });

  it('does not corrupt state when migrations are repeated', async () => {
    const harness = bootstrapHarness();

    await harness.bootstrap.bootstrap();
    const second = await harness.bootstrap.bootstrap();

    assert.equal(second.migrations.applied.length, 0);
    assert.deepEqual(second.migrations.skipped.map((migration) => migration.id), ['0001_trading_state.sql', '0002_runtime_audit.sql']);
    assert.equal(harness.storage.trading_schema_migrations.length, 2);
  });

  it('detects invalid migration safely', async () => {
    const harness = bootstrapHarness({
      migrations: [
        {
          id: '0001_invalid.sql',
          sql: 'DROP TABLE trading_events',
        },
      ],
    });

    await assert.rejects(
      () => harness.bootstrap.bootstrap(),
      (error) => error instanceof MigrationError && error.code === 'EXECUTION_FAILED',
    );
  });

  it('validates schema version during bootstrap health checks', async () => {
    const harness = bootstrapHarness({
      minimumSchemaVersion: '0003_missing_future.sql',
    });

    const result = await harness.bootstrap.bootstrap();

    assert.equal(result.health.status, 'degraded');
    assert.equal(result.health.migrationConsistency, 'inconsistent');
    assert.equal(result.health.schemaVersion, '0002_runtime_audit.sql');
    assert.equal(result.health.issues[0]?.includes('below required 0003_missing_future.sql'), true);
  });

  it('normalizes database health state', async () => {
    const harness = bootstrapHarness();

    await harness.bootstrap.bootstrap();
    const health = await harness.health.check();

    assert.equal(health.status, 'healthy');
    assert.equal(health.connectivity, 'connected');
    assert.equal(health.migrationConsistency, 'consistent');
    assert.equal(health.repositoryReadiness, 'ready');
    assert.equal(health.schemaVersion, '0002_runtime_audit.sql');
  });
});

describe('Local Trading infrastructure runtime config', () => {
  function localEnv(overrides = {}) {
    return {
      TRADING_ENV: 'local',
      TRADING_DB_HOST: '127.0.0.1',
      TRADING_DB_PORT: '55432',
      TRADING_DB_NAME: 'axodus_trading_local',
      TRADING_DB_USER: 'axodus_trading',
      TRADING_DB_PASSWORD: 'local_password',
      TRADING_DB_SCHEMA: 'public',
      TRADING_DB_MIN_SCHEMA_VERSION: '0001_trading_state.sql',
      ...overrides,
    };
  }

  it('validates required local database env fields', () => {
    const config = createLocalTradingDatabaseConfig(localEnv(), [
      {
        id: '0001_trading_state.sql',
        sql: 'CREATE TABLE IF NOT EXISTS trading_events (id TEXT PRIMARY KEY)',
      },
    ]);

    assert.equal(config.environment, 'local');
    assert.equal(config.connection.host, '127.0.0.1');
    assert.equal(config.connection.port, 55432);
    assert.equal(config.database.minimumSchemaVersion, '0001_trading_state.sql');
    assert.equal(config.database.migrations.length, 1);
  });

  it('blocks bootstrap config creation when database config is missing', () => {
    assert.throws(
      () => createLocalTradingDatabaseConfig(localEnv({ TRADING_DB_PASSWORD: undefined })),
      (error) => error instanceof TradingDatabaseConfigError && error.code === 'MISSING_ENV',
    );
  });

  it('runs migration bootstrap flow against the mock local client', async () => {
    const runtime = createLocalTradingDatabaseConfig(localEnv(), [
      {
        id: '0001_trading_state.sql',
        sql: 'CREATE TABLE IF NOT EXISTS trading_events (id TEXT PRIMARY KEY)',
      },
    ]);
    const client = new InMemoryPostgresClient(createInMemoryPostgresStorage());
    const connection = new DatabaseConnectionManager({ client, database: runtime.database });
    const runner = new MigrationRunner(client);
    const health = new DatabaseHealthService(connection, runner);
    const bootstrap = new PostgresBootstrapService(connection, runner, health);

    const result = await bootstrap.bootstrap();

    assert.equal(result.schemaVersion, '0001_trading_state.sql');
    assert.equal(result.health.status, 'healthy');
    assert.deepEqual(result.migrations.applied.map((migration) => migration.id), ['0001_trading_state.sql']);
  });

  it('runs database healthcheck flow against the mock local client', async () => {
    const runtime = createLocalTradingDatabaseConfig(localEnv(), [
      {
        id: '0001_trading_state.sql',
        sql: 'CREATE TABLE IF NOT EXISTS trading_events (id TEXT PRIMARY KEY)',
      },
    ]);
    const client = new InMemoryPostgresClient(createInMemoryPostgresStorage());
    const connection = new DatabaseConnectionManager({ client, database: runtime.database });
    const runner = new MigrationRunner(client);
    const health = new DatabaseHealthService(connection, runner);
    const bootstrap = new PostgresBootstrapService(connection, runner, health);

    await bootstrap.bootstrap();
    const state = await health.check(runtime.database);

    assert.equal(state.status, 'healthy');
    assert.equal(state.connectivity, 'connected');
    assert.equal(state.repositoryReadiness, 'ready');
  });

  it('rejects production-like local seed environments', () => {
    const config = createLocalTradingDatabaseConfig(localEnv({
      TRADING_ENV: 'production',
      TRADING_DB_HOST: 'prod-db.internal',
      TRADING_DB_NAME: 'axodus_trading_production',
    }));

    assert.throws(
      () => assertSafeLocalSeedConfig(config),
      (error) => error instanceof TradingDatabaseConfigError && error.code === 'UNSAFE_SEED_ENVIRONMENT',
    );
  });
});

describe('Trading DB migration CLI', () => {
  function cliEnv(overrides = {}) {
    return {
      TRADING_ENV: 'local',
      TRADING_DB_HOST: '127.0.0.1',
      TRADING_DB_PORT: '55432',
      TRADING_DB_NAME: 'axodus_trading_local',
      TRADING_DB_USER: 'axodus_trading',
      TRADING_DB_PASSWORD: 'local_password',
      TRADING_DB_SCHEMA: 'public',
      TRADING_DB_MIN_SCHEMA_VERSION: '0001_trading_state.sql',
      ...overrides,
    };
  }

  function createCliContext(options = {}) {
    const runtime = createLocalTradingDatabaseConfig(cliEnv(options.env ?? {}), [
      {
        id: '0001_trading_state.sql',
        sql: 'CREATE TABLE IF NOT EXISTS trading_events (id TEXT PRIMARY KEY)',
      },
    ]);
    const client = options.client ?? new InMemoryPostgresClient(createInMemoryPostgresStorage());
    const connection = new DatabaseConnectionManager({ client, database: runtime.database });
    const migrations = new MigrationRunner(client);
    const health = new DatabaseHealthService(connection, migrations);
    const bootstrap = new PostgresBootstrapService(connection, migrations, health);
    return {
      runtime,
      connection,
      migrations,
      health,
      bootstrap,
      seedLocal: options.seedLocal,
    };
  }

  it('migrate command applies pending migrations through MigrationRunner', async () => {
    const context = createCliContext();

    const result = await runTradingDbCli(['migrate'], context);

    assert.equal(result.exitCode, 0);
    assert.equal(result.payload.command, 'migrate');
    assert.deepEqual(result.payload.applied, ['0001_trading_state.sql']);
    assert.equal(result.stdout.includes('Trading DB migrate: ok'), true);
  });

  it('health command returns normalized database health', async () => {
    const context = createCliContext();
    await runTradingDbCli(['migrate'], context);

    const result = await runTradingDbCli(['health'], context);

    assert.equal(result.exitCode, 0);
    assert.equal(result.payload.command, 'health');
    assert.equal(result.payload.health.status, 'healthy');
  });

  it('JSON output is valid for automation', async () => {
    const context = createCliContext();

    const result = await runTradingDbCli(['migrate', '--json'], context);
    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.command, 'migrate');
    assert.deepEqual(parsed.applied, ['0001_trading_state.sql']);
  });

  it('redacts database password from failure output', async () => {
    const failingClient = {
      async query() {
        throw new Error('connection failed for password local_password');
      },
    };
    const context = createCliContext({ client: failingClient });

    const result = await runTradingDbCli(['health', '--json'], context);

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout.includes('local_password'), false);
    assert.equal(result.stdout.includes('[redacted]'), true);
  });

  it('invalid command fails safely', async () => {
    const context = createCliContext();

    const result = await runTradingDbCli(['rollback', '--json'], context);
    const parsed = JSON.parse(result.stdout);

    assert.equal(result.exitCode, 1);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.command, 'rollback');
  });

  it('seed-local rejects non-local environment', async () => {
    const context = createCliContext({
      env: {
        TRADING_ENV: 'staging',
        TRADING_DB_NAME: 'axodus_trading_staging',
      },
      seedLocal: async () => ({
        seeded: true,
      }),
    });

    const result = await runTradingDbCli(['seed-local', '--json'], context);
    const parsed = JSON.parse(result.stdout);

    assert.equal(result.exitCode, 1);
    assert.equal(parsed.ok, false);
    assert.equal(String(parsed.error).includes('allowed only for local or test'), true);
  });
});

describe('NodePostgresClient adapter', () => {
  function createPool(overrides = {}) {
    const calls = [];
    return {
      calls,
      ended: false,
      async query(sql, params = []) {
        calls.push({ sql, params });
        return { rows: [{ ok: true, sql, params }] };
      },
      async end() {
        this.ended = true;
      },
      ...overrides,
    };
  }

  it('executes parameterized queries through the pool', async () => {
    const pool = createPool();
    const client = new NodePostgresClient({ pool, queryTimeoutMs: 100 });

    const result = await client.query('select * from trading_events where id = $1', ['event-1']);

    assert.equal(result.rows[0]?.params[0], 'event-1');
    assert.equal(pool.calls[0]?.sql, 'select * from trading_events where id = $1');
  });

  it('supports connection health checks through the existing manager', async () => {
    const pool = createPool();
    const client = new NodePostgresClient({ pool, queryTimeoutMs: 100 });
    const runtime = createLocalTradingDatabaseConfig({
      TRADING_ENV: 'local',
      TRADING_DB_HOST: '127.0.0.1',
      TRADING_DB_PORT: '55432',
      TRADING_DB_NAME: 'axodus_trading_local',
      TRADING_DB_USER: 'axodus_trading',
      TRADING_DB_PASSWORD: 'local_password',
    });
    const connection = new DatabaseConnectionManager({ client, database: runtime.database });

    await connection.connect();

    assert.equal(connection.isConnected(), true);
    assert.equal(pool.calls[0]?.sql, 'SELECT 1');
  });

  it('fails safely on query timeout', async () => {
    const pool = createPool({
      async query() {
        return new Promise(() => undefined);
      },
    });
    const client = new NodePostgresClient({ pool, queryTimeoutMs: 5, maxRetries: 0 });

    await assert.rejects(
      () => client.query('select pg_sleep(10)'),
      (error) => error instanceof PostgresClientError && error.code === 'QUERY_TIMEOUT',
    );
  });

  it('normalizes query errors without leaking credentials', async () => {
    const pool = createPool({
      async query() {
        const error = new Error('connection failed password=local_password');
        error.code = 'ECONNREFUSED';
        throw error;
      },
    });
    const client = new NodePostgresClient({ pool, queryTimeoutMs: 100, maxRetries: 0 });

    await assert.rejects(
      () => client.query('select 1'),
      (error) => error instanceof PostgresClientError
        && error.code === 'CONNECTION_FAILED'
        && !error.message.includes('local_password')
        && error.message.includes('[redacted]'),
    );
  });

  it('closes the pool gracefully', async () => {
    const pool = createPool();
    const client = new NodePostgresClient({ pool });

    await client.close();

    assert.equal(client.isClosed(), true);
    assert.equal(pool.ended, true);
  });

  it('remains compatible with repository adapters', async () => {
    const storage = createInMemoryPostgresStorage();
    const memory = new InMemoryPostgresClient(storage);
    const pool = createPool({
      async query(sql, params = []) {
        return memory.query(sql, params);
      },
    });
    const client = new NodePostgresClient({ pool });
    const repository = new PostgresTradingEventRepository(client);

    await repository.append({
      id: 'node-pg-compatible-event',
      type: 'MARKET_DATA_RECEIVED',
      occurredAt: '2026-05-23T10:00:00.000Z',
      correlationId: 'corr-node-pg',
      source: 'core',
      userId: 'local-user',
      payload: {
        providerId: 'simulation',
        mock: true,
      },
    });
    const events = await repository.listByCorrelationId('corr-node-pg');

    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, 'node-pg-compatible-event');
  });

  it('maps env config for the real client and redacts diagnostics', () => {
    const config = createNodePostgresEnvConfig({
      TRADING_ENV: 'local',
      TRADING_DB_HOST: '127.0.0.1',
      TRADING_DB_PORT: '55432',
      TRADING_DB_NAME: 'axodus_trading_local',
      TRADING_DB_USER: 'axodus_trading',
      TRADING_DB_PASSWORD: 'local_password',
      TRADING_DB_POOL_MAX: '3',
      TRADING_DB_QUERY_TIMEOUT_MS: '2500',
      TRADING_DB_MAX_RETRIES: '1',
    });
    const redacted = redactPostgresEnvConfig(config);

    assert.equal(config.max, 3);
    assert.equal(config.queryTimeoutMs, 2500);
    assert.equal(redacted.password, '[redacted]');
  });
});

describe('Provider reconciliation skeleton', () => {
  function reconciliationRequest(overrides = {}) {
    return {
      context: {
        correlationId: 'corr-reconcile-1',
        executionDomain: 'user',
        userId: 'alice',
        strategyProductId: 'whiterabbit-scalper-futures',
        runtimeInstanceId: 'runtime-reconcile-1',
        providerId: 'simulation',
        strategyId: 'whiterabbit-v1',
      },
      sovereignSnapshot: {
        providerStatus: {
          providerId: 'simulation',
          type: 'simulation',
          connected: true,
          mode: 'paper',
          health: 'healthy',
          checkedAt: '2026-05-21T18:00:00.000Z',
        },
        orders: [{
          providerOrderId: 'order-reconcile-1',
          requestId: 'request-reconcile-1',
          market: 'BTC-USDT',
          status: 'submitted',
          updatedAt: '2026-05-21T18:00:00.000Z',
        }],
        positions: {
          providerId: 'simulation',
          capturedAt: '2026-05-21T18:00:00.000Z',
          positions: [{
            market: 'BTC-USDT',
            side: 'long',
            quantity: '1',
            entryPrice: '100',
          }],
        },
        runtimes: [{
          runtimeInstanceId: 'runtime-reconcile-1',
          status: 'active',
          updatedAt: '2026-05-21T18:00:00.000Z',
        }],
        capturedAt: '2026-05-21T18:00:00.000Z',
      },
      providerSnapshot: {
        providerStatus: {
          providerId: 'simulation',
          type: 'simulation',
          connected: true,
          mode: 'paper',
          health: 'healthy',
          checkedAt: '2026-05-21T18:00:02.000Z',
        },
        orders: [{
          providerOrderId: 'order-reconcile-1',
          requestId: 'request-reconcile-1',
          market: 'BTC-USDT',
          status: 'submitted',
          updatedAt: '2026-05-21T18:00:02.000Z',
        }],
        positions: {
          providerId: 'simulation',
          capturedAt: '2026-05-21T18:00:02.000Z',
          positions: [{
            market: 'BTC-USDT',
            side: 'long',
            quantity: '1',
            entryPrice: '100',
          }],
        },
        runtimes: [{
          runtimeInstanceId: 'runtime-reconcile-1',
          status: 'active',
          updatedAt: '2026-05-21T18:00:02.000Z',
        }],
        capturedAt: '2026-05-21T18:00:02.000Z',
      },
      now: '2026-05-21T18:00:10.000Z',
      staleAfterMs: 300000,
      ...overrides,
    };
  }

  it('detects divergent provider state without mutating sovereign state', async () => {
    const service = new ProviderReconciliationService();
    const proposal = await service.reconcile(reconciliationRequest({
      providerSnapshot: {
        ...reconciliationRequest().providerSnapshot,
        providerStatus: {
          ...reconciliationRequest().providerSnapshot.providerStatus,
          health: 'degraded',
        },
      },
    }));

    assert.equal(proposal.mutatesSovereignState, false);
    assert.equal(proposal.state, 'reconciliation-required');
    assert.equal(proposal.findings.some((finding) => finding.type === 'provider-state-drift'), true);
  });

  it('detects stale runtime state', async () => {
    const service = new ProviderReconciliationService();
    const proposal = await service.reconcile(reconciliationRequest({
      now: '2026-05-21T18:10:01.000Z',
      staleAfterMs: 300000,
    }));

    const staleFinding = proposal.findings.find((finding) => finding.type === 'stale-execution-state');
    assert.equal(staleFinding?.state, 'stale');
    assert.equal(staleFinding?.runtimeInstanceId, 'runtime-reconcile-1');
  });

  it('detects orphan runtime state', async () => {
    const service = new ProviderReconciliationService();
    const proposal = await service.reconcile(reconciliationRequest({
      providerSnapshot: {
        ...reconciliationRequest().providerSnapshot,
        runtimes: [],
      },
    }));

    assert.equal(proposal.state, 'orphaned');
    assert.equal(proposal.findings.some((finding) => finding.type === 'orphan-runtime'), true);
    assert.equal(proposal.recommendedActions.includes('request-runtime-recovery'), true);
  });

  it('generates reconciliation proposal for order and position divergence', async () => {
    const service = new ProviderReconciliationService();
    const base = reconciliationRequest();
    const proposal = await service.reconcile(reconciliationRequest({
      providerSnapshot: {
        ...base.providerSnapshot,
        orders: [{
          ...base.providerSnapshot.orders[0],
          status: 'filled',
        }],
        positions: {
          ...base.providerSnapshot.positions,
          positions: [{
            ...base.providerSnapshot.positions.positions[0],
            quantity: '2',
          }],
        },
      },
    }));

    assert.equal(proposal.state, 'reconciliation-required');
    assert.equal(proposal.findings.some((finding) => finding.type === 'order-divergence'), true);
    assert.equal(proposal.findings.some((finding) => finding.type === 'position-divergence'), true);
    assert.equal(proposal.recommendedActions.includes('request-order-review'), true);
    assert.equal(proposal.recommendedActions.includes('request-position-review'), true);
  });

  it('keeps treasury and user reconciliation traces isolated', async () => {
    const repository = new InMemoryTradingEventRepository();
    const service = new ProviderReconciliationService({ eventBus: new TradingEventBus(repository) });

    await service.reconcile(reconciliationRequest({
      context: {
        ...reconciliationRequest().context,
        correlationId: 'corr-reconcile-user-1',
        userId: 'alice',
        daoId: undefined,
      },
    }));
    await service.reconcile(reconciliationRequest({
      context: {
        ...reconciliationRequest().context,
        correlationId: 'corr-reconcile-treasury-1',
        executionDomain: 'treasury',
        userId: undefined,
        daoId: 'dao-1',
        runtimeInstanceId: undefined,
        strategyProductId: undefined,
      },
    }));

    const userTrace = repository.queryByCorrelationId('corr-reconcile-user-1');
    const treasuryTrace = repository.queryByCorrelationId('corr-reconcile-treasury-1');
    assert.equal(userTrace.every((event) => event.userId === 'alice'), true);
    assert.equal(treasuryTrace.every((event) => event.daoId === 'dao-1'), true);
    assert.equal(treasuryTrace.every((event) => event.userId === undefined), true);
  });

  it('emits telemetry event when provider drift is detected', async () => {
    const repository = new InMemoryTradingEventRepository();
    const service = new ProviderReconciliationService({ eventBus: new TradingEventBus(repository) });
    const base = reconciliationRequest();

    await service.reconcile(reconciliationRequest({
      providerSnapshot: {
        ...base.providerSnapshot,
        providerStatus: {
          ...base.providerSnapshot.providerStatus,
          connected: false,
          health: 'offline',
        },
      },
    }));

    assert.equal(repository.queryByType('PROVIDER_RECONCILIATION_STARTED').length, 1);
    assert.equal(repository.queryByType('PROVIDER_DRIFT_DETECTED').length, 1);
    assert.equal(repository.queryByType('RECONCILIATION_REQUIRED').length, 1);
    assert.equal(repository.queryByType('PROVIDER_RECONCILIATION_COMPLETED').length, 1);
  });
});

describe('Reconciliation worker skeleton', () => {
  function reconciliationRequest(overrides = {}) {
    return {
      context: {
        correlationId: 'corr-reconcile-worker-1',
        executionDomain: 'user',
        userId: 'alice',
        strategyProductId: 'whiterabbit-scalper-futures',
        runtimeInstanceId: 'runtime-worker-1',
        providerId: 'simulation',
        strategyId: 'whiterabbit-v1',
      },
      sovereignSnapshot: {
        providerStatus: {
          providerId: 'simulation',
          type: 'simulation',
          connected: true,
          mode: 'paper',
          health: 'healthy',
          checkedAt: '2026-05-23T12:00:00.000Z',
        },
        orders: [{
          providerOrderId: 'order-worker-1',
          requestId: 'request-worker-1',
          market: 'BTC-USDT',
          status: 'submitted',
          updatedAt: '2026-05-23T12:00:00.000Z',
        }],
        positions: {
          providerId: 'simulation',
          capturedAt: '2026-05-23T12:00:00.000Z',
          positions: [{
            market: 'BTC-USDT',
            side: 'long',
            quantity: '1',
            entryPrice: '100',
          }],
        },
        runtimes: [{
          runtimeInstanceId: 'runtime-worker-1',
          status: 'active',
          updatedAt: '2026-05-23T12:00:00.000Z',
        }],
        capturedAt: '2026-05-23T12:00:00.000Z',
      },
      providerSnapshot: {
        providerStatus: {
          providerId: 'simulation',
          type: 'simulation',
          connected: true,
          mode: 'paper',
          health: 'healthy',
          checkedAt: '2026-05-23T12:00:02.000Z',
        },
        orders: [{
          providerOrderId: 'order-worker-1',
          requestId: 'request-worker-1',
          market: 'BTC-USDT',
          status: 'submitted',
          updatedAt: '2026-05-23T12:00:02.000Z',
        }],
        positions: {
          providerId: 'simulation',
          capturedAt: '2026-05-23T12:00:02.000Z',
          positions: [{
            market: 'BTC-USDT',
            side: 'long',
            quantity: '1',
            entryPrice: '100',
          }],
        },
        runtimes: [{
          runtimeInstanceId: 'runtime-worker-1',
          status: 'active',
          updatedAt: '2026-05-23T12:00:02.000Z',
        }],
        capturedAt: '2026-05-23T12:00:02.000Z',
      },
      now: '2026-05-23T12:00:10.000Z',
      staleAfterMs: 300000,
      ...overrides,
    };
  }

  function candidate(id, candidateType, request = reconciliationRequest()) {
    return {
      id,
      tenantId: request.context.daoId ?? request.context.userId ?? 'tenant:unknown',
      candidateType,
      request,
      discoveredAt: request.now ?? new Date().toISOString(),
      reason: `${candidateType} candidate`,
    };
  }

  function createWorkerHarness(candidates) {
    const repository = new InMemoryTradingEventRepository();
    const proposals = new ReconciliationProposalRepository();
    const worker = new ReconciliationWorker({
      discovery: new ReconciliationCandidateDiscoveryService(candidates),
      proposals,
      audit: new ReconciliationWorkerAuditService(new TradingEventBus(repository)),
    });
    return { proposals, repository, worker };
  }

  it('creates proposal from stale runtime scan candidate', async () => {
    const request = reconciliationRequest({
      now: '2026-05-23T12:10:01.000Z',
      staleAfterMs: 300000,
    });
    const harness = createWorkerHarness([candidate('candidate-stale-runtime-1', 'stale-runtime', request)]);

    const result = await harness.worker.run({ correlationId: 'corr-worker-stale-run-1', tenantId: 'alice' });
    const saved = await harness.proposals.listByTenant('alice');

    assert.equal(result.status, 'completed');
    assert.equal(result.proposalsCreated, 1);
    assert.equal(saved[0]?.reviewState, 'pending-review');
    assert.equal(saved[0]?.findings.some((finding) => finding.type === 'stale-execution-state'), true);
    assert.equal(harness.repository.queryByType('RECONCILIATION_PROPOSAL_CREATED').length, 1);
  });

  it('creates proposal from provider drift scan candidate', async () => {
    const request = reconciliationRequest({
      providerSnapshot: {
        ...reconciliationRequest().providerSnapshot,
        providerStatus: {
          ...reconciliationRequest().providerSnapshot.providerStatus,
          connected: false,
          health: 'offline',
        },
      },
    });
    const harness = createWorkerHarness([candidate('candidate-provider-drift-1', 'provider-drift', request)]);

    const result = await harness.worker.run({ correlationId: 'corr-worker-provider-run-1', tenantId: 'alice' });

    assert.equal(result.proposals[0]?.findings.some((finding) => finding.type === 'provider-state-drift'), true);
    assert.equal(result.proposals[0]?.mutatesSovereignState, false);
    assert.equal(harness.repository.queryByType('RECONCILIATION_PROPOSAL_REVIEW_REQUIRED').length, 1);
  });

  it('creates proposal from orphan runtime candidate', async () => {
    const request = reconciliationRequest({
      providerSnapshot: {
        ...reconciliationRequest().providerSnapshot,
        runtimes: [],
      },
    });
    const harness = createWorkerHarness([candidate('candidate-orphan-runtime-1', 'orphan-runtime', request)]);

    const result = await harness.worker.run({ correlationId: 'corr-worker-orphan-run-1', tenantId: 'alice' });

    assert.equal(result.proposals[0]?.state, 'orphaned');
    assert.equal(result.proposals[0]?.recommendedActions.includes('request-runtime-recovery'), true);
  });

  it('preserves tenant context on reconciliation proposals', async () => {
    const userRequest = reconciliationRequest({
      context: {
        ...reconciliationRequest().context,
        correlationId: 'corr-worker-user-tenant-1',
        userId: 'alice',
        daoId: undefined,
      },
      now: '2026-05-23T12:10:01.000Z',
    });
    const treasuryRequest = reconciliationRequest({
      context: {
        ...reconciliationRequest().context,
        correlationId: 'corr-worker-treasury-tenant-1',
        executionDomain: 'treasury',
        userId: undefined,
        daoId: 'dao-1',
        runtimeInstanceId: undefined,
        strategyProductId: undefined,
      },
      now: '2026-05-23T12:10:01.000Z',
    });
    const harness = createWorkerHarness([
      candidate('candidate-user-tenant-1', 'stale-runtime', userRequest),
      candidate('candidate-treasury-tenant-1', 'stale-runtime', treasuryRequest),
    ]);

    await harness.worker.run({ correlationId: 'corr-worker-user-run', tenantId: 'alice' });
    await harness.worker.run({ correlationId: 'corr-worker-treasury-run', tenantId: 'dao-1' });

    const userProposals = await harness.proposals.listByTenant('alice');
    const treasuryProposals = await harness.proposals.listByTenant('dao-1');

    assert.equal(userProposals.every((proposal) => proposal.context.userId === 'alice'), true);
    assert.equal(treasuryProposals.every((proposal) => proposal.context.daoId === 'dao-1'), true);
    assert.equal(treasuryProposals.every((proposal) => proposal.context.userId === undefined), true);
  });

  it('emits safe audit event when worker discovery fails', async () => {
    class FailingDiscovery {
      async discover() {
        throw new Error('discovery unavailable');
      }
    }
    const repository = new InMemoryTradingEventRepository();
    const worker = new ReconciliationWorker({
      discovery: new FailingDiscovery(),
      audit: new ReconciliationWorkerAuditService(new TradingEventBus(repository)),
    });

    const result = await worker.run({ correlationId: 'corr-worker-failure-1', tenantId: 'alice' });

    assert.equal(result.status, 'failed');
    assert.equal(result.errors.some((error) => error.includes('discovery unavailable')), true);
    assert.equal(repository.queryByType('RECONCILIATION_WORKER_COMPLETED')[0]?.payload.status, 'failed');
  });

  it('does not expose provider execution or auto-healing methods', async () => {
    const harness = createWorkerHarness([candidate('candidate-no-provider-call-1', 'provider-drift')]);

    assert.equal(typeof harness.worker.executeOrder, 'undefined');
    assert.equal(typeof harness.worker.cancelOrder, 'undefined');
    assert.equal(typeof harness.worker.connectProvider, 'undefined');
    assert.equal(typeof harness.worker.healRuntime, 'undefined');
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

describe('Runtime observability and operational telemetry', () => {
  function observabilityContext(overrides = {}) {
    return {
      tenantId: 'tenant-observability-1',
      correlationId: 'corr-observability-1',
      executionDomain: 'user',
      userId: 'alice',
      runtimeInstanceId: 'runtime-observability-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      ...overrides,
    };
  }

  it('updates observability state when runtime is degraded', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const service = new RuntimeObservabilityService(eventBus);

    const state = await service.record({
      context: observabilityContext(),
      status: 'degraded',
      uptimeMs: 30000,
      restartCount: 1,
      recoveryCount: 0,
      degradedPeriods: 2,
      failedExecutions: 1,
      averageLatencyMs: 650,
      executionDriftFrequency: 1,
      telemetryIngestionQuality: 0.9,
      measuredAt: '2026-05-21T17:00:00.000Z',
    });

    assert.equal(state.health.state, 'degraded');
    assert.equal(state.metrics.runtimeInstanceId, 'runtime-observability-1');
    assert.equal(service.get('tenant-observability-1', 'runtime-observability-1')?.metrics.restartCount, 1);
    assert.equal(repository.queryByType('RUNTIME_HEALTH_DEGRADED').length, 1);
  });

  it('updates provider health scoring on degradation', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const service = new ProviderObservabilityService(eventBus);

    const health = await service.record({
      context: observabilityContext({ correlationId: 'corr-provider-critical-1' }),
      status: 'critical',
      latencyMs: 2500,
      slippageBps: 90,
      rejectionRate: 0.3,
      fillRate: 0.6,
      degradationScore: 0.4,
      measuredAt: '2026-05-21T17:01:00.000Z',
    });

    assert.equal(health.state, 'critical');
    assert.equal(service.get('tenant-observability-1', 'simulation')?.state, 'critical');
    assert.equal(repository.queryByType('PROVIDER_HEALTH_CRITICAL').length, 1);
  });

  it('emits telemetry event for execution latency spike', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const tracker = new ExecutionLatencyTracker(eventBus);

    const health = await tracker.record({
      context: observabilityContext({ correlationId: 'corr-latency-spike-1' }),
      latencyMs: 1400,
      thresholdMs: 1000,
      measuredAt: '2026-05-21T17:02:00.000Z',
    });

    assert.equal(health.state, 'degraded');
    assert.equal(tracker.averageLatency('tenant-observability-1', 'runtime-observability-1'), 1400);
    assert.equal(repository.queryByType('EXECUTION_LATENCY_SPIKE').length, 1);
  });

  it('applies strategy degradation to health score', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const aggregator = new StrategyTelemetryAggregator(eventBus);

    const health = await aggregator.record({
      context: observabilityContext({ correlationId: 'corr-strategy-degraded-1' }),
      degradationScore: 0.7,
      drawdownPct: 10,
      signalFailureRate: 0.2,
      failedExecutions: 2,
      telemetryIngestionQuality: 0.95,
      measuredAt: '2026-05-21T17:03:00.000Z',
    });

    assert.equal(health.state, 'critical');
    assert.equal(aggregator.get('tenant-observability-1', 'whiterabbit-scalper-futures')?.state, 'critical');
    assert.equal(repository.queryByType('STRATEGY_HEALTH_DEGRADED').length, 1);
  });

  it('preserves tenant isolation in observability state', async () => {
    const service = new RuntimeObservabilityService();

    await service.record({
      context: observabilityContext({ tenantId: 'tenant-a', runtimeInstanceId: 'runtime-shared' }),
      status: 'healthy',
      uptimeMs: 1000,
    });
    await service.record({
      context: observabilityContext({ tenantId: 'tenant-b', runtimeInstanceId: 'runtime-shared' }),
      status: 'critical',
      failedExecutions: 5,
    });

    assert.equal(service.get('tenant-a', 'runtime-shared')?.health.state, 'healthy');
    assert.equal(service.get('tenant-b', 'runtime-shared')?.health.state, 'critical');
    assert.equal(service.listByTenant('tenant-a').length, 1);
    assert.equal(service.listByTenant('tenant-b').length, 1);
  });
});

describe('Trading observability query API', () => {
  function observabilityContext(overrides = {}) {
    return {
      tenantId: 'tenant-observability-api-1',
      correlationId: 'corr-observability-api-1',
      executionDomain: 'user',
      userId: 'alice',
      runtimeInstanceId: 'runtime-observability-api-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      ...overrides,
    };
  }

  async function createObservabilityApiHarness() {
    const runtimes = new RuntimeObservabilityService();
    const providers = new ProviderObservabilityService();
    const strategies = new StrategyTelemetryAggregator();
    const latency = new ExecutionLatencyTracker();
    const api = new TradingObservabilityApi(new TenantObservabilityQueryService({
      runtimes,
      providers,
      strategies,
      latency,
    }));

    await runtimes.record({
      context: observabilityContext(),
      status: 'degraded',
      uptimeMs: 5000,
      restartCount: 1,
      recoveryCount: 1,
      degradedPeriods: 1,
      failedExecutions: 1,
      averageLatencyMs: 750,
      executionDriftFrequency: 0,
      telemetryIngestionQuality: 0.9,
    });
    await providers.record({
      context: observabilityContext(),
      status: 'degraded',
      latencyMs: 800,
      slippageBps: 20,
      fillRate: 0.9,
    });
    await strategies.record({
      context: observabilityContext(),
      degradationScore: 0.45,
      drawdownPct: 4,
      signalFailureRate: 0.1,
      telemetryIngestionQuality: 0.9,
    });
    await latency.record({
      context: observabilityContext(),
      latencyMs: 750,
    });

    return { api, runtimes, providers, strategies };
  }

  it('returns normalized runtime health read model', async () => {
    const { api } = await createObservabilityApiHarness();

    const response = api.runtimeHealth(observabilityContext());

    assert.equal(response.ok, true);
    assert.equal(response.data.runtimeInstanceId, 'runtime-observability-api-1');
    assert.equal(response.data.health.state, 'degraded');
    assert.equal(response.data.metrics.restartCount, 1);
    assert.equal(response.data.advisoryOnly, true);
  });

  it('returns provider health without provider DTOs or secrets', async () => {
    const { api } = await createObservabilityApiHarness();

    const response = api.providerHealth(observabilityContext());
    const serialized = JSON.stringify(response.data);

    assert.equal(response.data.providerId, 'simulation');
    assert.equal(serialized.includes('connectorPayload'), false);
    assert.equal(serialized.includes('apiKey'), false);
    assert.equal(serialized.includes('secret'), false);
  });

  it('rejects cross-tenant runtime queries', async () => {
    const { api } = await createObservabilityApiHarness();

    const response = api.runtimeHealth(observabilityContext({
      tenantId: 'tenant-other',
      runtimeInstanceId: 'runtime-observability-api-1',
    }));

    assert.equal(response.ok, true);
    assert.equal(response.data, undefined);
  });

  it('returns strategy health summary without sensitive data', async () => {
    const { api } = await createObservabilityApiHarness();

    const response = api.strategyHealth(observabilityContext());
    const serialized = JSON.stringify(response.data);

    assert.equal(response.data.strategyKey, 'whiterabbit-scalper-futures');
    assert.equal(response.data.advisoryOnly, true);
    assert.equal(serialized.includes('privateKey'), false);
    assert.equal(serialized.includes('providerDto'), false);
    assert.equal(serialized.includes('rawPayload'), false);
  });

  it('returns tenant-scoped operational snapshot', async () => {
    const { api } = await createObservabilityApiHarness();

    const response = api.snapshot(observabilityContext());

    assert.equal(response.data.tenantId, 'tenant-observability-api-1');
    assert.equal(response.data.runtimeHealth.runtimeInstanceId, 'runtime-observability-api-1');
    assert.equal(response.data.providerHealth.providerId, 'simulation');
    assert.equal(response.data.executionLatency.averageLatencyMs, 750);
    assert.equal(response.data.advisoryOnly, true);
  });

  it('does not expose runtime mutation or provider execution methods', async () => {
    const { api } = await createObservabilityApiHarness();

    assert.equal(typeof api.executeOrder, 'undefined');
    assert.equal(typeof api.pauseRuntime, 'undefined');
    assert.equal(typeof api.connectProvider, 'undefined');
  });
});

describe('Trinity observability integration', () => {
  function observabilityContext(overrides = {}) {
    return {
      tenantId: 'tenant-trinity-observability-1',
      correlationId: 'corr-trinity-observability-1',
      executionDomain: 'user',
      userId: 'alice',
      runtimeInstanceId: 'runtime-trinity-observability-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      ...overrides,
    };
  }

  function createTrinityObservabilityHarness() {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const state = new TradingStateService();
    eventBus.subscribe((event) => state.applyEvent(event));
    const runtimes = new RuntimeObservabilityService(eventBus);
    const providers = new ProviderObservabilityService(eventBus);
    const strategies = new StrategyTelemetryAggregator(eventBus);
    const latency = new ExecutionLatencyTracker(eventBus);
    const api = new TradingObservabilityApi(new TenantObservabilityQueryService({
      runtimes,
      providers,
      strategies,
      latency,
    }));
    const adapter = new TrinityObservabilityAdapter(api, {
      audit: new ObservabilityRecommendationAuditService(eventBus),
    });

    return {
      adapter,
      api,
      eventBus,
      latency,
      providers,
      repository,
      runtimes,
      state,
      strategies,
    };
  }

  it('creates runtime recovery recommendation from degraded runtime health', async () => {
    const harness = createTrinityObservabilityHarness();
    await harness.runtimes.record({
      context: observabilityContext(),
      status: 'degraded',
      uptimeMs: 5000,
      restartCount: 2,
      recoveryCount: 1,
      degradedPeriods: 2,
      failedExecutions: 1,
      averageLatencyMs: 900,
      telemetryIngestionQuality: 0.95,
    });

    const recommendations = await harness.adapter.evaluate(observabilityContext());

    assert.equal(recommendations.some((recommendation) => recommendation.recommendationType === 'recommend-runtime-recovery'), true);
    assert.equal(recommendations.every((recommendation) => recommendation.requiresAcs), true);
    assert.equal(recommendations.every((recommendation) => recommendation.authorizedExecution === false), true);
    assert.equal(recommendations[0].correlationId, 'corr-trinity-observability-1');
  });

  it('creates provider block recommendation from critical provider health', async () => {
    const harness = createTrinityObservabilityHarness();
    await harness.providers.record({
      context: observabilityContext({ correlationId: 'corr-trinity-provider-critical-1' }),
      status: 'critical',
      latencyMs: 2400,
      slippageBps: 120,
      rejectionRate: 0.4,
      fillRate: 0.5,
      degradationScore: 0.5,
    });

    const recommendations = await harness.adapter.evaluate(observabilityContext({ correlationId: 'corr-trinity-provider-critical-1' }));
    const providerBlock = recommendations.find((recommendation) => recommendation.recommendationType === 'recommend-provider-block');

    assert.equal(providerBlock?.authorizedExecution, false);
    assert.equal(providerBlock?.proposedAction.approvalPath.includes('ACS'), true);
    assert.equal(JSON.stringify(providerBlock).includes('providerDto'), false);
  });

  it('creates pause and simulation recommendations from degraded strategy health', async () => {
    const harness = createTrinityObservabilityHarness();
    await harness.strategies.record({
      context: observabilityContext({ correlationId: 'corr-trinity-strategy-degraded-1' }),
      degradationScore: 0.45,
      drawdownPct: 6,
      signalFailureRate: 0.05,
      telemetryIngestionQuality: 0.9,
    });

    const recommendations = await harness.adapter.evaluate(observabilityContext({ correlationId: 'corr-trinity-strategy-degraded-1' }));
    const types = recommendations.map((recommendation) => recommendation.recommendationType);

    assert.equal(types.includes('recommend-strategy-pause'), true);
    assert.equal(types.includes('recommend-simulation'), true);
    assert.equal(recommendations.every((recommendation) => recommendation.tenantId === 'tenant-trinity-observability-1'), true);
  });

  it('creates telemetry review recommendation from execution latency spike', async () => {
    const harness = createTrinityObservabilityHarness();
    await harness.runtimes.record({
      context: observabilityContext({ correlationId: 'corr-trinity-latency-1' }),
      status: 'healthy',
      uptimeMs: 12000,
      telemetryIngestionQuality: 0.95,
    });
    await harness.latency.record({
      context: observabilityContext({ correlationId: 'corr-trinity-latency-1' }),
      latencyMs: 1600,
      thresholdMs: 1000,
    });

    const recommendations = await harness.adapter.evaluate(observabilityContext({ correlationId: 'corr-trinity-latency-1' }));
    const telemetryReview = recommendations.find((recommendation) => recommendation.recommendationType === 'recommend-telemetry-review');

    assert.equal(telemetryReview?.authorizedExecution, false);
    assert.equal(telemetryReview?.proposedAction.advisoryOnly, true);
    assert.equal(telemetryReview?.proposedAction.observabilityEvidence.averageLatencyMs, 1600);
  });

  it('keeps ACS approval required for observability recommendations', async () => {
    const harness = createTrinityObservabilityHarness();
    await harness.runtimes.record({
      context: observabilityContext({ correlationId: 'corr-trinity-acs-required-1' }),
      status: 'critical',
      uptimeMs: 2000,
      failedExecutions: 4,
      telemetryIngestionQuality: 0.5,
    });

    const recommendations = await harness.adapter.evaluate(observabilityContext({ correlationId: 'corr-trinity-acs-required-1' }));

    assert.equal(typeof harness.adapter.executeOrder, 'undefined');
    assert.equal(typeof harness.adapter.pauseRuntime, 'undefined');
    assert.equal(recommendations.length > 0, true);
    assert.equal(recommendations.every((recommendation) => recommendation.requiresAcs), true);
    assert.equal(recommendations.every((recommendation) => recommendation.proposedAction.approvalPath.includes('ACS')), true);
  });

  it('persists audit trail for observability recommendation lifecycle', async () => {
    const harness = createTrinityObservabilityHarness();
    await harness.providers.record({
      context: observabilityContext({ correlationId: 'corr-trinity-observability-audit-1' }),
      status: 'critical',
      latencyMs: 3000,
      rejectionRate: 0.5,
      fillRate: 0.4,
      degradationScore: 0.6,
    });

    await harness.adapter.evaluate(observabilityContext({ correlationId: 'corr-trinity-observability-audit-1' }));

    const trace = harness.repository.queryByCorrelationId('corr-trinity-observability-audit-1');
    const audit = harness.state.audit.listByCorrelationId('corr-trinity-observability-audit-1');

    assert.equal(trace.some((event) => event.type === 'TRINITY_OBSERVABILITY_EVIDENCE_RECORDED'), true);
    assert.equal(trace.some((event) => event.type === 'TRINITY_OBSERVABILITY_RECOMMENDATION_CREATED'), true);
    assert.equal(audit.some((record) => record.eventType === 'TRINITY_OBSERVABILITY_RECOMMENDATION_CREATED'), true);
  });
});

describe('Observability risk feedback policy', () => {
  function riskContext(overrides = {}) {
    return {
      tenantId: 'tenant-risk-observability-1',
      requestedBy: 'risk-service',
      correlationId: 'corr-risk-observability-1',
      executionDomain: 'user',
      userId: 'alice',
      runtimeInstanceId: 'runtime-risk-observability-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      ...overrides,
    };
  }

  function health(state, overrides = {}) {
    return {
      state,
      score: state === 'critical' ? 0.2 : state === 'degraded' ? 0.55 : 1,
      reasons: state === 'healthy' ? [] : [`${state} observability state`],
      measuredAt: '2026-05-23T10:00:00.000Z',
      ...overrides,
    };
  }

  function snapshot(overrides = {}) {
    const context = riskContext();
    return {
      tenantId: context.tenantId,
      providerHealth: {
        tenantId: context.tenantId,
        providerId: context.providerId,
        health: health('healthy'),
        advisoryOnly: true,
      },
      runtimeHealth: {
        tenantId: context.tenantId,
        runtimeInstanceId: context.runtimeInstanceId,
        providerId: context.providerId,
        strategyProductId: context.strategyProductId,
        health: health('healthy'),
        metrics: {
          tenantId: context.tenantId,
          runtimeInstanceId: context.runtimeInstanceId,
          providerId: context.providerId,
          strategyProductId: context.strategyProductId,
          uptimeMs: 1000,
          restartCount: 0,
          recoveryCount: 0,
          degradedPeriods: 0,
          failedExecutions: 0,
          averageLatencyMs: 100,
          executionDriftFrequency: 0,
          updatedAt: '2026-05-23T10:00:00.000Z',
        },
        advisoryOnly: true,
      },
      strategyHealth: {
        tenantId: context.tenantId,
        strategyKey: context.strategyProductId,
        health: health('healthy'),
        advisoryOnly: true,
      },
      telemetryIngestionQuality: health('healthy'),
      executionLatency: {
        runtimeInstanceId: context.runtimeInstanceId,
        averageLatencyMs: 100,
      },
      degraded: false,
      critical: false,
      advisoryOnly: true,
      generatedAt: '2026-05-23T10:00:00.000Z',
      ...overrides,
    };
  }

  function createRiskObservabilityHarness() {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const state = new TradingStateService();
    eventBus.subscribe((event) => state.applyEvent(event));
    const service = new ObservabilityRiskDecisionService({
      audit: new ObservabilityRiskAuditService(eventBus),
    });
    return { repository, service, state };
  }

  it('generates provider block proposal for critical provider without direct block mutation', async () => {
    const harness = createRiskObservabilityHarness();
    const decisions = await harness.service.evaluate(riskContext({ correlationId: 'corr-risk-provider-critical-1' }), snapshot({
      providerHealth: {
        tenantId: 'tenant-risk-observability-1',
        providerId: 'simulation',
        health: health('critical'),
        advisoryOnly: true,
      },
      critical: true,
    }));
    const decision = decisions.find((entry) => entry.decision === 'recommend-block');

    assert.equal(decision?.status, 'proposal');
    assert.equal(decision?.authorizedExecution, false);
    assert.equal(decision?.mutatesProvider, false);
    assert.equal(typeof harness.service.blockProvider, 'undefined');
    assert.equal(harness.repository.queryByType('PROVIDER_BLOCK_RECOMMENDED').length, 1);
  });

  it('generates recovery-required decision for critical runtime', async () => {
    const harness = createRiskObservabilityHarness();
    const decisions = await harness.service.evaluate(riskContext({ correlationId: 'corr-risk-runtime-critical-1' }), snapshot({
      runtimeHealth: {
        ...snapshot().runtimeHealth,
        health: health('critical'),
      },
      critical: true,
    }));

    assert.equal(decisions.some((decision) => decision.decision === 'require-recovery'), true);
    assert.equal(harness.repository.queryByType('RUNTIME_RECOVERY_REQUIRED').length, 1);
  });

  it('requires strategy revalidation for degraded strategy health', async () => {
    const harness = createRiskObservabilityHarness();
    const decisions = await harness.service.evaluate(riskContext({ correlationId: 'corr-risk-strategy-degraded-1' }), snapshot({
      strategyHealth: {
        tenantId: 'tenant-risk-observability-1',
        strategyKey: 'whiterabbit-scalper-futures',
        health: health('degraded'),
        advisoryOnly: true,
      },
      degraded: true,
    }));

    assert.equal(decisions.some((decision) => decision.decision === 'require-simulation'), true);
    assert.equal(harness.repository.queryByType('STRATEGY_REVALIDATION_REQUIRED').length, 1);
  });

  it('rejects cross-tenant observability risk signals', async () => {
    const harness = createRiskObservabilityHarness();

    await assert.rejects(
      () => harness.service.evaluate(riskContext(), snapshot({
        providerHealth: {
          tenantId: 'tenant-other',
          providerId: 'simulation',
          health: health('critical'),
          advisoryOnly: true,
        },
      })),
      ObservabilityRiskBoundaryError,
    );
  });

  it('preserves tenantId and correlationId in risk decisions and audit trail', async () => {
    const harness = createRiskObservabilityHarness();
    const decisions = await harness.service.evaluate(riskContext({ correlationId: 'corr-risk-audit-1' }), snapshot({
      executionLatency: {
        runtimeInstanceId: 'runtime-risk-observability-1',
        averageLatencyMs: 1500,
      },
    }));
    const trace = harness.repository.queryByCorrelationId('corr-risk-audit-1');
    const audit = harness.state.audit.listByCorrelationId('corr-risk-audit-1');

    assert.equal(decisions.some((decision) => decision.decision === 'require-review'), true);
    assert.equal(decisions.every((decision) => decision.tenantId === 'tenant-risk-observability-1'), true);
    assert.equal(decisions.every((decision) => decision.correlationId === 'corr-risk-audit-1'), true);
    assert.equal(trace.some((event) => event.type === 'OBSERVABILITY_RISK_SIGNAL_CREATED'), true);
    assert.equal(audit.some((record) => record.eventType === 'OBSERVABILITY_RISK_REVIEW_REQUIRED'), true);
  });

  it('keeps the normal risk gateway as final execution authority', async () => {
    const harness = createRiskObservabilityHarness();
    const decisions = await harness.service.evaluate(riskContext({ correlationId: 'corr-risk-final-authority-1' }), snapshot({
      providerHealth: {
        tenantId: 'tenant-risk-observability-1',
        providerId: 'simulation',
        health: health('critical'),
        advisoryOnly: true,
      },
      critical: true,
    }));
    const gateway = new RiskGateway(false);
    const result = await gateway.check(userIntent({
      id: 'intent-risk-final-authority',
      correlationId: 'corr-risk-final-authority-1',
    }));

    assert.equal(decisions[0]?.authorizedExecution, false);
    assert.equal(result.status, 'rejected');
    assert.equal(result.violations.includes('Risk approval required before provider execution'), true);
  });
});

describe('HummingbotProvider', () => {
  it('boots a paper runtime lifecycle', async () => {
    const eventBus = new TradingEventBus();
    const client = new InMemoryHummingbotRuntimeClient();
    const provider = new HummingbotProvider({
      runtime: new HummingbotRuntime(client),
      eventBus,
    });

    await provider.connect();

    const status = await provider.getStatus();
    assert.equal(client.bootCount, 1);
    assert.equal(status.connected, true);
    assert.equal(status.mode, 'paper');
    assert.equal(eventBus.list().some((event) => event.type === 'HUMMINGBOT_RUNTIME_STARTED'), true);
  });

  it('is resolved through the provider registry', () => {
    const registry = new ExecutionProviderRegistry();
    const provider = new HummingbotProvider();

    registry.register(provider);

    assert.equal(registry.get('hummingbot'), provider);
  });

  it('emits events when runtime health changes', async () => {
    const eventBus = new TradingEventBus();
    const client = new InMemoryHummingbotRuntimeClient();
    const provider = new HummingbotProvider({
      runtime: new HummingbotRuntime(client),
      eventBus,
    });

    await provider.connect();
    client.healthState = {
      online: false,
      degraded: true,
      connectors: [{ name: 'binance_paper_trade', available: false, paperTrading: true }],
      message: 'runtime offline',
    };
    await provider.getStatus();

    const healthEvents = eventBus.list().filter((event) => event.type === 'PROVIDER_HEALTH_CHANGED');
    const connectorEvents = eventBus.list().filter((event) => event.type === 'PROVIDER_CONNECTOR_STATE_CHANGED');
    assert.equal(healthEvents.length, 1);
    assert.equal(connectorEvents.length, 1);
  });

  it('emits Hummingbot runtime degradation telemetry', async () => {
    const eventBus = new TradingEventBus();
    const client = new InMemoryHummingbotRuntimeClient();
    const provider = new HummingbotProvider({
      runtime: new HummingbotRuntime(client),
      eventBus,
    });

    await provider.connect();
    await provider.markRuntimeDegraded('paper runtime heartbeat missed', 'corr-hb-degraded-1');

    const degradationEvent = eventBus.list().find((event) => event.type === 'HUMMINGBOT_RUNTIME_DEGRADED');
    assert.equal(degradationEvent?.correlationId, 'corr-hb-degraded-1');
    assert.equal(degradationEvent?.payload.providerId, 'hummingbot');
  });

  it('generates normalized fills without exposing Hummingbot DTOs', async () => {
    const provider = new HummingbotProvider();

    const result = await provider.executeOrder({
      requestId: 'hb-request-1',
      providerId: 'hummingbot',
      market: 'BTC-USDT',
      side: 'buy',
      orderType: 'market',
      quantity: '1',
      price: '101',
    });

    assert.equal(result.status, 'submitted');
    assert.equal(result.fills?.length, 1);
    assert.equal(result.fills?.[0]?.market, 'BTC-USDT');
    assert.equal(result.fills?.[0]?.side, 'buy');
    assert.equal(result.fills?.[0]?.quantity, '1');
    assert.equal(result.fills?.[0]?.price, '101');
  });

  it('handles connector failure safely through normalized provider health', async () => {
    const eventBus = new TradingEventBus();
    const client = new InMemoryHummingbotRuntimeClient();
    const provider = new HummingbotProvider({
      runtime: new HummingbotRuntime(client),
      eventBus,
    });

    await provider.connect();
    client.healthState = {
      online: true,
      connectors: [{ name: 'binance_paper_trade', available: false, paperTrading: true }],
      message: 'connector unavailable',
    };

    const status = await provider.getStatus();
    assert.equal(status.health, 'degraded');
    assert.equal(eventBus.list().some((event) => event.type === 'HUMMINGBOT_CONNECTOR_UNAVAILABLE'), true);
  });

  it('restarts runtime while preserving correlationId', async () => {
    const eventBus = new TradingEventBus();
    const client = new InMemoryHummingbotRuntimeClient();
    const provider = new HummingbotProvider({
      runtime: new HummingbotRuntime(client),
      eventBus,
    });

    await provider.connect();
    await provider.restart('corr-hb-restart-1');

    const restartEvents = eventBus.list().filter((event) => event.correlationId === 'corr-hb-restart-1');
    assert.equal(client.restartCount, 1);
    assert.equal(restartEvents.some((event) => event.type === 'HUMMINGBOT_RUNTIME_STOPPED'), true);
    assert.equal(restartEvents.some((event) => event.type === 'HUMMINGBOT_RUNTIME_STARTED'), true);
    assert.equal(restartEvents.some((event) => event.type === 'HUMMINGBOT_RUNTIME_RECOVERED'), true);
  });

  it('ingests runtime telemetry through normalized streams', async () => {
    const provider = new HummingbotProvider();

    const telemetry = await provider.ingestRuntimeTelemetry();

    assert.equal(telemetry.balances.providerId, 'hummingbot');
    assert.equal(Array.isArray(telemetry.positions.positions), true);
    assert.equal(telemetry.orders.length, 0);
  });

  it('propagates emergency shutdown to the runtime', async () => {
    const client = new InMemoryHummingbotRuntimeClient();
    const provider = new HummingbotProvider({
      runtime: new HummingbotRuntime(client),
    });

    await provider.connect();
    await provider.emergencyShutdown('phase-2a-test');

    assert.equal(client.emergencyShutdownReason, 'phase-2a-test');
    const status = await provider.getStatus();
    assert.equal(status.connected, false);
    assert.equal(status.health, 'offline');
  });

  it('does not export Hummingbot DTO types from the service boundary', async () => {
    const coreExports = await import('../../../../dist-test/trading-core/services/trading-core/src/index.js');

    assert.equal(Object.hasOwn(coreExports, 'HummingbotOrderDto'), false);
    assert.equal(Object.hasOwn(coreExports, 'HummingbotFillDto'), false);
    assert.equal(Object.hasOwn(coreExports, 'HummingbotBalanceDto'), false);
    assert.equal(Object.hasOwn(coreExports, 'HummingbotPositionDto'), false);
  });
});

describe('WhiteRabbit product runtime', () => {
  it('provisions two users on the same strategy product with isolated runtime state', () => {
    const lifecycle = new RuntimeLifecycleService();
    const provisioner = new UserRuntimeProvisioner(lifecycle);
    const product = new WhiteRabbitProductAdapter().toStrategyProduct();

    const alice = provisioner.provision({
      userId: 'alice',
      strategyProduct: product,
      userProfile: userProfile('alice'),
      providerId: 'simulation',
    });
    const bob = provisioner.provision({
      userId: 'bob',
      strategyProduct: product,
      userProfile: userProfile('bob'),
      providerId: 'simulation',
    });

    assert.equal(alice.runtime.strategyProductId, product.id);
    assert.equal(bob.runtime.strategyProductId, product.id);
    assert.notEqual(alice.runtime.id, bob.runtime.id);
    assert.notEqual(alice.isolation.credentialBindingId, bob.isolation.credentialBindingId);
    assert.notEqual(alice.isolation.positionScopeId, bob.isolation.positionScopeId);
    assert.notEqual(alice.isolation.balanceScopeId, bob.isolation.balanceScopeId);
    assert.notEqual(alice.isolation.executionStateScopeId, bob.isolation.executionStateScopeId);
  });

  it('blocks provisioning when runtime quota is exhausted', () => {
    const lifecycle = new RuntimeLifecycleService();
    const provisioner = new UserRuntimeProvisioner(lifecycle);
    const product = new WhiteRabbitProductAdapter().toStrategyProduct();
    const profile = userProfile('alice');

    provisioner.provision({
      userId: 'alice',
      strategyProduct: product,
      userProfile: profile,
      providerId: 'simulation',
    });

    assert.throws(
      () => provisioner.provision({
        userId: 'alice',
        strategyProduct: product,
        userProfile: profile,
        providerId: 'hummingbot',
      }),
      RuntimeProvisioningError,
    );
  });

  it('blocks execution for a suspended provisioned runtime', async () => {
    const lifecycle = new RuntimeLifecycleService();
    const provisioner = new UserRuntimeProvisioner(lifecycle);
    const product = new WhiteRabbitProductAdapter().toStrategyProduct();
    const profile = userProfile('alice');
    const record = provisioner.provision({
      userId: 'alice',
      strategyProduct: product,
      userProfile: profile,
      providerId: 'simulation',
    });
    const suspended = lifecycle.suspend(record.runtime.id);

    const { orchestrator, simulationProvider } = createHarness({
      productGate: new ProductExecutionGate({
        strategyProducts: [product],
        userProfiles: [profile],
        runtimeInstances: [suspended],
        executionQuotas: [{ strategyId: product.id, maxOrdersPerDay: 25, maxConcurrentPositions: 2 }],
        dailyExecutionCounts: { [`alice:${product.id}`]: 0 },
        activeRuntimeCounts: { alice: 1 },
        activeStrategyCounts: { alice: 1 },
        concurrentPositionCounts: { [`alice:${product.id}`]: 0 },
      }),
      riskApproved: true,
    });

    await assertBlocked(orchestrator.execute(userIntent({
      context: {
        executionDomain: 'user',
        userId: 'alice',
        strategyProductId: product.id,
        runtimeInstanceId: record.runtime.id,
        providerId: 'simulation',
        strategyId: 'whiterabbit-v1',
      },
    })), 'PRODUCT_GATE_BLOCKED');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('recovers runtime while preserving tenant-scoped telemetry state', () => {
    const lifecycle = new RuntimeLifecycleService();
    const provisioner = new UserRuntimeProvisioner(lifecycle);
    const product = new WhiteRabbitProductAdapter().toStrategyProduct();
    const record = provisioner.provision({
      userId: 'alice',
      strategyProduct: product,
      userProfile: userProfile('alice'),
      providerId: 'simulation',
    });

    lifecycle.incrementExecution(record.runtime.id, '2026-05-20T12:00:00.000Z');
    lifecycle.suspend(record.runtime.id);
    const recovered = lifecycle.recover(record.runtime.id);
    const recoveredRecord = lifecycle.get(record.runtime.id);

    assert.equal(recovered.status, 'active');
    assert.equal(recoveredRecord?.telemetry.executionCount, 1);
    assert.equal(recoveredRecord?.telemetry.userId, 'alice');
    assert.equal(recoveredRecord?.isolation.credentialBindingId, record.isolation.credentialBindingId);
  });

  it('keeps telemetry tenant-scoped across users', () => {
    const lifecycle = new RuntimeLifecycleService();
    const provisioner = new UserRuntimeProvisioner(lifecycle);
    const product = new WhiteRabbitProductAdapter().toStrategyProduct();

    const alice = provisioner.provision({
      userId: 'alice',
      strategyProduct: product,
      userProfile: userProfile('alice'),
      providerId: 'simulation',
    });
    const bob = provisioner.provision({
      userId: 'bob',
      strategyProduct: product,
      userProfile: userProfile('bob'),
      providerId: 'simulation',
    });

    lifecycle.incrementExecution(alice.runtime.id);
    lifecycle.incrementExecution(alice.runtime.id);
    lifecycle.incrementExecution(bob.runtime.id);

    assert.equal(lifecycle.get(alice.runtime.id)?.telemetry.executionCount, 2);
    assert.equal(lifecycle.get(bob.runtime.id)?.telemetry.executionCount, 1);
  });

  it('supports WhiteRabbit as treasury strategy and user product simultaneously', () => {
    const provider = new WhiteRabbitStrategyProvider();
    const product = provider.product;
    const signal = provider.createHoldSignal('2026-05-20T12:00:00.000Z');

    assert.equal(provider.supportsTreasuryExecution(), true);
    assert.equal(provider.supportsUserProductExecution(), true);
    assert.equal(product.id, 'whiterabbit-scalper-futures');
    assert.equal(product.visibility, 'premium');
    assert.equal(product.accessPolicy.allowedSubscriptionTiers?.includes('premium'), true);
    assert.equal(signal.strategyId, 'whiterabbit-v1');
  });
});

describe('WhiteRabbit runtime engine', () => {
  function whiteRabbitContext(overrides = {}) {
    return {
      executionDomain: 'user',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-wr-alice-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      ...overrides,
    };
  }

  function whiteRabbitCandles(overrides = {}) {
    const candles = Array.from({ length: 19 }, (_, index) => ({
      market: 'BTC-USDT',
      open: 100,
      high: 102,
      low: 98,
      close: 100,
      volume: 100,
      pattern: 'inside-bar',
      closedAt: `2026-05-21T18:${String(index).padStart(2, '0')}:00.000Z`,
    }));
    candles.push({
      market: 'BTC-USDT',
      open: 95,
      high: 96,
      low: 79,
      close: 80,
      volume: 250,
      pattern: 'engulfing',
      closedAt: '2026-05-21T18:20:00.000Z',
      ...overrides,
    });
    return candles;
  }

  it('generates normalized signals through the signal pipeline', async () => {
    const engine = new WhiteRabbitRuntimeEngine();
    await engine.provision(whiteRabbitContext(), undefined, 'corr-wr-start-1');

    const signal = await engine.simulate('runtime-wr-alice-1', whiteRabbitCandles(), '2026-05-21T18:21:00.000Z');

    assert.equal(signal.strategyId, 'whiterabbit-v1');
    assert.equal(signal.strategyProductId, 'whiterabbit-scalper-futures');
    assert.equal(signal.runtimeInstanceId, 'runtime-wr-alice-1');
    assert.equal(signal.action, 'buy');
    assert.equal(signal.trace.bollingerPosition, 'below-lower');
    assert.equal(signal.trace.rsiConfirmed, true);
    assert.equal(signal.trace.volumeConfirmed, true);
    assert.equal(signal.trace.candlestickConfirmed, true);
  });

  it('preserves tenant isolation across WhiteRabbit runtime instances', async () => {
    const engine = new WhiteRabbitRuntimeEngine();
    await engine.provision(whiteRabbitContext({ userId: 'alice', runtimeInstanceId: 'runtime-wr-alice-1' }));
    await engine.provision(whiteRabbitContext({ userId: 'bob', runtimeInstanceId: 'runtime-wr-bob-1' }));

    await engine.simulate('runtime-wr-alice-1', whiteRabbitCandles(), '2026-05-21T18:21:00.000Z');
    await engine.simulate('runtime-wr-bob-1', whiteRabbitCandles({ close: 120, high: 121, low: 99 }), '2026-05-21T18:22:00.000Z');

    const alice = engine.getState('runtime-wr-alice-1');
    const bob = engine.getState('runtime-wr-bob-1');
    assert.equal(alice?.context.userId, 'alice');
    assert.equal(bob?.context.userId, 'bob');
    assert.notEqual(alice?.lastSignal?.id, bob?.lastSignal?.id);
  });

  it('enforces simulation-first lifecycle in the WhiteRabbit product adapter', () => {
    const provider = new WhiteRabbitStrategyProvider();
    const product = new WhiteRabbitProductAdapter();

    assert.equal(provider.executionProfile.simulationFirst, true);
    assert.equal(product.executionProfile().productionMutationAllowed, false);
    assert.equal(product.executionProfile().supportedLifecycle.includes('controlled-execution-proposal'), true);
  });

  it('keeps Trinity parameter proposal bounded by governance and risk approval', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const engine = new WhiteRabbitRuntimeEngine(undefined, undefined, undefined, eventBus);

    const proposal = await engine.proposeParameterMutation({
      correlationId: 'corr-wr-trinity-proposal-1',
      context: whiteRabbitContext(),
      proposedBy: 'trinity',
      proposedConfig: {
        bollinger: {
          period: 21,
          standardDeviation: 2.1,
        },
      },
      simulationCompleted: true,
      governanceApproved: false,
      riskApproved: true,
    });

    const event = repository.queryByType('WHITERABBIT_PARAMETER_PROPOSAL_CREATED')[0];
    assert.equal(proposal.productionMutationAllowed, false);
    assert.equal(event?.payload.approvedForControlledExecutionProposal, false);
    assert.equal(event?.correlationId, 'corr-wr-trinity-proposal-1');
  });

  it('persists runtime telemetry through normalized WhiteRabbit events', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const engine = new WhiteRabbitRuntimeEngine(undefined, undefined, undefined, eventBus);
    await engine.provision(whiteRabbitContext());

    await engine.simulate('runtime-wr-alice-1', whiteRabbitCandles(), '2026-05-21T18:21:00.000Z');
    await engine.simulate('runtime-wr-alice-1', whiteRabbitCandles({ close: 81 }), '2026-05-21T18:22:00.000Z');

    const telemetry = engine.getTelemetry('runtime-wr-alice-1');
    const events = repository.queryByType('WHITERABBIT_SIGNAL_CREATED');
    assert.equal(telemetry?.signalCount, 2);
    assert.equal(telemetry?.lastSignalAction, 'buy');
    assert.equal(events.length, 2);
  });

  it('keeps strategy state normalized and emits pause/degradation lifecycle events', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const engine = new WhiteRabbitRuntimeEngine(undefined, undefined, undefined, eventBus);
    await engine.provision(whiteRabbitContext(), undefined, 'corr-wr-state-start-1');
    await engine.simulate('runtime-wr-alice-1', whiteRabbitCandles(), '2026-05-21T18:21:00.000Z');
    await engine.pause('runtime-wr-alice-1', 'corr-wr-pause-1');
    await engine.degrade('runtime-wr-alice-1', 'provider drift detected', 'corr-wr-degrade-1');

    const state = engine.getState('runtime-wr-alice-1');
    assert.equal(state?.status, 'degraded');
    assert.equal(state?.context.executionDomain, 'user');
    assert.equal(state?.lastSignal?.trace.reasons.some((reason) => reason.startsWith('bollinger=')), true);
    assert.equal(repository.queryByType('WHITERABBIT_RUNTIME_STARTED').length, 1);
    assert.equal(repository.queryByType('WHITERABBIT_RUNTIME_PAUSED').length, 1);
    assert.equal(repository.queryByType('WHITERABBIT_RUNTIME_DEGRADED').length, 1);
  });
});

describe('TradingStateService', () => {
  it('updates execution state from normalized execution events', async () => {
    const state = new TradingStateService();

    await state.applyEvent({
      id: 'state-event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-20T12:00:00.000Z',
      correlationId: 'corr-state-1',
      source: 'core',
      userId: 'user-1',
      runtimeInstanceId: 'runtime-1',
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        requestId: 'request-state-1',
        providerId: 'simulation',
        market: 'BTC-USDT',
      },
    });
    await state.applyEvent({
      id: 'state-event-2',
      type: 'ORDER_SUBMITTED',
      occurredAt: '2026-05-20T12:00:01.000Z',
      correlationId: 'corr-state-1',
      source: 'provider',
      userId: 'user-1',
      runtimeInstanceId: 'runtime-1',
      payload: {
        result: {
          requestId: 'request-state-1',
          providerOrderId: 'sim-order-1',
        },
        providerId: 'simulation',
      },
    });
    await state.applyEvent({
      id: 'state-event-3',
      type: 'ORDER_FILLED',
      occurredAt: '2026-05-20T12:00:02.000Z',
      correlationId: 'corr-state-1',
      source: 'provider',
      userId: 'user-1',
      runtimeInstanceId: 'runtime-1',
      payload: {
        providerId: 'simulation',
        fill: {
          fillId: 'fill-state-1',
          providerOrderId: 'sim-order-1',
          market: 'BTC-USDT',
          side: 'buy',
          quantity: '1',
          price: '100',
          filledAt: '2026-05-20T12:00:02.000Z',
        },
      },
    });

    const execution = state.executionState.getByCorrelationId('corr-state-1');
    assert.equal(execution?.status, 'filled');
    assert.equal(execution?.providerOrderId, 'sim-order-1');
    assert.equal(execution?.fills.length, 1);
    assert.equal(state.audit.listByCorrelationId('corr-state-1').length, 3);
  });

  it('derives runtime state from lifecycle events', async () => {
    const state = new TradingStateService();

    await state.applyEvent({
      id: 'runtime-event-1',
      type: 'USER_RUNTIME_PROVISIONED',
      occurredAt: '2026-05-20T12:01:00.000Z',
      correlationId: 'corr-runtime-1',
      source: 'product',
      userId: 'user-1',
      runtimeInstanceId: 'runtime-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        providerId: 'simulation',
      },
    });
    await state.applyEvent({
      id: 'runtime-event-2',
      type: 'USER_RUNTIME_SUSPENDED',
      occurredAt: '2026-05-20T12:02:00.000Z',
      correlationId: 'corr-runtime-1',
      source: 'product',
      userId: 'user-1',
      runtimeInstanceId: 'runtime-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        providerId: 'simulation',
        reason: 'quota exceeded',
      },
    });

    const runtime = state.runtimeState.get('runtime-1');
    assert.equal(runtime?.status, 'suspended');
    assert.equal(runtime?.suspensionReason, 'quota exceeded');
  });

  it('represents provider healthy, degraded, offline, and suspended states', async () => {
    const state = new TradingStateService();

    await state.applyEvent({
      id: 'provider-event-1',
      type: 'PROVIDER_HEALTH_CHANGED',
      occurredAt: '2026-05-20T12:03:00.000Z',
      correlationId: 'corr-provider-1',
      source: 'provider',
      payload: {
        providerId: 'simulation',
        current: 'healthy',
      },
    });
    assert.equal(state.providerState.get('simulation')?.status, 'healthy');

    await state.applyEvent({
      id: 'provider-event-2',
      type: 'PROVIDER_HEALTH_CHANGED',
      occurredAt: '2026-05-20T12:04:00.000Z',
      correlationId: 'corr-provider-1',
      source: 'provider',
      payload: {
        providerId: 'simulation',
        current: 'degraded',
      },
    });
    assert.equal(state.providerState.get('simulation')?.status, 'degraded');

    await state.applyEvent({
      id: 'provider-event-3',
      type: 'PROVIDER_HEALTH_CHANGED',
      occurredAt: '2026-05-20T12:05:00.000Z',
      correlationId: 'corr-provider-1',
      source: 'provider',
      payload: {
        providerId: 'simulation',
        current: 'offline',
      },
    });
    assert.equal(state.providerState.get('simulation')?.status, 'offline');

    await state.applyEvent({
      id: 'provider-event-4',
      type: 'EMERGENCY_SHUTDOWN_TRIGGERED',
      occurredAt: '2026-05-20T12:06:00.000Z',
      correlationId: 'corr-provider-1',
      source: 'risk',
      payload: {
        providerId: 'simulation',
        reason: 'global shutdown',
      },
    });
    assert.equal(state.providerState.get('simulation')?.status, 'suspended');
  });

  it('rejects execution state mutation with missing tenant or runtime context', async () => {
    const state = new TradingStateService();

    await assert.rejects(
      state.applyEvent({
        id: 'state-event-invalid-1',
        type: 'EXECUTION_REQUESTED',
        occurredAt: '2026-05-20T12:07:00.000Z',
        correlationId: 'corr-state-invalid-1',
        source: 'core',
        payload: {
          requestId: 'request-invalid-state-1',
          providerId: 'simulation',
          market: 'BTC-USDT',
        },
      }),
      StateMutationError,
    );
    assert.equal(state.executionState.getByCorrelationId('corr-state-invalid-1'), undefined);
  });
});

describe('Trading event persistence and audit traces', () => {
  it('persists events after publish', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);

    await eventBus.publish({
      id: 'persist-event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-20T13:00:00.000Z',
      correlationId: 'corr-persist-1',
      source: 'core',
      userId: 'user-persist-1',
      runtimeInstanceId: 'runtime-persist-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        executionDomain: 'user',
        providerId: 'simulation',
      },
    });

    assert.equal(repository.list().length, 1);
    assert.equal(repository.queryByCorrelationId('corr-persist-1')[0]?.id, 'persist-event-1');
  });

  it('returns ordered correlation traces', async () => {
    const repository = new InMemoryTradingEventRepository();
    const query = new TradingEventQueryService(repository);
    const trace = new CorrelationTraceService(query);

    await repository.append({
      id: 'trace-event-2',
      type: 'ORDER_SUBMITTED',
      occurredAt: '2026-05-20T13:00:02.000Z',
      correlationId: 'corr-trace-1',
      source: 'provider',
      userId: 'user-trace-1',
      runtimeInstanceId: 'runtime-trace-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        providerId: 'simulation',
      },
    });
    await repository.append({
      id: 'trace-event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-20T13:00:01.000Z',
      correlationId: 'corr-trace-1',
      source: 'core',
      userId: 'user-trace-1',
      runtimeInstanceId: 'runtime-trace-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        executionDomain: 'user',
        providerId: 'simulation',
      },
    });

    const reconstructed = trace.reconstruct('corr-trace-1');
    assert.deepEqual(reconstructed.events.map((event) => event.id), ['trace-event-1', 'trace-event-2']);
    assert.equal(reconstructed.providerId, 'simulation');
    assert.equal(reconstructed.strategyProductId, 'whiterabbit-scalper-futures');
  });

  it('keeps audit trail for rejected execution', async () => {
    const repository = new InMemoryTradingEventRepository();
    const state = new TradingStateService({ eventRepository: repository });
    const trace = new CorrelationTraceService(new TradingEventQueryService(repository), state.audit);

    await state.applyEvent({
      id: 'reject-event-1',
      type: 'RISK_CHECK_REJECTED',
      occurredAt: '2026-05-20T13:01:00.000Z',
      correlationId: 'corr-reject-1',
      source: 'risk',
      userId: 'user-reject-1',
      runtimeInstanceId: 'runtime-reject-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        executionDomain: 'user',
        providerId: 'simulation',
        reason: 'max daily loss exceeded',
      },
    });

    const reconstructed = trace.reconstruct('corr-reject-1');
    assert.equal(reconstructed.events.length, 1);
    assert.equal(reconstructed.auditRecords.length, 1);
    assert.equal(reconstructed.rejectionReason, 'max daily loss exceeded');
    assert.equal(reconstructed.userId, 'user-reject-1');
  });

  it('keeps audit trail for provider execution events', async () => {
    const repository = new InMemoryTradingEventRepository();
    const state = new TradingStateService({ eventRepository: repository });
    const trace = new CorrelationTraceService(new TradingEventQueryService(repository), state.audit);

    await state.applyEvent({
      id: 'provider-audit-event-1',
      type: 'ORDER_SUBMITTED',
      occurredAt: '2026-05-20T13:02:00.000Z',
      correlationId: 'corr-provider-audit-1',
      source: 'provider',
      userId: 'user-provider-audit-1',
      runtimeInstanceId: 'runtime-provider-audit-1',
      strategyId: 'whiterabbit-v1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        providerId: 'simulation',
        result: {
          requestId: 'request-provider-audit-1',
          providerOrderId: 'sim-provider-audit-1',
        },
      },
    });

    const reconstructed = trace.reconstruct('corr-provider-audit-1');
    assert.equal(reconstructed.providerId, 'simulation');
    assert.equal(reconstructed.strategyId, 'whiterabbit-v1');
    assert.equal(reconstructed.auditRecords[0]?.providerId, 'simulation');
  });

  it('keeps user and treasury traces separated', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const query = new TradingEventQueryService(repository);

    await eventBus.publish({
      id: 'separated-user-event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-20T13:03:00.000Z',
      correlationId: 'corr-separated-user-1',
      source: 'core',
      userId: 'user-separated-1',
      runtimeInstanceId: 'runtime-separated-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        executionDomain: 'user',
        providerId: 'simulation',
      },
    });
    await eventBus.publish({
      id: 'separated-treasury-event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-20T13:03:01.000Z',
      correlationId: 'corr-separated-treasury-1',
      source: 'core',
      daoId: 'dao-separated-1',
      strategyId: 'treasury-rebalance',
      payload: {
        executionDomain: 'treasury',
        providerId: 'simulation',
      },
    });

    assert.deepEqual(query.byUserId('user-separated-1').map((event) => event.correlationId), ['corr-separated-user-1']);
    assert.deepEqual(query.byDaoId('dao-separated-1').map((event) => event.correlationId), ['corr-separated-treasury-1']);
  });

  it('does not let failed subscribers prevent event persistence', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);

    eventBus.subscribe(() => {
      throw new Error('subscriber failed after persistence');
    });

    await eventBus.publish({
      id: 'subscriber-failure-persisted-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-20T13:04:00.000Z',
      correlationId: 'corr-subscriber-failure-1',
      source: 'core',
      userId: 'user-subscriber-failure-1',
      runtimeInstanceId: 'runtime-subscriber-failure-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        executionDomain: 'user',
        providerId: 'simulation',
      },
    });

    assert.equal(repository.queryByCorrelationId('corr-subscriber-failure-1').length, 1);
    assert.equal(eventBus.getDispatchErrors().length, 1);
  });

  it('uses one trace model for product, risk, governance, runtime, security, and compliance events', async () => {
    const repository = new InMemoryTradingEventRepository();
    const query = new TradingEventQueryService(repository);

    const shared = {
      occurredAt: '2026-05-20T13:05:00.000Z',
      correlationId: 'corr-unified-trace-1',
      userId: 'user-unified-1',
      runtimeInstanceId: 'runtime-unified-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        executionDomain: 'user',
        providerId: 'simulation',
      },
    };

    await repository.append({ ...shared, id: 'unified-product-1', type: 'STRATEGY_ACCESS_GRANTED', source: 'product' });
    await repository.append({ ...shared, id: 'unified-risk-1', type: 'RISK_CHECK_APPROVED', source: 'risk' });
    await repository.append({ ...shared, id: 'unified-governance-1', type: 'GOVERNANCE_EXECUTION_BLOCKED', source: 'governance' });
    await repository.append({ ...shared, id: 'unified-runtime-1', type: 'USER_RUNTIME_PROVISIONED', source: 'product' });
    await repository.append({ ...shared, id: 'unified-security-1', type: 'CREDENTIAL_BINDING_CREATED', source: 'security' });
    await repository.append({ ...shared, id: 'unified-compliance-1', type: 'RISK_DISCLOSURE_ACCEPTED', source: 'compliance' });

    assert.deepEqual(query.byCorrelationId('corr-unified-trace-1').map((event) => event.source), [
      'compliance',
      'governance',
      'product',
      'risk',
      'product',
      'security',
    ]);
  });
});

describe('ACS trading access boundary', () => {
  function acsIntent(overrides = {}) {
    const intent = userIntent({
      id: 'acs-intent-1',
      correlationId: 'corr-acs-1',
      request: {
        ...userIntent().request,
        requestId: 'request-acs-1',
      },
    });
    return {
      id: intent.id,
      correlationId: intent.correlationId,
      tenantId: 'tenant-1',
      requestedBy: 'acs-operator-1',
      context: intent.context,
      request: intent.request,
      ...overrides,
    };
  }

  it('does not expose direct provider execution through ACS boundary', async () => {
    const { orchestrator, simulationProvider, eventBus } = createHarness({
      productApproved: false,
      riskApproved: true,
    });
    const acs = new AcsTradingAccessService({ orchestrator, eventBus });

    assert.equal(typeof acs.executeOrder, 'undefined');
    await assert.rejects(
      acs.requestExecution(acsIntent()),
      (error) => error instanceof ExecutionBlockedError && error.code === 'PRODUCT_GATE_BLOCKED',
    );
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('rejects ACS command without tenant context', async () => {
    const { orchestrator, eventBus } = createHarness({
      productApproved: true,
      riskApproved: true,
    });
    const acs = new AcsTradingAccessService({ orchestrator, eventBus });

    await assert.rejects(
      acs.executeCommand({
        id: 'acs-command-invalid-1',
        correlationId: 'corr-acs-invalid-1',
        tenantId: 'tenant-1',
        requestedBy: 'acs-operator-1',
        commandType: 'pause-runtime',
        context: {
          executionDomain: 'user',
          providerId: 'simulation',
          runtimeInstanceId: 'runtime-1',
        },
      }),
      (error) => error instanceof AcsTradingBoundaryError && error.code === 'MISSING_TENANT_CONTEXT',
    );
  });

  it('routes ACS execution intent through normal gate pipeline', async () => {
    const { orchestrator, simulationProvider, eventBus } = createHarness({
      productGate: new ProductExecutionGate(validProductAccessState()),
      riskGateway: new RiskGateway(validRiskState()),
    });
    const acs = new AcsTradingAccessService({ orchestrator, eventBus });

    const receipt = await acs.requestExecution(acsIntent());

    assert.equal(receipt.correlationId, 'corr-acs-1');
    assert.equal(simulationProvider.receivedExecutions.length, 1);
    assert.deepEqual(eventBus.getByCorrelationId('corr-acs-1').map((event) => event.type).slice(0, 2), [
      'ACS_COMMAND_RECEIVED',
      'EXECUTION_REQUESTED',
    ]);
  });

  it('emits runtime lifecycle event for ACS pause command', async () => {
    const { orchestrator, eventBus } = createHarness({
      productApproved: true,
      riskApproved: true,
    });
    const lifecycle = new RuntimeLifecycleService();
    lifecycle.register({
      id: 'runtime-acs-pause-1',
      userId: 'user-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      providerId: 'simulation',
      executionDomain: 'user',
      status: 'active',
      createdAt: '2026-05-20T14:00:00.000Z',
      updatedAt: '2026-05-20T14:00:00.000Z',
    });
    const acs = new AcsTradingAccessService({ orchestrator, eventBus, runtimeLifecycle: lifecycle });

    const runtime = await acs.executeCommand({
      id: 'acs-pause-1',
      correlationId: 'corr-acs-pause-1',
      tenantId: 'tenant-1',
      requestedBy: 'acs-operator-1',
      commandType: 'pause-runtime',
      context: {
        ...userIntent().context,
        runtimeInstanceId: 'runtime-acs-pause-1',
      },
      reason: 'operator pause',
    });

    assert.equal(runtime?.status, 'paused');
    assert.equal(eventBus.getByCorrelationId('corr-acs-pause-1').some((event) => event.type === 'USER_RUNTIME_PAUSED'), true);
  });

  it('returns normalized runtime inspection state only', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const { orchestrator } = createHarness({
      productApproved: true,
      riskApproved: true,
    });
    const lifecycle = new RuntimeLifecycleService();
    lifecycle.register({
      id: 'runtime-acs-inspect-1',
      userId: 'user-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      providerId: 'simulation',
      executionDomain: 'user',
      status: 'active',
      createdAt: '2026-05-20T14:01:00.000Z',
      updatedAt: '2026-05-20T14:01:00.000Z',
    });
    await eventBus.publish({
      id: 'acs-inspect-event-1',
      type: 'USER_RUNTIME_PROVISIONED',
      occurredAt: '2026-05-20T14:01:00.000Z',
      correlationId: 'corr-acs-inspect-1',
      source: 'product',
      userId: 'user-1',
      runtimeInstanceId: 'runtime-acs-inspect-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        providerId: 'simulation',
      },
    });
    const acs = new AcsTradingAccessService({
      orchestrator,
      eventBus,
      runtimeLifecycle: lifecycle,
      eventQuery: new TradingEventQueryService(repository),
    });

    const inspection = acs.inspectRuntime({
      id: 'acs-inspection-1',
      correlationId: 'corr-acs-inspect-1',
      tenantId: 'tenant-1',
      requestedBy: 'acs-operator-1',
      context: {
        ...userIntent().context,
        runtimeInstanceId: 'runtime-acs-inspect-1',
      },
    });

    assert.equal(inspection.runtime?.id, 'runtime-acs-inspect-1');
    assert.equal(inspection.telemetry?.runtimeInstanceId, 'runtime-acs-inspect-1');
    assert.equal(inspection.events.length, 1);
    assert.equal(Object.hasOwn(inspection, 'isolation'), false);
    assert.equal(Object.hasOwn(inspection, 'credentialBindingId'), false);
  });

  it('records ACS recommendation without granting execution authorization', async () => {
    const { orchestrator, simulationProvider, eventBus } = createHarness({
      productApproved: false,
      riskApproved: true,
    });
    const acs = new AcsTradingAccessService({ orchestrator, eventBus });

    const feedback = await acs.intakeRecommendation({
      id: 'acs-recommendation-1',
      correlationId: 'corr-acs-recommendation-1',
      tenantId: 'tenant-1',
      producedByAgent: 'trinity',
      context: userIntent().context,
      recommendationType: 'execution',
      confidence: 0.9,
      rationale: 'simulated opportunity',
      proposedRequest: userIntent().request,
    });

    assert.equal(feedback.feedbackType, 'requires-review');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
    assert.equal(eventBus.getByCorrelationId('corr-acs-recommendation-1').some((event) => event.type === 'ACS_RECOMMENDATION_RECEIVED'), true);
  });
});

describe('Headless Trading API boundary', () => {
  function createApiHarness(options = {}) {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const lifecycle = new RuntimeLifecycleService();
    const state = new TradingStateService();
    eventBus.subscribe((event) => state.applyEvent(event));
    const { orchestrator, simulationProvider } = createHarness({
      productApproved: options.productApproved ?? false,
      riskApproved: options.riskApproved ?? true,
    });
    const eventQuery = new TradingEventQueryService(repository);
    const acs = new AcsTradingAccessService({
      orchestrator,
      eventBus,
      runtimeLifecycle: lifecycle,
      eventQuery,
    });
    const gateway = new TradingApiGateway({
      readApi: new TradingReadApi({
        runtimeLifecycle: lifecycle,
        eventQuery,
        providerState: state.providerState,
      }),
      actionRequestApi: new TradingActionRequestApi(acs),
      telemetryApi: new TradingTelemetryApi(eventQuery),
      runtimeInspectionApi: new TradingRuntimeInspectionApi(acs),
    });

    return { gateway, eventBus, repository, lifecycle, simulationProvider };
  }

  function apiRequest(overrides = {}) {
    return {
      id: 'api-request-1',
      correlationId: 'corr-api-1',
      tenantId: 'tenant-api-1',
      requestedBy: 'acs-console',
      context: {
        executionDomain: 'user',
        userId: 'api-user-1',
        strategyProductId: 'whiterabbit-scalper-futures',
        runtimeInstanceId: 'runtime-api-1',
        providerId: 'simulation',
        strategyId: 'whiterabbit-v1',
      },
      ...overrides,
    };
  }

  function registerApiRuntime(lifecycle) {
    lifecycle.register({
      id: 'runtime-api-1',
      userId: 'api-user-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      providerId: 'simulation',
      executionDomain: 'user',
      status: 'active',
      createdAt: '2026-05-21T19:00:00.000Z',
      updatedAt: '2026-05-21T19:00:00.000Z',
    });
  }

  it('does not let API action requests bypass Trading Core or ACS', async () => {
    const { gateway, simulationProvider, repository } = createApiHarness();

    const response = await gateway.submitAction({
      ...apiRequest({ id: 'api-simulation-request-1', correlationId: 'corr-api-simulation-1' }),
      actionType: 'request-simulation',
      reason: 'operator requested simulation',
    });

    assert.equal(response.ok, true);
    assert.equal(simulationProvider.receivedExecutions.length, 0);
    const events = repository.queryByCorrelationId('corr-api-simulation-1');
    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, 'ACS_COMMAND_RECEIVED');
    assert.equal(events[0]?.payload.commandType, 'request-strategy-simulation');
  });

  it('does not expose direct provider execution methods', () => {
    const { gateway } = createApiHarness();

    assert.equal(typeof gateway.executeOrder, 'undefined');
    assert.equal(typeof gateway.cancelOrder, 'undefined');
    assert.equal(typeof gateway.getProviderClient, 'undefined');
  });

  it('returns runtime snapshots without secrets or provider DTO payloads', async () => {
    const { gateway, lifecycle, eventBus } = createApiHarness();
    registerApiRuntime(lifecycle);
    lifecycle.incrementExecution('runtime-api-1', '2026-05-21T19:01:00.000Z');
    await eventBus.publish({
      id: 'api-secret-payload-event-1',
      type: 'USER_RUNTIME_PROVISIONED',
      occurredAt: '2026-05-21T19:00:00.000Z',
      correlationId: 'corr-api-runtime-1',
      source: 'product',
      userId: 'api-user-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-api-1',
      payload: {
        providerId: 'simulation',
        apiKey: 'must-not-leak',
        hummingbotDto: { internal: true },
      },
    });

    const response = gateway.inspectRuntime(apiRequest({ correlationId: 'corr-api-runtime-1' }));
    const serialized = JSON.stringify(response.data);

    assert.equal(response.ok, true);
    assert.equal(response.data?.runtime?.id, 'runtime-api-1');
    assert.equal(response.data?.telemetry?.executionCount, 1);
    assert.equal(serialized.includes('must-not-leak'), false);
    assert.equal(serialized.includes('hummingbotDto'), false);
  });

  it('preserves tenant context on action requests', async () => {
    const { gateway, repository } = createApiHarness();

    await gateway.submitAction({
      ...apiRequest({ id: 'api-backtest-request-1', correlationId: 'corr-api-backtest-1' }),
      actionType: 'request-backtest',
      reason: 'validate strategy parameter proposal',
    });

    const event = repository.queryByCorrelationId('corr-api-backtest-1')[0];
    assert.equal(event?.source, 'acs');
    assert.equal(event?.userId, 'api-user-1');
    assert.equal(event?.runtimeInstanceId, 'runtime-api-1');
    assert.equal(event?.payload.commandType, 'request-strategy-backtest');
  });

  it('returns normalized telemetry summaries', async () => {
    const { gateway, eventBus } = createApiHarness();
    await eventBus.publish({
      id: 'api-telemetry-event-1',
      type: 'TRINITY_RECOMMENDATION_CREATED',
      occurredAt: '2026-05-21T19:01:00.000Z',
      correlationId: 'corr-api-telemetry-1',
      source: 'agent',
      userId: 'api-user-1',
      runtimeInstanceId: 'runtime-api-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        providerId: 'simulation',
        recommendation: { recommendationType: 'request-simulation' },
      },
    });
    await eventBus.publish({
      id: 'api-telemetry-event-2',
      type: 'USER_RUNTIME_PAUSED',
      occurredAt: '2026-05-21T19:02:00.000Z',
      correlationId: 'corr-api-telemetry-1',
      source: 'acs',
      userId: 'api-user-1',
      runtimeInstanceId: 'runtime-api-1',
      strategyProductId: 'whiterabbit-scalper-futures',
      payload: {
        providerId: 'simulation',
      },
    });

    const response = gateway.telemetry(apiRequest({ correlationId: 'corr-api-telemetry-1' }));

    assert.equal(response.ok, true);
    assert.equal(response.data?.totalEvents, 2);
    assert.equal(response.data?.recommendationCount, 1);
    assert.equal(response.data?.runtimeEventCount, 2);
    assert.equal(response.data?.eventCounts.TRINITY_RECOMMENDATION_CREATED, 1);
  });

  it('preserves treasury and user separation in telemetry reads', async () => {
    const { gateway, eventBus } = createApiHarness();
    await eventBus.publish({
      id: 'api-user-event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-21T19:03:00.000Z',
      correlationId: 'corr-api-user-1',
      source: 'core',
      userId: 'api-user-1',
      runtimeInstanceId: 'runtime-api-1',
      payload: { providerId: 'simulation' },
    });
    await eventBus.publish({
      id: 'api-treasury-event-1',
      type: 'EXECUTION_REQUESTED',
      occurredAt: '2026-05-21T19:04:00.000Z',
      correlationId: 'corr-api-treasury-1',
      source: 'core',
      daoId: 'dao-api-1',
      payload: { providerId: 'simulation' },
    });

    const userSummary = gateway.telemetry(apiRequest());
    const treasurySummary = gateway.telemetry(apiRequest({
      correlationId: 'corr-api-treasury-1',
      context: {
        executionDomain: 'treasury',
        daoId: 'dao-api-1',
        providerId: 'simulation',
        strategyId: 'treasury-rebalance',
      },
    }));

    assert.equal(userSummary.data?.totalEvents, 1);
    assert.equal(treasurySummary.data?.totalEvents, 1);
    assert.equal(treasurySummary.data?.context.daoId, 'dao-api-1');
    assert.equal(treasurySummary.data?.context.userId, undefined);
  });
});

describe('WhiteRabbit product surface contract', () => {
  function requiredDisclosure() {
    return {
      id: 'wr-risk-v1',
      version: '1.0.0',
      category: 'strategy-specific',
      title: 'WhiteRabbit automated trading risk',
      contentRef: 'disclosures/whiterabbit-risk-v1',
      requiredFor: ['runtime-provisioning', 'execution-enable', 'strategy-product'],
    };
  }

  function acceptedDisclosure(userId = 'alice') {
    return {
      userId,
      disclosureId: 'wr-risk-v1',
      disclosureVersion: '1.0.0',
      acceptedAt: '2026-05-20T15:00:00.000Z',
      executionDomain: 'user',
    };
  }

  function activeRuntime(userId = 'alice') {
    return {
      id: `runtime-${userId}`,
      userId,
      strategyProductId: 'whiterabbit-scalper-futures',
      providerId: 'simulation',
      executionDomain: 'user',
      status: 'active',
      createdAt: '2026-05-20T15:00:00.000Z',
      updatedAt: '2026-05-20T15:00:00.000Z',
    };
  }

  function activeCredential() {
    return {
      vaultRefId: 'vault-ref-safe-1',
      exchange: 'binance',
      accountLabel: 'main futures',
      scopes: ['read-balances', 'read-positions', 'trade', 'cancel-orders'],
      apiKey: 'must-not-leak',
      secret: 'must-not-leak',
    };
  }

  it('does not expose secrets in WhiteRabbit view', () => {
    const surface = new WhiteRabbitProductSurfaceService().build({
      profile: userProfile('alice'),
      runtime: activeRuntime('alice'),
      credentialBinding: activeCredential(),
      disclosures: [requiredDisclosure()],
      acceptances: [acceptedDisclosure('alice')],
    });

    const serialized = JSON.stringify(surface);
    assert.equal(serialized.includes('must-not-leak'), false);
    assert.equal(serialized.includes('secret'), false);
    assert.equal(surface.credentialBinding.vaultRefId, 'vault-ref-safe-1');
  });

  it('does not expose provider DTOs or direct provider actions', () => {
    const surface = new WhiteRabbitProductSurfaceService().build({
      profile: userProfile('alice'),
      runtime: activeRuntime('alice'),
      credentialBinding: activeCredential(),
      disclosures: [requiredDisclosure()],
      acceptances: [acceptedDisclosure('alice')],
    });

    assert.equal(surface.product.forbiddenUserActions.includes('call-provider'), true);
    assert.equal(surface.product.forbiddenUserActions.includes('call-hummingbot'), true);
    assert.equal(JSON.stringify(surface).includes('HummingbotOrderDto'), false);
    assert.equal(JSON.stringify(surface).includes('providerOrderId'), false);
  });

  it('blocks runtime enablement when disclosure is missing', () => {
    const surface = new WhiteRabbitProductSurfaceService().build({
      profile: userProfile('alice'),
      runtime: activeRuntime('alice'),
      credentialBinding: activeCredential(),
      disclosures: [requiredDisclosure()],
      acceptances: [],
    });

    assert.equal(surface.disclosures.allRequiredAccepted, false);
    assert.equal(surface.runtime.runtimeEnablement.canEnableExecution, false);
    assert.equal(surface.runtime.runtimeEnablement.blockers.includes('Required risk disclosures are missing.'), true);
  });

  it('blocks runtime enablement when credential binding is missing', () => {
    const surface = new WhiteRabbitProductSurfaceService().build({
      profile: userProfile('alice'),
      runtime: activeRuntime('alice'),
      disclosures: [requiredDisclosure()],
      acceptances: [acceptedDisclosure('alice')],
    });

    assert.equal(surface.credentialBinding.status, 'missing');
    assert.equal(surface.runtime.runtimeEnablement.canEnableExecution, false);
    assert.equal(surface.runtime.runtimeEnablement.blockers.includes('Credential binding is missing or not active.'), true);
  });

  it('blocks runtime provisioning when entitlement is invalid', () => {
    const invalidProfile = {
      ...userProfile('alice'),
      entitlementState: {
        status: 'revoked',
        checkedAt: '2026-05-20T15:00:00.000Z',
        entitlementKeys: [],
      },
    };

    const surface = new WhiteRabbitProductSurfaceService().build({
      profile: invalidProfile,
      credentialBinding: activeCredential(),
      disclosures: [requiredDisclosure()],
      acceptances: [acceptedDisclosure('alice')],
    });

    assert.equal(surface.access.accessStatus, 'blocked');
    assert.equal(surface.runtime.runtimeEnablement.canProvision, false);
    assert.equal(surface.runtime.runtimeEnablement.blockers.includes('Product access is blocked.'), true);
  });

  it('shows runtime status through normalized read model for valid user', () => {
    const surface = new WhiteRabbitProductSurfaceService().build({
      profile: userProfile('alice'),
      runtime: activeRuntime('alice'),
      credentialBinding: activeCredential(),
      disclosures: [requiredDisclosure()],
      acceptances: [acceptedDisclosure('alice')],
      telemetry: {
        userId: 'alice',
        runtimeInstanceId: 'runtime-alice',
        strategyProductId: 'whiterabbit-scalper-futures',
        executionCount: 3,
        lastExecutionAt: '2026-05-20T15:30:00.000Z',
      },
    });

    assert.equal(surface.product.productId, 'whiterabbit-scalper-futures');
    assert.equal(surface.runtime.status, 'active');
    assert.equal(surface.runtime.runtimeEnablement.canEnableExecution, true);
    assert.equal(surface.telemetry.executionCount, 3);
    assert.equal(surface.risk.riskSummary.includes('Non-custodial automated trading'), true);
  });
});

describe('WhiteRabbit product surface API', () => {
  function wrSurfaceInput(overrides = {}) {
    return {
      profile: userProfile('alice'),
      runtime: {
        id: 'runtime-wr-api-alice',
        userId: 'alice',
        strategyProductId: 'whiterabbit-scalper-futures',
        providerId: 'simulation',
        executionDomain: 'user',
        status: 'active',
        createdAt: '2026-05-21T20:00:00.000Z',
        updatedAt: '2026-05-21T20:00:00.000Z',
      },
      credentialBinding: {
        vaultRefId: 'vault-wr-api-1',
        exchange: 'simulation',
        accountLabel: 'paper account',
        scopes: ['read-balances', 'read-positions', 'trade', 'cancel-orders'],
        secret: 'must-not-leak',
      },
      disclosures: [{
        id: 'wr-risk-v1',
        version: '1.0.0',
        category: 'strategy-specific',
        title: 'WhiteRabbit automated trading risk',
        contentRef: 'disclosures/whiterabbit-risk-v1',
        requiredFor: ['runtime-provisioning', 'execution-enable', 'strategy-product'],
      }],
      acceptances: [{
        userId: 'alice',
        disclosureId: 'wr-risk-v1',
        disclosureVersion: '1.0.0',
        acceptedAt: '2026-05-21T20:00:00.000Z',
        executionDomain: 'user',
      }],
      telemetry: {
        userId: 'alice',
        runtimeInstanceId: 'runtime-wr-api-alice',
        strategyProductId: 'whiterabbit-scalper-futures',
        executionCount: 4,
        lastExecutionAt: '2026-05-21T20:10:00.000Z',
        providerDto: { internal: true },
      },
      ...overrides,
    };
  }

  function wrContext(overrides = {}) {
    return {
      executionDomain: 'user',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-wr-api-alice',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      ...overrides,
    };
  }

  function createWhiteRabbitApiHarness() {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const lifecycle = new RuntimeLifecycleService();
    const { orchestrator, simulationProvider } = createHarness({
      productApproved: false,
      riskApproved: true,
    });
    const acs = new AcsTradingAccessService({
      orchestrator,
      eventBus,
      runtimeLifecycle: lifecycle,
      eventQuery: new TradingEventQueryService(repository),
    });
    const actionApi = new TradingActionRequestApi(acs);
    const surfaceApi = new WhiteRabbitSurfaceApi(undefined, new WhiteRabbitActionRequestService(actionApi));
    return { surfaceApi, repository, simulationProvider };
  }

  it('exposes normalized WhiteRabbit state only', () => {
    const response = new WhiteRabbitSurfaceApi().getSurface(wrSurfaceInput());
    const serialized = JSON.stringify(response.data);

    assert.equal(response.ok, true);
    assert.equal(response.data?.product.productId, 'whiterabbit-scalper-futures');
    assert.equal(response.data?.runtime.status, 'active');
    assert.equal(response.data?.providerCompatibility.compatible, true);
    assert.equal(response.data?.readiness.simulationReady, true);
    assert.equal(serialized.includes('must-not-leak'), false);
    assert.equal(serialized.includes('providerDto'), false);
  });

  it('blocks action request when entitlement is invalid', async () => {
    const { surfaceApi, repository } = createWhiteRabbitApiHarness();
    const blockedSurface = new WhiteRabbitSurfaceApi().getSurface(wrSurfaceInput({
      profile: {
        ...userProfile('alice'),
        entitlementState: {
          status: 'revoked',
          checkedAt: '2026-05-21T20:00:00.000Z',
          entitlementKeys: [],
        },
      },
    })).data;

    const response = await surfaceApi.submitAction({
      id: 'wr-api-provision-blocked-1',
      correlationId: 'corr-wr-api-blocked-1',
      tenantId: 'tenant-wr-api-1',
      requestedBy: 'marketplace',
      action: 'request-provisioning',
      context: wrContext(),
      surface: blockedSurface,
    });

    assert.equal(response.ok, false);
    assert.equal(response.error?.code, 'WHITERABBIT_ACTION_BLOCKED');
    assert.equal(repository.queryByCorrelationId('corr-wr-api-blocked-1').length, 0);
  });

  it('keeps runtime status tenant-scoped', () => {
    const alice = new WhiteRabbitSurfaceApi().getSurface(wrSurfaceInput()).data;
    const bob = new WhiteRabbitSurfaceApi().getSurface(wrSurfaceInput({
      profile: userProfile('bob'),
      runtime: {
        ...wrSurfaceInput().runtime,
        id: 'runtime-wr-api-bob',
        userId: 'bob',
        status: 'paused',
      },
      telemetry: {
        userId: 'bob',
        runtimeInstanceId: 'runtime-wr-api-bob',
        strategyProductId: 'whiterabbit-scalper-futures',
        executionCount: 1,
      },
    })).data;

    assert.equal(alice?.runtime.runtimeInstanceId, 'runtime-wr-api-alice');
    assert.equal(alice?.runtime.status, 'active');
    assert.equal(bob?.runtime.runtimeInstanceId, 'runtime-wr-api-bob');
    assert.equal(bob?.runtime.status, 'paused');
  });

  it('returns telemetry summary without sensitive information', () => {
    const response = new WhiteRabbitSurfaceApi().getSurface(wrSurfaceInput());
    const serialized = JSON.stringify(response.data?.telemetry);

    assert.equal(response.data?.telemetry.executionCount, 4);
    assert.equal(response.data?.telemetry.sensitiveFieldsExcluded, true);
    assert.equal(serialized.includes('providerDto'), false);
    assert.equal(serialized.includes('secret'), false);
  });

  it('converts user actions into request-only ACS commands', async () => {
    const { surfaceApi, repository, simulationProvider } = createWhiteRabbitApiHarness();
    const surface = new WhiteRabbitSurfaceApi().getSurface(wrSurfaceInput()).data;

    const response = await surfaceApi.submitAction({
      id: 'wr-api-simulation-1',
      correlationId: 'corr-wr-api-simulation-1',
      tenantId: 'tenant-wr-api-1',
      requestedBy: 'marketplace',
      action: 'request-simulation',
      context: wrContext(),
      surface,
      reason: 'user requested simulation from product surface',
    });

    const event = repository.queryByCorrelationId('corr-wr-api-simulation-1')[0];
    assert.equal(response.ok, true);
    assert.equal(event?.type, 'ACS_COMMAND_RECEIVED');
    assert.equal(event?.payload.commandType, 'request-strategy-simulation');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });
});

describe('Credential vault and runtime credential authority', () => {
  function credentialContext(overrides = {}) {
    return {
      executionDomain: 'user',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-credential-1',
      providerId: 'hummingbot',
      strategyId: 'whiterabbit-v1',
      ...overrides,
    };
  }

  async function createCredential(scopes = ['read-only', 'futures-trading', 'account-info']) {
    const repository = new InMemoryCredentialVaultRepository();
    const eventBus = new TradingEventBus(new InMemoryTradingEventRepository());
    const vault = new CredentialVaultService(repository, eventBus);
    const registered = await vault.registerExchangeCredential({
      ownerUserId: 'alice',
      providerId: 'hummingbot',
      exchange: 'binance',
      accountLabel: 'alice futures',
      scopes,
      secretMaterial: {
        apiKey: 'raw-api-key-must-not-leak',
        apiSecret: 'raw-api-secret-must-not-leak',
      },
      correlationId: 'corr-credential-created-1',
    });
    return { repository, eventBus, vault, registered };
  }

  it('gives runtime only a vault reference and scoped metadata', async () => {
    const { repository, registered } = await createCredential();
    const bindingService = new RuntimeCredentialBindingService(repository);

    const decision = await bindingService.bindRuntime({
      context: credentialContext(),
      vaultRefId: registered.reference.id,
      requiredScopes: ['futures-trading', 'account-info'],
      correlationId: 'corr-runtime-credential-1',
    });
    const runtimeBinding = bindingService.getTelemetrySafeBinding('runtime-credential-1');

    assert.equal(decision.approved, true);
    assert.equal(runtimeBinding?.vaultRefId, registered.reference.id);
    assert.equal(Object.hasOwn(runtimeBinding ?? {}, 'secretMaterial'), false);
    assert.equal(Object.hasOwn(runtimeBinding ?? {}, 'apiSecret'), false);
  });

  it('never lets secret material leave the vault boundary', async () => {
    const { repository, registered } = await createCredential();

    assert.equal(repository.hasSecretMaterial(registered.reference.id), true);
    assert.equal(JSON.stringify(registered).includes('raw-api-key-must-not-leak'), false);
    assert.equal(JSON.stringify(repository.findReference(registered.reference.id)).includes('raw-api-secret-must-not-leak'), false);
    assert.equal(JSON.stringify(repository.findExchangeBinding(registered.reference.id)).includes('raw-api-secret-must-not-leak'), false);
  });

  it('blocks runtime binding when credential has invalid withdrawal-like scope', async () => {
    const { repository, registered } = await createCredential(['read-only', 'withdraw']);
    const bindingService = new RuntimeCredentialBindingService(repository);

    const decision = await bindingService.bindRuntime({
      context: credentialContext(),
      vaultRefId: registered.reference.id,
      requiredScopes: ['read-only'],
      correlationId: 'corr-invalid-scope-1',
    });

    assert.equal(decision.approved, false);
    assert.equal(decision.reason?.includes('Forbidden credential scope'), true);
    assert.equal(bindingService.getRuntimeBinding('runtime-credential-1'), undefined);
  });

  it('blocks runtime binding for revoked credential', async () => {
    const { repository, eventBus, registered } = await createCredential();
    const lifecycle = new CredentialLifecycleService(repository, eventBus);
    const revoked = await lifecycle.revoke(registered.reference, 'corr-credential-revoked-1');
    const bindingService = new RuntimeCredentialBindingService(repository);

    const decision = await bindingService.bindRuntime({
      context: credentialContext(),
      vaultRefId: revoked.id,
      requiredScopes: ['futures-trading'],
      correlationId: 'corr-revoked-credential-1',
    });

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Credential is not active: revoked.');
    assert.equal(eventBus.getByCorrelationId('corr-credential-revoked-1')[0]?.type, 'CREDENTIAL_BINDING_REVOKED');
  });

  it('enforces tenant isolation for runtime credentials', async () => {
    const { repository, registered } = await createCredential();
    const bindingService = new RuntimeCredentialBindingService(repository);

    const decision = await bindingService.bindRuntime({
      context: credentialContext({ userId: 'bob' }),
      vaultRefId: registered.reference.id,
      requiredScopes: ['futures-trading'],
      correlationId: 'corr-tenant-isolation-1',
    });

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Credential belongs to a different tenant.');
  });

  it('enforces provider-scoped credential access', async () => {
    const { repository, registered } = await createCredential();
    const bindingService = new RuntimeCredentialBindingService(repository);

    const decision = await bindingService.bindRuntime({
      context: credentialContext({ providerId: 'simulation' }),
      vaultRefId: registered.reference.id,
      requiredScopes: ['futures-trading'],
      correlationId: 'corr-provider-scope-1',
    });

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Credential provider does not match runtime provider.');
  });

  it('keeps telemetry serialization free of sensitive fields', async () => {
    const { repository, registered } = await createCredential();
    const bindingService = new RuntimeCredentialBindingService(repository);

    await bindingService.bindRuntime({
      context: credentialContext(),
      vaultRefId: registered.reference.id,
      requiredScopes: ['futures-trading', 'account-info'],
      correlationId: 'corr-telemetry-safe-1',
    });

    const telemetrySafe = bindingService.getTelemetrySafeBinding('runtime-credential-1');
    const serialized = JSON.stringify(telemetrySafe);

    assert.equal(serialized.includes('raw-api-key-must-not-leak'), false);
    assert.equal(serialized.includes('raw-api-secret-must-not-leak'), false);
    assert.equal(serialized.includes('apiKey'), false);
    assert.equal(serialized.includes('apiSecret'), false);
  });

  it('blocks provider access when ephemeral grant is expired', async () => {
    const { repository, registered } = await createCredential();
    const grants = new CredentialGrantLifecycleService(repository);
    const created = await grants.createGrant({
      context: credentialContext(),
      vaultRefId: registered.reference.id,
      requiredScopes: ['futures-trading'],
      purpose: 'paper-trading',
      policy: {
        ttlMs: 1000,
        allowedScopes: ['futures-trading'],
      },
      now: '2026-05-23T13:00:00.000Z',
    });

    const validation = await grants.validateGrant(created.grant.id, credentialContext(), '2026-05-23T13:00:02.000Z');

    assert.equal(created.approved, true);
    assert.equal(validation.approved, false);
    assert.equal(validation.reason, 'Credential grant is expired.');
    assert.equal(grants.getGrant(created.grant.id)?.status, 'expired');
  });

  it('blocks provider access when ephemeral grant is revoked', async () => {
    const { repository, registered } = await createCredential();
    const grants = new CredentialGrantLifecycleService(repository);
    const created = await grants.createGrant({
      context: credentialContext(),
      vaultRefId: registered.reference.id,
      requiredScopes: ['futures-trading'],
      purpose: 'paper-trading',
      policy: {
        ttlMs: 60000,
        allowedScopes: ['futures-trading'],
      },
    });

    await grants.revokeGrant(created.grant.id, 'corr-grant-revoked-1');
    const validation = await grants.validateGrant(created.grant.id, credentialContext());

    assert.equal(validation.approved, false);
    assert.equal(validation.reason, 'Credential grant is revoked.');
  });

  it('rejects ephemeral grant creation with withdrawal-like scope', async () => {
    const { repository, registered } = await createCredential(['read-only', 'withdraw']);
    const grants = new CredentialGrantLifecycleService(repository);

    const created = await grants.createGrant({
      context: credentialContext(),
      vaultRefId: registered.reference.id,
      requiredScopes: ['withdraw'],
      purpose: 'paper-trading',
      policy: {
        ttlMs: 60000,
        allowedScopes: ['withdraw'],
      },
    });

    assert.equal(created.approved, false);
    assert.equal(created.reason?.includes('Forbidden credential scope'), true);
    assert.equal(created.grant, undefined);
  });

  it('enforces tenant runtime and provider scope on ephemeral grants', async () => {
    const { repository, registered } = await createCredential();
    const grants = new CredentialGrantLifecycleService(repository);
    const created = await grants.createGrant({
      context: credentialContext(),
      vaultRefId: registered.reference.id,
      requiredScopes: ['futures-trading'],
      purpose: 'paper-trading',
      policy: {
        ttlMs: 60000,
        allowedScopes: ['futures-trading'],
      },
    });

    const wrongTenant = await grants.validateGrant(created.grant.id, credentialContext({ userId: 'bob' }));
    const wrongRuntime = await grants.validateGrant(created.grant.id, credentialContext({ runtimeInstanceId: 'runtime-other' }));
    const wrongProvider = await grants.validateGrant(created.grant.id, credentialContext({ providerId: 'simulation' }));

    assert.equal(wrongTenant.approved, false);
    assert.equal(wrongRuntime.approved, false);
    assert.equal(wrongProvider.approved, false);
    assert.equal(wrongProvider.reason, 'Credential grant scope does not match runtime context.');
  });

  it('resolves mock encrypted credential vault adapter through registry', async () => {
    const { registered } = await createCredential();
    const registry = new CredentialVaultAdapterRegistry();
    const adapter = new MockEncryptedCredentialVaultAdapter();
    registry.register(adapter);

    const resolved = registry.resolve('mock-encrypted');
    const envelope = await resolved.registerEnvelope(registered.reference, 'trading-local-key');

    assert.equal(resolved, adapter);
    assert.equal(envelope.vaultRefId, registered.reference.id);
    assert.equal(envelope.redacted, true);
    assert.equal(envelope.keyRef.keyAlias, 'trading-local-key');
  });

  it('serializes encrypted envelope metadata without sensitive values', async () => {
    const repository = new InMemoryCredentialVaultRepository();
    const eventRepository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(eventRepository);
    const adapter = new MockEncryptedCredentialVaultAdapter();
    const vault = new CredentialVaultService(repository, eventBus, adapter);
    const registered = await vault.registerExchangeCredential({
      ownerUserId: 'alice',
      providerId: 'hummingbot',
      exchange: 'binance',
      scopes: ['read-only'],
      secretMaterial: {
        apiKey: 'raw-api-key-must-not-leak',
        apiSecret: 'raw-api-secret-must-not-leak',
      },
    });

    const envelope = await vault.registerEncryptedEnvelope(registered.reference, 'trading-local-key');
    const serialized = JSON.stringify(envelope);
    const eventPayload = JSON.stringify(eventRepository.queryByType('CREDENTIAL_ENVELOPE_REGISTERED')[0]?.payload);

    assert.equal(serialized.includes('raw-api-key-must-not-leak'), false);
    assert.equal(serialized.includes('raw-api-secret-must-not-leak'), false);
    assert.equal(serialized.includes('apiSecret'), false);
    assert.equal(eventPayload.includes('raw-api'), false);
    assert.equal(eventPayload.includes('keyAlias'), true);
  });
});

describe('Compliance runtime enforcement and disclosure gate', () => {
  function complianceContext(overrides = {}) {
    return {
      executionDomain: 'user',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-compliance-1',
      providerId: 'hummingbot',
      strategyId: 'whiterabbit-v1',
      ...overrides,
    };
  }

  function disclosure(overrides = {}) {
    return {
      id: 'wr-noncustodial-v1',
      version: '1.0.0',
      category: 'non-custodial',
      title: 'Non-custodial automated trading disclosure',
      contentRef: 'disclosures/wr-noncustodial-v1',
      requiredFor: ['runtime-provisioning', 'execution-enable', 'runtime-resume', 'provider-activation'],
      ...overrides,
    };
  }

  function createComplianceHarness(initialAcceptances = []) {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const state = new TradingStateService();
    eventBus.subscribe((event) => state.applyEvent(event));
    const acceptanceService = new DisclosureAcceptanceService(initialAcceptances, eventBus);
    const gate = new ComplianceGate(acceptanceService, undefined, undefined, eventBus);
    const validator = new RuntimeComplianceValidator(gate);
    return { repository, eventBus, state, acceptanceService, gate, validator };
  }

  it('blocks runtime provisioning when disclosure acceptance is missing', async () => {
    const { validator } = createComplianceHarness();

    const decision = await validator.validateProvisioning({
      context: complianceContext(),
      disclosures: [disclosure()],
      correlationId: 'corr-compliance-missing-1',
    });

    assert.equal(decision.approved, false);
    assert.deepEqual(decision.missingDisclosureIds, ['wr-noncustodial-v1']);
  });

  it('blocks execution enablement when disclosure acceptance is expired', async () => {
    const { validator } = createComplianceHarness([{
      userId: 'alice',
      disclosureId: 'wr-noncustodial-v1',
      disclosureVersion: '1.0.0',
      acceptedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
      executionDomain: 'user',
    }]);

    const decision = await validator.validateExecutionEnablement({
      context: complianceContext(),
      disclosures: [disclosure()],
      correlationId: 'corr-compliance-expired-1',
    });

    assert.equal(decision.approved, false);
    assert.deepEqual(decision.expiredDisclosureIds, ['wr-noncustodial-v1']);
  });

  it('blocks runtime when disclosure version mismatches current disclosure', async () => {
    const { validator } = createComplianceHarness([{
      userId: 'alice',
      disclosureId: 'wr-noncustodial-v1',
      disclosureVersion: '1.0.0',
      acceptedAt: '2026-05-20T00:00:00.000Z',
      executionDomain: 'user',
    }]);

    const decision = await validator.validateRuntimeResume({
      context: complianceContext(),
      disclosures: [disclosure({ version: '2.0.0' })],
      correlationId: 'corr-compliance-version-1',
    });

    assert.equal(decision.approved, false);
    assert.deepEqual(decision.versionMismatchDisclosureIds, ['wr-noncustodial-v1']);
  });

  it('enables provisioning when required disclosure acceptance is valid', async () => {
    const { acceptanceService, validator } = createComplianceHarness();
    await acceptanceService.accept({
      context: complianceContext(),
      disclosure: disclosure(),
      acceptedAt: '2026-05-21T00:00:00.000Z',
      expiresAt: '2027-05-21T00:00:00.000Z',
      correlationId: 'corr-compliance-accepted-1',
    });

    const decision = await validator.validateProvisioning({
      context: complianceContext(),
      disclosures: [disclosure()],
      correlationId: 'corr-compliance-valid-1',
    });

    assert.equal(decision.approved, true);
    assert.equal(decision.missingDisclosureIds.length, 0);
  });

  it('bypasses user disclosure flow for treasury execution', async () => {
    const { validator } = createComplianceHarness();

    const decision = await validator.validateExecutionEnablement({
      context: complianceContext({
        executionDomain: 'treasury',
        userId: undefined,
        daoId: 'dao-1',
        runtimeInstanceId: undefined,
      }),
      disclosures: [disclosure()],
      correlationId: 'corr-compliance-treasury-1',
    });

    assert.equal(decision.approved, true);
    assert.equal(decision.bypassed, true);
  });

  it('persists audit trail for disclosure decisions', async () => {
    const { repository, state, validator } = createComplianceHarness();

    const decision = await validator.validateProviderActivation({
      context: complianceContext(),
      disclosures: [disclosure({
        id: 'wr-provider-v1',
        category: 'runtime-provider',
        title: 'Runtime provider activation disclosure',
        requiredFor: ['provider-activation'],
      })],
      correlationId: 'corr-compliance-audit-1',
    });

    const eventTypes = repository.queryByCorrelationId('corr-compliance-audit-1').map((event) => event.type);
    const auditRecords = state.audit.listByCorrelationId('corr-compliance-audit-1');

    assert.equal(decision.approved, false);
    assert.deepEqual(eventTypes, [
      'RISK_DISCLOSURE_REQUIRED',
      'RISK_DISCLOSURE_MISSING',
      'RUNTIME_COMPLIANCE_REJECTED',
    ]);
    assert.equal(auditRecords.length, 3);
    assert.equal(auditRecords.at(-1)?.rejectionReason?.includes('Missing disclosure acceptance'), true);
  });
});

describe('Runtime provisioning API and lifecycle orchestration', () => {
  function runtimeDisclosure() {
    return {
      id: 'runtime-disclosure-v1',
      version: '1.0.0',
      category: 'runtime-provider',
      title: 'Runtime provisioning disclosure',
      contentRef: 'disclosures/runtime-v1',
      requiredFor: ['runtime-provisioning'],
    };
  }

  function runtimeContext(overrides = {}) {
    return {
      executionDomain: 'user',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-alice-whiterabbit-scalper-futures-simulation',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      ...overrides,
    };
  }

  async function createRuntimeHarness(options = {}) {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const lifecycle = new RuntimeLifecycleService();
    const eventState = new TradingStateService();
    eventBus.subscribe((event) => eventState.applyEvent(event));

    const disclosureValue = runtimeDisclosure();
    const acceptanceService = new DisclosureAcceptanceService([], eventBus);
    if (options.acceptDisclosure ?? true) {
      await acceptanceService.accept({
        context: runtimeContext(),
        disclosure: disclosureValue,
        acceptedAt: '2026-05-21T12:00:00.000Z',
        expiresAt: '2027-05-21T12:00:00.000Z',
        correlationId: 'corr-runtime-acceptance-1',
      });
    }
    const compliance = new RuntimeComplianceValidator(new ComplianceGate(acceptanceService, undefined, undefined, eventBus));

    const credentialRepository = new InMemoryCredentialVaultRepository();
    const vault = new CredentialVaultService(credentialRepository, eventBus);
    const credentialLifecycle = new CredentialLifecycleService(credentialRepository, eventBus);
    const credentials = new RuntimeCredentialBindingService(credentialRepository, undefined, eventBus);
    let registeredCredential;
    if (options.registerCredential ?? true) {
      registeredCredential = await vault.registerExchangeCredential({
        ownerUserId: 'alice',
        providerId: 'simulation',
        exchange: 'simulation',
        accountLabel: 'alice simulation',
        scopes: ['read-only', 'futures-trading', 'account-info'],
        secretMaterial: {
          apiKey: 'runtime-secret-key',
          apiSecret: 'runtime-secret-secret',
        },
        correlationId: 'corr-runtime-credential-created-1',
      });
    }

    const service = new RuntimeProvisioningService({
      lifecycle,
      compliance,
      credentials,
      riskGateway: new RiskGateway(validRiskState({
        userRuntime: {
          exchangeWhitelist: ['simulation'],
          quoteCurrencyWhitelist: ['USDT'],
        },
      })),
      eventBus,
    });

    const product = new WhiteRabbitProductAdapter().toStrategyProduct();
    const profile = {
      ...userProfile('alice'),
      runtimeQuota: {
        maxActiveStrategies: options.maxActiveStrategies ?? 2,
        maxConcurrentRuntimes: options.maxConcurrentRuntimes ?? 2,
        maxDailyExecutions: 25,
      },
    };

    return {
      repository,
      eventBus,
      lifecycle,
      eventState,
      credentialRepository,
      vault,
      credentialLifecycle,
      credentials,
      service,
      product,
      profile,
      disclosure: disclosureValue,
      registeredCredential,
    };
  }

  function provisioningRequest(harness, overrides = {}) {
    return {
      id: 'runtime-provision-request-1',
      correlationId: 'corr-runtime-provision-1',
      context: runtimeContext(),
      product: harness.product,
      profile: harness.profile,
      disclosures: [harness.disclosure],
      vaultRefId: harness.registeredCredential?.reference.id,
      requiredCredentialScopes: ['futures-trading', 'account-info'],
      ...overrides,
    };
  }

  it('blocks provisioning without credential binding', async () => {
    const harness = await createRuntimeHarness({ registerCredential: false });

    const decision = await harness.service.provision(provisioningRequest(harness, { vaultRefId: undefined }));

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Runtime credential binding is required.');
    assert.equal(harness.lifecycle.listByUser('alice').length, 0);
  });

  it('blocks provisioning without disclosure acceptance', async () => {
    const harness = await createRuntimeHarness({ acceptDisclosure: false });

    const decision = await harness.service.provision(provisioningRequest(harness));

    assert.equal(decision.approved, false);
    assert.equal(decision.reason?.includes('Missing disclosure acceptance'), true);
    assert.equal(harness.lifecycle.listByUser('alice').length, 0);
  });

  it('blocks provisioning when runtime quota is exhausted', async () => {
    const harness = await createRuntimeHarness({ maxConcurrentRuntimes: 1, maxActiveStrategies: 1 });
    harness.lifecycle.register({
      id: 'runtime-existing-1',
      userId: 'alice',
      strategyProductId: harness.product.id,
      providerId: 'simulation',
      executionDomain: 'user',
      status: 'active',
      createdAt: '2026-05-21T12:00:00.000Z',
      updatedAt: '2026-05-21T12:00:00.000Z',
    });

    const decision = await harness.service.provision(provisioningRequest(harness));

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Runtime quota exhausted: max concurrent runtimes');
  });

  it('enforces treasury and user runtime separation', async () => {
    const harness = await createRuntimeHarness();

    const decision = await harness.service.provision(provisioningRequest(harness, {
      context: runtimeContext({
        executionDomain: 'treasury',
        userId: undefined,
        daoId: 'dao-1',
      }),
    }));

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Runtime provisioning is limited to user execution domain.');
  });

  it('preserves correlationId through recovery lifecycle', async () => {
    const harness = await createRuntimeHarness();
    const decision = await harness.service.provision(provisioningRequest(harness));
    assert.equal(decision.approved, true);

    const recovery = new RuntimeRecoveryService(harness.lifecycle, harness.eventBus);
    await recovery.startRecovery({
      runtimeInstanceId: decision.runtime.id,
      correlationId: 'corr-runtime-recovery-1',
      reason: 'provider-disconnect',
    });

    const events = harness.repository.queryByCorrelationId('corr-runtime-recovery-1');
    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, 'RUNTIME_RECOVERING');
    assert.equal(events[0]?.correlationId, 'corr-runtime-recovery-1');
    assert.equal(harness.lifecycle.get(decision.runtime.id)?.runtime.status, 'recovering');
  });

  it('revokes provider access when runtime is terminated', async () => {
    const harness = await createRuntimeHarness();
    const decision = await harness.service.provision(provisioningRequest(harness));
    assert.equal(decision.approved, true);

    const coordinator = new RuntimeLifecycleCoordinator(
      harness.lifecycle,
      harness.eventBus,
      harness.credentials,
      harness.vault,
      harness.credentialLifecycle,
    );
    await coordinator.terminate(decision.runtime.id, 'corr-runtime-terminate-1', 'tenant requested termination');

    const reference = harness.vault.getReference(harness.registeredCredential.reference.id);
    const eventTypes = harness.repository.queryByCorrelationId('corr-runtime-terminate-1').map((event) => event.type);
    assert.equal(reference?.status, 'revoked');
    assert.equal(harness.lifecycle.get(decision.runtime.id)?.runtime.status, 'terminated');
    assert.deepEqual(eventTypes, ['CREDENTIAL_BINDING_REVOKED', 'RUNTIME_TERMINATED']);
  });
});

describe('Paper trading runtime session', () => {
  function paperContext(overrides = {}) {
    return {
      executionDomain: 'user',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-paper-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      ...overrides,
    };
  }

  function paperRequest(overrides = {}) {
    const context = paperContext(overrides.context ?? {});
    return {
      id: 'paper-session-1',
      correlationId: 'corr-paper-session-1',
      tenantId: context.daoId ?? context.userId,
      requestedBy: 'acs',
      context,
      connectorConfig: {
        providerId: context.providerId,
        providerType: context.providerId === 'hummingbot' ? 'hummingbot' : 'simulation',
        mode: 'paper',
        connectorName: 'simulation-paper',
        market: 'BTC-USDT',
      },
      ...overrides,
    };
  }

  function createPaperHarness({ provider = new SimulationProvider(), observability = true, reconciliationCandidate } = {}) {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const registry = new ExecutionProviderRegistry();
    registry.register(provider);
    const runtimeObservability = observability ? new RuntimeObservabilityService(eventBus) : undefined;
    const worker = reconciliationCandidate
      ? new ReconciliationWorker({
          discovery: new ReconciliationCandidateDiscoveryService([reconciliationCandidate]),
          proposals: new ReconciliationProposalRepository(),
          audit: new ReconciliationWorkerAuditService(eventBus),
        })
      : undefined;
    return {
      eventBus,
      provider,
      registry,
      repository,
      runtimeObservability,
      service: new PaperTradingSessionService({
        registry,
        eventBus,
        observability: runtimeObservability,
        reconciliationWorker: worker,
      }),
      worker,
    };
  }

  function reconciliationCandidateForPaper() {
    const request = {
      context: {
        correlationId: 'corr-paper-session-1',
        executionDomain: 'user',
        userId: 'alice',
        strategyProductId: 'whiterabbit-scalper-futures',
        runtimeInstanceId: 'runtime-paper-1',
        providerId: 'simulation',
        strategyId: 'whiterabbit-v1',
      },
      sovereignSnapshot: {
        providerStatus: {
          providerId: 'simulation',
          type: 'simulation',
          connected: true,
          mode: 'paper',
          health: 'healthy',
          checkedAt: '2026-05-23T14:00:00.000Z',
        },
        runtimes: [{
          runtimeInstanceId: 'runtime-paper-1',
          status: 'active',
          updatedAt: '2026-05-23T14:00:00.000Z',
        }],
        capturedAt: '2026-05-23T14:00:00.000Z',
      },
      providerSnapshot: {
        providerStatus: {
          providerId: 'simulation',
          type: 'simulation',
          connected: false,
          mode: 'paper',
          health: 'offline',
          checkedAt: '2026-05-23T14:00:02.000Z',
        },
        runtimes: [],
        capturedAt: '2026-05-23T14:00:02.000Z',
      },
      now: '2026-05-23T14:10:00.000Z',
    };
    return {
      id: 'paper-reconciliation-candidate-1',
      tenantId: 'alice',
      candidateType: 'provider-drift',
      request,
      discoveredAt: request.now,
      reason: 'paper reconciliation dry run',
    };
  }

  it('transitions paper session through requested approved starting and active', async () => {
    const harness = createPaperHarness();

    const session = await harness.service.requestSession(paperRequest());
    const events = harness.repository.queryByCorrelationId('corr-paper-session-1').map((event) => event.type);

    assert.equal(session.status, 'active');
    assert.equal(events.includes('PAPER_SESSION_REQUESTED'), true);
    assert.equal(events.includes('PAPER_SESSION_APPROVED'), true);
    assert.equal(events.includes('PAPER_SESSION_STARTED'), true);
  });

  it('rejects live execution config', async () => {
    const harness = createPaperHarness();

    const session = await harness.service.requestSession(paperRequest({
      id: 'paper-session-live-reject',
      correlationId: 'corr-paper-live-reject',
      connectorConfig: {
        providerId: 'simulation',
        providerType: 'simulation',
        mode: 'live',
      },
    }));

    assert.equal(session.status, 'failed');
    assert.equal(session.failureReason, 'Paper session rejected live execution mode.');
    assert.equal(harness.repository.queryByType('PAPER_SESSION_FAILED').length, 1);
  });

  it('rejects production API key usage in paper config', async () => {
    const harness = createPaperHarness();

    const session = await harness.service.requestSession(paperRequest({
      id: 'paper-session-secret-reject',
      correlationId: 'corr-paper-secret-reject',
      connectorConfig: {
        providerId: 'simulation',
        providerType: 'simulation',
        mode: 'paper',
        rawApiKey: 'prod-key-must-not-leak',
      },
    }));

    assert.equal(session.status, 'failed');
    assert.equal(session.failureReason, 'Paper session config must not include raw API credentials.');
    assert.equal(JSON.stringify(harness.repository.queryByCorrelationId('corr-paper-secret-reject')).includes('prod-key-must-not-leak'), false);
  });

  it('models Hummingbot paper-compatible session safely', async () => {
    const harness = createPaperHarness({ provider: new HummingbotProvider() });

    const session = await harness.service.requestSession(paperRequest({
      id: 'paper-session-hummingbot',
      correlationId: 'corr-paper-hummingbot',
      context: paperContext({ providerId: 'hummingbot' }),
      connectorConfig: {
        providerId: 'hummingbot',
        providerType: 'hummingbot',
        mode: 'paper',
        connectorName: 'binance_paper_trade',
      },
    }));

    assert.equal(session.status, 'active');
    assert.equal(harness.repository.queryByCorrelationId('corr-paper-hummingbot').some((event) => event.type === 'PAPER_SESSION_STARTED'), true);
  });

  it('normalizes and persists paper fills', async () => {
    const harness = createPaperHarness();
    await harness.service.requestSession(paperRequest());

    const result = await harness.service.ingestOrder('paper-session-1', {
      requestId: 'paper-order-1',
      providerId: 'simulation',
      market: 'BTC-USDT',
      side: 'buy',
      orderType: 'market',
      quantity: '0.01',
    });

    assert.equal(result.status, 'submitted');
    assert.equal(harness.repository.queryByType('PAPER_ORDER_INGESTED').length, 1);
    assert.equal(harness.repository.queryByType('PAPER_FILL_NORMALIZED').length, 1);
  });

  it('updates observability from paper telemetry', async () => {
    const harness = createPaperHarness();
    await harness.service.requestSession(paperRequest());

    const state = harness.runtimeObservability.get('alice', 'runtime-paper-1');

    assert.equal(state?.health.state, 'healthy');
    assert.equal(state?.metrics.providerId, 'simulation');
  });

  it('runs reconciliation dry-run and creates proposals only', async () => {
    const candidate = reconciliationCandidateForPaper();
    const harness = createPaperHarness({ reconciliationCandidate: candidate });
    await harness.service.requestSession(paperRequest());

    const result = await harness.service.dryRunReconciliation('paper-session-1', candidate);

    assert.equal(result.proposalsCreated, 1);
    assert.equal(result.proposals[0]?.mutatesSovereignState, false);
    assert.equal(harness.repository.queryByType('PAPER_RECONCILIATION_DRY_RUN_COMPLETED').length, 1);
    assert.equal(typeof harness.service.healRuntime, 'undefined');
  });

  it('keeps user and treasury paper sessions separated', async () => {
    const harness = createPaperHarness();
    await harness.service.requestSession(paperRequest({
      id: 'paper-session-user-isolated',
      correlationId: 'corr-paper-user-isolated',
    }));
    await harness.service.requestSession(paperRequest({
      id: 'paper-session-treasury-isolated',
      correlationId: 'corr-paper-treasury-isolated',
      context: paperContext({
        executionDomain: 'treasury',
        userId: undefined,
        daoId: 'dao-paper-1',
        runtimeInstanceId: 'runtime-paper-treasury-1',
      }),
    }));

    const userEvents = harness.repository.queryByCorrelationId('corr-paper-user-isolated');
    const treasuryEvents = harness.repository.queryByCorrelationId('corr-paper-treasury-isolated');

    assert.equal(userEvents.every((event) => event.userId === 'alice'), true);
    assert.equal(treasuryEvents.every((event) => event.daoId === 'dao-paper-1'), true);
    assert.equal(treasuryEvents.every((event) => event.userId === undefined), true);
  });
});

describe('Trinity cognitive recommendation engine', () => {
  function trinityIntent(overrides = {}) {
    return {
      id: 'trinity-intent-1',
      correlationId: 'corr-trinity-1',
      tenantId: 'tenant-1',
      context: {
        executionDomain: 'user',
        userId: 'alice',
        strategyProductId: 'whiterabbit-scalper-futures',
        runtimeInstanceId: 'runtime-trinity-1',
        providerId: 'simulation',
        strategyId: 'whiterabbit-v1',
      },
      marketSnapshot: {
        volatility: 0.2,
        spreadBps: 5,
        liquidityScore: 0.85,
        trendStrength: 0.25,
      },
      providerSnapshot: {
        health: 'healthy',
      },
      strategySnapshot: {
        degradationScore: 0,
        drawdownPct: 0,
      },
      runtimeSnapshot: {
        health: 'healthy',
        staleExecutionState: false,
      },
      ...overrides,
    };
  }

  it('cannot bypass ACS or expose execution methods', async () => {
    const engine = new TrinityRecommendationEngine();
    const result = await engine.evaluate(trinityIntent({
      strategySnapshot: {
        degradationScore: 0.8,
        drawdownPct: 9,
      },
    }));

    assert.equal(typeof engine.executeOrder, 'undefined');
    assert.equal(typeof engine.requestExecution, 'undefined');
    assert.equal(result.recommendations.every((recommendation) => recommendation.requiresAcs), true);
    assert.equal(result.recommendations.every((recommendation) => recommendation.authorizedExecution === false), true);
  });

  it('does not execute provider when Trinity recommendation is sent to ACS', async () => {
    const { orchestrator, simulationProvider, eventBus } = createHarness({
      productApproved: false,
      riskApproved: true,
    });
    const acs = new AcsTradingAccessService({ orchestrator, eventBus });
    const engine = new TrinityRecommendationEngine(eventBus);
    const result = await engine.evaluate(trinityIntent({
      marketSnapshot: {
        volatility: 0.9,
        spreadBps: 30,
        liquidityScore: 0.3,
      },
    }));
    const acsRecommendation = engine.evaluator.toAcsRecommendation(result.recommendations[0]);

    const feedback = await acs.intakeRecommendation(acsRecommendation);

    assert.equal(feedback.feedbackType, 'requires-review');
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('preserves tenant context in recommendations', async () => {
    const engine = new TrinityRecommendationEngine();
    const result = await engine.evaluate(trinityIntent({
      runtimeSnapshot: {
        health: 'degraded',
      },
    }));

    const recommendation = result.recommendations.find((item) => item.recommendationType === 'recommend-runtime-recovery');
    assert.equal(recommendation?.tenantId, 'tenant-1');
    assert.equal(recommendation?.context.userId, 'alice');
    assert.equal(recommendation?.context.runtimeInstanceId, 'runtime-trinity-1');
    assert.equal(recommendation?.correlationId, 'corr-trinity-1');
  });

  it('emits recommendation for degraded strategy', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const engine = new TrinityRecommendationEngine(eventBus);

    const result = await engine.evaluate(trinityIntent({
      strategySnapshot: {
        degradationScore: 0.85,
        drawdownPct: 12,
      },
    }));

    const eventTypes = repository.queryByCorrelationId('corr-trinity-1').map((event) => event.type);
    assert.equal(result.recommendations.some((recommendation) => recommendation.recommendationType === 'pause-strategy'), true);
    assert.equal(eventTypes.includes('TRINITY_STRATEGY_DEGRADATION_DETECTED'), true);
    assert.equal(eventTypes.includes('TRINITY_BACKTEST_REQUESTED'), true);
  });

  it('emits recommendation for runtime anomaly', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const engine = new TrinityRecommendationEngine(eventBus);

    const result = await engine.evaluate(trinityIntent({
      runtimeSnapshot: {
        health: 'offline',
        staleExecutionState: true,
      },
    }));

    const eventTypes = repository.queryByCorrelationId('corr-trinity-1').map((event) => event.type);
    assert.equal(result.recommendations.some((recommendation) => recommendation.recommendationType === 'recommend-runtime-recovery'), true);
    assert.equal(eventTypes.includes('TRINITY_RUNTIME_ANOMALY_DETECTED'), true);
  });

  it('persists recommendation audit trail', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const state = new TradingStateService();
    eventBus.subscribe((event) => state.applyEvent(event));
    const engine = new TrinityRecommendationEngine(eventBus);

    await engine.evaluate(trinityIntent({
      marketSnapshot: {
        volatility: 0.95,
        spreadBps: 35,
        liquidityScore: 0.25,
      },
      providerSnapshot: {
        health: 'degraded',
      },
    }));

    const trace = repository.queryByCorrelationId('corr-trinity-1');
    const audit = state.audit.listByCorrelationId('corr-trinity-1');
    assert.equal(trace.some((event) => event.type === 'TRINITY_RECOMMENDATION_CREATED'), true);
    assert.equal(audit.length, trace.length);
    assert.equal(audit.every((record) => record.userId === 'alice'), true);
  });

  it('generates volatility protection recommendation from telemetry-aware intelligence', async () => {
    const repository = new InMemoryTradingEventRepository();
    const engine = new TrinityRecommendationEngine(new TradingEventBus(repository));

    const result = await engine.evaluate(trinityIntent({
      marketSnapshot: {
        volatility: 0.92,
        spreadBps: 8,
        liquidityScore: 0.8,
      },
    }));

    assert.equal(result.intelligenceReport.volatilitySpike, true);
    assert.equal(result.recommendations.some((recommendation) => recommendation.recommendationType === 'reduce-exposure'), true);
    assert.equal(repository.queryByType('VOLATILITY_PROTECTION_RECOMMENDED').length, 1);
  });

  it('generates provider suspension recommendation from degraded provider quality', async () => {
    const repository = new InMemoryTradingEventRepository();
    const engine = new TrinityRecommendationEngine(new TradingEventBus(repository));

    const result = await engine.evaluate(trinityIntent({
      providerQualityTelemetry: {
        degradationScore: 0.45,
        slippageBps: 35,
        fillRate: 0.72,
        rejectionRate: 0.12,
      },
    }));

    const recommendation = result.recommendations.find((item) => item.recommendationType === 'recommend-provider-block');
    assert.equal(result.intelligenceReport.providerDegraded, true);
    assert.equal(recommendation?.requiresAcs, true);
    assert.equal(recommendation?.authorizedExecution, false);
    assert.equal(repository.queryByType('PROVIDER_QUALITY_DEGRADED').length, 1);
  });

  it('generates pair rotation recommendation when spread deteriorates', async () => {
    const engine = new TrinityRecommendationEngine();

    const result = await engine.evaluate(trinityIntent({
      spreadMetrics: {
        currentSpreadBps: 32,
        averageSpreadBps: 8,
      },
    }));

    assert.equal(result.intelligenceReport.spreadDeteriorated, true);
    assert.equal(result.recommendations.some((recommendation) => recommendation.recommendationType === 'rotate-pair'), true);
  });

  it('generates runtime recovery recommendation from latency anomaly', async () => {
    const repository = new InMemoryTradingEventRepository();
    const engine = new TrinityRecommendationEngine(new TradingEventBus(repository));

    const result = await engine.evaluate(trinityIntent({
      runtimeTelemetry: {
        latencyMs: 1500,
        errorRate: 0.02,
      },
    }));

    assert.equal(result.intelligenceReport.runtimeLatencySpike, true);
    assert.equal(result.recommendations.some((recommendation) => recommendation.recommendationType === 'recommend-runtime-recovery'), true);
    assert.equal(repository.queryByType('RUNTIME_LATENCY_SPIKE_DETECTED').length, 1);
  });

  it('preserves tenant context in telemetry-aware Trinity outputs', async () => {
    const engine = new TrinityRecommendationEngine();

    const result = await engine.evaluate(trinityIntent({
      tenantId: 'tenant-alpha',
      context: {
        ...trinityIntent().context,
        userId: 'tenant-user-alpha',
        runtimeInstanceId: 'runtime-alpha-1',
      },
      providerQualityTelemetry: {
        degradationScore: 0.8,
      },
    }));

    assert.equal(result.recommendations.every((recommendation) => recommendation.tenantId === 'tenant-alpha'), true);
    assert.equal(result.recommendations.every((recommendation) => recommendation.context.userId === 'tenant-user-alpha'), true);
    assert.equal(result.recommendations.every((recommendation) => recommendation.context.runtimeInstanceId === 'runtime-alpha-1'), true);
  });

  it('persists audit trail for telemetry-aware intelligence recommendations', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const state = new TradingStateService();
    eventBus.subscribe((event) => state.applyEvent(event));
    const engine = new TrinityRecommendationEngine(eventBus);

    await engine.evaluate(trinityIntent({
      strategyPerformanceTelemetry: {
        degradationScore: 0.82,
        drawdownPct: 10,
      },
    }));

    const trace = repository.queryByCorrelationId('corr-trinity-1');
    const audit = state.audit.listByCorrelationId('corr-trinity-1');
    assert.equal(trace.some((event) => event.type === 'STRATEGY_PERFORMANCE_DEGRADED'), true);
    assert.equal(audit.length, trace.length);
    assert.equal(audit.every((record) => record.userId === 'alice'), true);
  });
});

describe('Trinity autonomy policy and simulation governance', () => {
  function autonomyContext(overrides = {}) {
    return {
      executionDomain: 'user',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-autonomy-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      ...overrides,
    };
  }

  function recommendation(overrides = {}) {
    return {
      id: 'trinity-rec-autonomy-1',
      correlationId: 'corr-autonomy-1',
      tenantId: 'tenant-1',
      producedByAgent: 'trinity',
      context: autonomyContext(),
      recommendationType: 'adjust-parameter',
      confidence: 0.8,
      rationale: 'Parameter update requires simulation-first policy.',
      createdAt: '2026-05-21T15:00:00.000Z',
      requiresAcs: true,
      authorizedExecution: false,
      ...overrides,
    };
  }

  it('blocks level 0 from requesting execution', async () => {
    const eventBus = new TradingEventBus(new InMemoryTradingEventRepository());
    const boundary = new AutonomousActionBoundary(createTrinityAutonomyProfile({ autonomyLevel: 0 }), eventBus);

    const decision = await boundary.evaluate({
      actionType: 'controlled-execution-proposal',
      context: autonomyContext(),
      recommendation: recommendation(),
    });

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Autonomy level 0 cannot perform controlled-execution-proposal.');
  });

  it('allows level 1 to request simulation only', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const boundary = new AutonomousActionBoundary(createTrinityAutonomyProfile({ autonomyLevel: 1 }), eventBus);

    const simulationDecision = await boundary.evaluate({
      actionType: 'request-simulation',
      context: autonomyContext(),
      recommendation: recommendation({ recommendationType: 'request-simulation' }),
    });
    const executionDecision = await boundary.evaluate({
      actionType: 'controlled-execution-proposal',
      context: autonomyContext(),
      recommendation: recommendation(),
    });

    assert.equal(simulationDecision.approved, true);
    assert.equal(executionDecision.approved, false);
    assert.equal(repository.queryByType('SIMULATION_APPROVED').length, 1);
    assert.equal(repository.queryByType('AUTONOMOUS_ACTION_BLOCKED').length, 1);
  });

  it('blocks production mutation without simulation', async () => {
    const boundary = new AutonomousActionBoundary(createTrinityAutonomyProfile({
      autonomyLevel: 4,
      governanceApproved: true,
      riskApproved: true,
      complianceApproved: true,
    }));

    const decision = await boundary.evaluate({
      actionType: 'production-strategy-mutation',
      context: autonomyContext(),
      recommendation: recommendation(),
      mutationPolicy: {
        productionMutationRequested: true,
        mutationType: 'adjust-parameter',
        simulationPolicy: {
          simulationRequired: true,
          backtestRequired: true,
          paperValidationRequired: true,
          simulationCompleted: false,
          backtestCompleted: true,
          paperValidationCompleted: true,
        },
        governancePolicy: {
          governanceApproved: true,
          riskApproved: true,
          minimumBacktestRuns: 1,
          completedBacktestRuns: 1,
        },
      },
    });

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Production mutation blocked without simulation.');
  });

  it('blocks autonomy escalation when governance rejects it', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const boundary = new AutonomousActionBoundary(createTrinityAutonomyProfile({
      autonomyLevel: 1,
      governanceApproved: false,
    }), eventBus);

    const decision = await boundary.requestAutonomyLevelChange(2, false, autonomyContext(), 'corr-autonomy-escalation-1');

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Governance approval is required for autonomy escalation.');
    assert.equal(repository.queryByCorrelationId('corr-autonomy-escalation-1')[0]?.type, 'AUTONOMOUS_ACTION_BLOCKED');
  });

  it('preserves audit trail for autonomous action decisions', async () => {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const state = new TradingStateService();
    eventBus.subscribe((event) => state.applyEvent(event));
    const boundary = new AutonomousActionBoundary(createTrinityAutonomyProfile({ autonomyLevel: 1 }), eventBus);

    await boundary.evaluate({
      actionType: 'request-backtest',
      context: autonomyContext(),
      recommendation: recommendation({ recommendationType: 'request-backtest' }),
    });

    const events = repository.queryByCorrelationId('corr-autonomy-1');
    const audit = state.audit.listByCorrelationId('corr-autonomy-1');
    assert.equal(events[0]?.type, 'BACKTEST_APPROVED');
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.userId, 'alice');
  });

  it('blocks autonomous mutation of treasury execution', async () => {
    const boundary = new AutonomousActionBoundary(createTrinityAutonomyProfile({
      autonomyLevel: 4,
      governanceApproved: true,
      riskApproved: true,
      complianceApproved: true,
    }));

    const decision = await boundary.evaluate({
      actionType: 'production-strategy-mutation',
      context: autonomyContext({
        executionDomain: 'treasury',
        userId: undefined,
        daoId: 'dao-1',
      }),
      recommendation: recommendation(),
      mutationPolicy: {
        productionMutationRequested: true,
        mutationType: 'reduce-exposure',
        simulationPolicy: {
          simulationRequired: true,
          backtestRequired: true,
          paperValidationRequired: true,
          simulationCompleted: true,
          backtestCompleted: true,
          paperValidationCompleted: true,
        },
        governancePolicy: {
          governanceApproved: true,
          riskApproved: true,
          minimumBacktestRuns: 1,
          completedBacktestRuns: 1,
        },
      },
    });

    assert.equal(decision.approved, false);
    assert.equal(decision.reason, 'Treasury execution cannot be autonomously mutated.');
  });
});

describe('ACS and Trinity command orchestration API', () => {
  function commandContext(overrides = {}) {
    return {
      executionDomain: 'user',
      userId: 'alice',
      strategyProductId: 'whiterabbit-scalper-futures',
      runtimeInstanceId: 'runtime-command-1',
      providerId: 'simulation',
      strategyId: 'whiterabbit-v1',
      ...overrides,
    };
  }

  function acsCommand(overrides = {}) {
    return {
      id: 'acs-command-10a-1',
      correlationId: 'corr-command-10a-1',
      tenantId: 'tenant-command-1',
      requestedBy: 'tenant-acs',
      commandType: 'request-simulation',
      context: commandContext(),
      autonomyLevel: 1,
      governanceContext: {
        governanceApproved: true,
        riskApproved: true,
        complianceApproved: true,
      },
      reason: 'Simulation request from ACS.',
      ...overrides,
    };
  }

  function recommendation(overrides = {}) {
    return {
      id: 'trinity-rec-command-1',
      correlationId: 'corr-trinity-command-1',
      tenantId: 'tenant-command-1',
      producedByAgent: 'trinity',
      context: commandContext(),
      recommendationType: 'recommend-runtime-recovery',
      confidence: 0.86,
      rationale: 'Runtime anomaly requires ACS review before recovery workflow.',
      createdAt: '2026-05-21T16:00:00.000Z',
      requiresAcs: true,
      authorizedExecution: false,
      ...overrides,
    };
  }

  function createCommandApiHarness() {
    const repository = new InMemoryTradingEventRepository();
    const eventBus = new TradingEventBus(repository);
    const state = new TradingStateService();
    eventBus.subscribe((event) => state.applyEvent(event));
    const approval = new RecommendationApprovalService();
    const workflows = new TradingWorkflowRequestService(eventBus, approval);
    return {
      repository,
      state,
      workflows,
      acs: new AcsTradingCommandApi(workflows),
      supervision: new RuntimeSupervisionApi(new AcsTradingCommandApi(workflows)),
      trinity: new TrinityRecommendationApi(workflows),
    };
  }

  it('preserves tenant context for ACS commands', async () => {
    const harness = createCommandApiHarness();
    const decision = await harness.acs.submit(acsCommand());
    const trace = harness.repository.queryByCorrelationId('corr-command-10a-1');

    assert.equal(decision.approved, true);
    assert.equal(decision.tenantId, 'tenant-command-1');
    assert.equal(decision.context.userId, 'alice');
    assert.equal(decision.context.runtimeInstanceId, 'runtime-command-1');
    assert.equal(trace[0]?.type, 'TRADING_WORKFLOW_REQUESTED');
    assert.equal(trace[0]?.payload.tenantId, 'tenant-command-1');
    assert.equal(trace[0]?.payload.autonomyLevel, 1);
  });

  it('keeps Trinity recommendations from mutating runtime directly', async () => {
    const harness = createCommandApiHarness();
    const decision = await harness.trinity.submit({
      id: 'trinity-request-command-1',
      correlationId: 'corr-trinity-command-1',
      tenantId: 'tenant-command-1',
      requestedBy: 'trinity',
      recommendation: recommendation(),
      autonomyLevel: 1,
      governanceContext: {
        governanceApproved: true,
        riskApproved: true,
        complianceApproved: true,
      },
    });
    const traceTypes = harness.repository.queryByCorrelationId('corr-trinity-command-1').map((event) => event.type);

    assert.equal(typeof harness.trinity.executeOrder, 'undefined');
    assert.equal(typeof harness.trinity.pauseRuntime, 'undefined');
    assert.equal(decision.authorizedExecution, false);
    assert.equal(decision.requiresAcs, true);
    assert.equal(traceTypes.includes('USER_RUNTIME_PAUSED'), false);
    assert.equal(traceTypes[0], 'TRINITY_RECOMMENDATION_SUBMITTED');
  });

  it('blocks workflow escalation on governance rejection', async () => {
    const harness = createCommandApiHarness();
    const decision = await harness.acs.submit(acsCommand({
      id: 'acs-command-governance-reject',
      correlationId: 'corr-command-governance-reject',
      commandType: 'request-provider-suspension',
      governanceContext: {
        governanceApproved: false,
        riskApproved: true,
        complianceApproved: true,
        reason: 'DAO approval missing.',
      },
    }));
    const rejected = harness.repository.queryByType('TRADING_WORKFLOW_REJECTED');

    assert.equal(decision.approved, false);
    assert.equal(decision.blockedBy, 'governance');
    assert.equal(rejected[0]?.payload.reason, 'DAO approval missing.');
  });

  it('blocks workflow continuation on risk rejection', async () => {
    const harness = createCommandApiHarness();
    const decision = await harness.supervision.request(acsCommand({
      id: 'acs-command-risk-reject',
      correlationId: 'corr-command-risk-reject',
      commandType: 'request-strategy-pause',
      governanceContext: {
        governanceApproved: true,
        riskApproved: false,
        complianceApproved: true,
        reason: 'Risk policy blocked strategy pause workflow.',
      },
    }));

    assert.equal(decision.approved, false);
    assert.equal(decision.blockedBy, 'risk');
    assert.equal(decision.commandType, 'request-strategy-pause');
    assert.equal(decision.mutatesRuntime, false);
  });

  it('persists audit trail for recommendation approval decisions', async () => {
    const harness = createCommandApiHarness();
    const decision = await harness.trinity.submit({
      id: 'trinity-request-audit-1',
      correlationId: 'corr-trinity-audit-1',
      tenantId: 'tenant-command-1',
      requestedBy: 'trinity',
      recommendation: recommendation({
        id: 'trinity-rec-audit-1',
        correlationId: 'corr-trinity-audit-1',
        recommendationType: 'pause-strategy',
      }),
      autonomyLevel: 2,
      governanceContext: {
        governanceApproved: true,
        riskApproved: true,
        complianceApproved: true,
      },
    });
    const trace = harness.repository.queryByCorrelationId('corr-trinity-audit-1');
    const audit = harness.state.audit.listByCorrelationId('corr-trinity-audit-1');

    assert.equal(decision.approved, true);
    assert.deepEqual(trace.map((event) => event.type), ['TRINITY_RECOMMENDATION_SUBMITTED', 'TRADING_WORKFLOW_APPROVED']);
    assert.equal(audit.length, trace.length);
    assert.equal(audit.every((record) => record.userId === 'alice'), true);
  });
});
