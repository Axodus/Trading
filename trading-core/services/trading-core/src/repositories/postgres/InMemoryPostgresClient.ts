import type {
  PostgresQueryResult,
  PostgresTransactionClient,
  TransactionalPostgresQueryClient,
} from './PostgresClient.js';

type Row = Record<string, unknown>;
export type InMemoryPostgresFault = (normalizedSql: string) => Error | undefined;

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
  strategy_lifecycle_heads: Row[];
  strategy_lifecycle_transitions: Row[];
  strategy_lifecycle_policies: Row[];
  strategy_health_heads: Row[];
  strategy_health_transitions: Row[];
  strategy_health_policies: Row[];
  strategy_operational_snapshots: Row[];
  trading_intents: Row[];
  pre_execution_authorizations: Row[];
  execution_intents: Row[];
  execution_translations: Row[];
  execution_results: Row[];
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
    strategy_lifecycle_heads: [],
    strategy_lifecycle_transitions: [],
    strategy_lifecycle_policies: [],
    strategy_health_heads: [],
    strategy_health_transitions: [],
    strategy_health_policies: [],
    strategy_operational_snapshots: [],
    trading_intents: [],
    pre_execution_authorizations: [],
    execution_intents: [],
    execution_translations: [],
    execution_results: [],
  };
}

export class InMemoryPostgresClient implements TransactionalPostgresQueryClient {
  constructor(
    private readonly storage: InMemoryPostgresStorage = createInMemoryPostgresStorage(),
    private readonly fault?: InMemoryPostgresFault,
  ) {}

  async transaction<T>(callback: (client: PostgresTransactionClient) => Promise<T>): Promise<T> {
    const staged = new InMemoryPostgresClient(JSON.parse(JSON.stringify(this.storage)) as InMemoryPostgresStorage, this.fault);
    const result = await callback(staged);
    Object.assign(this.storage, staged.getStorage());
    return result;
  }

