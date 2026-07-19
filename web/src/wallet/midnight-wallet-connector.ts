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
export const WALLET_DIAGNOSTIC_EVENT = 'latch:wallet-diagnostic' as const;

const MAX_NAME_LENGTH = 80;
const MAX_VERSION_LENGTH = 32;
const MAX_ICON_LENGTH = 128 * 1024;
const MAX_ENDPOINT_LENGTH = 2_048;
const DEFAULT_AUTHORIZATION_TIMEOUT_MS = 30_000;
const DEFAULT_READINESS_TIMEOUT_MS = 3_000;
const DEFAULT_POLL_INTERVAL_MS = 150;
const DEFAULT_PROBE_TIMEOUT_MS = 2_000;
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;
const SAFE_DATA_ICON = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+={0,2})$/i;
const INTERNAL_FAILURE = Symbol('latch-wallet-connector-failure');

export type PublicWalletCode = Extract<
  PublicClientError['code'],
  | 'WALLET_MISSING'
  | 'WALLET_DISCOVERY_FAILED'
  | 'WALLET_LOCKED'
  | 'USER_REJECTED'
  | 'WRONG_NETWORK'
  | 'AUTHORIZATION_TIMEOUT'
  | 'PROVIDER_DISAPPEARED'
  | 'CONNECTOR_ERROR'
  | 'INCOMPATIBLE_WALLET'
>;

export type PublicWalletError = PublicClientError & { readonly code: PublicWalletCode };

export type WalletDiagnosticStage =
  | 'discovery'
  | 'provider_selection'
  | 'authorization_check'
  | 'authorization_request'
  | 'api_resolution'
  | 'network_validation'
  | 'provider_invalidation'
  | 'react_state';

export interface WalletDiagnosticEvent {
  readonly stage: WalletDiagnosticStage;
  readonly status: 'started' | 'succeeded' | 'retrying' | 'failed' | 'invalidated';
  readonly providerId?: string;
  readonly networkId?: typeof DEFAULT_REAL_NETWORK;
  readonly authorization?: 'existing' | 'requested' | 'connector_managed';
  readonly attempt?: number;
  readonly providerCount?: number;
  readonly errorCode?: PublicWalletCode;
  readonly reactState?: 'connecting' | 'connected' | 'error' | 'disconnected';
}

export type WalletDiagnosticSink = (event: Readonly<WalletDiagnosticEvent>) => void;

export interface WalletConnectorOptions {
  readonly diagnosticSink?: WalletDiagnosticSink;
  readonly authorizationTimeoutMs?: number;
  readonly readinessTimeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly probeTimeoutMs?: number;
}

interface InternalFailure {
  readonly [INTERNAL_FAILURE]: PublicWalletCode;
}

type IsEnabledMethod = () => boolean | Promise<boolean>;
type EnableMethod = () => unknown | Promise<unknown>;

interface DiscoveredWallet {
  readonly registryKey: string;
  readonly option: WalletOption;
  readonly candidate: object;
  readonly connect?: InitialAPI['connect'];
  readonly isEnabled?: IsEnabledMethod;
  readonly enable?: EnableMethod;
}

interface ConnectedSessionState {
  readonly api: ConnectedAPI;
  readonly optionId: string;
  readonly registryKey: string;
  readonly candidate: object;
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
  readonly configuration: Configuration;
}

