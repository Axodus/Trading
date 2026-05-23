import type { TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import { assertMutationContext, contextFromEvent, readString, toRecord } from './StateContext.js';
import type { TradingAuditRecord } from './StateTypes.js';

export class TradingAuditService {
  private readonly records: TradingAuditRecord[] = [];

  recordEvent(event: TradingEvent): TradingAuditRecord {
    const context = contextFromEvent(event);
    assertMutationContext(context);
    const payload = toRecord(event.payload);
    const record: TradingAuditRecord = {
      id: `${event.id}:audit`,
      correlationId: event.correlationId,
      eventType: event.type,
      occurredAt: event.occurredAt,
      actor: event.source,
      executionDomain: context.executionDomain,
      userId: context.userId,
      daoId: context.daoId,
      runtimeInstanceId: context.runtimeInstanceId,
      providerId: context.providerId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      rejectionReason: readString(payload.reason) ?? readString(payload.rejectionReason),
      detail: readString(payload.reason) ?? readString(payload.rejectionReason) ?? readString(payload.detail),
    };
    this.records.push(record);
    return record;
  }

  list(): TradingAuditRecord[] {
    return [...this.records];
  }

  listByCorrelationId(correlationId: string): TradingAuditRecord[] {
    return this.records.filter((record) => record.correlationId === correlationId);
  }

  listByUserId(userId: string): TradingAuditRecord[] {
    return this.records.filter((record) => record.userId === userId);
  }

  listByDaoId(daoId: string): TradingAuditRecord[] {
    return this.records.filter((record) => record.daoId === daoId);
  }

  listByRuntimeInstanceId(runtimeInstanceId: string): TradingAuditRecord[] {
    return this.records.filter((record) => record.runtimeInstanceId === runtimeInstanceId);
  }
}
