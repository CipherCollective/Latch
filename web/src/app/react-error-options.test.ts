import { describe, expect, it, vi } from 'vitest';
import { PRIVATE_ROOT_ERROR_OPTIONS } from './react-error-options';

describe('PRIVATE_ROOT_ERROR_OPTIONS', () => {
  it('discards raw React errors without writing their details to browser consoles', () => {
    const consoleSpies = [
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
    ];
    const privateError = new Error('INJECTED_PRIVATE_PROVIDER_DETAIL');

    PRIVATE_ROOT_ERROR_OPTIONS.onCaughtError(privateError);
    PRIVATE_ROOT_ERROR_OPTIONS.onUncaughtError(privateError);
    PRIVATE_ROOT_ERROR_OPTIONS.onRecoverableError(privateError);

    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
