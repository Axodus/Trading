import type { TradingRiskDisclosure, UserRiskAcceptance } from '../../../../packages/trading-contracts/src/index.js';

export type DisclosureVersionStatus = 'valid' | 'missing' | 'expired' | 'version-mismatch';

export class DisclosureVersionService {
  validate(disclosure: TradingRiskDisclosure, acceptance?: UserRiskAcceptance, now = new Date()): DisclosureVersionStatus {
    if (!acceptance) {
      return 'missing';
    }

    if (acceptance.disclosureVersion !== disclosure.version) {
      return 'version-mismatch';
    }

    if (acceptance.expiresAt && Date.parse(acceptance.expiresAt) <= now.getTime()) {
      return 'expired';
    }

    return 'valid';
  }
}
