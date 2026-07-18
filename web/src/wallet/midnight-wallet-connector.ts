import '@midnight-ntwrk/dapp-connector-api';

import type {
  ConnectedAPI,
  Configuration,
  InitialAPI,
  WalletConnectedAPI,
} from '@midnight-ntwrk/dapp-connector-api';
import { satisfies, valid } from 'semver';

import type { NetworkId, PublicClientError, WalletSnapshot } from '../types/domain';

export const SUPPORTED_CONNECTOR_RANGE = '^4.0.0';
export const DEFAULT_REAL_NETWORK = 'preprod' as const;

const MAX_NAME_LENGTH = 80;
const MAX_VERSION_LENGTH = 32;
const MAX_ICON_LENGTH = 128 * 1024;
const MAX_ENDPOINT_LENGTH = 2_048;
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;
const SAFE_DATA_ICON = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+={0,2})$/i;
const INTERNAL_FAILURE = Symbol('latch-wallet-connector-failure');

type PublicWalletCode = Extract<
  PublicClientError['code'],
  | 'WALLET_MISSING'
  | 'WALLET_DISCOVERY_FAILED'
  | 'WALLET_LOCKED'
  | 'WALLET_REJECTED'
  | 'WRONG_NETWORK'
  | 'INCOMPATIBLE_WALLET'
  | 'NOT_FOUND'
  | 'UNKNOWN'
>;

interface InternalFailure {
  readonly [INTERNAL_FAILURE]: PublicWalletCode;
}

interface DiscoveredWallet {
  readonly option: WalletOption;
  readonly candidate: object;
  readonly connect?: InitialAPI['connect'];
}

type RegistryGetter = () => unknown;

export interface WalletOption {
  readonly id: string;
  readonly name: string;
  readonly apiVersion: string;
  readonly iconUrl?: string;
  readonly compatible: boolean;
  readonly incompatibilityReason?: string;
}

export interface ConnectedWalletSession {
  readonly snapshot: WalletSnapshot;
  readonly connected: ConnectedAPI;
  readonly configuration: Configuration;
}

const PUBLIC_ERRORS: Readonly<Record<PublicWalletCode, PublicClientError>> = Object.freeze({
  WALLET_MISSING: Object.freeze({
    code: 'WALLET_MISSING',
    message: 'No compatible Midnight wallet was found.',
    retryable: false,
  }),
  WALLET_DISCOVERY_FAILED: Object.freeze({
    code: 'WALLET_DISCOVERY_FAILED',
    message: 'Wallet discovery could not be completed in this browser.',
    retryable: true,
  }),
  WALLET_LOCKED: Object.freeze({
    code: 'WALLET_LOCKED',
    message: 'The wallet is disconnected or locked. Unlock it and try again.',
    retryable: true,
  }),
  WALLET_REJECTED: Object.freeze({
    code: 'WALLET_REJECTED',
    message: 'The wallet connection request was declined.',
    retryable: true,
  }),
  WRONG_NETWORK: Object.freeze({
    code: 'WRONG_NETWORK',
    message: 'The wallet is connected to a different network. Switch networks and try again.',
    retryable: true,
  }),
  INCOMPATIBLE_WALLET: Object.freeze({
    code: 'INCOMPATIBLE_WALLET',
    message: 'This wallet uses an unsupported connector API version.',
    retryable: false,
  }),
  NOT_FOUND: Object.freeze({
    code: 'NOT_FOUND',
    message: 'The selected wallet is no longer available. Refresh the wallet list.',
    retryable: true,
  }),
  UNKNOWN: Object.freeze({
    code: 'UNKNOWN',
    message: 'The wallet could not be connected. Try again.',
    retryable: true,
  }),
});

function failure(code: PublicWalletCode): InternalFailure {
  return { [INTERNAL_FAILURE]: code };
}

function safeProperty(value: unknown, property: PropertyKey): unknown {
  if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return undefined;

  try {
    return Reflect.get(value, property);
  } catch {
    return undefined;
  }
}

function safeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;

  let normalized: string;
  try {
    // Normalize only a bounded prefix so hostile metadata cannot force work over
    // an arbitrarily large injected string.
    normalized = value.slice(0, maxLength * 4).normalize('NFKC');
  } catch {
    return fallback;
  }

  const cleaned = normalized.replace(UNSAFE_TEXT, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return Array.from(cleaned).slice(0, maxLength).join('');
}

function safeApiVersion(value: unknown): { display: string; version?: string } {
  if (typeof value !== 'string' || value.length > MAX_VERSION_LENGTH || UNSAFE_TEXT.test(value)) {
    UNSAFE_TEXT.lastIndex = 0;
    return { display: 'unknown' };
  }
  UNSAFE_TEXT.lastIndex = 0;

  const display = safeText(value, 'unknown', MAX_VERSION_LENGTH);
  const normalizedVersion = valid(value);
  if (display !== value || normalizedVersion === null || normalizedVersion !== value) return { display };
  return { display, version: value };
}

function safeIconUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ICON_LENGTH) return undefined;
  return SAFE_DATA_ICON.test(value) ? value : undefined;
}

function isRecordLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function safeEndpoint(value: unknown, protocol: 'https:' | 'wss:'): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ENDPOINT_LENGTH) return undefined;

  try {
    const endpoint = new URL(value);
    if (
      endpoint.protocol !== protocol ||
      !endpoint.hostname ||
      endpoint.username ||
      endpoint.password
    ) {
      return undefined;
    }
    return endpoint.toString();
  } catch {
    return undefined;
  }
}

function safeConfiguration(value: unknown, networkId: NetworkId): Configuration | undefined {
  if (!isRecordLike(value) || safeProperty(value, 'networkId') !== networkId) return undefined;

  const indexerUri = safeEndpoint(safeProperty(value, 'indexerUri'), 'https:');
  const indexerWsUri = safeEndpoint(safeProperty(value, 'indexerWsUri'), 'wss:');
  const substrateNodeUri = safeEndpoint(safeProperty(value, 'substrateNodeUri'), 'wss:');
  if (!indexerUri || !indexerWsUri || !substrateNodeUri) return undefined;

  const proverValue = safeProperty(value, 'proverServerUri');
  const proverServerUri = proverValue === undefined ? undefined : safeEndpoint(proverValue, 'https:');
  if (proverValue !== undefined && !proverServerUri) return undefined;

  return {
    indexerUri,
    indexerWsUri,
    substrateNodeUri,
    networkId,
    ...(proverServerUri ? { proverServerUri } : {}),
  };
}

function codeFromKnownPublicError(error: unknown): PublicWalletCode | undefined {
  const code = safeProperty(error, 'code');
  return typeof code === 'string' && Object.hasOwn(PUBLIC_ERRORS, code) ? (code as PublicWalletCode) : undefined;
}

/**
 * Convert wallet-controlled failures into fixed public copy. Raw wallet messages,
 * reasons, configuration, and stack traces never cross this boundary.
 */
export function toPublicWalletError(error: unknown): PublicClientError {
  const internalCode = safeProperty(error, INTERNAL_FAILURE);
  if (typeof internalCode === 'string' && Object.hasOwn(PUBLIC_ERRORS, internalCode)) {
    return { ...PUBLIC_ERRORS[internalCode as PublicWalletCode] };
  }

  const knownPublicCode = codeFromKnownPublicError(error);
  if (knownPublicCode) return { ...PUBLIC_ERRORS[knownPublicCode] };

  if (safeProperty(error, 'type') === 'DAppConnectorAPIError') {
    switch (safeProperty(error, 'code')) {
      case 'Rejected':
      case 'PermissionRejected':
        return { ...PUBLIC_ERRORS.WALLET_REJECTED };
      case 'Disconnected':
        return { ...PUBLIC_ERRORS.UNKNOWN };
      case 'InvalidRequest':
      case 'InternalError':
      default:
        return { ...PUBLIC_ERRORS.UNKNOWN };
    }
  }

  return { ...PUBLIC_ERRORS.UNKNOWN };
}

function defaultRegistryGetter(): unknown {
  if (typeof window === 'undefined') return undefined;
  return window.midnight;
}

export class MidnightWalletConnector {
  readonly #registryGetter: RegistryGetter;
  readonly #wallets = new Map<string, DiscoveredWallet>();
  #nextId = 1;

  constructor(registryGetter: RegistryGetter = defaultRegistryGetter) {
    this.#registryGetter = registryGetter;
  }

  discover(): WalletOption[] {
    this.#wallets.clear();

    let registry: unknown;
    try {
      registry = this.#registryGetter();
    } catch {
      throw toPublicWalletError(failure('WALLET_DISCOVERY_FAILED'));
    }

    if (!isRecordLike(registry)) return [];

    let candidates: unknown[];
    try {
      candidates = Object.values(registry);
    } catch {
      throw toPublicWalletError(failure('WALLET_DISCOVERY_FAILED'));
    }

    const options: WalletOption[] = [];
    for (const candidate of candidates) {
      if (!isRecordLike(candidate)) continue;

      const id = `wallet-${this.#nextId++}`;
      const name = safeText(safeProperty(candidate, 'name'), `Midnight wallet ${options.length + 1}`, MAX_NAME_LENGTH);
      const { display: apiVersion, version } = safeApiVersion(safeProperty(candidate, 'apiVersion'));
      const iconUrl = safeIconUrl(safeProperty(candidate, 'icon'));
      const connectValue = safeProperty(candidate, 'connect');
      const connect = typeof connectValue === 'function' ? (connectValue as InitialAPI['connect']) : undefined;
      const versionCompatible = version !== undefined && satisfies(version, SUPPORTED_CONNECTOR_RANGE);
      const compatible = versionCompatible && connect !== undefined;
      const incompatibilityReason = compatible
        ? undefined
        : versionCompatible
          ? 'This wallet connector is unavailable.'
          : 'This wallet uses an unsupported connector API version.';

      const option: WalletOption = {
        id,
        name,
        apiVersion,
        ...(iconUrl ? { iconUrl } : {}),
        compatible,
        ...(incompatibilityReason ? { incompatibilityReason } : {}),
      };

      this.#wallets.set(id, { option, candidate, ...(connect ? { connect } : {}) });
      options.push({ ...option });
    }

    return options;
  }