const PUBLIC_ERRORS: Readonly<Record<PublicWalletCode, PublicWalletError>> = Object.freeze({
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
  USER_REJECTED: Object.freeze({
    code: 'USER_REJECTED',
    message: 'The wallet connection request was declined.',
    retryable: true,
  }),
  WRONG_NETWORK: Object.freeze({
    code: 'WRONG_NETWORK',
    message: 'The wallet is connected to a different network. Switch networks and try again.',
    retryable: true,
  }),
  AUTHORIZATION_TIMEOUT: Object.freeze({
    code: 'AUTHORIZATION_TIMEOUT',
    message: 'Wallet authorization did not finish in time. Open the wallet and try again.',
    retryable: true,
  }),
  PROVIDER_DISAPPEARED: Object.freeze({
    code: 'PROVIDER_DISAPPEARED',
    message: 'The selected wallet provider changed or is no longer available. Try connecting again.',
    retryable: true,
  }),
  CONNECTOR_ERROR: Object.freeze({
    code: 'CONNECTOR_ERROR',
    message: 'The wallet connector returned an invalid or unexpected response. Try again.',
    retryable: true,
  }),
  INCOMPATIBLE_WALLET: Object.freeze({
    code: 'INCOMPATIBLE_WALLET',
    message: 'This wallet uses an unsupported connector API version.',
    retryable: false,
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
    if (endpoint.protocol !== protocol || !endpoint.hostname || endpoint.username || endpoint.password) return undefined;
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

/** Convert wallet-controlled failures into fixed public copy without exposing raw details. */
export function toPublicWalletError(error: unknown): PublicWalletError {
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
        return { ...PUBLIC_ERRORS.USER_REJECTED };
      case 'Disconnected':
        return { ...PUBLIC_ERRORS.WALLET_LOCKED };
      case 'InvalidRequest':
      case 'InternalError':
      default:
        return { ...PUBLIC_ERRORS.CONNECTOR_ERROR };
    }
  }

  return { ...PUBLIC_ERRORS.CONNECTOR_ERROR };
}

function defaultRegistryGetter(): unknown {
  if (typeof window === 'undefined') return undefined;
  return window.midnight;
}

function defaultDiagnosticSink(event: Readonly<WalletDiagnosticEvent>): void {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(WALLET_DIAGNOSTIC_EVENT, { detail: Object.freeze({ ...event }) }));
}

function boundedDuration(value: number | undefined, fallback: number, minimum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(value), 30_000));
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withDeadline<T>(promise: Promise<T>, milliseconds: number, timeoutCode: PublicWalletCode): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(failure(timeoutCode)), milliseconds);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

function isConnectedApiCandidate(value: unknown): value is ConnectedAPI {
  return (
    isRecordLike(value) &&
    typeof safeProperty(value, 'getConnectionStatus') === 'function' &&
    typeof safeProperty(value, 'getConfiguration') === 'function'
  );
}

export class MidnightWalletConnector {
  readonly #registryGetter: RegistryGetter;
  readonly #diagnosticSink: WalletDiagnosticSink;
  readonly #authorizationTimeoutMs: number;
  readonly #readinessTimeoutMs: number;
  readonly #pollIntervalMs: number;
  readonly #probeTimeoutMs: number;
  readonly #wallets = new Map<string, DiscoveredWallet>();
  readonly #idsByRegistryKey = new Map<string, string>();
  readonly #connectedSessions = new WeakMap<ConnectedWalletSession, ConnectedSessionState>();
  #nextId = 1;

