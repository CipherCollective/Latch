import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

// Jest DOM's Vitest entry resolves the hoisted Vitest 3 dependency in this
// workspace. Register the same official matchers with the web runner's
// Vitest 4 `expect` instance instead.
expect.extend(matchers);

afterEach(() => {
  cleanup();
});
