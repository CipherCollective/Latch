import { describe, expect, it } from 'vitest';
import { compareDecimal, isPositiveDecimal, parseDecimal, subtractDecimal } from './decimal';

describe('exact decimal helpers', () => {
  it('normalizes values without converting chain amounts through Number', () => {
    expect(parseDecimal('20.500000')).toEqual({ coefficient: 205n, scale: 1, canonical: '20.5' });
    expect(parseDecimal('0.000001')).toEqual({ coefficient: 1n, scale: 6, canonical: '0.000001' });
    expect(parseDecimal('9007199254740993000000')?.canonical).toBe('9007199254740993000000');
  });

  it.each(['-1', '+1', ' 1', '1 ', '1e3', 'NaN', 'Infinity', '.5', '01', '1.0000001']) (
    'rejects non-canonical input %s',
    (value) => {
      expect(parseDecimal(value)).toBeNull();
      expect(isPositiveDecimal(value)).toBe(false);
    },
  );

  it('compares and subtracts differently-scaled values exactly', () => {
    expect(compareDecimal('12', '12.000000')).toBe(0);
    expect(compareDecimal('12.000001', '12')).toBe(1);
    expect(subtractDecimal('50', '12')).toBe('38');
    expect(subtractDecimal('1.2', '0.15')).toBe('1.05');
    expect(subtractDecimal('1', '2')).toBeNull();
  });
});
