import type { ConnectedWalletSession } from './wallet-session.js';
import type { MoatClient } from './types.js';

/**
 * Real Midnight-backed client seam. Throws until a verified core factory is supplied
 * (contract address, providers, and amount-unit facts from the deploy handoff).
 */
export class CoreHandoffRequiredError extends Error {
  constructor() {
    super(
      'Real MoatClient actions are unavailable until the verified Midnight core handoff is configured. Use MockMoatClient for demo mode.',
    );
    this.name = 'CoreHandoffRequiredError';
  }
}

export type VerifiedMoatClientFactory = (session: ConnectedWalletSession) => MoatClient;

export function createRealMoatClient(
  factory: VerifiedMoatClientFactory | undefined,
  session: ConnectedWalletSession,
): MoatClient {
  if (!factory) throw new CoreHandoffRequiredError();
  return factory(session);
}
