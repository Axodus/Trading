import { VAL_04B_ENVIRONMENT } from './Val04BPreCredentialHarness.js';

export const VAL_04B1_BASE_URL = 'https://testnet.binancefuture.com' as const;
export const VAL_04B1_ACCOUNT_PATH = '/fapi/v2/account' as const;
export const VAL_04B1_REQUIRED_SCOPES = ['account-info', 'futures-trading'] as const;

type Val04B1RequiredScope = (typeof VAL_04B1_REQUIRED_SCOPES)[number];

export interface Val04B1CredentialMetadata {
  environment: typeof VAL_04B_ENVIRONMENT;
  providerId: 'binance';
  scopes: readonly string[];
  vaultRefId: string;
}

interface Val04B1SecretMaterial {
  apiKey: string;
  apiSecret: string;
}

export interface Val04B1CredentialSource {
  metadata(): Val04B1CredentialMetadata;
  resolveEphemeralMaterial(): Promise<Val04B1SecretMaterial>;
}

export interface Val04B1HttpResponse {
  status: number;
  json(): Promise<unknown>;
}

export interface Val04B1ReadTransport {
  get(
    url: string,
    query: Readonly<Record<string, string>>,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
  ): Promise<Val04B1HttpResponse>;
}

export interface Val04B1ReadResult {
  environment: typeof VAL_04B_ENVIRONMENT;
  authenticated: true;
  accountType?: string;
  canTrade?: boolean;
  assetCount?: number;
  serverTime?: number;
  privateCallsMade: true;
  mutatingCallsMade: false;
  websocketUsed: false;
  redactionVerified: true;
}

export interface Val04B1RunReport {
  status: 'PASS' | 'BLOCKED' | 'FAILED';
  environment: typeof VAL_04B_ENVIRONMENT;
  domain: string;
  mainnetExcluded: true;
  privateCallsMade: boolean;
  mutatingCallsMade: boolean;
  websocketUsed: false;
  secretPresent: boolean;
  secretRedacted: true;
  result?: Val04B1ReadResult;
  failure?: string;
}

export class Val04B1BoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Val04B1BoundaryError';
  }
}

export function assertVal04B1Environment(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Val04B1BoundaryError('VAL-04B1 requires a valid HTTPS testnet URL');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'testnet.binancefuture.com') {
    throw new Val04B1BoundaryError('VAL-04B1 rejects non-testnet or non-HTTPS endpoints');
  }
  if (parsed.hostname.includes('binance.com') && parsed.hostname !== 'testnet.binancefuture.com') {
    throw new Val04B1BoundaryError('Mainnet Binance endpoints are prohibited by VAL-04B1');
  }
}

export function assertVal04B1CredentialMetadata(metadata: Val04B1CredentialMetadata): void {
  if (metadata.providerId !== 'binance' || metadata.environment !== VAL_04B_ENVIRONMENT) {
    throw new Val04B1BoundaryError('Credential provider or environment does not match Binance Futures Testnet');
  }
  if (!metadata.vaultRefId) {
    throw new Val04B1BoundaryError('Credential reference is required; raw configuration is not an admitted identity');
  }
  const scopes = new Set(metadata.scopes);
  if (['withdraw', 'withdrawal', 'transfer'].some((scope) => scopes.has(scope))) {
    throw new Val04B1BoundaryError('Withdraw and transfer scopes are prohibited for VAL-04B1');
  }
  for (const requiredScope of VAL_04B1_REQUIRED_SCOPES) {
    if (!hasScope(scopes, requiredScope)) {
      throw new Val04B1BoundaryError(`Credential scope missing: ${requiredScope}`);
    }
  }
}

function hasScope(scopes: Set<string>, required: Val04B1RequiredScope): boolean {
  if (scopes.has(required)) return true;
  if (required === 'account-info') return scopes.has('read-only') || scopes.has('read-balances') || scopes.has('read-positions');
  if (required === 'futures-trading') return scopes.has('trade');
  return false;
}

function assertReadOnlyPath(path: string): void {
  if (path !== VAL_04B1_ACCOUNT_PATH) {
    throw new Val04B1BoundaryError(`VAL-04B1 admits only authenticated account read: ${VAL_04B1_ACCOUNT_PATH}`);
  }
}

function assertMaterial(material: Val04B1SecretMaterial): void {
  if (!material.apiKey || !material.apiSecret) {
    throw new Val04B1BoundaryError('Credential material is incomplete');
  }
}

