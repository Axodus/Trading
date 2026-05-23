export type NormalizedPostgresErrorCode =
  | 'CONNECTION_FAILED'
  | 'QUERY_TIMEOUT'
  | 'CONSTRAINT_VIOLATION'
  | 'TRANSACTION_FAILED'
  | 'QUERY_FAILED';

export class PostgresClientError extends Error {
  constructor(
    message: string,
    public readonly code: NormalizedPostgresErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PostgresClientError';
  }
}

export function mapPostgresError(error: unknown, fallbackCode: NormalizedPostgresErrorCode = 'QUERY_FAILED'): PostgresClientError {
  if (error instanceof PostgresClientError) {
    return error;
  }

  const detail = readErrorDetail(error);
  const code = mapCode(detail.code, fallbackCode);
  return new PostgresClientError(detail.message, code, error);
}

export function isRetryablePostgresError(error: unknown): boolean {
  const normalized = mapPostgresError(error);
  return normalized.code === 'CONNECTION_FAILED' || normalized.code === 'QUERY_TIMEOUT';
}

function mapCode(code: string | undefined, fallbackCode: NormalizedPostgresErrorCode): NormalizedPostgresErrorCode {
  if (!code) {
    return fallbackCode;
  }
  if (code === 'QUERY_TIMEOUT') {
    return 'QUERY_TIMEOUT';
  }
  if (code.startsWith('23')) {
    return 'CONSTRAINT_VIOLATION';
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') {
    return 'CONNECTION_FAILED';
  }
  return fallbackCode;
}

function readErrorDetail(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    const coded = error as Error & { code?: string };
    return {
      message: redactSecrets(error.message),
      code: coded.code,
    };
  }
  return {
    message: redactSecrets(String(error)),
  };
}

function redactSecrets(value: string): string {
  return value.replace(/password\s*=?\s*[^"\s;]+/gi, 'password=[redacted]');
}
