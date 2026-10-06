import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AcsTradingAccessService,
  createExecutionAuthorityContext,
  ExecutionBlockedError,
  ExecutionOrchestrator,
  ExecutionProviderRegistry,
  GovernanceExecutionGuard,
  ProductExecutionGate,
  RiskGateway,
  SimulationProvider,
  TradingEventBus,
  validateExecutionAuthorityContext,
  validateExecutionAuthorityBinding,
  EXECUTION_ORDER_SUBMIT_ACTION,
  executionOrderResource,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';

function makeValidAuthorityContext(overrides = {}) {
  return createExecutionAuthorityContext({
    executionIntentId: 'intent-test-1',
    tenantId: 'tenant-acme',
    principalRef: 'principal:operator-1',
    action: EXECUTION_ORDER_SUBMIT_ACTION,
    resource: executionOrderResource('simulation', 'BTC-USDT'),
    requestedAt: '2026-10-06T12:00:00.000Z',
    ...overrides,
  });
}

function makeIntent(overrides = {}) {
  const id = overrides.id ?? 'intent-test-1';
  const tenantId = overrides.tenantId ?? 'tenant-acme';
  const principalRef = overrides.principalRef ?? 'principal:operator-1';
  const providerId = overrides.providerId ?? 'simulation';
  const market = overrides.market ?? 'BTC-USDT';

  return {
    id,
    correlationId: 'corr-test-1',
    context: {
      executionDomain: 'user',
      tenantId,
      principalRef,
      providerId,
      userId: 'operator-1',
    },
    request: {
      requestId: 'req-test-1',
      providerId,
      market,
      side: 'buy',
      orderType: 'market',
      quantity: '0.1',
    },
    authorityContext: overrides.authorityContext ?? makeValidAuthorityContext({
      executionIntentId: id,
      tenantId,
      principalRef,
      resource: executionOrderResource(providerId, market),
    }),
  };
}

function createHarness() {
  const providers = new ExecutionProviderRegistry();
  const eventBus = new TradingEventBus();
  const simulationProvider = new SimulationProvider({ eventBus, deterministicPrice: '100' });
  providers.register(simulationProvider);

  const orchestrator = new ExecutionOrchestrator({
    providers,
    productGate: new ProductExecutionGate(true),
    governanceGuard: new GovernanceExecutionGuard(true),
    riskGateway: new RiskGateway(true),
    eventBus,
  });

  return { orchestrator, simulationProvider, eventBus };
}