  constructor(registryGetter: RegistryGetter = defaultRegistryGetter, options: WalletConnectorOptions = {}) {
    this.#registryGetter = registryGetter;
    this.#diagnosticSink = options.diagnosticSink ?? defaultDiagnosticSink;
    this.#authorizationTimeoutMs = boundedDuration(
      options.authorizationTimeoutMs,
      DEFAULT_AUTHORIZATION_TIMEOUT_MS,
      25,
    );
    this.#readinessTimeoutMs = boundedDuration(options.readinessTimeoutMs, DEFAULT_READINESS_TIMEOUT_MS, 25);
    this.#pollIntervalMs = boundedDuration(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, 1);
    this.#probeTimeoutMs = boundedDuration(options.probeTimeoutMs, DEFAULT_PROBE_TIMEOUT_MS, 10);
  }

  #emit(event: WalletDiagnosticEvent): void {
    try {
      this.#diagnosticSink(Object.freeze({ ...event }));
    } catch {
      // Diagnostics are deliberately non-authoritative and must never alter wallet behavior.
    }
  }

  #entries(): Array<[string, unknown]> {
    let registry: unknown;
    try {
      registry = this.#registryGetter();
    } catch {
      throw failure('WALLET_DISCOVERY_FAILED');
    }
    if (!isRecordLike(registry)) return [];

    try {
      return Object.entries(registry);
    } catch {
      throw failure('WALLET_DISCOVERY_FAILED');
    }
  }

  #buildWallet(registryKey: string, candidate: unknown, fallbackIndex: number): DiscoveredWallet | undefined {
    if (!isRecordLike(candidate)) return undefined;

    let id = this.#idsByRegistryKey.get(registryKey);
    if (!id) {
      id = `wallet-${this.#nextId++}`;
      this.#idsByRegistryKey.set(registryKey, id);
    }

    const name = safeText(safeProperty(candidate, 'name'), `Midnight wallet ${fallbackIndex}`, MAX_NAME_LENGTH);
    const { display: apiVersion, version } = safeApiVersion(safeProperty(candidate, 'apiVersion'));
    const iconUrl = safeIconUrl(safeProperty(candidate, 'icon'));
    const connectValue = safeProperty(candidate, 'connect');
    const isEnabledValue = safeProperty(candidate, 'isEnabled');
    const enableValue = safeProperty(candidate, 'enable');
    const connect = typeof connectValue === 'function' ? (connectValue as InitialAPI['connect']) : undefined;
    const isEnabled = typeof isEnabledValue === 'function' ? (isEnabledValue as IsEnabledMethod) : undefined;
    const enable = typeof enableValue === 'function' ? (enableValue as EnableMethod) : undefined;
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

    return {
      registryKey,
      option,
      candidate,
      ...(connect ? { connect } : {}),
      ...(isEnabled ? { isEnabled } : {}),
      ...(enable ? { enable } : {}),
    };
  }

  discover(): WalletOption[] {
    this.#emit({ stage: 'discovery', status: 'started' });
    this.#wallets.clear();

    try {
      const options: WalletOption[] = [];
      for (const [registryKey, candidate] of this.#entries()) {
        const wallet = this.#buildWallet(registryKey, candidate, options.length + 1);
        if (!wallet) continue;
        this.#wallets.set(wallet.option.id, wallet);
        options.push({ ...wallet.option });
      }
      this.#emit({ stage: 'discovery', status: 'succeeded', providerCount: options.length });
      return options;
    } catch (error) {
      const publicError = toPublicWalletError(error);
      this.#emit({ stage: 'discovery', status: 'failed', errorCode: publicError.code });
      throw publicError;
    }
  }

  #freshProvider(optionId: string): DiscoveredWallet {
    this.discover();
    const wallet = this.#wallets.get(optionId);
    if (!wallet) throw failure('PROVIDER_DISAPPEARED');
    return wallet;
  }

  #providerIsCurrent(wallet: DiscoveredWallet): boolean {
    try {
      const current = this.#entries().find(([key]) => key === wallet.registryKey);
      return current !== undefined && current[1] === wallet.candidate;
    } catch {
      return false;
    }
  }

  async #authorize(wallet: DiscoveredWallet, networkId: typeof DEFAULT_REAL_NETWORK): Promise<{
    apiValue?: unknown;
    authorization: WalletDiagnosticEvent['authorization'];
    requestPermissionHint: boolean;
  }> {
    let enabled = false;
    if (wallet.isEnabled) {
      this.#emit({ stage: 'authorization_check', status: 'started', providerId: wallet.option.id, networkId });
      let enabledValue: unknown;
      try {
        const enabledResponse = Reflect.apply(wallet.isEnabled, wallet.candidate, []);
        enabledValue =
          typeof enabledResponse === 'boolean'
            ? enabledResponse
            : await withDeadline(
                Promise.resolve(enabledResponse),
                this.#probeTimeoutMs,
                'AUTHORIZATION_TIMEOUT',
              );
      } catch (error) {
        this.#emit({
          stage: 'authorization_check',
          status: 'failed',
          providerId: wallet.option.id,
          networkId,
          errorCode: toPublicWalletError(error).code,
        });
        throw error;
      }
      if (typeof enabledValue !== 'boolean') throw failure('CONNECTOR_ERROR');
      enabled = enabledValue;
      this.#emit({
        stage: 'authorization_check',
        status: 'succeeded',
        providerId: wallet.option.id,
        networkId,
        authorization: enabled ? 'existing' : 'requested',
      });
    }

    if (enabled && !wallet.enable) {
      return { authorization: 'existing', requestPermissionHint: false };
    }
    if (!wallet.enable) throw failure('CONNECTOR_ERROR');

    const authorization = enabled ? 'existing' : 'requested';
    this.#emit({
      stage: 'authorization_request',
      status: 'started',
      providerId: wallet.option.id,
      networkId,
      authorization,
    });
    let apiValue: unknown;
    try {
      apiValue = await withDeadline(
        Promise.resolve(Reflect.apply(wallet.enable, wallet.candidate, [])),
        this.#authorizationTimeoutMs,
        'AUTHORIZATION_TIMEOUT',
      );
    } catch (error) {
      this.#emit({
        stage: 'authorization_request',
        status: 'failed',
        providerId: wallet.option.id,
        networkId,
        authorization,
        errorCode: toPublicWalletError(error).code,
      });
      throw error;
    }
    this.#emit({
      stage: 'authorization_request',
      status: 'succeeded',
      providerId: wallet.option.id,
      networkId,
      authorization,
    });
    return { apiValue, authorization, requestPermissionHint: false };
  }

  async #resolveApi(
    wallet: DiscoveredWallet,
    networkId: typeof DEFAULT_REAL_NETWORK,
    authorizedValue: unknown,
    authorization: WalletDiagnosticEvent['authorization'],
  ): Promise<ConnectedAPI> {
    this.#emit({
      stage: 'api_resolution',
      status: 'started',
      providerId: wallet.option.id,
      networkId,
      authorization,
    });
    if (isConnectedApiCandidate(authorizedValue)) {
      this.#emit({
        stage: 'api_resolution',
        status: 'succeeded',
        providerId: wallet.option.id,
        networkId,
        authorization,
      });
      return authorizedValue;
    }
    if (!wallet.connect) throw failure('CONNECTOR_ERROR');

    const connectedValue = await withDeadline(
      Promise.resolve(Reflect.apply(wallet.connect, wallet.candidate, [networkId])),
      this.#authorizationTimeoutMs,
      'AUTHORIZATION_TIMEOUT',
    );
    if (!isConnectedApiCandidate(connectedValue)) throw failure('CONNECTOR_ERROR');
    this.#emit({
      stage: 'api_resolution',
      status: 'succeeded',
      providerId: wallet.option.id,
      networkId,
      authorization,
    });
    return connectedValue;
  }

  #startConnectorManagedApi(
    wallet: DiscoveredWallet,
    networkId: typeof DEFAULT_REAL_NETWORK,
  ): Promise<ConnectedAPI> {
    this.#emit({
      stage: 'authorization_check',
      status: 'succeeded',
      providerId: wallet.option.id,
      networkId,
      authorization: 'connector_managed',
    });
    this.#emit({
      stage: 'api_resolution',
      status: 'started',
      providerId: wallet.option.id,
      networkId,
      authorization: 'connector_managed',
    });
    if (!wallet.connect) return Promise.reject(failure('CONNECTOR_ERROR'));

    let connection: Promise<unknown>;
    try {
      // Invoke connect before this method yields so the extension receives the
      // original user activation and can display its authorization UI.
      connection = Promise.resolve(Reflect.apply(wallet.connect, wallet.candidate, [networkId]));
    } catch (error) {
      return Promise.reject(error);
    }

    return withDeadline(connection, this.#authorizationTimeoutMs, 'AUTHORIZATION_TIMEOUT').then((connectedValue) => {
      if (!isConnectedApiCandidate(connectedValue)) throw failure('CONNECTOR_ERROR');
      this.#emit({
        stage: 'api_resolution',
        status: 'succeeded',
        providerId: wallet.option.id,
        networkId,
        authorization: 'connector_managed',
      });
      return connectedValue;
    });
  }

  async #waitForConnectedStatus(
    api: ConnectedAPI,
    wallet: DiscoveredWallet,
    networkId: typeof DEFAULT_REAL_NETWORK,
    allowPolling: boolean,
  ): Promise<void> {
    const getConnectionStatus = safeProperty(api, 'getConnectionStatus');
    if (typeof getConnectionStatus !== 'function') throw failure('CONNECTOR_ERROR');

    const deadline = Date.now() + this.#readinessTimeoutMs;
    let attempt = 0;
    let sawDisconnected = false;
    while (Date.now() <= deadline) {
      attempt += 1;
      if (!this.#providerIsCurrent(wallet)) throw failure('PROVIDER_DISAPPEARED');
      const remaining = Math.max(1, deadline - Date.now());
      const rawStatus = await withDeadline(
        Promise.resolve(Reflect.apply(getConnectionStatus, api, [])),
        Math.min(this.#probeTimeoutMs, remaining),
        'AUTHORIZATION_TIMEOUT',
      );
      if (!isRecordLike(rawStatus)) throw failure('CONNECTOR_ERROR');
      const status = safeProperty(rawStatus, 'status');
      if (status === 'connected') {
        if (safeProperty(rawStatus, 'networkId') !== networkId) throw failure('WRONG_NETWORK');
        return;
      }
      if (status !== 'disconnected') throw failure('CONNECTOR_ERROR');
      if (!allowPolling) throw failure('WALLET_LOCKED');
      sawDisconnected = true;
      if (Date.now() + this.#pollIntervalMs > deadline) break;
      this.#emit({
        stage: 'network_validation',
        status: 'retrying',
        providerId: wallet.option.id,
        networkId,
        attempt,
      });
      await sleep(this.#pollIntervalMs);
    }
    throw failure(sawDisconnected ? 'WALLET_LOCKED' : 'AUTHORIZATION_TIMEOUT');
  }

  async #confirmSession(
    api: ConnectedAPI,
    wallet: DiscoveredWallet,
    networkId: typeof DEFAULT_REAL_NETWORK,
    requestPermissionHint: boolean,
    allowPolling = true,
  ): Promise<ConnectedWalletSession> {
    const hintUsage = safeProperty(api, 'hintUsage');
    const getConnectionStatus = safeProperty(api, 'getConnectionStatus');
    const getConfiguration = safeProperty(api, 'getConfiguration');
    if (
      (requestPermissionHint && typeof hintUsage !== 'function') ||
      typeof getConnectionStatus !== 'function' ||
      typeof getConfiguration !== 'function'
    ) {
      throw failure('CONNECTOR_ERROR');
    }

    if (requestPermissionHint) {
      const methods: Array<keyof WalletConnectedAPI> = ['getConnectionStatus', 'getConfiguration'];
      await withDeadline(
        Promise.resolve(Reflect.apply(hintUsage as ConnectedAPI['hintUsage'], api, [methods])),
        this.#authorizationTimeoutMs,
        'AUTHORIZATION_TIMEOUT',
      );
    }

    this.#emit({
      stage: 'network_validation',
      status: 'started',
      providerId: wallet.option.id,
      networkId,
    });
    await this.#waitForConnectedStatus(api, wallet, networkId, allowPolling);

    const rawConfiguration = await withDeadline(
      Promise.resolve(Reflect.apply(getConfiguration, api, [])),
      this.#probeTimeoutMs,
      'CONNECTOR_ERROR',
    );
    if (isRecordLike(rawConfiguration) && safeProperty(rawConfiguration, 'networkId') !== networkId) {
      throw failure('WRONG_NETWORK');
    }
    const configuration = safeConfiguration(rawConfiguration, networkId);
    if (!configuration) throw failure('CONNECTOR_ERROR');

    await this.#waitForConnectedStatus(api, wallet, networkId, allowPolling);
    const session: ConnectedWalletSession = {
      snapshot: {
        mode: 'real',
        connectionState: 'connected',
        networkId,
        walletName: wallet.option.name,
      },
      configuration,
    };
    this.#connectedSessions.set(session, {
      api,
      optionId: wallet.option.id,
      registryKey: wallet.registryKey,
      candidate: wallet.candidate,
    });
    this.#emit({
      stage: 'network_validation',
      status: 'succeeded',
      providerId: wallet.option.id,
      networkId,
    });
    return session;
  }

  #invalidate(session: ConnectedWalletSession, errorCode: PublicWalletCode): void {
    const state = this.#connectedSessions.get(session);
    this.#connectedSessions.delete(session);
    if (!state) return;
    this.#wallets.delete(state.optionId);
    this.#emit({
      stage: 'provider_invalidation',
      status: 'invalidated',
      providerId: state.optionId,
      networkId: DEFAULT_REAL_NETWORK,
      errorCode,
    });
  }

  async connect(optionId: string, networkId: NetworkId = DEFAULT_REAL_NETWORK): Promise<ConnectedWalletSession> {
    if (networkId !== DEFAULT_REAL_NETWORK) throw toPublicWalletError(failure('WRONG_NETWORK'));
    this.#emit({ stage: 'provider_selection', status: 'started', providerId: optionId, networkId });

    let wallet: DiscoveredWallet | undefined;
    let failureStage: WalletDiagnosticStage = 'provider_selection';
    try {
      wallet = this.#freshProvider(optionId);
      if (!wallet.option.compatible || !wallet.connect) throw failure('INCOMPATIBLE_WALLET');
      this.#emit({ stage: 'provider_selection', status: 'succeeded', providerId: optionId, networkId });
      const connectorManaged = !wallet.enable && !wallet.isEnabled;
      failureStage = connectorManaged ? 'api_resolution' : 'authorization_check';
      const connectorManagedApi = connectorManaged ? this.#startConnectorManagedApi(wallet, networkId) : undefined;
      const authorization = connectorManaged
        ? { authorization: 'connector_managed' as const, requestPermissionHint: true }
        : await this.#authorize(wallet, networkId);
      if (!connectorManaged && !this.#providerIsCurrent(wallet)) throw failure('PROVIDER_DISAPPEARED');
      failureStage = 'api_resolution';
      const api = connectorManagedApi
        ? await connectorManagedApi
        : await this.#resolveApi(wallet, networkId, authorization.apiValue, authorization.authorization);
      if (!this.#providerIsCurrent(wallet)) throw failure('PROVIDER_DISAPPEARED');
      failureStage = 'network_validation';
      return await this.#confirmSession(api, wallet, networkId, authorization.requestPermissionHint);
    } catch (error) {
      const publicError = toPublicWalletError(error);
      this.#emit({
        stage: failureStage,
        status: 'failed',
        providerId: optionId,
        networkId,
        errorCode: publicError.code,
      });
      throw publicError;
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

    const state = this.#connectedSessions.get(session);
    if (!state) throw toPublicWalletError(failure('PROVIDER_DISAPPEARED'));
    const wallet: DiscoveredWallet = {
      registryKey: state.registryKey,
      option: {
        id: state.optionId,
        name: safeText(session.snapshot.walletName, 'Midnight wallet', MAX_NAME_LENGTH),
        apiVersion: '4.0.1',
        compatible: true,
      },
      candidate: state.candidate,
    };

    try {
      if (!this.#providerIsCurrent(wallet)) throw failure('PROVIDER_DISAPPEARED');
      return await this.#confirmSession(state.api, wallet, DEFAULT_REAL_NETWORK, false, false);
    } catch (error) {
      const publicError = toPublicWalletError(error);
      this.#invalidate(session, publicError.code);
      throw publicError;
    }
  }

  reportReactState(
    reactState: NonNullable<WalletDiagnosticEvent['reactState']>,
    errorCode?: PublicWalletCode,
  ): void {
    this.#emit({
      stage: 'react_state',
      status: reactState === 'error' ? 'failed' : 'succeeded',
      networkId: DEFAULT_REAL_NETWORK,
      reactState,
      ...(errorCode ? { errorCode } : {}),
    });
  }

  toPublicWalletError(error: unknown): PublicWalletError {
    return toPublicWalletError(error);
  }
}
