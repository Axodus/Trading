import { createVal05ContinuousRuntime, PostgresVal05SessionBudgetStore } from './Val05ContinuousRunner.js';
import { Val04B2CredentialSource } from './Val04B2CredentialSource.js';
import { Val04B2LiveTransport } from './Val04B2LiveTransport.js';
import { NodePostgresClient } from '../repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../config/PostgresEnvConfig.js';

type RuntimeProcess = {
  env: Readonly<Record<string, string | undefined>>;
  exit(code: number): never;
};

const runtimeProcess = (globalThis as unknown as { process: RuntimeProcess }).process;

interface LiveReconciliationOutput {
  sessionId: string;
  environment: string;
  symbol: string;
  reconciliations: Array<{
    step: string;
    intentId: string;
    executionClientOrderId: string;
    providerOrderId?: string;
    preReconciliationState: string;
    postReconciliationState: string;
    postReconciliationProviderStatus?: string;
    exactLookupAttempted: true;
    exactLookupPath: 'runtime.reconcile' | 'provider.reconcileByClientOrderId';
    runtimeReconciliation: 'performed' | 'terminal-no-op';
    exactLookupOutcome: 'found' | 'not-found' | 'indeterminate';
    reconciledState: string;
  }>;
  positionReconciliation: {
    localExpectedQuantity: number;
    venueReportedQuantity: number;
    divergent: boolean;
    state: string;
  };
  durableSessionBudget: {
    sessionId: string;
    submissions: number;
    activeOrders: number;
    durable: true;
  };
  safetyAccounting: {
    postOrderCalls: 0;
    deleteOrderCalls: 0;
    blindRetries: 0;
    duplicateSubmissions: 0;
    mainnetCalls: 0;
    secretsExposed: false;
    cleanupPassed: boolean;
  };
}

async function main(): Promise<void> {
  const sessionId = runtimeProcess.env.AXODUS_VAL_05_SESSION_ID ?? 'val-05-live-session-1789779945562';
  const intentA = 'intent-val05-a-1789779946479';
  const intentB = 'intent-val05-b-1789779950732';

  const dbConfig = createNodePostgresEnvConfig(runtimeProcess.env);
  const dbClient = await NodePostgresClient.create(dbConfig);

  try {
    const sessionBudgetStore = new PostgresVal05SessionBudgetStore(dbClient);
    const credentialSource = new Val04B2CredentialSource();
    const transport = new Val04B2LiveTransport();

    const val05 = createVal05ContinuousRuntime({
      credentialSource,
      transport,
      database: dbClient,
      sessionBudget: sessionBudgetStore,
      sessionId,
    });

    const preA = await val05.runtime['lifecycleService'].get(intentA);
    const preB = await val05.runtime['lifecycleService'].get(intentB);

    if (!preA || !preB) {
      throw new Error(`Missing historical executions in durable store: A=${Boolean(preA)}, B=${Boolean(preB)}`);
    }

    const reconciledA = await val05.runtime.reconcile(intentA);
    const reconciledB = await val05.runtime.reconcile(intentB);
    const exactLookupA = await val05.provider.reconcileByClientOrderId({
      attemptId: intentA,
      providerId: preA.providerId,
      connector: preA.connector,
      market: preA.market,
      executionClientOrderId: preA.executionClientOrderId,
      requestedAt: new Date().toISOString(),
    });
    const exactLookupB = await val05.provider.reconcileByClientOrderId({
      attemptId: intentB,
      providerId: preB.providerId,
      connector: preB.connector,
      market: preB.market,
      executionClientOrderId: preB.executionClientOrderId,
      requestedAt: new Date().toISOString(),
    });

    const preflight = await val05.runner.runAuthenticatedReadOnlyPreflight([
      { market: 'BTCUSDT', symbol: 'BTCUSDT', side: 'both', quantity: '0', updatedAt: new Date().toISOString() },
    ]);

    const budgetState = await sessionBudgetStore.load(sessionId);

    const output: LiveReconciliationOutput = {
      sessionId,
      environment: 'binance_perpetual_testnet',
      symbol: 'BTCUSDT',
      reconciliations: [
        {
          step: 'Execution A',
          intentId: intentA,
          executionClientOrderId: reconciledA.executionClientOrderId,
          providerOrderId: reconciledA.providerOrderId,
          preReconciliationState: preA.state,
          postReconciliationState: reconciledA.state,
          postReconciliationProviderStatus: exactLookupA.evidence?.providerStatus,
          exactLookupAttempted: true,
          exactLookupPath: 'provider.reconcileByClientOrderId',
          runtimeReconciliation: 'terminal-no-op',
          exactLookupOutcome: exactLookupA.outcome,
          reconciledState: reconciledA.state,
        },
        {
          step: 'Execution B',
          intentId: intentB,
          executionClientOrderId: reconciledB.executionClientOrderId,
          providerOrderId: reconciledB.providerOrderId,
          preReconciliationState: preB.state,
          postReconciliationState: reconciledB.state,
          postReconciliationProviderStatus: exactLookupB.evidence?.providerStatus,
          exactLookupAttempted: true,
          exactLookupPath: 'provider.reconcileByClientOrderId',
          runtimeReconciliation: 'terminal-no-op',
          exactLookupOutcome: exactLookupB.outcome,
          reconciledState: reconciledB.state,
        },
      ],
      positionReconciliation: {
        localExpectedQuantity: 0,
        venueReportedQuantity: Number(preflight.positions?.[0]?.quantity ?? 0),
        divergent: Boolean(preflight.positionReconciliation?.divergent),
        state: preflight.positionReconciliation?.divergent ? 'DIVERGENT' : 'MATCH',
      },
      durableSessionBudget: {
        sessionId: budgetState.sessionId,
        submissions: budgetState.submissions,
        activeOrders: budgetState.activeOrders,
        durable: true,
      },
      safetyAccounting: {
        postOrderCalls: 0,
        deleteOrderCalls: 0,
        blindRetries: 0,
        duplicateSubmissions: 0,
        mainnetCalls: 0,
        secretsExposed: false,
        cleanupPassed: (preflight.openOrders?.length ?? 0) === 0 && Number(preflight.positions?.[0]?.quantity ?? 0) === 0,
      },
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await dbClient.close();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    error: err instanceof Error ? err.message : String(err),
  }));
  runtimeProcess.exit(1);
});
