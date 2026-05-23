import type { PostgresQueryClient, PostgresQueryResult } from './PostgresClient.js';
import type { PgPoolLike, PostgresConnectionPoolConfig } from './PostgresConnectionPool.js';
import { createPostgresConnectionPool } from './PostgresConnectionPool.js';
import { isRetryablePostgresError, mapPostgresError, PostgresClientError } from './PostgresErrorMapper.js';

export interface NodePostgresClientConfig {
  pool: PgPoolLike;
  queryTimeoutMs?: number;
  maxRetries?: number;
}

export class NodePostgresClient implements PostgresQueryClient {
  private closed = false;

  constructor(private readonly config: NodePostgresClientConfig) {}

  static async create(config: PostgresConnectionPoolConfig & {
    queryTimeoutMs?: number;
    maxRetries?: number;
  }): Promise<NodePostgresClient> {
    const pool = await createPostgresConnectionPool(config);
    return new NodePostgresClient({
      pool,
      queryTimeoutMs: config.queryTimeoutMs,
      maxRetries: config.maxRetries,
    });
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<PostgresQueryResult<T>> {
    if (this.closed) {
      throw new PostgresClientError('Postgres pool is already closed.', 'CONNECTION_FAILED');
    }

    const maxRetries = this.config.maxRetries ?? 1;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      try {
        return await this.withTimeout(
          this.config.pool.query<T>(sql, params),
          this.config.queryTimeoutMs ?? 5000,
        );
      } catch (error) {
        lastError = error;
        const normalized = mapPostgresError(error);
        if (!isRetryablePostgresError(normalized) || attempt >= maxRetries) {
          throw normalized;
        }
        attempt += 1;
      }
    }

    throw mapPostgresError(lastError);
  }

  async transaction<T>(callback: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    await this.query('BEGIN');
    try {
      const result = await callback(this);
      await this.query('COMMIT');
      return result;
    } catch (error) {
      await this.query('ROLLBACK').catch(() => undefined);
      throw mapPostgresError(error, 'TRANSACTION_FAILED');
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    await this.config.pool.end();
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new PostgresClientError(`Postgres query timed out after ${timeoutMs}ms.`, 'QUERY_TIMEOUT'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
