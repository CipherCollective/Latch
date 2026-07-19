import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectedWalletSession } from '../../wallet/midnight-wallet-connector';
import { DeveloperRouteFailure, developerRouteDiagnostic } from './developer-route-diagnostics';

const mocks = vi.hoisted(() => ({
  createMoatProviders: vi.fn(),
  deployMoatContractLowLevel: vi.fn(),
  waitForMoatContract: vi.fn().mockResolvedValue(undefined),
  createBrowserZkConfigProvider: vi.fn(() => ({ fixture: true })),
}));

vi.mock('../../../../api/src/browser.ts', () => ({
  PREPROD_ENDPOINTS: {
    networkId: 'preprod',
    proofServer: 'https://proof.invalid/',
    indexerHttp: 'https://indexer.invalid/',
    indexerWs: 'wss://indexer.invalid/',
    node: 'wss://node.invalid/',
  },
  createMoatProviders: mocks.createMoatProviders,
  deployMoatContractLowLevel: mocks.deployMoatContractLowLevel,
  waitForMoatContract: mocks.waitForMoatContract,
}));

vi.mock('./browser-zk-provider', () => ({
  createBrowserZkConfigProvider: mocks.createBrowserZkConfigProvider,
}));

import { deployMoatWithLace } from './lace-moat-deploy';

const session: ConnectedWalletSession = {
  snapshot: {
    mode: 'real',
    connectionState: 'connected',
    networkId: 'preprod',
    walletName: 'Lace fixture',
  },
  configuration: {
    networkId: 'preprod',
    indexerUri: 'https://indexer.invalid/',
    indexerWsUri: 'wss://indexer.invalid/',
    substrateNodeUri: 'wss://node.invalid/',
  },
};

function connectedApi(overrides: Partial<ConnectedAPI> = {}): ConnectedAPI {
  return {
    getConnectionStatus: vi.fn().mockResolvedValue({ status: 'connected', networkId: 'preprod' }),
    getShieldedAddresses: vi.fn().mockResolvedValue({
      shieldedAddress: 'fixture',
      shieldedCoinPublicKey: 'fixture-coin-key',
      shieldedEncryptionPublicKey: 'fixture-encryption-key',
    }),
    balanceUnsealedTransaction: vi.fn(),
    submitTransaction: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ConnectedAPI;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createMoatProviders.mockImplementation((input) => input);
  mocks.waitForMoatContract.mockResolvedValue(undefined);
});

describe('Lace deployment provider bridge', () => {
  function submitThroughBridge(api: ConnectedAPI) {
    mocks.deployMoatContractLowLevel.mockImplementation(async (providers: unknown) => {
      const bridge = providers as {
        walletAndMidnightProvider: {
          submitTx: (transaction: { serialize: () => Uint8Array; identifiers: () => string[] }) => Promise<string>;
        };
      };
      const txId = await bridge.walletAndMidnightProvider.submitTx({
        serialize: () => new Uint8Array([10, 11, 12]),
        identifiers: () => ['fixture-transaction-id'],
      });
      return {
        contractAddress: 'fixture-contract-address',
        txId,
        signingKey: 'fixture-signing-key',
        initialPrivateState: {},
      };
    });
    return deployMoatWithLace(session, api);
  }

  it('classifies a connector ReferenceError at the wallet balance boundary and exposes only its safe identifier', async () => {
    const api = connectedApi({
      balanceUnsealedTransaction: vi.fn().mockRejectedValue(new ReferenceError('Buffer is not defined')),
    });
    mocks.deployMoatContractLowLevel.mockImplementation(async (providers: unknown) => {
      const bridge = providers as {
        walletAndMidnightProvider: {
          balanceTx: (transaction: { serialize: () => Uint8Array }) => Promise<unknown>;
        };
      };
      await bridge.walletAndMidnightProvider.balanceTx({ serialize: () => new Uint8Array([1, 2, 3]) });
      throw new Error('unreachable');
    });

    const failure = await deployMoatWithLace(session, api).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DeveloperRouteFailure);
    expect(failure).toMatchObject({
      stage: 'wallet_balance',
      originalErrorName: 'ReferenceError',
      missingIdentifier: 'Buffer',
    });
    expect(developerRouteDiagnostic('deployment_submission', failure)).toEqual({
      code: 'DEVELOPER_ROUTE_FAILURE',
      stage: 'wallet_balance',
      errorName: 'ReferenceError',
      missingIdentifier: 'Buffer',
      message: 'Lace could not authorize and balance the deployment transaction.',
    });
    expect(api.submitTransaction).not.toHaveBeenCalled();
  });

  it('derives the transaction identifier and preserves this-binding for Connector API 4.0.1 void submission', async () => {
    let api: ConnectedAPI;
    const submitTransaction = vi.fn(function (this: unknown) {
      expect(this).toBe(api);
      return Promise.resolve();
    });
    api = connectedApi({ submitTransaction });

    const result = await submitThroughBridge(api);

    expect(result.txId).toBe('fixture-transaction-id');
    expect(submitTransaction).toHaveBeenCalledTimes(1);
    expect(submitTransaction).toHaveBeenCalledWith('0a0b0c');
  });

  it('classifies an explicit connector rejection before broadcast', async () => {
    const rejection = Object.assign(new Error('private connector reason'), {
      type: 'DAppConnectorAPIError',
      code: 'Rejected',
      reason: 'private connector reason',
    });
    const failure = await submitThroughBridge(
      connectedApi({ submitTransaction: vi.fn().mockRejectedValue(rejection) }),
    ).catch((error: unknown) => error);

    expect(developerRouteDiagnostic('deployment_submission', failure)).toMatchObject({
      stage: 'wallet_submission',
      walletErrorCode: 'USER_REJECTED',
      message: 'The Lace submission request was rejected. No automatic retry will occur.',
    });
  });

  it('classifies an unknown asynchronous rejection as ambiguous after possible broadcast', async () => {
    const privateValue = 'private relay acknowledgement failure';
    const failure = await submitThroughBridge(
      connectedApi({ submitTransaction: vi.fn().mockRejectedValue(new Error(privateValue)) }),
    ).catch((error: unknown) => error);
    const diagnostic = developerRouteDiagnostic('deployment_submission', failure);

    expect(diagnostic).toMatchObject({
      stage: 'wallet_submission',
      walletErrorCode: 'AMBIGUOUS_SUBMISSION',
    });
    expect(diagnostic.message).not.toContain(privateValue);
  });

  it('does not expose arbitrary ReferenceError text as an identifier', () => {
    const diagnostic = developerRouteDiagnostic(
      'wallet_balance',
      new ReferenceError('wallet payload for an unrelated address is not defined'),
    );

    expect(diagnostic).not.toHaveProperty('missingIdentifier');
    expect(diagnostic.message).toBe('Lace could not authorize and balance the deployment transaction.');
  });
});
