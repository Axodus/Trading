import {
  VAL_04B2_BASE_URL,
  Val04B2HttpResponse,
  Val04B2Transport,
} from './Val04B2ControlledOrderHarness.js';

function assertTestnetUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.origin !== VAL_04B2_BASE_URL) {
    throw new Error('VAL-04B2 transport admits only the Binance Futures Testnet HTTPS endpoint');
  }
  return parsed;
}

function buildUrl(urlOrPath: string, query: Readonly<Record<string, string>>): string {
  const parsed = urlOrPath.startsWith('/')
    ? new URL(urlOrPath, `${VAL_04B2_BASE_URL}/`)
    : assertTestnetUrl(urlOrPath);
  for (const [key, value] of Object.entries(query)) parsed.searchParams.set(key, value);
  return parsed.toString();
}

async function request(
  method: 'GET' | 'POST' | 'DELETE',
  urlOrPath: string,
  query: Readonly<Record<string, string>> = {},
  headers: Readonly<Record<string, string>> = {},
  timeoutMs = 5000,
): Promise<Val04B2HttpResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(buildUrl(urlOrPath, query), {
      method,
      headers,
      signal: controller.signal,
      redirect: 'error',
    });
    return {
      status: response.status,
      json: () => response.json(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export class Val04B2LiveTransport implements Val04B2Transport {
  get(url: string, query = {}, headers = {}, timeoutMs = 5000): Promise<Val04B2HttpResponse> {
    return request('GET', url, query, headers, timeoutMs);
  }

  post(url: string, query = {}, headers = {}, timeoutMs = 5000): Promise<Val04B2HttpResponse> {
    return request('POST', url, query, headers, timeoutMs);
  }

  delete(url: string, query = {}, headers = {}, timeoutMs = 5000): Promise<Val04B2HttpResponse> {
    return request('DELETE', url, query, headers, timeoutMs);
  }
}

export function assertVal04B2TestnetUrl(url: string): void {
  assertTestnetUrl(url);
}
