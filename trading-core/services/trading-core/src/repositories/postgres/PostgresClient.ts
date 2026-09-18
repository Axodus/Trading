export interface PostgresQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount?: number;
}

export interface PostgresQueryClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<T>>;
}

export interface PostgresTransactionClient extends PostgresQueryClient {}

export interface TransactionalPostgresQueryClient extends PostgresQueryClient {
  transaction<T>(callback: (client: PostgresTransactionClient) => Promise<T>): Promise<T>;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value);
}