  async query<T = Row>(sql: string, params: unknown[] = []): Promise<PostgresQueryResult<T>> {
    const normalized = sql.toLowerCase().trim();
    const injectedFailure = this.fault?.(normalized);
    if (injectedFailure) throw injectedFailure;
    if (normalized === 'select 1') {
      return { rows: [{ '?column?': 1 }] as unknown as T[] };
    }
    if (normalized.startsWith('create table') || normalized.startsWith('create index')) {
      return { rows: [] };
    }
    if (normalized.startsWith('alter table')) {
      return { rows: [] };
    }
    if (normalized.includes('from information_schema.tables')) {
      return { rows: this.selectInformationSchema(params) as unknown as T[] };
    }
    if (normalized.startsWith('insert into trading_schema_migrations')) {
      this.insertMigration(params);
      return { rows: [] };
    }
    if (normalized.includes('from trading_schema_migrations')) {
      return { rows: this.selectMigrations() as unknown as T[] };
    }
    if (normalized.startsWith('insert into trading_events')) {
      this.insertEvent(params);
      return { rows: [] };
    }
    if (normalized.includes('from trading_events')) {
      return { rows: this.selectEvents(normalized, params) as unknown as T[] };
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
      return { rows: this.storage.trading_orders.filter((row) => row.providerOrderId === params[0]) as unknown as T[] };
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
      return { rows: this.storage.trading_fills.filter((row) => row.providerOrderId === params[0]) as unknown as T[] };
    }
    if (normalized.startsWith('insert into trading_positions')) {
      this.storage.trading_positions.push({ owner_id: params[0], provider_id: params[1], captured_at: params[2], snapshot: params[3] });
      return { rows: [] };
    }
    if (normalized.includes('from trading_positions')) {
      return { rows: this.latestByOwner(this.storage.trading_positions, params[0]) as unknown as T[] };
    }
    if (normalized.startsWith('insert into trading_portfolios')) {
      this.storage.trading_portfolios.push({ owner_id: params[0], provider_id: params[1], captured_at: params[2], snapshot: params[3] });
      return { rows: [] };
    }
    if (normalized.includes('from trading_portfolios')) {
      return { rows: this.latestByOwner(this.storage.trading_portfolios, params[0]) as unknown as T[] };
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
      return { rows: this.storage.trading_runtime_instances.filter((row) => row.id === params[0]) as unknown as T[] };
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
      return { rows: this.storage.trading_provider_state.filter((row) => row.provider_id === params[0]) as unknown as T[] };
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
      return { rows: [existing] as unknown as T[], rowCount: 1 };
    }
    if (normalized.includes('from trading_submission_attempts')) {
      if (normalized.includes('where attempt_id = $1')) {
        return { rows: this.storage.trading_submission_attempts.filter((row) => row.attempt_id === params[0]) as unknown as T[] };
      }
      const terminalStates = ['provider-acknowledged', 'failed', 'rejected', 'cancelled', 'cancellation-rejected', 'cancellation-failed', 'reconciled-found', 'reconciled-not-found'];
      return { rows: this.storage.trading_submission_attempts.filter((row) => !terminalStates.includes(String(row.state))) as unknown as T[] };
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
    if (normalized.startsWith('insert into strategy_lifecycle_heads')) {
      if (!this.storage.strategy_lifecycle_heads.some((row) => row.strategy_id === params[0])) {
        this.storage.strategy_lifecycle_heads.push({
          strategy_id: params[0],
          current_revision_id: params[1],
          current_state: params[2],
          lifecycle_version: 0,
          updated_at: params[3],
        });
      }
      return { rows: [] };
    }
    if (normalized.startsWith('update strategy_lifecycle_heads set')) {
      const row = this.storage.strategy_lifecycle_heads.find((item) => item.strategy_id === params[4] && Number(item.lifecycle_version) === Number(params[5]));
      if (!row) return { rows: [], rowCount: 0 };
      Object.assign(row, {
        current_revision_id: params[0], current_state: params[1], updated_at: params[2],
        last_transition_id: params[3], lifecycle_version: Number(params[5]) + 1,
      });
      return { rows: [row] as unknown as T[], rowCount: 1 };
    }
    if (normalized.includes('from strategy_lifecycle_heads') && !normalized.includes('inner join strategy_health_heads')) {
      return { rows: this.storage.strategy_lifecycle_heads.filter((row) => row.strategy_id === params[0]) as unknown as T[] };
    }
    if (normalized.startsWith('insert into strategy_lifecycle_transitions')) {
      this.storage.strategy_lifecycle_transitions.push({
        transition_id: params[0], strategy_id: params[1], strategy_revision_id: params[2],
        from_state: params[3], to_state: params[4], previous_version: params[5], new_version: params[6],
        policy_revision: params[7], eligibility_ref: params[8], authorization_refs: params[9],
        decision: params[10], reason_codes: params[11], idempotency_key: params[12], command_hash: params[13],
        rationale: params[14], requested_at: params[15], decided_at: params[16], created_at: params[17],
      });
      return { rows: [] };
    }
    if (normalized.includes('from strategy_lifecycle_transitions')) {
      let rows = this.storage.strategy_lifecycle_transitions.filter((row) => row.strategy_id === params[0]);
      if (normalized.includes('idempotency_key = $2')) rows = rows.filter((row) => row.idempotency_key === params[1]);
      return { rows: rows as unknown as T[] };
    }
    if (normalized.startsWith('insert into strategy_lifecycle_policies')) {
      this.upsert('strategy_lifecycle_policies', 'policy_revision', {
        policy_revision: params[0], name: params[1], description: params[2], rules: params[3],
        default_max_eligibility_age_ms: params[4], created_at: params[5],
      });
      return { rows: [] };
    }
    if (normalized.includes('from strategy_lifecycle_policies')) {
      return { rows: this.storage.strategy_lifecycle_policies.filter((row) => row.policy_revision === params[0]) as unknown as T[] };
    }
    if (normalized.startsWith('insert into strategy_health_heads')) {
      if (!this.storage.strategy_health_heads.some((row) => row.strategy_id === params[0] && row.strategy_revision_id === params[1])) {
        this.storage.strategy_health_heads.push({
          strategy_id: params[0], strategy_revision_id: params[1], health_state: 'UNKNOWN', health_version: 0,
          effective_at: params[2], evaluation_policy_revision: params[3], reason_codes: [], evidence_refs: [],
        });
      }
      return { rows: [] };
    }
    if (normalized.startsWith('update strategy_health_heads set')) {
      const row = this.storage.strategy_health_heads.find((item) =>
        item.strategy_id === params[7] && item.strategy_revision_id === params[8] && Number(item.health_version) === Number(params[9]));
      if (!row) return { rows: [], rowCount: 0 };
      Object.assign(row, {
        health_state: params[0], health_version: Number(params[9]) + 1, effective_at: params[1],
        evaluation_policy_revision: params[2], reason_codes: params[3], evidence_refs: params[4],
        previous_health_version: params[5], last_transition_id: params[6],
      });
      return { rows: [row] as unknown as T[], rowCount: 1 };
    }
    if (normalized.includes('from strategy_health_heads') && !normalized.includes('inner join strategy_health_heads')) {
      return { rows: this.storage.strategy_health_heads.filter((row) => row.strategy_id === params[0] && row.strategy_revision_id === params[1]) as unknown as T[] };
    }
    if (normalized.startsWith('insert into strategy_health_transitions')) {
      if (this.storage.strategy_health_transitions.some((row) => row.strategy_id === params[1] && row.strategy_revision_id === params[2] && row.idempotency_key === params[12])) {
        throw new Error('StrategyHealth idempotency uniqueness violation');
      }
      this.storage.strategy_health_transitions.push({
        transition_id: params[0], strategy_id: params[1], strategy_revision_id: params[2],
        previous_health: params[3], new_health: params[4], previous_version: params[5], new_version: params[6],
        policy_revision: params[7], reason_codes: params[8], evidence_refs: params[9], authorization_refs: params[10],
        decision: params[11], idempotency_key: params[12], command_hash: params[13], actor_type: params[14],
        actor_id: params[15], decided_at: params[16], created_at: params[17],
      });
      return { rows: [] };
    }
    if (normalized.includes('from strategy_health_transitions')) {
      let rows = this.storage.strategy_health_transitions.filter((row) => row.strategy_id === params[0] && row.strategy_revision_id === params[1]);
      if (normalized.includes('idempotency_key = $3')) rows = rows.filter((row) => row.idempotency_key === params[2]);
      return { rows: rows as unknown as T[] };
    }
    if (normalized.startsWith('insert into strategy_health_policies')) {
      this.upsert('strategy_health_policies', 'policy_revision', {
        policy_revision: params[0], name: params[1], rules: params[2], created_at: params[3],
      });
      return { rows: [] };
    }
    if (normalized.includes('from strategy_health_policies')) {
      return { rows: this.storage.strategy_health_policies.filter((row) => row.policy_revision === params[0]) as unknown as T[] };
    }
    if (normalized.includes('from strategy_lifecycle_heads lifecycle') && normalized.includes('inner join strategy_health_heads')) {
      const lifecycle = this.storage.strategy_lifecycle_heads.find((row) => row.strategy_id === params[0] && row.current_revision_id === params[1]);
      const health = lifecycle && this.storage.strategy_health_heads.find((row) =>
        row.strategy_id === lifecycle.strategy_id && row.strategy_revision_id === lifecycle.current_revision_id);
      if (!lifecycle || !health) return { rows: [] };
      return { rows: [{
        strategy_id: lifecycle.strategy_id, strategy_revision_id: lifecycle.current_revision_id,
        lifecycle_state: lifecycle.current_state, lifecycle_version: lifecycle.lifecycle_version,
        lifecycle_updated_at: lifecycle.updated_at, health_state: health.health_state,
        health_version: health.health_version, health_effective_at: health.effective_at,
      }] as unknown as T[] };
    }
    if (normalized.startsWith('insert into strategy_operational_snapshots')) {
      if (!this.storage.strategy_operational_snapshots.some((row) => row.snapshot_id === params[0])) {
        this.storage.strategy_operational_snapshots.push({
          snapshot_id: params[0], strategy_id: params[1], strategy_revision_id: params[2],
          lifecycle_state: params[3], lifecycle_version: params[4], health_state: params[5], health_version: params[6],
          compatibility: params[7], effective_at: params[8], expires_at: params[9], snapshot_version: params[10],
        });
      }
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
      return { rows: this.storage.trading_val05_session_budgets.filter((row) => row.session_id === params[0]) as unknown as T[] };
    }
    if (normalized.includes('from trading_execution_outbox')) {
      if (normalized.includes('where aggregate_id = $1')) {
        return { rows: this.storage.trading_execution_outbox.filter((row) => row.aggregate_id === params[0]) as unknown as T[] };
      }
      if (normalized.includes('where outbox_id = $1')) {
        return { rows: this.storage.trading_execution_outbox.filter((row) => row.outbox_id === params[0]) as unknown as T[] };
      }
      return { rows: this.storage.trading_execution_outbox as unknown as T[] };
    }

    if (normalized.startsWith("insert into strategy_lifecycle_heads")) {
      const existing = this.storage.strategy_lifecycle_heads.find((row) => row.strategy_id === params[0]);
      if (!existing) {
        this.storage.strategy_lifecycle_heads.push({
          strategy_id: params[0],
          current_revision_id: params[1],
          current_state: params[2],
          lifecycle_version: 0,
          updated_at: params[3],
        });
      }
      return { rows: [] };
    }
    if (normalized.startsWith("update strategy_lifecycle_heads set")) {
      const strategyId = params[4];
      const expectedVersion = Number(params[5]);
      const existing = this.storage.strategy_lifecycle_heads.find((row) => row.strategy_id === strategyId);
      if (!existing || Number(existing.lifecycle_version) !== expectedVersion) {
        return { rows: [], rowCount: 0 };
      }
      Object.assign(existing, {
        current_revision_id: params[0],
        current_state: params[1],
        lifecycle_version: expectedVersion + 1,
        updated_at: params[2],
        last_transition_id: params[3],
      });
      return { rows: [existing] as unknown as T[], rowCount: 1 };
    }
    if (normalized.includes("from strategy_lifecycle_heads")) {
      return { rows: this.storage.strategy_lifecycle_heads.filter((row) => row.strategy_id === params[0]) as unknown as T[] };
    }
    if (normalized.startsWith("insert into strategy_lifecycle_transitions")) {
      const existing = this.storage.strategy_lifecycle_transitions.find(
        (row) => row.strategy_id === params[1] && row.idempotency_key === params[12]
      );
      if (existing) {
        throw new Error(`Duplicate transition idempotency key: ${params[12]} for strategy ${params[1]}`);
      }
      this.storage.strategy_lifecycle_transitions.push({
        transition_id: params[0],
        strategy_id: params[1],
        strategy_revision_id: params[2],
        from_state: params[3],
        to_state: params[4],
        previous_version: params[5],
        new_version: params[6],
        policy_revision: params[7],
        eligibility_ref: params[8],
        authorization_refs: params[9],
        decision: params[10],
        reason_codes: params[11],
        idempotency_key: params[12],
        command_hash: params[13],
        rationale: params[14],
        requested_at: params[15],
        decided_at: params[16],
        created_at: params[17],
      });
      return { rows: [] };
    }
    if (normalized.includes("from strategy_lifecycle_transitions")) {
      if (normalized.includes("where transition_id = $1")) {
        return { rows: this.storage.strategy_lifecycle_transitions.filter((row) => row.transition_id === params[0]) as unknown as T[] };
      }
      if (normalized.includes("where strategy_id = $1 and idempotency_key = $2")) {
        return { rows: this.storage.strategy_lifecycle_transitions.filter((row) => row.strategy_id === params[0] && row.idempotency_key === params[1]) as unknown as T[] };
      }
      const matching = this.storage.strategy_lifecycle_transitions.filter((row) => row.strategy_id === params[0]);
      return { rows: matching.sort((a, b) => Number(a.new_version) - Number(b.new_version)) as unknown as T[] };
    }
    if (normalized.startsWith("insert into strategy_lifecycle_policies")) {
      this.upsert("strategy_lifecycle_policies", "policy_revision", {
        policy_revision: params[0],
        name: params[1],
        description: params[2],
        rules: params[3],
        default_max_eligibility_age_ms: params[4],
        created_at: params[5],
      });
      return { rows: [] };
    }
    if (normalized.includes("from strategy_lifecycle_policies")) {
      return { rows: this.storage.strategy_lifecycle_policies.filter((row) => row.policy_revision === params[0]) as unknown as T[] };
    }
    if (normalized.startsWith('insert into trading_intents')) {
      if (this.storage.trading_intents.some((row) => row.risk_decision_id === params[7])) {
        throw new Error('Duplicate key violation: unique risk_decision_id in trading_intents');
      }
      if (this.storage.trading_intents.some((row) => row.intent_id === params[0])) {
        throw new Error('Duplicate key violation: unique intent_id in trading_intents');
      }
      this.storage.trading_intents.push({
        intent_id: params[0],
        strategy_id: params[1],
        strategy_revision_id: params[2],
        market_state_id: params[3],
        opportunity_id: params[4],
        proposal_id: params[5],
        portfolio_decision_id: params[6],
        risk_decision_id: params[7],
        eligibility_id: params[8],
        instrument: params[9],
        venue: params[10],
        action: params[11],
        approved_quantity: params[12],
        approved_capital: params[13],
        approved_leverage: params[14],
        price_constraints: params[15],
        time_constraints: params[16],
        execution_policy_ref: params[17],
        correlation_id: params[18],
        idempotency_key: params[19],
        created_at: params[20],
        expires_at: params[21],
        evidence_refs: params[22],
      });
      return { rows: [] };
    }
    if (normalized.includes('from trading_intents')) {
      if (normalized.includes('where intent_id = $1')) {
        return { rows: this.storage.trading_intents.filter((row) => row.intent_id === params[0]) as unknown as T[] };
      }
      if (normalized.includes('where risk_decision_id = $1')) {
        return { rows: this.storage.trading_intents.filter((row) => row.risk_decision_id === params[0]) as unknown as T[] };
      }
      return { rows: this.storage.trading_intents as unknown as T[] };
    }
    if (normalized.startsWith('insert into pre_execution_authorizations')) {
      if (this.storage.pre_execution_authorizations.some((row) => row.strategy_id === params[1] && row.idempotency_key === params[12])) {
        throw new Error('Duplicate key violation: unique idempotency_key in pre_execution_authorizations');
      }
      if (this.storage.pre_execution_authorizations.some((row) => row.authorization_id === params[0])) {
        throw new Error('Duplicate key violation: unique authorization_id in pre_execution_authorizations');
      }
      this.storage.pre_execution_authorizations.push({
        authorization_id: params[0],
        strategy_id: params[1],
        strategy_revision_id: params[2],
        proposal_id: params[3],
        portfolio_decision_id: params[4],
        risk_decision_id: params[5],
        snapshot_id: params[6],
        decision: params[7],
        reason_codes: params[8],
        intent_id: params[9],
        effective_capital: params[10],
        effective_leverage: params[11],
        idempotency_key: params[12],
        command_hash: params[13],
        rationale: params[14],
        decided_at: params[15],
        created_at: params[16],
      });
      return { rows: [] };
    }
    if (normalized.includes('from pre_execution_authorizations')) {
      if (normalized.includes('where strategy_id = $1 and idempotency_key = $2')) {
        return { rows: this.storage.pre_execution_authorizations.filter((row) => row.strategy_id === params[0] && row.idempotency_key === params[1]) as unknown as T[] };
      }
      if (normalized.includes('where risk_decision_id = $1')) {
        return { rows: this.storage.pre_execution_authorizations.filter((row) => row.risk_decision_id === params[0]) as unknown as T[] };
      }
      if (normalized.includes('where authorization_id = $1')) {
        return { rows: this.storage.pre_execution_authorizations.filter((row) => row.authorization_id === params[0]) as unknown as T[] };
      }
      return { rows: this.storage.pre_execution_authorizations as unknown as T[] };
    }
    if (normalized.startsWith("insert into execution_intents")) {
      if (this.storage.execution_intents.some((row) => row.trading_intent_id === params[1])) {
        throw new Error("Duplicate key violation: unique trading_intent_id in execution_intents");
      }
      if (this.storage.execution_intents.some((row) => row.execution_intent_id === params[0])) {
        throw new Error("Duplicate key violation: unique execution_intent_id in execution_intents");
      }
      this.storage.execution_intents.push({
        execution_intent_id: params[0],
        trading_intent_id: params[1],
        strategy_id: params[2],
        strategy_revision_id: params[3],
        instrument: params[4],
        market_type: params[5],
        side: params[6],
        authorized_capital: params[7],
        authorized_quantity: params[8],
        authorized_leverage: params[9],
        execution_capital: params[10],
        execution_quantity: params[11],
        execution_leverage: params[12],
        venue: params[13],
        target_adapter_type: params[14],
        constraints: params[15],
        trading_intent_digest: params[16],
        authorization_context_digest: params[17],
        execution_policy_ref: params[18],
        correlation_id: params[19],
        idempotency_key: params[20],
        created_at: params[21],
        expires_at: params[22],
        evidence_refs: params[23],
      });
      return { rows: [] };
    }
    if (normalized.includes("from execution_intents")) {
      if (normalized.includes("where execution_intent_id = $1")) {
        return { rows: this.storage.execution_intents.filter((row) => row.execution_intent_id === params[0]) as unknown as T[] };
      }
      if (normalized.includes("where trading_intent_id = $1")) {
        return { rows: this.storage.execution_intents.filter((row) => row.trading_intent_id === params[0]) as unknown as T[] };
      }
      return { rows: this.storage.execution_intents as unknown as T[] };
    }
    if (normalized.startsWith("insert into execution_translations")) {
      if (this.storage.execution_translations.some((row) => row.trading_intent_id === params[1] && row.idempotency_key === params[12])) {
        throw new Error("Duplicate key violation: unique idempotency_key in execution_translations");
      }
      if (this.storage.execution_translations.some((row) => row.translation_id === params[0])) {
        throw new Error("Duplicate key violation: unique translation_id in execution_translations");
      }
      this.storage.execution_translations.push({
        translation_id: params[0],
        trading_intent_id: params[1],
        strategy_id: params[2],
        strategy_revision_id: params[3],
        target_adapter_type: params[4],
        decision: params[5],
        reason_codes: params[6],
        execution_intent_id: params[7],
        effective_capital: params[8],
        effective_quantity: params[9],
        effective_leverage: params[10],
        policy_revision: params[11],
        idempotency_key: params[12],
        command_hash: params[13],
        rationale: params[14],
        evaluated_at: params[15],
        created_at: params[16],
      });
      return { rows: [] };
    }
    if (normalized.includes("from execution_translations")) {
      if (normalized.includes("where trading_intent_id = $1 and idempotency_key = $2")) {
        return { rows: this.storage.execution_translations.filter((row) => row.trading_intent_id === params[0] && row.idempotency_key === params[1]) as unknown as T[] };
      }
      if (normalized.includes("where translation_id = $1")) {
        return { rows: this.storage.execution_translations.filter((row) => row.translation_id === params[0]) as unknown as T[] };
      }
      return { rows: this.storage.execution_translations as unknown as T[] };
    }
    if (normalized.startsWith("insert into execution_results")) {
      if (this.storage.execution_results.some((row) => row.execution_result_id === params[0])) {
        throw new Error("Duplicate key violation: unique execution_result_id in execution_results");
      }
      this.storage.execution_results.push({
        execution_result_id: params[0],
        execution_intent_id: params[1],
        trading_intent_id: params[2],
        strategy_id: params[3],
        strategy_revision_id: params[4],
        adapter_type: params[5],
        mode: params[6],
        status: params[7],
        requested_quantity: params[8],
        accepted_quantity: params[9],
        simulated_filled_quantity: params[10],
        simulated_average_price: params[11],
        fees: params[12],
        reason_codes: params[13],
        created_at: params[14],
        completed_at: params[15],
      });
      return { rows: [] };
    }
    if (normalized.includes("from execution_results")) {
      if (normalized.includes("where execution_result_id = $1")) {
        return { rows: this.storage.execution_results.filter((row) => row.execution_result_id === params[0]) as unknown as T[] };
      }
      if (normalized.includes("where execution_intent_id = $1")) {
        return { rows: this.storage.execution_results.filter((row) => row.execution_intent_id === params[0]) as unknown as T[] };
      }
      return { rows: this.storage.execution_results as unknown as T[] };
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
