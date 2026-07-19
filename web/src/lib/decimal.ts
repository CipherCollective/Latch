const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/;

export interface ParsedDecimal {
  coefficient: bigint;
  scale: number;
  canonical: string;
}

export function parseDecimal(value: string): ParsedDecimal | null {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) return null;

  const fraction = match[2] ?? '';
  const whole = match[1] ?? '0';
  const coefficient = BigInt(`${whole}${fraction}`);
  const canonicalFraction = fraction.replace(/0+$/, '');

  return {
    coefficient: canonicalFraction.length === fraction.length
      ? coefficient
      : coefficient / 10n ** BigInt(fraction.length - canonicalFraction.length),
    scale: canonicalFraction.length,
    canonical: canonicalFraction ? `${whole}.${canonicalFraction}` : whole,
  };
}

function align(left: ParsedDecimal, right: ParsedDecimal): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * 10n ** BigInt(scale - left.scale),
    right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  ];
}

export function compareDecimal(leftValue: string, rightValue: string): number | null {
  const left = parseDecimal(leftValue);
  const right = parseDecimal(rightValue);
  if (!left || !right) return null;
  const [leftAligned, rightAligned] = align(left, right);
  return leftAligned === rightAligned ? 0 : leftAligned > rightAligned ? 1 : -1;
}

export function isPositiveDecimal(value: string): boolean {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed.coefficient > 0n;
}

export function subtractDecimal(leftValue: string, rightValue: string): string | null {
  const left = parseDecimal(leftValue);
  const right = parseDecimal(rightValue);
  if (!left || !right) return null;
  const [leftAligned, rightAligned, scale] = align(left, right);
  const difference = leftAligned - rightAligned;
  if (difference < 0n) return null;
  if (scale === 0) return difference.toString();

  const padded = difference.toString().padStart(scale + 1, '0');
  const whole = padded.slice(0, -scale);
  const fraction = padded.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

