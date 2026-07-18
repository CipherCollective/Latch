function normalize(value: unknown, inArray = false): unknown {
  if (value === undefined) {
    if (inArray) throw new TypeError('Undefined array entries are not canonicalizable.');
    return undefined;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString(10);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('Only safe integer numbers are canonicalizable.');
    return value.toString(10);
  }
  if (Array.isArray(value)) return value.map((entry) => normalize(entry, true));
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const normalized = normalize(source[key]);
      if (normalized !== undefined) output[key] = normalized;
    }
    return output;
  }
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  const normalized = normalize(value);
  if (normalized === undefined) throw new TypeError('A top-level undefined value is not canonicalizable.');
  return JSON.stringify(normalized);
}
