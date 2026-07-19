import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import * as secp from '@noble/secp256k1';

import type { MerchantMetaAddress, OneTimeDestination } from './types.js';
import { normalizeBytes32, toHex32 } from './commitments.js';

secp.hashes.hmacSha256 = (key, msg) => hmac(sha256, key, msg);
secp.hashes.sha256 = sha256;

function parseCompressedPoint(hex: string, label: string): Uint8Array {
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{66}$/.test(raw)) {
    throw new Error(`malformed ${label}: expected 33-byte compressed hex`);
  }
  const bytes = hexToBytes(raw);
  secp.Point.fromBytes(bytes);
  return bytes;
}

function requireNonZeroScalar(bytes: Uint8Array): bigint {
  if (bytes.every((b) => b === 0)) throw new Error('zero scalar rejected');
  const n = secp.Point.CURVE().n;
  const scalar = BigInt(`0x${bytesToHex(bytes)}`) % n;
  if (scalar === 0n) throw new Error('zero scalar rejected');
  return scalar;
}

/**
 * Fresh one-time destination from a merchant meta-address (view V, spend S).
 * Clean-room secp256k1 implementation for this hackathon.
 */
export async function generateOneTimeDestination(
  merchant: MerchantMetaAddress,
  requestNonce: string,
  randomScalar?: Uint8Array,
): Promise<OneTimeDestination> {
  const viewKey = parseCompressedPoint(merchant.viewPublicKey, 'viewPublicKey');
  const spendKey = parseCompressedPoint(merchant.spendPublicKey, 'spendPublicKey');
  const nonce = normalizeBytes32(requestNonce);

  const rBytes = randomScalar ?? secp.utils.randomSecretKey();
  if (rBytes.every((b) => b === 0)) throw new Error('zero scalar rejected');
  const r = requireNonZeroScalar(rBytes);
  const R = secp.Point.BASE.multiply(r);
  const V = secp.Point.fromBytes(viewKey);
  const S = secp.Point.fromBytes(spendKey);

  const shared = V.multiply(r).toBytes(true);
  const tweakHash = sha256(Uint8Array.from([...shared, ...nonce]));
  const tweak = requireNonZeroScalar(tweakHash);
  const P = secp.Point.BASE.multiply(tweak).add(S);
  const viewTag = sha256(shared)[0] ?? 0;
  const destinationBytes = P.toBytes(true);

  return {
    destination: `0x${bytesToHex(destinationBytes)}`,
    ephemeralPublicKey: `0x${bytesToHex(R.toBytes(true))}`,
    viewTag,
    destinationHash: toHex32(sha256(destinationBytes)),
  };
}

/** Receiver-side check used by unit tests — never log shared secrets. */
export function deriveReceiverOneTimePublicKey(input: {
  viewPrivateKey: Uint8Array;
  spendPublicKey: string;
  ephemeralPublicKey: string;
  requestNonce: string;
}): string {
  const v = requireNonZeroScalar(input.viewPrivateKey);
  const R = secp.Point.fromBytes(parseCompressedPoint(input.ephemeralPublicKey, 'ephemeralPublicKey'));
  const S = secp.Point.fromBytes(parseCompressedPoint(input.spendPublicKey, 'spendPublicKey'));
  const nonce = normalizeBytes32(input.requestNonce);
  const shared = R.multiply(v).toBytes(true);
  const tweak = requireNonZeroScalar(sha256(Uint8Array.from([...shared, ...nonce])));
  return `0x${bytesToHex(secp.Point.BASE.multiply(tweak).add(S).toBytes(true))}`;
}
