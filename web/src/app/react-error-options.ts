/**
 * React logs caught and recoverable errors by default. Provider failures may
 * contain endpoint or private payload details, so the application root
 * deliberately discards every raw React error callback.
 */
const discardPotentiallySensitiveError = (..._details: unknown[]): void => undefined;

export const PRIVATE_ROOT_ERROR_OPTIONS = {
  onCaughtError: discardPotentiallySensitiveError,
  onUncaughtError: discardPotentiallySensitiveError,
  onRecoverableError: discardPotentiallySensitiveError,
} as const;
