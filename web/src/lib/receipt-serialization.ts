import type { AuthorizationReceipt } from '../types/domain';

export interface ReceiptClipboardPayload {
  capabilityId: string;
  requestCommitment: string;
  receiptCommitment: string;
  nullifier: string;
  oneTimeDestination: {
    destination: string;
    ephemeralPublicKey: string;
    viewTag: string;
    fixture: boolean;
  };
  tx: {
    kind: AuthorizationReceipt['tx']['kind'];
    networkId: AuthorizationReceipt['tx']['networkId'];
    txHash?: string;
    explorerUrl?: string;
  };
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${path} must be a string.`);
  }

  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${path} must be a boolean.`);
  }

  return value;
}

/**
 * Builds the only receipt shape that may cross the owner clipboard boundary.
 * Every leaf is copied explicitly so runtime-injected fields cannot hitchhike
 * through object spreading or nested references.
 */
export function projectOwnerReceipt(receipt: AuthorizationReceipt): ReceiptClipboardPayload {
  const txKind = requireString(receipt.tx.kind, 'tx.kind');
  if (txKind !== 'demo-fixture' && txKind !== 'midnight-transaction') {
    throw new TypeError('tx.kind must be "demo-fixture" or "midnight-transaction".');
  }

  const txNetworkId = requireString(receipt.tx.networkId, 'tx.networkId');
  if (!['demo', 'undeployed', 'preprod', 'preview', 'mainnet'].includes(txNetworkId)) {
    throw new TypeError('tx.networkId must be a supported network id.');
  }

  const payload: ReceiptClipboardPayload = {
    capabilityId: requireString(receipt.capabilityId, 'capabilityId'),
    requestCommitment: requireString(receipt.requestCommitment, 'requestCommitment'),
    receiptCommitment: requireString(receipt.receiptCommitment, 'receiptCommitment'),
    nullifier: requireString(receipt.nullifier, 'nullifier'),
    oneTimeDestination: {
      destination: requireString(receipt.oneTimeDestination.destination, 'oneTimeDestination.destination'),
      ephemeralPublicKey: requireString(
        receipt.oneTimeDestination.ephemeralPublicKey,
        'oneTimeDestination.ephemeralPublicKey',
      ),
      viewTag: requireString(receipt.oneTimeDestination.viewTag, 'oneTimeDestination.viewTag'),
      fixture: requireBoolean(receipt.oneTimeDestination.fixture, 'oneTimeDestination.fixture'),
    },
    tx: {
      kind: txKind as AuthorizationReceipt['tx']['kind'],
      networkId: txNetworkId as AuthorizationReceipt['tx']['networkId'],
    },
  };

  if (typeof receipt.tx.txHash === 'string') {
    payload.tx.txHash = receipt.tx.txHash;
  }
  if (typeof receipt.tx.explorerUrl === 'string') {
    payload.tx.explorerUrl = receipt.tx.explorerUrl;
  }

  return payload;
}

export function serializeOwnerReceipt(receipt: AuthorizationReceipt): string {
  return JSON.stringify(projectOwnerReceipt(receipt), null, 2);
}
