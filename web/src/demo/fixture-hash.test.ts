import { describe, expect, it } from 'vitest';
import { fixtureHash } from './fixture-hash';

describe('deterministic fixture hashing', () => {
  it('is stable across key order and repeated calls', async () => {
    const first = await fixtureHash('policy-commitment', { limit: '20', uses: 3 });
    const reordered = await fixtureHash('policy-commitment', { uses: 3, limit: '20' });
    const repeated = await fixtureHash('policy-commitment', { limit: '20', uses: 3 });

    expect(first).toMatch(/^0x[0-9a-f]{64}$/);
    expect(reordered).toBe(first);
    expect(repeated).toBe(first);
  });

  it('separates fixture domains even when payloads match', async () => {
    const payload = { capabilityId: 'cap_demo_1' };
    await expect(fixtureHash('policy-commitment', payload)).resolves.not.toBe(
      await fixtureHash('spend-state-commitment', payload),
    );
  });
});
