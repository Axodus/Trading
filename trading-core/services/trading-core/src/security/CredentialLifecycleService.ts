import type { CredentialVaultReference, TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { InMemoryCredentialVaultRepository } from './InMemoryCredentialVaultRepository.js';

export class CredentialLifecycleService {
  constructor(
    private readonly repository: InMemoryCredentialVaultRepository,
    private readonly eventBus?: TradingEventBus,
  ) {}

  async revoke(reference: CredentialVaultReference, correlationId = `credential-revoked-${reference.id}`): Promise<CredentialVaultReference> {
    const revoked = { ...reference, status: 'revoked' as const };
    this.repository.updateReference(revoked);
    await this.publish({
      id: `${reference.id}:credential-binding-revoked`,
      type: 'CREDENTIAL_BINDING_REVOKED',
      occurredAt: new Date().toISOString(),
      correlationId,
      source: 'security',
      userId: reference.ownerUserId,
      payload: {
        vaultRefId: reference.id,
        providerId: reference.providerId,
      },
    });
    return revoked;
  }

  async rotate(
    reference: CredentialVaultReference,
    secretMaterial: Record<string, string>,
    correlationId = `credential-rotated-${reference.id}`,
  ): Promise<CredentialVaultReference> {
    this.repository.replaceSecret(reference.id, secretMaterial);
    const rotated = { ...reference, status: 'rotated' as const };
    this.repository.updateReference(rotated);
    await this.publish({
      id: `${reference.id}:credential-rotated`,
      type: 'CREDENTIAL_ROTATED',
      occurredAt: new Date().toISOString(),
      correlationId,
      source: 'security',
      userId: reference.ownerUserId,
      payload: {
        vaultRefId: reference.id,
        providerId: reference.providerId,
      },
    });
    return rotated;
  }

  async auditRotation(reference: CredentialVaultReference, envelopeId: string, correlationId = `credential-rotation-audited-${reference.id}`): Promise<void> {
    await this.publish({
      id: `${reference.id}:credential-rotation-audited`,
      type: 'CREDENTIAL_ROTATION_AUDITED',
      occurredAt: new Date().toISOString(),
      correlationId,
      source: 'security',
      userId: reference.ownerUserId,
      payload: {
        vaultRefId: reference.id,
        providerId: reference.providerId,
        envelopeId,
      },
    });
  }

  private async publish(event: TradingEvent): Promise<void> {
    await this.eventBus?.publish(event);
  }
}
