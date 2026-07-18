import type {
  AuthorizationResult,
  CapabilityOwnerState,
  CapabilityPublicState,
  CreateCapabilityInput,
  CreateCapabilityResult,
  MerchantMetaAddress,
  OneTimeDestination,
  ProofStep,
  SpendRequest,
  TxResult,
  WalletSnapshot,
} from '../types/domain';

export interface MoatClient {
  connectWallet(): Promise<WalletSnapshot>;
  createCapability(input: CreateCapabilityInput): Promise<CreateCapabilityResult>;
  authorizeSpend(input: {
    capabilityId: string;
    request: SpendRequest;
    onProofStep?: (step: ProofStep) => void;
  }): Promise<AuthorizationResult>;
  revokeCapability(capabilityId: string): Promise<TxResult>;
  getCapability(capabilityId: string): Promise<CapabilityOwnerState | CapabilityPublicState>;
  verifyReceipt(receiptCommitment: string): Promise<boolean>;
  generateOneTimeDestination(
    merchant: MerchantMetaAddress,
    requestNonce: string,
  ): Promise<OneTimeDestination>;
}

