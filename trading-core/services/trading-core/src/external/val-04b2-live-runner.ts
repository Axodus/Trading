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
  Val04B2ControlledOrderHarness,
} from './Val04B2ControlledOrderHarness.js';
import { Val04B2CredentialSource } from './Val04B2CredentialSource.js';
import { Val04B2LiveTransport } from './Val04B2LiveTransport.js';

type RunnerEnvironment = Readonly<Record<string, string | undefined>>;
type RuntimeProcess = {
  argv: string[];
  env: RunnerEnvironment;
  stdout: { write(value: string): void };
};

const runtimeProcess = (globalThis as unknown as { process: RuntimeProcess }).process;

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
  if (runtimeProcess.argv.slice(2).join(' ') !== '--public') {
    throw new Error('VAL-04B2 R4 runner requires the explicit --public Phase A mode; mutation mode is unavailable');
  }
  const result = await runVal04B2PublicQualification();
  runtimeProcess.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${runtimeProcess.argv[1]}`) await main();

export { VAL_04B_AXODUS_INSTRUMENT };
