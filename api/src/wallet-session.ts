/** Minimal session shape for the real-client injection seam (filled after wallet connect). */
export interface ConnectedWalletSession {
  networkId: string;
  walletName?: string;
}
