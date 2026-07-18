export type ExecutionMode = 'demo' | 'real';
export type NetworkId = 'demo' | 'undeployed' | 'preprod' | 'preview' | 'mainnet';
export type ConnectionState = 'disconnected' | 'discovering' | 'connecting' | 'connected' | 'error';

export interface WalletSnapshot {
  mode: ExecutionMode;
  connectionState: ConnectionState;
  networkId: NetworkId;
  walletName?: string;
  unshieldedAddress?: string;
  error?: PublicClientError;
}

export interface PolicyInput {
  agentName: string;
  perTransactionLimit: string;
  totalBudget: string;
  maxUses: number;
  allowedCategory: string;
}

export interface CreateCapabilityInput {
  alias: string;
  policy: PolicyInput;
}

export interface CreateCapabilityResult {
  capabilityId: string;
  policyCommitment: string;
  spendStateCommitment: string;
  status: 'active';
  createdAtLabel: string;
  tx?: TxResult;
}

export interface MerchantMetaAddress {
  merchantId: string;
  displayName: string;
  metaAddress: string;
}

export interface SpendRequest {
  requestNonce: string;
  serviceId: 'codeshield' | 'alphasignal';
  serviceName: string;
  amount: string;
  category: string;
  merchant: MerchantMetaAddress;
}

export interface OneTimeDestination {
  destination: string;
  ephemeralPublicKey: string;
  viewTag: string;
  fixture: boolean;
}

export type ProofStepId =
  | 'prepare-witness'
  | 'derive-destination'
  | 'open-policy'
  | 'evaluate-constraints'
  | 'check-nullifier'
  | 'submit-proof'
  | 'commit-receipt';

export interface ProofStep {
  id: ProofStepId;
  label: string;
  status: 'waiting' | 'running' | 'passed' | 'failed';
  safeDetail?: string;
}

export type TxResult =
  | { kind: 'demo-fixture'; networkId: 'demo' | 'undeployed'; txHash?: never; explorerUrl?: never }
  | { kind: 'midnight-transaction'; networkId: 'preprod' | 'preview' | 'mainnet'; txHash: string; explorerUrl?: string };

export interface AuthorizationReceipt {
  capabilityId: string;
  requestCommitment: string;
  receiptCommitment: string;
  nullifier: string;
  oneTimeDestination: OneTimeDestination;
  tx: TxResult;
}

export type PrivateRejectionCode =
  | 'PER_TX_LIMIT'
  | 'TOTAL_BUDGET'
  | 'MAX_USES'
  | 'CATEGORY'
  | 'REPLAY'
  | 'REVOKED'
  | 'UNKNOWN';

export type AuthorizationResult =
  | {
      status: 'approved';
      proofSteps: ProofStep[];
      receipt: AuthorizationReceipt;
    }
  | {
      status: 'rejected';
      proofSteps: ProofStep[];
      publicMessage: 'Authorization rejected. No private policy values were disclosed.';
      privateReason?: PrivateRejectionCode;
    };

export interface CapabilityPublicState {
  capabilityId: string;
  status: 'active' | 'revoked';
  policyCommitment: string;
  spendStateCommitment: string;
}

export interface CapabilityOwnerState extends CapabilityPublicState {
  alias: string;
  policy: PolicyInput;
  usesRemaining: number;
  remainingBudget: string;
}

export interface PublicClientError {
  code:
    | 'WALLET_MISSING'
    | 'WALLET_DISCOVERY_FAILED'
    | 'WALLET_LOCKED'
    | 'WALLET_REJECTED'
    | 'WRONG_NETWORK'
    | 'INCOMPATIBLE_WALLET'
    | 'PROOF_FAILED'
    | 'SUBMISSION_FAILED'
    | 'NOT_FOUND'
    | 'UNKNOWN';
  message: string;
  retryable: boolean;
}
