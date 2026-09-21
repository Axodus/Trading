import {
  deriveMinimumValidLimitOrder,
  deriveRuntimeVenueRules,
  VAL_04B_AXODUS_INSTRUMENT,
  VAL_04B_SYMBOL,
  Val04BPreCredentialHarness,
  verifyPublicExchangeInfo,
} from './Val04BPreCredentialHarness.js';
import {
  VAL_04B2_BASE_URL,
  VAL_04B2_PREMIUM_INDEX_PATH,
  VAL_04B2_APPROVAL_TOKEN,
  Val04B2ControlledOrderHarness,
  Val04B2OrderExecutionResult,
} from './Val04B2ControlledOrderHarness.js';
import { Val04B2CredentialSource } from './Val04B2CredentialSource.js';
import { Val04B2LiveTransport } from './Val04B2LiveTransport.js';
import { assertTestnetMutationAuthorized } from './ExternalMutationTestGuard.js';

type RunnerEnvironment = Readonly<Record<string, string | undefined>>;
type RuntimeProcess = {
  argv: string[];
  env: RunnerEnvironment;
  stdout: { write(value: string): void };
};

const runtimeProcess = (globalThis as unknown as { process: RuntimeProcess }).process;

export const VAL_04B2_EXECUTE_CONFIRMATION_VARIABLE = 'AXODUS_VAL_04B2_EXECUTE_CONFIRMATION' as const;
export const VAL_04B2_EXECUTE_CONFIRMATION = 'EXECUTE_SINGLE_TESTNET_ORDER' as const;

export type Val04B2HarnessFactory = (
  environment: RunnerEnvironment,
) => Pick<Val04B2ControlledOrderHarness, 'executeControlledOrderLifecycle'>;

export interface Val04B2ExecuteResult {
  environment: 'binance_perpetual_testnet';
  endpoint: typeof VAL_04B2_BASE_URL;
  result: Val04B2OrderExecutionResult;
}

export interface Val04B2PublicQualificationResult {
  environment: 'binance_perpetual_testnet';
  endpoint: typeof VAL_04B2_BASE_URL;
  symbol: typeof VAL_04B_SYMBOL;
  contractType: string;
  status: string;
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
  referencePrice: number;
  candidatePrice: number;
  candidateQuantity: number;
  candidateNotional: number;
  credentialsLoaded: 0;
  privateCalls: 0;
  postAttempts: 0;
  deleteAttempts: 0;
  websocketUsed: 0;
  mainnetCalls: 0;
}

export function createVal04B2ControlledOrderHarness(
  environment: RunnerEnvironment = runtimeProcess.env,
): Val04B2ControlledOrderHarness {
  return new Val04B2ControlledOrderHarness(
    new Val04B2CredentialSource(environment),
    new Val04B2LiveTransport(),
  );
}

export function assertVal04B2ExecutionTarget(endpoint: string = VAL_04B2_BASE_URL): void {
  if (endpoint !== VAL_04B2_BASE_URL) {
    throw new Error('VAL-04B2 execution admits only the Binance Futures Testnet endpoint');
  }
}

export function resolveVal04B2Mode(args: readonly string[]): 'public' | 'execute' {
  if (args.length !== 1 || (args[0] !== '--public' && args[0] !== '--execute')) {
    throw new Error('VAL-04B2 R4 runner requires exactly one explicit mode: --public or --execute');
  }
  return args[0] === '--public' ? 'public' : 'execute';
}

function sanitizeExecutionResult(result: Val04B2OrderExecutionResult): Val04B2OrderExecutionResult {
  return {
    environment: result.environment,
    symbol: result.symbol,
    instrument: result.instrument,
    executionClientOrderId: result.executionClientOrderId,
    providerOrderId: result.providerOrderId,
    submittedPrice: result.submittedPrice,
    submittedQuantity: result.submittedQuantity,
    submittedNotional: result.submittedNotional,
    preflightPassed: result.preflightPassed,
    submissionStatus: result.submissionStatus,
    lookupStatusAfterSubmit: result.lookupStatusAfterSubmit,
    identityPreserved: result.identityPreserved,
    cancellationStatus: result.cancellationStatus,
    terminalReconciliationStatus: result.terminalReconciliationStatus,
    residualActiveOrdersCount: result.residualActiveOrdersCount,
    residualPositionAmount: result.residualPositionAmount,
    blindRetries: result.blindRetries,
    ordersSubmitted: result.ordersSubmitted,
    websocketUsed: false,
    mainnetExcluded: true,
    secretsExposed: false,
    cleanupPassed: result.cleanupPassed,
  };
}

