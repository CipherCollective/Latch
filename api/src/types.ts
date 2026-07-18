/** Shared MOAT API types for Atharv frontend + Ashiha core handoff. */

export interface WalletSnapshot {
  connected: boolean;
  networkId: string;
  shieldedAddress?: string;
  unshieldedAddress?: string;
}

export interface PolicyInput {
  agentName: string;
  agentKeyHash: string;
  perTransactionLimit: bigint;
  totalBudget: bigint;
  maxUses: number;
  allowedCategory: string;
}

export interface CreateCapabilityInput {
  policy: PolicyInput;
}

export interface CreateCapabilityResult {
  capabilityId: string;
  policyCommitment: string;
  spendStateCommitment: string;
  ownerCommitment: string;
  txHash?: string;
}

export interface MerchantMetaAddress {
  viewPublicKey: string;
  spendPublicKey: string;
}

export interface SpendRequest {
  requestId: string;
  requestNonce: string;
  agentName: string;
  agentKeyHash: string;
  serviceId: string;
  serviceName: string;
  category: string;
  amount: bigint;
  merchant: MerchantMetaAddress;
}

export interface OneTimeDestination {
  destination: string;
  ephemeralPublicKey: string;
  viewTag: number;
  destinationHash: string;
}

export type PrivateRejectReason =
  | 'limit'
  | 'budget'
  | 'category'
  | 'uses'
  | 'replay'
  | 'revoked'
  | 'agent';

export interface ProofStep {
  id: string;
  label: string;
  status: 'waiting' | 'running' | 'passed' | 'failed';
  detail?: string;
}

export interface AuthorizationResult {
  status: 'approved' | 'rejected' | 'wallet_required' | 'network_error';
  capabilityId: string;
  requestCommitment: string;
  receiptCommitment?: string;
  nullifier?: string;
  oneTimeDestination?: OneTimeDestination;
  txHash?: string;
  publicMessage: string;
  privateReason?: PrivateRejectReason;
  proofSteps: ProofStep[];
}

export interface CapabilityPublicState {
  capabilityId: string;
  policyCommitment: string;
  spendStateCommitment: string;
  ownerCommitment: string;
  revoked: boolean;
}

export interface TxResult {
  txHash?: string;
  success: boolean;
}

export interface MoatClient {
  connectWallet(): Promise<WalletSnapshot>;
  createCapability(input: CreateCapabilityInput): Promise<CreateCapabilityResult>;
  authorizeSpend(input: {
    capabilityId: string;
    request: SpendRequest;
    onProofStep?: (step: ProofStep) => void;
  }): Promise<AuthorizationResult>;
  revokeCapability(capabilityId: string): Promise<TxResult>;
  getCapability(capabilityId: string): Promise<CapabilityPublicState | null>;
  verifyReceipt(receiptCommitment: string): Promise<boolean>;
  generateOneTimeDestination(
    merchant: MerchantMetaAddress,
    requestNonce: string,
  ): Promise<OneTimeDestination>;
}
