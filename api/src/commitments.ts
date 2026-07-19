import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Domain-separated commitment helpers aligned with `contract/src/moat.compact`.
 *
 * Encoding note: Compact `persistentHash` over `Vector<n, Bytes<32>>` is modeled
 * here as SHA-256 over the concatenation of the 32-byte chunks (including
 * `pad(32, domain)` and `Uint as Bytes<32>` big-endian). Bit-exact parity with
 * Compact runtime must be re-verified when the real Midnight client lands.
 */

export const DOMAINS = {
  CAPABILITY_ID: 'MOAT_CAPABILITY_ID_V1',
  OWNER: 'MOAT_OWNER_V1',
  AGENT_KEY: 'MOAT_AGENT_KEY_V1',
  POLICY: 'MOAT_POLICY_V1',
  SPEND_STATE: 'MOAT_SPEND_STATE_V1',
  REQUEST: 'MOAT_REQUEST_V1',
  NULLIFIER: 'MOAT_NULLIFIER_V1',
  RECEIPT: 'MOAT_RECEIPT_V1',
} as const;

export function padDomain(tag: string): Uint8Array {
  const out = new Uint8Array(32);
  const raw = utf8ToBytes(tag);
  out.set(raw.slice(0, 32));
  return out;
}

export function uintToBytes32(value: bigint): Uint8Array {
  if (value < 0n) throw new Error('unsigned value required');
  const out = new Uint8Array(32);
  let n = value;
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  if (n !== 0n) throw new Error('value does not fit in 32 bytes');
  return out;
}

export function normalizeBytes32(input: string | Uint8Array): Uint8Array {
  if (typeof input !== 'string') {
    if (input.length !== 32) throw new Error('expected 32 bytes');
    return input;
  }
  const hex = input.startsWith('0x') ? input.slice(2) : input;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    // Allow opaque demo ids / category strings by hashing into 32 bytes.
    return sha256(utf8ToBytes(input));
  }
  return hexToBytes(hex);
}

export function persistentHashChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    if (chunk.length !== 32) throw new Error('commitment chunks must be 32 bytes');
    joined.set(chunk, offset);
    offset += 32;
  }
  return sha256(joined);
}

export function toHex32(bytes: Uint8Array): string {
  return `0x${bytesToHex(bytes)}`;
}

export function hashOwner(ownerSecret: Uint8Array): Uint8Array {
  return persistentHashChunks([padDomain(DOMAINS.OWNER), ownerSecret]);
}

export function hashCapabilityId(ownerSecret: Uint8Array, policySalt: Uint8Array): Uint8Array {
  return persistentHashChunks([padDomain(DOMAINS.CAPABILITY_ID), ownerSecret, policySalt]);
}

export function hashAgentKey(agentSecret: Uint8Array): Uint8Array {
  return persistentHashChunks([padDomain(DOMAINS.AGENT_KEY), agentSecret]);
}

export function hashPolicy(input: {
  capabilityId: Uint8Array;
  agentKeyHash: Uint8Array;
  perTransactionLimit: bigint;
  totalBudget: bigint;
  maxUses: bigint;
  allowedCategoryHash: Uint8Array;
  policySalt: Uint8Array;
}): Uint8Array {
  return persistentHashChunks([
    padDomain(DOMAINS.POLICY),
    input.capabilityId,
    input.agentKeyHash,
    uintToBytes32(input.perTransactionLimit),
    uintToBytes32(input.totalBudget),
    uintToBytes32(input.maxUses),
    input.allowedCategoryHash,
    input.policySalt,
  ]);
}

export function hashSpendState(input: {
  capabilityId: Uint8Array;
  spentSoFar: bigint;
  useCount: bigint;
  stateSalt: Uint8Array;
}): Uint8Array {
  return persistentHashChunks([
    padDomain(DOMAINS.SPEND_STATE),
    input.capabilityId,
    uintToBytes32(input.spentSoFar),
    uintToBytes32(input.useCount),
    input.stateSalt,
  ]);
}

export function hashRequest(input: {
  amount: bigint;
  categoryHash: Uint8Array;
  oneTimeDestinationHash: Uint8Array;
  requestNonce: Uint8Array;
}): Uint8Array {
  return persistentHashChunks([
    padDomain(DOMAINS.REQUEST),
    uintToBytes32(input.amount),
    input.categoryHash,
    input.oneTimeDestinationHash,
    input.requestNonce,
  ]);
}

export function hashNullifier(input: {
  capabilityId: Uint8Array;
  requestNonce: Uint8Array;
  agentSecret: Uint8Array;
}): Uint8Array {
  return persistentHashChunks([
    padDomain(DOMAINS.NULLIFIER),
    input.capabilityId,
    input.requestNonce,
    input.agentSecret,
  ]);
}

export function hashReceipt(input: {
  capabilityId: Uint8Array;
  requestCommitment: Uint8Array;
  nullifier: Uint8Array;
  newSpendStateCommitment: Uint8Array;
}): Uint8Array {
  return persistentHashChunks([
    padDomain(DOMAINS.RECEIPT),
    input.capabilityId,
    input.requestCommitment,
    input.nullifier,
    input.newSpendStateCommitment,
  ]);
}

export function hashCategory(category: string): Uint8Array {
  return sha256(utf8ToBytes(`MOAT_CATEGORY_V1:${category}`));
}

export function randomBytes32(): Uint8Array {
  const out = new Uint8Array(32);
  crypto.getRandomValues(out);
  // Reject all-zero for safety in stealth/scalar contexts that reuse this helper.
  if (out.every((b) => b === 0)) out[31] = 1;
  return out;
}
