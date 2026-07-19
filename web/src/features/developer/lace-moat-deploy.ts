import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { Transaction } from '@midnight-ntwrk/ledger-v8';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import {
  PREPROD_ENDPOINTS,
  createMoatProviders,
  deployMoatContractLowLevel,
  waitForMoatContract,
  type MoatCircuitId,
  type WalletAndMidnightProvider,
} from '../../../../api/src/browser.ts';

import type { ConnectedWalletSession } from '../../wallet/midnight-wallet-connector';

export type MoatDeploymentResult = {
  contractAddress: string;
  txId: string;
  waitForIndexer: () => Promise<void>;
};

class DeveloperDeploymentError extends Error {}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array {
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^(?:[0-9a-f]{2})*$/i.test(normalized)) {
    throw new DeveloperDeploymentError('Lace returned an invalid balanced transaction. Do not retry yet.');
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
  } catch {
    throw new DeveloperDeploymentError('Lace could not provide the keys needed to prepare this deployment.');
  }

  return {
    getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey as never,
    getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey as never,
    async balanceTx(transaction: Parameters<WalletAndMidnightProvider['balanceTx']>[0]) {
      let balanced: { tx?: unknown };
      try {
        balanced = await api.balanceUnsealedTransaction(toHex(transaction.serialize()));
      } catch {
        throw new DeveloperDeploymentError('Lace could not balance the deployment transaction. Check wallet approval and try later.');
      }
      if (typeof balanced.tx !== 'string') {
        throw new DeveloperDeploymentError('Lace returned no balanced deployment transaction. Do not retry yet.');
      }
      try {
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx)) as never;
      } catch {
        throw new DeveloperDeploymentError('Lace returned an invalid balanced transaction. Do not retry yet.');
      }
    },
    async submitTx(transaction: Parameters<WalletAndMidnightProvider['submitTx']>[0]) {
      const serialized = toHex(transaction.serialize());
      let submitted: unknown;
      try {
        submitted = await (api.submitTransaction as (tx: string) => Promise<unknown>)(serialized);
      } catch {
        throw new DeveloperDeploymentError('Lace could not submit the deployment transaction. Check the wallet and Preprod connection.');
      }
      if (typeof submitted === 'string' && submitted) return submitted as never;
      if (submitted && typeof submitted === 'object') {
        const candidate = submitted as { transactionId?: unknown; id?: unknown };
        if (typeof candidate.transactionId === 'string' && candidate.transactionId) return candidate.transactionId as never;
        if (typeof candidate.id === 'string' && candidate.id) return candidate.id as never;
      }
      throw new DeveloperDeploymentError(
        'Lace submitted the transaction but did not return a transaction ID. Verify wallet activity before trying again.',
      );
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
    throw new DeveloperDeploymentError('Connect Lace to Midnight Preprod before deploying.');
  }
}

/** Build browser providers from the already-connected Lace session, then submit one explicit deployment. */
export async function deployMoatWithLace(
  session: ConnectedWalletSession | null,
  api: ConnectedAPI | null,
): Promise<MoatDeploymentResult> {
  if (!session || !api) {
    throw new DeveloperDeploymentError('Connect Lace to Midnight Preprod before deploying.');
  }
  assertPreprodSession(session);

  try {
    const status = await api.getConnectionStatus();
    if (status.status !== 'connected' || status.networkId !== 'preprod') {
      throw new DeveloperDeploymentError('Lace is no longer connected to Midnight Preprod. Reconnect before deploying.');
    }
  } catch (error) {
    if (error instanceof DeveloperDeploymentError) throw error;
    throw new DeveloperDeploymentError('Lace connection could not be confirmed. Reconnect before deploying.');
  }

  const zkConfigProvider = new FetchZkConfigProvider<MoatCircuitId>(
    import.meta.env.VITE_ZK_ASSET_BASE_URL ?? '/zk/moat/',
  );
  const providers = createMoatProviders({
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

  try {
    const deployment = await deployMoatContractLowLevel(providers);
    return {
      contractAddress: deployment.contractAddress,
      txId: deployment.txId,
      waitForIndexer: () => waitForMoatContract(providers, deployment.contractAddress),
    };
  } catch (error) {
    if (error instanceof DeveloperDeploymentError) throw error;
    throw new DeveloperDeploymentError(
      'The deployment was not completed. Check Lace approval, the proof server, and Preprod connectivity before retrying.',
    );
  }
}
