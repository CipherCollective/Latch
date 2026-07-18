import type {
  PrivateStateId,
  PrivateStateProvider,
  PrivateStateExport,
  SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';

/**
 * Hackathon in-memory private-state provider (browser-safe).
 * Documented in CORE_STATUS — not encrypted; do not use for production custody.
 */
export function createInMemoryPrivateStateProvider<
  PSI extends PrivateStateId = PrivateStateId,
  PS = unknown,
>(): PrivateStateProvider<PSI, PS> {
  let scope: string | undefined;
  const states = new Map<string, PS>();
  const signingKeys = new Map<string, unknown>();

  const requireScope = () => {
    if (!scope) throw new Error('privateStateProvider.setContractAddress must be called first');
    return scope;
  };

  const stateKey = (id: string) => `${requireScope()}:${id}`;

  return {
    setContractAddress(address) {
      scope = String(address);
    },
    async set(privateStateId, state) {
      states.set(stateKey(String(privateStateId)), state);
    },
    async get(privateStateId) {
      return states.get(stateKey(String(privateStateId))) ?? null;
    },
    async remove(privateStateId) {
      states.delete(stateKey(String(privateStateId)));
    },
    async clear() {
      const prefix = `${requireScope()}:`;
      for (const key of [...states.keys()]) {
        if (key.startsWith(prefix)) states.delete(key);
      }
    },
    async setSigningKey(address, signingKey) {
      signingKeys.set(String(address), signingKey);
    },
    async getSigningKey(address) {
      return (signingKeys.get(String(address)) as never) ?? null;
    },
    async removeSigningKey(address) {
      signingKeys.delete(String(address));
    },
    async clearSigningKeys() {
      signingKeys.clear();
    },
    async exportPrivateStates(): Promise<PrivateStateExport> {
      throw new Error('In-memory private state export is not implemented for the hackathon mock store');
    },
    async importPrivateStates() {
      throw new Error('In-memory private state import is not implemented for the hackathon mock store');
    },
    async exportSigningKeys(): Promise<SigningKeyExport> {
      throw new Error('In-memory signing-key export is not implemented for the hackathon mock store');
    },
    async importSigningKeys() {
      throw new Error('In-memory signing-key import is not implemented for the hackathon mock store');
    },
  };
}
