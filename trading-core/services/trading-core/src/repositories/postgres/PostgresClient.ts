export interface PostgresQueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface PostgresQueryClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PostgresQueryResult<T>>;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value);
}
