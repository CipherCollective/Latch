import type { ConnectedWalletSession } from './wallet-session.js';
import type { MoatClient } from './types.js';
import type { RealMoatClientOptions } from './real-client.js';
import { RealMoatClient } from './real-client.js';

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

export type CoreHandoffConfig = RealMoatClientOptions;

/**
 * Build a RealMoatClient from an already-deployed/joined contract + providers.
 * Atharv should obtain wallet providers, call deployMoatContract/joinMoatContract, then pass the handle here.
 */
export function createConfiguredMoatClient(config: CoreHandoffConfig): RealMoatClient {
  return new RealMoatClient(config);
}

export function createRealMoatClient(
  factory: VerifiedMoatClientFactory | undefined,
  session: ConnectedWalletSession,
): MoatClient {
  if (!factory) throw new CoreHandoffRequiredError();
  return factory(session);
}
