import { NodePostgresClient } from '../repositories/postgres/NodePostgresClient.js';
import { createNodePostgresEnvConfig } from '../config/PostgresEnvConfig.js';
import { PostgresPositionProtectionRepository } from './PostgresPositionProtectionRepository.js';
import { PostgresTradingSafetyStateRepository } from './PostgresTradingSafetyStateRepository.js';
import { BinanceConditionalProtectionAdapter } from './BinanceConditionalProtectionAdapter.js';
import { Val04B2LiveTransport } from '../external/Val04B2LiveTransport.js';
import { Val04B2CredentialSource } from '../external/Val04B2CredentialSource.js';
import { IndependentSafetySupervisor } from './IndependentSafetySupervisor.js';
import type { SafetySupervisorConfigV1 } from './IndependentSafetySupervisorContracts.js';

type NodeProcessLike = {
  env?: Record<string, string | undefined>;
  pid?: number;
  exit?: (code?: number) => never;
  on?: (event: string, handler: (signal: string) => void) => void;
};

function getRuntimeProcess(): NodeProcessLike {
  return ((globalThis as unknown as { process?: NodeProcessLike }).process ?? {});
}

export interface SupervisorBootstrapOptions {
  env?: Record<string, string | undefined>;
  dryRun?: boolean;
}

export async function bootstrapSafetySupervisor(
  options: SupervisorBootstrapOptions = {},
): Promise<{
  supervisor: IndependentSafetySupervisor;
  dbClient: NodePostgresClient;
  shutdown: () => Promise<void>;
}> {
  const proc = getRuntimeProcess();
  const env = options.env ?? proc.env ?? {};
  const environment = env.AXODUS_TRADING_ENVIRONMENT ?? env.TRADING_ENVIRONMENT ?? 'testnet';
  const provider = env.AXODUS_TRADING_PROVIDER ?? 'binance-perpetual-futures';
  const pid = proc.pid ?? 0;
  const supervisorId = env.AXODUS_SUPERVISOR_ID ?? `supervisor_${pid}_${Date.now().toString(36)}`;
  const healthPort = env.AXODUS_SUPERVISOR_HEALTH_PORT ? Number(env.AXODUS_SUPERVISOR_HEALTH_PORT) : 9108;
  const leaseDurationMs = env.AXODUS_SUPERVISOR_LEASE_MS ? Number(env.AXODUS_SUPERVISOR_LEASE_MS) : 15000;
  const heartbeatIntervalMs = env.AXODUS_SUPERVISOR_HEARTBEAT_MS ? Number(env.AXODUS_SUPERVISOR_HEARTBEAT_MS) : 4000;
  const reconciliationIntervalMs = env.AXODUS_SUPERVISOR_RECONCILE_MS ? Number(env.AXODUS_SUPERVISOR_RECONCILE_MS) : 5000;

  const dbConfig = createNodePostgresEnvConfig(env as any);
  const dbClient = await NodePostgresClient.create(dbConfig);

  const protectionRepo = new PostgresPositionProtectionRepository(dbClient);
  const safetyStateRepo = new PostgresTradingSafetyStateRepository(dbClient);

  // Initialize Binance adapter with live transport and credentials if present
  const transport = new Val04B2LiveTransport();
  const credentialSource = new Val04B2CredentialSource(env);
  const venueAdapter = new BinanceConditionalProtectionAdapter(credentialSource, transport, {
    environment,
    timeoutMs: 5000,
  });

  const config: SafetySupervisorConfigV1 = {
    supervisorId,
    environment,
    provider,
    leaseDurationMs,
    heartbeatIntervalMs,
    reconciliationIntervalMs,
    healthPort,
    dryRun: options.dryRun ?? false,
  };

  const supervisor = new IndependentSafetySupervisor(
    config,
    protectionRepo,
    safetyStateRepo,
    venueAdapter,
  );

  const shutdown = async () => {
    await supervisor.shutdown();
    await dbClient.close();
  };

  return { supervisor, dbClient, shutdown };
}

export async function runSupervisorMain(): Promise<void> {
  const proc = getRuntimeProcess();
  const { supervisor, shutdown } = await bootstrapSafetySupervisor();

  const handleSignal = async (signal: string) => {
    console.log(`[SafetySupervisor] Received ${signal}. Initiating graceful drain and lease release...`);
    await shutdown();
    console.log('[SafetySupervisor] Shutdown complete.');
    if (proc.exit) {
      proc.exit(0);
    }
  };

  if (proc.on) {
    proc.on('SIGTERM', () => void handleSignal('SIGTERM'));
    proc.on('SIGINT', () => void handleSignal('SIGINT'));
  }

  console.log(`[SafetySupervisor] Starting autonomous safety supervisor (PID ${proc.pid ?? 0})...`);
  await supervisor.start();
  console.log('[SafetySupervisor] Supervisor running.');
}

if (typeof globalThis !== 'undefined') {
  const p = getRuntimeProcess() as unknown as { argv?: string[] };
  if (p && p.argv && p.argv[1]) {
    const currentScript = p.argv[1].replace(/\\/g, '/');
    if (currentScript.endsWith('IndependentSafetySupervisorRunner.js') || currentScript.endsWith('IndependentSafetySupervisorRunner.ts')) {
      void runSupervisorMain();
    }
  }
}


