import { canonicalJson } from '../lib/canonical-json';

export type FixtureDomain =
  | 'capability-id'
  | 'policy-commitment'
  | 'spend-state-commitment'
  | 'request-commitment'
  | 'nullifier'
  | 'receipt-commitment'
  | 'destination'
  | 'ephemeral-key'
  | 'view-tag';

export async function fixtureHash(domain: FixtureDomain, value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(`latch-demo:v1:${domain}:${canonicalJson(value)}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

