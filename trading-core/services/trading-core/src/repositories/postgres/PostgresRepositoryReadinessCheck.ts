import type { TradingEvent } from '../../../../../packages/trading-contracts/src/index.js';
import { PostgresRuntimeRepository } from './PostgresRuntimeRepository.js';
import { PostgresTradingEventRepository } from './PostgresTradingEventRepository.js';
import type { PostgresQueryClient } from './PostgresClient.js';

export interface PostgresRepositoryReadinessResult {
  ready: boolean;
  checkedAt: string;
  requiredTables: Record<string, boolean>;
  eventReplay: {
    ok: boolean;
    correlationId: string;
    eventCount: number;
  };
  runtimeRoundTrip: {
    ok: boolean;
    runtimeInstanceId: string;
  };
  issues: string[];
}

const REQUIRED_TABLES = [
  'trading_events',
  'trading_orders',
  'trading_fills',
  'trading_positions',
  'trading_portfolios',
  'trading_runtime_instances',
  'trading_provider_state',
  'trading_runtime_audit',
] as const;

export class PostgresRepositoryReadinessCheck {
  constructor(private readonly client: PostgresQueryClient) {}

  async check(): Promise<PostgresRepositoryReadinessResult> {
    const checkedAt = new Date().toISOString();
    const issues: string[] = [];
    const requiredTables = await this.checkRequiredTables();
    for (const [table, exists] of Object.entries(requiredTables)) {
      if (!exists) {
        issues.push(`Required table is missing: ${table}.`);
      }
    }

    const eventReplay = await this.checkEventReplay(checkedAt).catch((error: unknown) => {
      issues.push(`Event repository replay failed: ${String(error)}`);
      return {
        ok: false,
        correlationId: 'readiness-event-check-failed',
        eventCount: 0,
      };
    });

    const runtimeRoundTrip = await this.checkRuntimeRoundTrip(checkedAt).catch((error: unknown) => {
      issues.push(`Runtime repository round-trip failed: ${String(error)}`);
      return {
        ok: false,
        runtimeInstanceId: 'readiness-runtime-check-failed',
      };
    });

    return {
      ready: Object.values(requiredTables).every(Boolean) && eventReplay.ok && runtimeRoundTrip.ok,
      checkedAt,
      requiredTables,
      eventReplay,
      runtimeRoundTrip,
      issues,
    };
  }

  private async checkRequiredTables(): Promise<Record<string, boolean>> {
    const result = await this.client.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `, [[...REQUIRED_TABLES]]);
    const found = new Set(result.rows.map((row) => row.table_name));
    return Object.fromEntries(REQUIRED_TABLES.map((table) => [table, found.has(table)]));
  }

  private async checkEventReplay(checkedAt: string): Promise<PostgresRepositoryReadinessResult['eventReplay']> {
    const repository = new PostgresTradingEventRepository(this.client);
    const correlationId = `local-readiness-correlation-${Date.parse(checkedAt)}`;
    const event: TradingEvent = {
      id: `local-readiness-event:${Date.parse(checkedAt)}`,
      type: 'EXECUTION_REQUESTED',
      occurredAt: checkedAt,
      correlationId,
      source: 'core',
      userId: 'local-readiness-user',
      strategyId: 'readiness-strategy',
      strategyProductId: 'readiness-strategy-product',
      runtimeInstanceId: 'local-readiness-runtime',
      payload: {
        tenantId: 'local-readiness-tenant',
        providerId: 'simulation',
        mock: true,
        simulationOnly: true,
        readinessCheck: true,
      },
    };
    await repository.append(event);
    const replay = await repository.replayByCorrelationId(correlationId);
    return {
      ok: replay.length === 1 && replay[0]?.correlationId === correlationId,
      correlationId,
      eventCount: replay.length,
    };
  }

  private async checkRuntimeRoundTrip(checkedAt: string): Promise<PostgresRepositoryReadinessResult['runtimeRoundTrip']> {
    const repository = new PostgresRuntimeRepository(this.client);
    const runtimeInstanceId = `local-readiness-runtime-${Date.parse(checkedAt)}`;
    await repository.save({
      id: runtimeInstanceId,
      userId: 'local-readiness-user',
      strategyProductId: 'readiness-strategy-product',
      providerId: 'simulation',
      executionDomain: 'user',
      status: 'active',
      createdAt: checkedAt,
      updatedAt: checkedAt,
    });
    const runtime = await repository.findById(runtimeInstanceId);
    return {
      ok: runtime?.id === runtimeInstanceId && runtime.executionDomain === 'user',
      runtimeInstanceId,
    };
  }
}