export async function runVal04B2Execute(
  environment: RunnerEnvironment = runtimeProcess.env,
  createHarness: Val04B2HarnessFactory = createVal04B2ControlledOrderHarness,
): Promise<Val04B2ExecuteResult> {
  assertVal04B2ExecutionTarget();
  if (environment[VAL_04B2_EXECUTE_CONFIRMATION_VARIABLE] !== VAL_04B2_EXECUTE_CONFIRMATION) {
    throw new Error(
      `VAL-04B2 execute mode requires ${VAL_04B2_EXECUTE_CONFIRMATION_VARIABLE}=${VAL_04B2_EXECUTE_CONFIRMATION}`,
    );
  }
  assertTestnetMutationAuthorized(environment);

  const harness = createHarness(environment);
  const result = await harness.executeControlledOrderLifecycle({
    approval: VAL_04B2_APPROVAL_TOKEN,
    maxOrderNotional: 250,
    tenantId: 'axodus-trading-tenant',
    runSessionId: 'val-04b2-r4',
  });

  return {
    environment: 'binance_perpetual_testnet',
    endpoint: VAL_04B2_BASE_URL,
    result: sanitizeExecutionResult(result),
  };
}

export async function runVal04B2PublicQualification(
  transport = new Val04B2LiveTransport(),
): Promise<Val04B2PublicQualificationResult> {
  const exchangeInfo = await verifyPublicExchangeInfo(
    { get: (path, timeoutMs) => transport.get(path, {}, {}, timeoutMs) },
  );
  const symbol = exchangeInfo.symbols.find((candidate) => candidate.symbol === VAL_04B_SYMBOL);
  if (!symbol || symbol.contractType !== 'PERPETUAL' || symbol.status !== 'TRADING') {
    throw new Error('BTCUSDT must be a TRADING PERPETUAL contract');
  }

  const rules = deriveRuntimeVenueRules(exchangeInfo);
  const premiumResponse = await transport.get(
    VAL_04B2_PREMIUM_INDEX_PATH,
    { symbol: VAL_04B_SYMBOL },
    {},
    5000,
  );
  if (premiumResponse.status !== 200) throw new Error(`Public premium index failed with HTTP ${premiumResponse.status}`);
  const premium = (await premiumResponse.json()) as Record<string, unknown>;
  const referencePrice = Number(premium.markPrice ?? premium.price);
  const clientOrderId = 'axd_r4_phase_a_public';
  const candidate = deriveMinimumValidLimitOrder(rules, referencePrice, 250, clientOrderId, 'BUY');
  const preflight = new Val04BPreCredentialHarness().prepare({
    exchangeInfo,
    referencePrice,
    clientOrderId,
    maxOrderNotional: 250,
    credentialCapability: 'ABSENT',
  });
  if (!preflight.passed || !preflight.order) throw new Error(`Public preflight rejected runtime candidate: ${preflight.failures.join('; ')}`);

  return {
    environment: 'binance_perpetual_testnet',
    endpoint: VAL_04B2_BASE_URL,
    symbol: VAL_04B_SYMBOL,
    contractType: symbol.contractType,
    status: symbol.status,
    tickSize: rules.tickSize,
    stepSize: rules.stepSize,
    minQty: rules.minQuantity,
    minNotional: rules.minNotional,
    referencePrice,
    candidatePrice: candidate.price,
    candidateQuantity: candidate.quantity,
    candidateNotional: candidate.notional,
    credentialsLoaded: 0,
    privateCalls: 0,
    postAttempts: 0,
    deleteAttempts: 0,
    websocketUsed: 0,
    mainnetCalls: 0,
  };
}

async function main(): Promise<void> {
  const mode = resolveVal04B2Mode(runtimeProcess.argv.slice(2));
  const result = mode === 'public'
    ? await runVal04B2PublicQualification()
    : await runVal04B2Execute();
  runtimeProcess.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${runtimeProcess.argv[1]}`) await main();

export { VAL_04B_AXODUS_INSTRUMENT };