  async #confirmSession(
    connectedValue: unknown,
    networkId: NetworkId,
    walletName: string,
    requestPermissionHint: boolean,
  ): Promise<ConnectedWalletSession> {
    if (!isRecordLike(connectedValue)) throw failure('UNKNOWN');

    const hintUsage = safeProperty(connectedValue, 'hintUsage');
    const getConnectionStatus = safeProperty(connectedValue, 'getConnectionStatus');
    const getConfiguration = safeProperty(connectedValue, 'getConfiguration');
    if (
      (requestPermissionHint && typeof hintUsage !== 'function') ||
      typeof getConnectionStatus !== 'function' ||
      typeof getConfiguration !== 'function'
    ) {
      throw failure('UNKNOWN');
    }

    if (requestPermissionHint) {
      const methods: Array<keyof WalletConnectedAPI> = ['getConnectionStatus', 'getConfiguration'];
      await Reflect.apply(hintUsage as ConnectedAPI['hintUsage'], connectedValue, [methods]);
    }

    const statusBeforeConfiguration = await Reflect.apply(getConnectionStatus, connectedValue, []);
    if (!isRecordLike(statusBeforeConfiguration) || safeProperty(statusBeforeConfiguration, 'status') !== 'connected') {
      throw failure('UNKNOWN');
    }
    if (safeProperty(statusBeforeConfiguration, 'networkId') !== networkId) throw failure('WRONG_NETWORK');

    const rawConfiguration = await Reflect.apply(getConfiguration, connectedValue, []);
    if (!isRecordLike(rawConfiguration) || safeProperty(rawConfiguration, 'networkId') !== networkId) {
      throw failure('WRONG_NETWORK');
    }
    const configuration = safeConfiguration(rawConfiguration, networkId);
    if (!configuration) throw failure('UNKNOWN');

    // Close the race where the wallet disconnects or switches networks while
    // configuration is being read.
    const statusAfterConfiguration = await Reflect.apply(getConnectionStatus, connectedValue, []);
    if (!isRecordLike(statusAfterConfiguration) || safeProperty(statusAfterConfiguration, 'status') !== 'connected') {
      throw failure('UNKNOWN');
    }
    if (safeProperty(statusAfterConfiguration, 'networkId') !== networkId) throw failure('WRONG_NETWORK');

    return {
      snapshot: {
        mode: 'real',
        connectionState: 'connected',
        networkId,
        walletName,
      },
      connected: connectedValue as ConnectedAPI,
      configuration,
    };
  }

  async connect(optionId: string, networkId: NetworkId = DEFAULT_REAL_NETWORK): Promise<ConnectedWalletSession> {
    const selected = this.#wallets.get(optionId);
    if (!selected) throw toPublicWalletError(failure('NOT_FOUND'));
    if (!selected.option.compatible || !selected.connect) {
      throw toPublicWalletError(failure('INCOMPATIBLE_WALLET'));
    }
    if (networkId !== DEFAULT_REAL_NETWORK) throw toPublicWalletError(failure('WRONG_NETWORK'));

    try {
      const connectedValue = await Reflect.apply(selected.connect, selected.candidate, [networkId]);
      return await this.#confirmSession(connectedValue, networkId, selected.option.name, true);
    } catch (error) {
      throw toPublicWalletError(error);
    }
  }

  async revalidate(session: ConnectedWalletSession): Promise<ConnectedWalletSession> {
    if (
      session.snapshot.mode !== 'real' ||
      session.snapshot.connectionState !== 'connected' ||
      session.snapshot.networkId !== DEFAULT_REAL_NETWORK
    ) {
      throw toPublicWalletError(failure('WRONG_NETWORK'));
    }

    try {
      return await this.#confirmSession(
        session.connected,
        DEFAULT_REAL_NETWORK,
        safeText(session.snapshot.walletName, 'Midnight wallet', MAX_NAME_LENGTH),
        false,
      );
    } catch (error) {
      throw toPublicWalletError(error);
    }
  }

  toPublicWalletError(error: unknown): PublicClientError {
    return toPublicWalletError(error);
  }
}
