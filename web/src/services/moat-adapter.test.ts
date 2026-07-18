import { describe, expect, it, vi } from 'vitest';
import type { MoatClient } from './moat-client';
import {
  CORE_HANDOFF_REQUIRED,
  CoreHandoffRequiredError,
  createRealMoatClient,
} from './moat-adapter';
import type { ConnectedWalletSession } from '../wallet/midnight-wallet-connector';

const session = {
  snapshot: {
    mode: 'real',
    connectionState: 'connected',
    networkId: 'preprod',
    walletName: 'Fixture wallet',
  },
  connected: { privateProviderPayload: 'DO_NOT_RENDER' },
  configuration: {
    networkId: 'preprod',
    indexerUri: 'https://private-indexer.example',
    indexerWsUri: 'wss://private-indexer.example',
    substrateNodeUri: 'wss://private-node.example',
  },
} as unknown as ConnectedWalletSession;

describe('real MoatClient handoff gate', () => {
  it('fails closed with a fixed public error when no verified factory exists', () => {
    expect(() => createRealMoatClient(undefined, session)).toThrow(CoreHandoffRequiredError);
    try {
      createRealMoatClient(undefined, session);
    } catch (error) {
      expect(error).toBeInstanceOf(CoreHandoffRequiredError);
      expect((error as CoreHandoffRequiredError).publicError).toEqual(CORE_HANDOFF_REQUIRED);
      expect(JSON.stringify((error as CoreHandoffRequiredError).publicError)).not.toContain('private-indexer');
      expect(JSON.stringify((error as CoreHandoffRequiredError).publicError)).not.toContain('privateProviderPayload');
    }
  });

  it('passes the wallet session only to an explicitly supplied verified factory', () => {
    const client = { connectWallet: vi.fn() } as unknown as MoatClient;
    const factory = vi.fn(() => client);

    expect(createRealMoatClient(factory, session)).toBe(client);
    expect(factory).toHaveBeenCalledWith(session);
  });
});
