/** Minimal browser replacement for the assertion function used by SCALE codecs. */
export default function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) throw new Error(message ?? 'Assertion failed');
}
