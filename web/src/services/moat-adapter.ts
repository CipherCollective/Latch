import type { MoatClient } from './moat-client';
import type { PublicClientError } from '../types/domain';
import type { ConnectedWalletSession } from '../wallet/midnight-wallet-connector';

export const CORE_HANDOFF_REQUIRED: PublicClientError = {
  code: 'UNKNOWN',
  message: 'Real capability actions are unavailable until the verified core client handoff is configured. Demo mode remains available.',
  retryable: false,
};

export type VerifiedCoreClientFactory = (session: ConnectedWalletSession) => MoatClient;

export class CoreHandoffRequiredError extends Error {
  readonly publicError = CORE_HANDOFF_REQUIRED;

  constructor() {
    super(CORE_HANDOFF_REQUIRED.message);
    this.name = 'CoreHandoffRequiredError';
  }
}

/**
 * The sole real-client injection seam. It deliberately accepts an already
 * verified factory rather than guessing the independently owned core package,
 * contract address, amount units, or proof/receipt shapes.
 */
export function createRealMoatClient(
  factory: VerifiedCoreClientFactory | undefined,
  session: ConnectedWalletSession,
): MoatClient {
  if (!factory) throw new CoreHandoffRequiredError();
  return factory(session);
}