describe('AXODUS-TRADING-IMP-EXECUTION-AUTHORITY-CONTEXT-01 — Authority Context', () => {
  it('valid complete context is accepted and frozen', () => {
    const ctx = makeValidAuthorityContext();
    assert.equal(ctx.executionIntentId, 'intent-test-1');
    assert.equal(ctx.tenantId, 'tenant-acme');
    assert.equal(ctx.principalRef, 'principal:operator-1');
    assert.equal(ctx.action, EXECUTION_ORDER_SUBMIT_ACTION);
    assert.equal(ctx.resource, 'execution-provider:simulation:market:BTC-USDT');
    assert.equal(Object.isFrozen(ctx), true);
  });

  it('rejects missing tenant with EXECUTION_TENANT_MISSING', () => {
    const res = validateExecutionAuthorityContext({
      executionIntentId: 'intent-1',
      principalRef: 'user-1',
      action: 'order.submit',
      resource: 'res-1',
      requestedAt: '2026-10-06T12:00:00.000Z',
    });
    assert.equal(res.valid, false);
    assert.equal(res.code, 'EXECUTION_TENANT_MISSING');
  });

  it('rejects missing principal with EXECUTION_PRINCIPAL_MISSING', () => {
    const res = validateExecutionAuthorityContext({
      executionIntentId: 'intent-1',
      tenantId: 'tenant-1',
      action: 'order.submit',
      resource: 'res-1',
      requestedAt: '2026-10-06T12:00:00.000Z',
    });
    assert.equal(res.valid, false);
    assert.equal(res.code, 'EXECUTION_PRINCIPAL_MISSING');
  });

  it('rejects missing action with EXECUTION_ACTION_MISSING', () => {
    const res = validateExecutionAuthorityContext({
      executionIntentId: 'intent-1',
      tenantId: 'tenant-1',
      principalRef: 'user-1',
      resource: 'res-1',
      requestedAt: '2026-10-06T12:00:00.000Z',
    });
    assert.equal(res.valid, false);
    assert.equal(res.code, 'EXECUTION_ACTION_MISSING');
  });

  it('rejects missing resource with EXECUTION_RESOURCE_MISSING', () => {
    const res = validateExecutionAuthorityContext({
      executionIntentId: 'intent-1',
      tenantId: 'tenant-1',
      principalRef: 'user-1',
      action: 'order.submit',
      requestedAt: '2026-10-06T12:00:00.000Z',
    });
    assert.equal(res.valid, false);
    assert.equal(res.code, 'EXECUTION_RESOURCE_MISSING');
  });

  it('rejects invalid requestedAt date string with EXECUTION_REQUESTED_AT_INVALID', () => {
    const res = validateExecutionAuthorityContext({
      executionIntentId: 'intent-1',
      tenantId: 'tenant-1',
      principalRef: 'user-1',
      action: 'order.submit',
      resource: 'res-1',
      requestedAt: 'not-a-date',
    });
    assert.equal(res.valid, false);
    assert.equal(res.code, 'EXECUTION_REQUESTED_AT_INVALID');
  });

  it('rejects a date-only requestedAt value', () => {
    const res = validateExecutionAuthorityContext({
      executionIntentId: 'intent-1',
      tenantId: 'tenant-1',
      principalRef: 'user-1',
      action: 'order.submit',
      resource: 'res-1',
      requestedAt: '2026-10-06',
    });
    assert.equal(res.valid, false);
    assert.equal(res.code, 'EXECUTION_REQUESTED_AT_INVALID');
  });

  it('preserves canonical fields across JSON serialization', () => {
    const original = makeValidAuthorityContext({
      governanceAuthorityRef: 'governance-resolution:resolution-1',
      treasuryScopeRef: 'treasury-scope:scope-1',
      treasuryAuthorizationRef: 'treasury-authorization:authorization-1',
    });
    const deserialized = JSON.parse(JSON.stringify(original));

    assert.deepEqual(deserialized, original);
    assert.deepEqual(validateExecutionAuthorityContext(deserialized), {
      valid: true,
      reasons: [],
      code: undefined,
    });
  });

  it('allows retry binding only for the same semantic intent', () => {
    const context = makeValidAuthorityContext();
    const validRetry = validateExecutionAuthorityBinding(context, {
      executionIntentId: context.executionIntentId,
      tenantId: context.tenantId,
      principalRef: context.principalRef,
      action: context.action,
      resource: context.resource,
    });
    const changedResource = validateExecutionAuthorityBinding(context, {
      executionIntentId: context.executionIntentId,
      tenantId: context.tenantId,
      principalRef: context.principalRef,
      action: context.action,
      resource: executionOrderResource('simulation', 'ETH-USDT'),
    });

    assert.equal(validRetry.valid, true);
    assert.equal(changedResource.valid, false);
    assert.equal(changedResource.code, 'EXECUTION_RESOURCE_MISMATCH');
  });

  it('rejects intent with mismatched tenant with EXECUTION_TENANT_MISMATCH', async () => {
    const { orchestrator } = createHarness();
    const intent = makeIntent({
      tenantId: 'tenant-alpha',
      authorityContext: makeValidAuthorityContext({
        executionIntentId: 'intent-test-1',
        tenantId: 'tenant-beta',
        principalRef: 'principal:operator-1',
      }),
    });

    await assert.rejects(
      orchestrator.execute(intent),
      (err) => err instanceof ExecutionBlockedError && err.code === 'EXECUTION_TENANT_MISMATCH',
    );
  });

  it('rejects intent with mismatched principal with EXECUTION_PRINCIPAL_MISMATCH', async () => {
    const { orchestrator } = createHarness();
    const intent = makeIntent({
      principalRef: 'principal:alice',
      authorityContext: makeValidAuthorityContext({
        executionIntentId: 'intent-test-1',
        tenantId: 'tenant-acme',
        principalRef: 'principal:bob',
      }),
    });

    await assert.rejects(
      orchestrator.execute(intent),
      (err) => err instanceof ExecutionBlockedError && err.code === 'EXECUTION_PRINCIPAL_MISMATCH',
    );
  });

  it('rejects intent with mismatched action with EXECUTION_ACTION_MISMATCH', async () => {
    const { orchestrator } = createHarness();
    const intent = makeIntent({
      authorityContext: makeValidAuthorityContext({
        executionIntentId: 'intent-test-1',
        tenantId: 'tenant-acme',
        principalRef: 'principal:operator-1',
        action: 'strategy.start',
      }),
    });

    await assert.rejects(
      orchestrator.execute(intent),
      (err) => err instanceof ExecutionBlockedError && err.code === 'EXECUTION_ACTION_MISMATCH',
    );
  });

  it('rejects intent with mismatched resource with EXECUTION_RESOURCE_MISMATCH', async () => {
    const { orchestrator } = createHarness();
    const intent = makeIntent({
      market: 'BTC-USDT',
      authorityContext: makeValidAuthorityContext({
        executionIntentId: 'intent-test-1',
        tenantId: 'tenant-acme',
        principalRef: 'principal:operator-1',
        resource: executionOrderResource('simulation', 'ETH-USDT'),
      }),
    });

    await assert.rejects(
      orchestrator.execute(intent),
      (err) => err instanceof ExecutionBlockedError && err.code === 'EXECUTION_RESOURCE_MISMATCH',
    );
  });

  it('legacy governanceApproved=true cannot substitute for missing authority context', async () => {
    const { orchestrator } = createHarness();
    const intentWithoutAuthority = {
      id: 'intent-no-auth',
      correlationId: 'corr-1',
      context: {
        executionDomain: 'treasury',
        tenantId: 'tenant-dao',
        principalRef: 'principal:dao',
        daoId: 'dao-1',
        providerId: 'simulation',
      },
      request: {
        requestId: 'req-1',
        providerId: 'simulation',
        market: 'BTC-USDT',
        side: 'buy',
        orderType: 'market',
        quantity: '0.1',
      },
      governanceApproved: true,
    };

    await assert.rejects(
      orchestrator.execute(intentWithoutAuthority),
      (err) => err instanceof ExecutionBlockedError && err.code === 'EXECUTION_AUTHORITY_CONTEXT_MISSING',
    );
  });

  it('ACS fails closed with a typed error when a deserialized command omits authorityContext', async () => {
    const { orchestrator, simulationProvider, eventBus } = createHarness();
    const acs = new AcsTradingAccessService({ orchestrator, eventBus });
    const baseIntent = makeIntent();
    const commandWithoutAuthority = {
      id: baseIntent.id,
      correlationId: baseIntent.correlationId,
      tenantId: 'tenant-acme',
      requestedBy: 'principal:operator-1',
      context: baseIntent.context,
      request: baseIntent.request,
    };

    await assert.rejects(
      acs.requestExecution(commandWithoutAuthority),
      (err) => err instanceof ExecutionBlockedError && err.code === 'EXECUTION_AUTHORITY_CONTEXT_MISSING',
    );
    assert.equal(simulationProvider.receivedExecutions.length, 0);
  });

  it('ACS propagates valid ExecutionAuthorityContext and succeeds', async () => {
    const { orchestrator, simulationProvider, eventBus } = createHarness();
    const acs = new AcsTradingAccessService({ orchestrator, eventBus });

    const baseIntent = makeIntent();
    const acsRequest = {
      id: baseIntent.id,
      correlationId: baseIntent.correlationId,
      tenantId: 'tenant-acme',
      requestedBy: 'principal:operator-1',
      context: baseIntent.context,
      request: baseIntent.request,
      authorityContext: baseIntent.authorityContext,
    };

    const receipt = await acs.requestExecution(acsRequest);
    assert.equal(receipt.intentId, baseIntent.id);
    assert.equal(simulationProvider.receivedExecutions.length, 1);
  });
});
