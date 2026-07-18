import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical-json';

describe('canonical JSON', () => {
  it('sorts object keys recursively, preserves array order, and stringifies integers', () => {
    const left = canonicalJson({ z: 3, nested: { b: true, a: 2 }, list: [2, 1] });
    const right = canonicalJson({ list: [2, 1], nested: { a: 2, b: true }, z: 3 });

    expect(left).toBe('{"list":["2","1"],"nested":{"a":"2","b":true},"z":"3"}');
    expect(right).toBe(left);
  });

  it('omits undefined object properties but rejects ambiguous top-level and array values', () => {
    expect(canonicalJson({ present: 'yes', missing: undefined })).toBe('{"present":"yes"}');
    expect(() => canonicalJson(undefined)).toThrow(/top-level undefined/i);
    expect(() => canonicalJson([undefined])).toThrow(/undefined array entries/i);
  });

  it('rejects unsafe numbers, fractional numbers, and non-plain objects', () => {
    expect(() => canonicalJson(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/i);
    expect(() => canonicalJson(1.25)).toThrow(/safe integer/i);
    expect(() => canonicalJson(new Date())).toThrow(/unsupported canonical value/i);
  });
});
