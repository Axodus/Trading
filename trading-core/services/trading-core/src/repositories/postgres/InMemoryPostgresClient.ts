import type {
  PostgresQueryResult,
  PostgresTransactionClient,
  TransactionalPostgresQueryClient,
} from './PostgresClient.js';

type Row = Record<string, unknown>;

export interface InMemoryPostgresStorage {
  trading_schema_migrations: Row[];
  trading_events: Row[];
  trading_orders: Row[];
  trading_fills: Row[];
  trading_positions: Row[];
  trading_portfolios: Row[];
  trading_runtime_instances: Row[];
  trading_provider_state: Row[];
  trading_runtime_audit: Row[];
  trading_submission_attempts: Row[];
  trading_execution_outbox: Row[];
  trading_val05_session_budgets: Row[];
}

export function createInMemoryPostgresStorage(): InMemoryPostgresStorage {
  return {
    trading_schema_migrations: [],
    trading_events: [],
    trading_orders: [],
    trading_fills: [],
    trading_positions: [],
    trading_portfolios: [],
    trading_runtime_instances: [],
    trading_provider_state: [],
    trading_runtime_audit: [],
    trading_submission_attempts: [],
    trading_execution_outbox: [],
    trading_val05_session_budgets: [],
  };
}

export class InMemoryPostgresClient implements TransactionalPostgresQueryClient {
  constructor(private readonly storage: InMemoryPostgresStorage = createInMemoryPostgresStorage()) {}

