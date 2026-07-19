import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { Transaction } from '@midnight-ntwrk/ledger-v8';
import {
  PREPROD_ENDPOINTS,
  createMoatProviders,
  deployMoatContractLowLevel,
  waitForMoatContract,
  type MoatCircuitId,
  type WalletAndMidnightProvider,
} from '../../../../api/src/browser.ts';

import type { ConnectedWalletSession } from '../../wallet/midnight-wallet-connector';
import { createBrowserZkConfigProvider } from './browser-zk-provider';
import { DeveloperRouteFailure } from './developer-route-diagnostics';

export type MoatDeploymentResult = {
  contractAddress: string;
  txId: string;
  waitForIndexer: () => Promise<void>;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array {
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^(?:[0-9a-f]{2})*$/i.test(normalized)) {
    throw new DeveloperRouteFailure('deployment_submission', new TypeError('invalid balanced transaction'));
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

async function createWalletAndMidnightProvider(api: ConnectedAPI): Promise<WalletAndMidnightProvider> {
  let shieldedAddresses: Awaited<ReturnType<ConnectedAPI['getShieldedAddresses']>>;
  try {
    shieldedAddresses = await api.getShieldedAddresses();
  } catch (error) {
    throw new DeveloperRouteFailure('provider_adapter_construction', error);
  }

  return {
    getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey as never,
    getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey as never,
    async balanceTx(transaction: Parameters<WalletAndMidnightProvider['balanceTx']>[0]) {
      let serialized: string;
      try {
        serialized = toHex(transaction.serialize());
      } catch (error) {
        throw new DeveloperRouteFailure('transaction_serialization', error);
      }

      let balanced: { tx?: unknown };
      try {
        balanced = await api.balanceUnsealedTransaction(serialized);
      } catch (error) {
        throw new DeveloperRouteFailure('wallet_balance', error);
      }
      if (typeof balanced.tx !== 'string') {
        throw new DeveloperRouteFailure('wallet_balance', new TypeError('missing balanced transaction'));
      }
      try {
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx)) as never;
      } catch (error) {
        if (error instanceof DeveloperRouteFailure) throw error;
        throw new DeveloperRouteFailure('balanced_transaction_deserialization', error);
      }
    },
    async submitTx(transaction: Parameters<WalletAndMidnightProvider['submitTx']>[0]) {
      let serialized: string;
      let txId: string | undefined;
      try {
        serialized = toHex(transaction.serialize());
        txId = transaction.identifiers()[0];
      } catch (error) {
        throw new DeveloperRouteFailure('transaction_serialization', error);
      }
      if (!txId) {
        throw new DeveloperRouteFailure('transaction_serialization', new TypeError('missing transaction identifier'));
      }
      try {
        // Connector API 4.0.1 resolves with void, so preserve the ledger identifier before submission.
        await api.submitTransaction(serialized);
      } catch (error) {
        throw new DeveloperRouteFailure('wallet_submission', error);
      }
      return txId as never;
    },
  };
}

function assertPreprodSession(session: ConnectedWalletSession): void {
  if (
    session.snapshot.mode !== 'real' ||
    session.snapshot.connectionState !== 'connected' ||
    session.snapshot.networkId !== 'preprod' ||
    session.configuration.networkId !== 'preprod'
  ) {
    throw new DeveloperRouteFailure('deployment_precondition', new Error('wrong network'));
  }
}

/** Build browser providers from the already-connected Lace session, then submit one explicit deployment. */
export async function deployMoatWithLace(
  session: ConnectedWalletSession | null,
  api: ConnectedAPI | null,
): Promise<MoatDeploymentResult> {
  if (!session || !api) {
    throw new DeveloperRouteFailure('deployment_precondition', new Error('missing session'));
  }
  assertPreprodSession(session);

  try {
    const status = await api.getConnectionStatus();
    if (status.status !== 'connected' || status.networkId !== 'preprod') {
      throw new DeveloperRouteFailure('deployment_precondition', new Error('disconnected'));
    }
  } catch (error) {
    if (error instanceof DeveloperRouteFailure) throw error;
    throw new DeveloperRouteFailure('deployment_precondition', error);
  }

  const zkConfigProvider = createBrowserZkConfigProvider<MoatCircuitId>();

  let providers: ReturnType<typeof createMoatProviders>;
  try {
    providers = createMoatProviders({
      endpoints: {
        ...PREPROD_ENDPOINTS,
        proofServer: session.configuration.proverServerUri ?? PREPROD_ENDPOINTS.proofServer,
        indexerHttp: session.configuration.indexerUri,
        indexerWs: session.configuration.indexerWsUri,
        node: session.configuration.substrateNodeUri,
      },
      walletAndMidnightProvider: await createWalletAndMidnightProvider(api),
      zkConfigProvider,
    });
  } catch (error) {
    if (error instanceof DeveloperRouteFailure) throw error;
    throw new DeveloperRouteFailure('provider_adapter_construction', error);
  }

  try {
    const deployment = await deployMoatContractLowLevel(providers);
    return {
      contractAddress: deployment.contractAddress,
      txId: deployment.txId,
      waitForIndexer: () => waitForMoatContract(providers, deployment.contractAddress),
    };
  } catch (error) {
    if (error instanceof DeveloperRouteFailure) throw error;
    throw new DeveloperRouteFailure('deployment_submission', error);
  }
}