async function signedQuery(timestamp: number, recvWindow: number, apiSecret: string): Promise<Record<string, string>> {
  const query = { recvWindow: String(recvWindow), timestamp: String(timestamp) };
  const payload = new URLSearchParams(query).toString();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const signature = Array.from(new Uint8Array(signatureBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { ...query, signature };
}

function readAccountSummary(body: unknown): Omit<Val04B1ReadResult, 'privateCallsMade' | 'mutatingCallsMade' | 'websocketUsed' | 'redactionVerified' | 'environment' | 'authenticated'> {
  if (!body || typeof body !== 'object') throw new Val04B1BoundaryError('Authenticated account response is not an object');
  const record = body as Record<string, unknown>;
  const assets = Array.isArray(record.assets) ? record.assets : undefined;
  if (record.accountType !== undefined && typeof record.accountType !== 'string') {
    throw new Val04B1BoundaryError('Authenticated account response has an invalid accountType');
  }
  if (record.canTrade !== undefined && typeof record.canTrade !== 'boolean') {
    throw new Val04B1BoundaryError('Authenticated account response has an invalid canTrade');
  }
  if (record.updateTime !== undefined && typeof record.updateTime !== 'number') {
    throw new Val04B1BoundaryError('Authenticated account response has an invalid updateTime');
  }
  return {
    ...(typeof record.accountType === 'string' ? { accountType: record.accountType } : {}),
    ...(typeof record.canTrade === 'boolean' ? { canTrade: record.canTrade } : {}),
    ...(assets ? { assetCount: assets.length } : {}),
    ...(typeof record.updateTime === 'number' ? { serverTime: record.updateTime } : {}),
  };
}

export function redactVal04B1(value: string, secrets: readonly string[]): string {
  return secrets.filter(Boolean).reduce((current, secret) => current.split(secret).join('[REDACTED]'), value);
}

export class Val04B1AuthenticatedReadHarness {
  constructor(
    private readonly source: Val04B1CredentialSource,
    private readonly transport: Val04B1ReadTransport,
    private readonly baseUrl = VAL_04B1_BASE_URL,
    private readonly timeoutMs = 5000,
    private readonly now = () => Date.now(),
  ) {}

  async readAccount(): Promise<Val04B1ReadResult> {
    assertVal04B1Environment(this.baseUrl);
    const metadata = this.source.metadata();
    assertVal04B1CredentialMetadata(metadata);
    assertReadOnlyPath(VAL_04B1_ACCOUNT_PATH);
    const material = await this.source.resolveEphemeralMaterial();
    assertMaterial(material);
    const query = await signedQuery(this.now(), 5000, material.apiSecret);
    const response = await this.transport.get(
      `${this.baseUrl}${VAL_04B1_ACCOUNT_PATH}`,
      query,
      { 'X-MBX-APIKEY': material.apiKey },
      this.timeoutMs,
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Val04B1BoundaryError(`Authenticated testnet read failed with HTTP ${response.status}`);
    }
    const summary = readAccountSummary(await response.json());
    return {
      environment: VAL_04B_ENVIRONMENT,
      authenticated: true,
      ...summary,
      privateCallsMade: true,
      mutatingCallsMade: false,
      websocketUsed: false,
      redactionVerified: true,
    };
  }
}

export function createVal04B1EnvironmentReport(env: Record<string, string | undefined>): Val04B1RunReport {
  const apiKeyPresent = Boolean(env.AXODUS_BINANCE_TESTNET_API_KEY);
  const apiSecretPresent = Boolean(env.AXODUS_BINANCE_TESTNET_API_SECRET);
  return {
    status: apiKeyPresent && apiSecretPresent ? 'BLOCKED' : 'BLOCKED',
    environment: VAL_04B_ENVIRONMENT,
    domain: VAL_04B1_BASE_URL,
    mainnetExcluded: true,
    privateCallsMade: false,
    mutatingCallsMade: false,
    websocketUsed: false,
    secretPresent: apiKeyPresent && apiSecretPresent,
    secretRedacted: true,
    failure: apiKeyPresent && apiSecretPresent
      ? 'Credentials are available only for an explicitly constructed authenticated runtime; no external call was made by the report builder.'
      : 'Testnet credential material is not injected into this process.',
  };
}