  async transaction<T>(callback: (client: PostgresTransactionClient) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async query<T = Row>(sql: string, params: unknown[] = []): Promise<PostgresQueryResult<T>> {
    const normalized = sql.toLowerCase().trim();
    if (normalized === 'select 1') {
      return { rows: [{ '?column?': 1 }] as T[] };
    }
    if (normalized.startsWith('create table') || normalized.startsWith('create index')) {
      return { rows: [] };
    }
    if (normalized.startsWith('alter table')) {
      return { rows: [] };
    }
    if (normalized.includes('from information_schema.tables')) {
      return { rows: this.selectInformationSchema(params) as T[] };
    }
    if (normalized.startsWith('insert into trading_schema_migrations')) {
      this.insertMigration(params);
      return { rows: [] };
    }
    if (normalized.includes('from trading_schema_migrations')) {
      return { rows: this.selectMigrations() as T[] };
    }
    if (normalized.startsWith('insert into trading_events')) {
      this.insertEvent(params);
      return { rows: [] };
    }
    if (normalized.includes('from trading_events')) {
      return { rows: this.selectEvents(normalized, params) as T[] };
    }
    if (normalized.startsWith('insert into trading_orders')) {
      this.upsert('trading_orders', 'providerOrderId', {
        providerOrderId: params[0],
        requestId: params[1],
        providerId: params[2],
        market: params[3],
        status: params[4],
        createdAt: params[5],
      });
      return { rows: [] };
    }
    if (normalized.includes('from trading_orders')) {
      return { rows: this.storage.trading_orders.filter((row) => row.providerOrderId === params[0]) as T[] };
    }
    if (normalized.startsWith('insert into trading_fills')) {
      this.upsert('trading_fills', 'fillId', {
        fillId: params[0],
        providerOrderId: params[1],
        market: params[2],
        side: params[3],
        quantity: params[4],
        price: params[5],
        fee: params[6],
        filledAt: params[7],
        payload: params[8],
      });
      return { rows: [] };
    }
    if (normalized.includes('from trading_fills')) {
      return { rows: this.storage.trading_fills.filter((row) => row.providerOrderId === params[0]) as T[] };
    }
    if (normalized.startsWith('insert into trading_positions')) {
      this.storage.trading_positions.push({ owner_id: params[0], provider_id: params[1], captured_at: params[2], snapshot: params[3] });
      return { rows: [] };
    }
    if (normalized.includes('from trading_positions')) {
      return { rows: this.latestByOwner(this.storage.trading_positions, params[0]) as T[] };
    }
    if (normalized.startsWith('insert into trading_portfolios')) {
      this.storage.trading_portfolios.push({ owner_id: params[0], provider_id: params[1], captured_at: params[2], snapshot: params[3] });
      return { rows: [] };
    }
    if (normalized.includes('from trading_portfolios')) {
      return { rows: this.latestByOwner(this.storage.trading_portfolios, params[0]) as T[] };
    }
    if (normalized.startsWith('insert into trading_runtime_instances')) {
      this.upsert('trading_runtime_instances', 'id', {
        id: params[0],
        user_id: params[1],
        strategy_product_id: params[2],
        provider_id: params[3],
        execution_domain: params[4],
        status: params[5],
        created_at: params[6],
        updated_at: params[7],
        payload: params[8],
      });
      return { rows: [] };
    }
    if (normalized.includes('from trading_runtime_instances')) {
      return { rows: this.storage.trading_runtime_instances.filter((row) => row.id === params[0]) as T[] };
    }
    if (normalized.startsWith('insert into trading_provider_state')) {
      this.upsert('trading_provider_state', 'provider_id', {
        provider_id: params[0],
        status: params[1],
        updated_at: params[2],
        detail: params[3],
        payload: params[4],
      });
      return { rows: [] };
    }
    if (normalized.includes('from trading_provider_state')) {
      return { rows: this.storage.trading_provider_state.filter((row) => row.provider_id === params[0]) as T[] };
    }
    if (normalized.startsWith('insert into trading_submission_attempts')) {
      this.upsert('trading_submission_attempts', 'attempt_id', {
        attempt_id: params[0],
        intent_id: params[1],
        correlation_id: params[2],
        provider_id: params[3],
        connector: params[4],
        market: params[5],
        side: params[6],
        order_type: params[7],
        quantity: params[8],
        price: params[9],
        execution_client_order_id: params[10],
        state: params[11],
        provider_order_id: params[12],
        evidence: params[13],
        last_failure: params[14],
        version: params[15],
        created_at: params[16],
        updated_at: params[17],
      });
      return { rows: [] };
    }
    if (normalized.startsWith('update trading_submission_attempts set')) {
      const attemptId = params[15];
      const expectedVersion = Number(params[16]);
      const existing = this.storage.trading_submission_attempts.find((row) => row.attempt_id === attemptId);
      if (!existing || Number(existing.version) !== expectedVersion) {
        return { rows: [], rowCount: 0 };
      }
      Object.assign(existing, {
        intent_id: params[0],
        correlation_id: params[1],
        provider_id: params[2],
        connector: params[3],
        market: params[4],
        side: params[5],
        order_type: params[6],
        quantity: params[7],
        price: params[8],
        execution_client_order_id: params[9],
        state: params[10],
        provider_order_id: params[11],
        evidence: params[12],
        last_failure: params[13],
        updated_at: params[14],
        version: expectedVersion + 1,
      });
      return { rows: [existing] as T[], rowCount: 1 };
    }
    if (normalized.includes('from trading_submission_attempts')) {
      if (normalized.includes('where attempt_id = $1')) {
        return { rows: this.storage.trading_submission_attempts.filter((row) => row.attempt_id === params[0]) as T[] };
      }
      const terminalStates = ['provider-acknowledged', 'failed', 'rejected', 'cancelled', 'cancellation-rejected', 'cancellation-failed', 'reconciled-found', 'reconciled-not-found'];
      return { rows: this.storage.trading_submission_attempts.filter((row) => !terminalStates.includes(String(row.state))) as T[] };
    }
    if (normalized.startsWith('insert into trading_execution_outbox')) {
      this.storage.trading_execution_outbox.push({
        outbox_id: params[0],
        aggregate_id: params[1],
        aggregate_version: params[2],
        event_type: params[3],
        correlation_id: params[4],
        payload: params[5],
        created_at: params[6],
      });
      return { rows: [] };
    }
    if (normalized.startsWith('insert into trading_val05_session_budgets')) {
      this.upsert('trading_val05_session_budgets', 'session_id', {
        session_id: params[0],
        submissions: params[1],
        active_orders: params[2],
        updated_at: params[3],
      });
      return { rows: [] };
    }
    if (normalized.includes('from trading_val05_session_budgets')) {
      return { rows: this.storage.trading_val05_session_budgets.filter((row) => row.session_id === params[0]) as T[] };
    }
    if (normalized.includes('from trading_execution_outbox')) {
      if (normalized.includes('where aggregate_id = $1')) {
        return { rows: this.storage.trading_execution_outbox.filter((row) => row.aggregate_id === params[0]) as T[] };
      }
      if (normalized.includes('where outbox_id = $1')) {
        return { rows: this.storage.trading_execution_outbox.filter((row) => row.outbox_id === params[0]) as T[] };
      }
      return { rows: this.storage.trading_execution_outbox as T[] };
    }
    throw new Error(`Unsupported in-memory postgres query: ${sql}`);
  }

  private insertMigration(params: unknown[]): void {
    const id = String(params[0]);
    if (this.storage.trading_schema_migrations.some((row) => row.id === id)) {
      return;
    }
    this.storage.trading_schema_migrations.push({
      id,
      checksum: params[1],
      applied_at: params[2],
    });
  }

  private selectMigrations(): Row[] {
    return [...this.storage.trading_schema_migrations].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  }

  getStorage(): InMemoryPostgresStorage {
    return this.storage;
  }

  private insertEvent(params: unknown[]): void {
    const id = params[0];
    if (this.storage.trading_events.some((row) => row.id === id)) {
      throw new Error(`Append-only event store violation: duplicate event id ${String(id)}`);
    }
    this.storage.trading_events.push({
      id: params[0],
      type: params[1],
      occurred_at: params[2],
      correlation_id: params[3],
      source: params[4],
      dao_id: params[5],
      federation_id: params[6],
      user_id: params[7],
      strategy_id: params[8],
      strategy_product_id: params[9],
      runtime_instance_id: params[10],
      provider_id: params[11],
      tenant_id: params[12],
      payload: params[13],
    });
  }

  private selectEvents(sql: string, params: unknown[]): Row[] {
    let rows = [...this.storage.trading_events];
    if (sql.includes('where tenant_id')) {
      rows = rows.filter((row) => row.tenant_id === params[0]);
    } else if (sql.includes('where correlation_id')) {
      rows = rows.filter((row) => row.correlation_id === params[0]);
    } else if (sql.includes('where runtime_instance_id')) {
      rows = rows.filter((row) => row.runtime_instance_id === params[0]);
    } else if (sql.includes('where strategy_product_id')) {
      rows = rows.filter((row) => row.strategy_product_id === params[0]);
    } else if (sql.includes('where provider_id')) {
      rows = rows.filter((row) => row.provider_id === params[0]);
    } else if (sql.includes('where user_id')) {
      rows = rows.filter((row) => row.user_id === params[0]);
    } else if (sql.includes('where dao_id')) {
      rows = rows.filter((row) => row.dao_id === params[0]);
    } else if (sql.includes('where type')) {
      rows = rows.filter((row) => row.type === params[0]);
    }
    return rows.sort((left, right) => {
      const timeOrder = Date.parse(String(left.occurred_at)) - Date.parse(String(right.occurred_at));
      return timeOrder || String(left.id).localeCompare(String(right.id));
    });
  }

  private selectInformationSchema(params: unknown[]): Row[] {
    const required = Array.isArray(params[0]) ? params[0] as string[] : [];
    return required
      .filter((table) => table in this.storage)
      .map((table) => ({ table_name: table }));
  }

  private latestByOwner(rows: Row[], ownerId: unknown): Row[] {
    const matching = rows
      .filter((row) => row.owner_id === ownerId)
      .sort((left, right) => Date.parse(String(right.captured_at)) - Date.parse(String(left.captured_at)));
    return matching.slice(0, 1);
  }

  private upsert(table: keyof InMemoryPostgresStorage, key: string, row: Row): void {
    const rows = this.storage[table];
    const index = rows.findIndex((existing) => existing[key] === row[key]);
    if (index >= 0) {
      rows[index] = row;
      return;
    }
    rows.push(row);
  }
}
