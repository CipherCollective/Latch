import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';

import { DeveloperRouteFailure } from './developer-route-diagnostics';

type FetchZkProviderConstructor = new <K extends string>(
  baseURL: string,
  fetchFunc?: typeof fetch,
) => FetchZkConfigProvider<K>;

export function createBrowserZkConfigProvider<K extends string>(
  configuredBase = import.meta.env.VITE_ZK_ASSET_BASE_URL ?? '/zk/moat/',
  Provider: FetchZkProviderConstructor = FetchZkConfigProvider,
): FetchZkConfigProvider<K> {
  try {
    const zkAssetBaseUrl = new URL(configuredBase, window.location.origin)
      .toString()
      .replace(/\/+$/, '');

    return new Provider<K>(zkAssetBaseUrl, window.fetch.bind(window));
  } catch (error) {
    throw new DeveloperRouteFailure('zk_provider_initialization', error);
  }
}
