import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';

import { createBrowserZkConfigProvider } from './browser-zk-provider';
import { DeveloperRouteFailure } from './developer-route-diagnostics';

type Constructor = new <K extends string>(
  baseURL: string,
  fetchFunc?: typeof fetch,
) => FetchZkConfigProvider<K>;

const originalFetch = window.fetch;

afterEach(() => {
  window.fetch = originalFetch;
});

function capturingConstructor(capture: { baseURL?: string; fetchFunc?: typeof fetch }): Constructor {
  return class {
    constructor(baseURL: string, fetchFunc?: typeof fetch) {
      capture.baseURL = baseURL;
      capture.fetchFunc = fetchFunc;
    }
  } as unknown as Constructor;
}

describe('createBrowserZkConfigProvider', () => {
  it('resolves a relative configured base against the browser origin', () => {
    const capture: { baseURL?: string } = {};

    createBrowserZkConfigProvider('/zk/moat/', capturingConstructor(capture));

    expect(capture.baseURL).toBe(`${window.location.origin}/zk/moat`);
  });

  it('preserves an absolute configured base and removes trailing slashes', () => {
    const capture: { baseURL?: string } = {};

    createBrowserZkConfigProvider('https://assets.example.test/moat///', capturingConstructor(capture));

    expect(capture.baseURL).toBe('https://assets.example.test/moat');
  });

  it('passes a fetch function bound to window', async () => {
    const capture: { fetchFunc?: typeof fetch } = {};
    let receiver: unknown;
    window.fetch = vi.fn(function (this: unknown) {
      receiver = this;
      return Promise.resolve(new Response());
    });

    createBrowserZkConfigProvider('/zk/moat/', capturingConstructor(capture));
    await capture.fetchFunc?.('https://assets.example.test/test');

    expect(receiver).toBe(window);
  });

  it('classifies constructor failures as zk_provider_initialization', () => {
    const Provider = class {
      constructor() {
        throw new TypeError('private resolved URL must not escape');
      }
    } as unknown as Constructor;

    expect(() => createBrowserZkConfigProvider('/zk/moat/', Provider)).toThrowError(
      expect.objectContaining<Partial<DeveloperRouteFailure>>({
        name: 'DeveloperRouteFailure',
        stage: 'zk_provider_initialization',
        originalErrorName: 'TypeError',
      }),
    );
  });
});
