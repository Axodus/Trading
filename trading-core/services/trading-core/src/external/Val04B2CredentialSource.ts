import {
  Val04B1CredentialMetadata,
  Val04B1CredentialSource,
} from './Val04B1AuthenticatedReadHarness.js';

interface Val04B2SecretMaterial {
  apiKey: string;
  apiSecret: string;
}

const API_KEY_ENV = 'TRADING_BINANCE_API_KEY';
const API_SECRET_ENV = 'TRADING_BINANCE_API_SECRET';
type CredentialEnvironment = Readonly<Record<string, string | undefined>>;

const runtimeEnvironment = (): CredentialEnvironment =>
  ((globalThis as unknown as { process?: { env?: CredentialEnvironment } }).process?.env ?? {});

export class Val04B2CredentialSource implements Val04B1CredentialSource {
  constructor(
    private readonly environment: CredentialEnvironment = runtimeEnvironment(),
    private readonly vaultRefId = 'env:binance-futures-testnet',
  ) {}

  metadata(): Val04B1CredentialMetadata {
    return {
      environment: 'binance_perpetual_testnet',
      providerId: 'binance',
      scopes: ['account-info', 'futures-trading'],
      vaultRefId: this.vaultRefId,
    };
  }

  async resolveEphemeralMaterial(): Promise<Val04B2SecretMaterial> {
    const apiKey = this.environment[API_KEY_ENV];
    const apiSecret = this.environment[API_SECRET_ENV];
    if (!apiKey || !apiSecret) {
      throw new Error('Approved Binance Futures Testnet credential material is unavailable');
    }
    return { apiKey, apiSecret };
  }
}

export const VAL_04B2_CREDENTIAL_ENVIRONMENT_VARIABLES = [API_KEY_ENV, API_SECRET_ENV] as const;
