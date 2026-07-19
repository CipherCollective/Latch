import type { ConnectedAPI, Configuration, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_REAL_NETWORK,
  MidnightWalletConnector,
  SUPPORTED_CONNECTOR_RANGE,
  WALLET_DIAGNOSTIC_EVENT,
  toPublicWalletError,
  type WalletDiagnosticEvent,
} from './midnight-wallet-connector';

interface ConnectedFixture {
  api: ConnectedAPI;
  hintUsage: ReturnType<typeof vi.fn>;
  getConnectionStatus: ReturnType<typeof vi.fn>;
  getConfiguration: ReturnType<typeof vi.fn>;
  sensitiveCalls: Array<ReturnType<typeof vi.fn>>;
}

const configuration = (networkId = 'preprod'): Configuration => ({
  indexerUri: 'https://indexer.invalid/',
  indexerWsUri: 'wss://indexer.invalid/',
  substrateNodeUri: 'wss://node.invalid/',
  networkId,
});

function connectedFixture({
  status = { status: 'connected' as const, networkId: 'preprod' },
  config = configuration(),
}: {
  status?: { status: 'connected'; networkId: string } | { status: 'disconnected' };
  config?: Configuration;
} = {}): ConnectedFixture {
  const hintUsage = vi.fn().mockResolvedValue(undefined);
  const getConnectionStatus = vi.fn().mockResolvedValue(status);
  const getConfiguration = vi.fn().mockResolvedValue(config);
  const sensitiveCalls = Array.from({ length: 10 }, () => vi.fn().mockRejectedValue(new Error('must not run')));
  const [
    getShieldedBalances,
    getUnshieldedBalances,
    getDustBalance,
    getShieldedAddresses,
    getUnshieldedAddress,
    getDustAddress,
    getTxHistory,
    makeTransfer,
    makeIntent,
    signData,
  ] = sensitiveCalls;

  const api = {
    hintUsage,
    getConnectionStatus,
    getConfiguration,
    getShieldedBalances,
    getUnshieldedBalances,
    getDustBalance,
    getShieldedAddresses,
    getUnshieldedAddress,
    getDustAddress,
    getTxHistory,
    makeTransfer,
    makeIntent,
    signData,
  } as unknown as ConnectedAPI;

  return { api, hintUsage, getConnectionStatus, getConfiguration, sensitiveCalls };
}

function wallet(
  name: string,
  api: ConnectedAPI,
  overrides: Partial<InitialAPI> = {},
): InitialAPI & { connect: ReturnType<typeof vi.fn> } {
  return {
    rdns: 'dev.latch.fixture',
    name,
    icon: '',
    apiVersion: '4.0.1',
    connect: vi.fn().mockResolvedValue(api),
    ...overrides,
  } as InitialAPI & { connect: ReturnType<typeof vi.fn> };
}

const fastPolling = {
  authorizationTimeoutMs: 250,
  readinessTimeoutMs: 250,
  pollIntervalMs: 1,
  probeTimeoutMs: 50,
} as const;

afterEach(() => {
  Reflect.deleteProperty(window, 'midnight');
});

describe('MidnightWalletConnector discovery', () => {
  it('publishes the verified defaults', () => {
    expect(SUPPORTED_CONNECTOR_RANGE).toBe('^4.0.0');
    expect(DEFAULT_REAL_NETWORK).toBe('preprod');
  });

  it('returns an empty list when the injection is missing', () => {
    expect(new MidnightWalletConnector(() => undefined).discover()).toEqual([]);
  });

  it('reports inaccessible injection and enumeration as fixed discovery failures', () => {
    expect(
      () =>
        new MidnightWalletConnector(() => {
          throw new Error('blocked registry with private extension details');
        }).discover(),
    ).toThrow(expect.objectContaining({ code: 'WALLET_DISCOVERY_FAILED' }));

    const hostileRegistry = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('hostile ownKeys');
        },
      },
    );
    expect(() => new MidnightWalletConnector(() => hostileRegistry).discover()).toThrow(
      expect.objectContaining({
        code: 'WALLET_DISCOVERY_FAILED',
        message: 'Wallet discovery could not be completed in this browser.',
      }),
    );
  });

  it('enumerates the injected registry and preserves every wallet/version', () => {
    const firstConnection = connectedFixture();
    const secondConnection = connectedFixture();
    const first = wallet('Nova', firstConnection.api);
    const second = wallet('Nova', secondConnection.api, { apiVersion: '4.1.0' });
    Object.defineProperty(window, 'midnight', {
      configurable: true,
      value: { 'not-a-hardcoded-key': first, 'another-generated-key': second },
    });

    const connector = new MidnightWalletConnector();
    const options = connector.discover();

    expect(options).toHaveLength(2);
    expect(options.map(({ name, apiVersion, compatible }) => ({ name, apiVersion, compatible }))).toEqual([
      { name: 'Nova', apiVersion: '4.0.1', compatible: true },
      { name: 'Nova', apiVersion: '4.1.0', compatible: true },
    ]);
    expect(options[0]?.id).not.toBe(options[1]?.id);
    expect(options[0]?.id).not.toContain('Nova');
    expect(first.connect).not.toHaveBeenCalled();
    expect(second.connect).not.toHaveBeenCalled();
  });

  it('sanitizes malicious metadata, getters, controls, markup, and icon URLs', () => {
    const fixture = connectedFixture();
    const validRaster = `data:image/png;base64,${'a'.repeat(64)}`;
    const name = `${'<script>steal()</script>\u0000\u202e'.repeat(8)}${'x'.repeat(120)}`;
    const safe = wallet(name, fixture.api, { icon: validRaster });
    const javascriptIcon = wallet('Remote icon', fixture.api, { icon: 'javascript:alert(1)' });
    const svgIcon = wallet('SVG icon', fixture.api, {
      icon: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+',
    });
    const remoteIcon = wallet('Tracker', fixture.api, { icon: 'https://tracker.invalid/icon.png' });
    const throwingMetadata = {
      get name() {
        throw new Error('secret wallet state');
      },
      get apiVersion() {
        throw new Error('secret version state');
      },
      get icon() {
        throw new Error('secret icon state');
      },
      get connect() {
        throw new Error('secret connection state');
      },
    };

    const options = new MidnightWalletConnector(() => ({
      safe,
      javascriptIcon,
      svgIcon,
      remoteIcon,
      throwingMetadata,
      nullEntry: null,
    })).discover();

    expect(options).toHaveLength(5);
    expect(options[0]?.name).not.toMatch(/[<>\u0000\u202e]/);
    expect(Array.from(options[0]?.name ?? '')).toHaveLength(80);
    expect(options[0]?.iconUrl).toBe(validRaster);
    expect(options[1]?.iconUrl).toBeUndefined();
    expect(options[2]?.iconUrl).toBeUndefined();
    expect(options[3]?.iconUrl).toBeUndefined();
    expect(options[4]).toMatchObject({
      name: 'Midnight wallet 5',
      apiVersion: 'unknown',
      compatible: false,
    });
  });

  it('distinguishes a compatible API without a callable connector from an unsupported version', () => {
    const fixture = connectedFixture();
    const unavailable = wallet('Unavailable', fixture.api, { connect: undefined as never });
    const [option] = new MidnightWalletConnector(() => ({ unavailable })).discover();

    expect(option).toMatchObject({
      apiVersion: '4.0.1',
      compatible: false,
      incompatibilityReason: 'This wallet connector is unavailable.',
    });
  });

  it.each([
    ['3.9.9', false],
    ['5.0.0', false],
    ['4', false],
    ['v4.0.1', false],
    ['4.0.1-beta.1', false],
    ['4.0.1\u0000', false],
    ['4.0.0', true],
    ['4.9.12', true],
  ])('marks connector version %s compatibility as %s', (apiVersion, compatible) => {
    const fixture = connectedFixture();
    const option = new MidnightWalletConnector(() => ({ wallet: wallet('Versioned', fixture.api, { apiVersion }) }))
      .discover()
      .at(0);

    expect(option?.compatible).toBe(compatible);
    expect(Boolean(option?.incompatibilityReason)).toBe(!compatible);
  });
});

describe('MidnightWalletConnector connection', () => {
  it('connects only the explicitly selected compatible wallet', async () => {
    const firstFixture = connectedFixture();
    const secondFixture = connectedFixture();
    const first = wallet('First', firstFixture.api);
    const second = wallet('Second', secondFixture.api);
    const connector = new MidnightWalletConnector(() => ({ first, second }));
    const options = connector.discover();

    const session = await connector.connect(options[1]!.id);

    expect(first.connect).not.toHaveBeenCalled();
    expect(second.connect).toHaveBeenCalledOnce();
    expect(second.connect).toHaveBeenCalledWith('preprod');
    expect(session.snapshot).toEqual({
      mode: 'real',
      connectionState: 'connected',
      networkId: 'preprod',
      walletName: 'Second',
    });
    expect(session).not.toHaveProperty('connected');
    expect(session.configuration).toEqual(configuration());
    expect(session.snapshot.unshieldedAddress).toBeUndefined();
  });

  it('remains pending while the wallet prompt is pending and probes only after approval', async () => {
    const fixture = connectedFixture();
    let approve!: (api: ConnectedAPI) => void;
    const pendingConnection = new Promise<ConnectedAPI>((resolve) => {
      approve = resolve;
    });
    const injected = wallet('Pending', fixture.api, { connect: vi.fn(() => pendingConnection) });
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();
    let settled = false;

    const result = connector.connect(option!.id).finally(() => {
      settled = true;
    });

    // The Connector API call must occur before the async flow yields so Lace
    // receives the browser's original user activation and can open its prompt.
    expect(injected.connect).toHaveBeenCalledOnce();
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(fixture.hintUsage).not.toHaveBeenCalled();
    expect(fixture.getConnectionStatus).not.toHaveBeenCalled();
    expect(fixture.getConfiguration).not.toHaveBeenCalled();

    approve(fixture.api);
    await result;
    expect(settled).toBe(true);
  });

  it('hints and calls only connection status and configuration', async () => {
    const fixture = connectedFixture();
    const injected = wallet('Least authority', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    await connector.connect(option!.id);

    expect(fixture.hintUsage).toHaveBeenCalledOnce();
    expect(fixture.hintUsage).toHaveBeenCalledWith(['getConnectionStatus', 'getConfiguration']);
    expect(fixture.getConnectionStatus).toHaveBeenCalledTimes(2);
    expect(fixture.getConfiguration).toHaveBeenCalledOnce();
    for (const call of fixture.sensitiveCalls) expect(call).not.toHaveBeenCalled();
  });

  it('emits fixed-schema browser diagnostics without wallet-controlled private data', async () => {
    const fixture = connectedFixture();
    const privateValue = 'mn_private_wallet_value_must_not_be_logged';
    const injected = Object.assign(wallet('Diagnostic wallet', fixture.api), { privateValue });
    const events: WalletDiagnosticEvent[] = [];
    const listener = (event: Event) => events.push((event as CustomEvent<WalletDiagnosticEvent>).detail);
    window.addEventListener(WALLET_DIAGNOSTIC_EVENT, listener);

    try {
      const connector = new MidnightWalletConnector(() => ({ lace: injected }));
      const [option] = connector.discover();
      await connector.connect(option!.id);
      connector.reportReactState('connected');
    } finally {
      window.removeEventListener(WALLET_DIAGNOSTIC_EVENT, listener);
    }

    expect(events.map((event) => event.stage)).toEqual(
      expect.arrayContaining([
        'discovery',
        'provider_selection',
        'authorization_check',
        'api_resolution',
        'network_validation',
        'react_state',
      ]),
    );
    expect(JSON.stringify(events)).not.toContain(privateValue);
    const allowedKeys = new Set([
      'stage',
      'status',
      'providerId',
      'networkId',
      'authorization',
      'attempt',
      'providerCount',
      'errorCode',
      'reactState',
    ]);
    for (const event of events) {
      expect(Object.keys(event).every((key) => allowedKeys.has(key))).toBe(true);
    }
  });

  it('preserves each wallet method receiver without exposing extra authority', async () => {
    const receivers: unknown[] = [];
    let api!: ConnectedAPI;
    const hintUsage = vi.fn(function (this: unknown) {
      receivers.push(this);
      return Promise.resolve();
    });
    const getConnectionStatus = vi.fn(function (this: unknown) {
      receivers.push(this);
      return Promise.resolve({ status: 'connected' as const, networkId: 'preprod' });
    });
    const getConfiguration = vi.fn(function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(configuration());
    });
    api = { hintUsage, getConnectionStatus, getConfiguration } as unknown as ConnectedAPI;
    let injected!: InitialAPI & { connect: ReturnType<typeof vi.fn> };
    const connect = vi.fn(function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(api);
    });
    injected = wallet('Receiver safe', api, { connect });
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    await connector.connect(option!.id);

    expect(receivers).toEqual([injected, api, api, api, api]);
  });

  it('rejects incompatible and stale selections without calling a wallet', async () => {
    const fixture = connectedFixture();
    const injected = wallet('Old', fixture.api, { apiVersion: '3.0.0' });
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    await expect(connector.connect(option!.id)).rejects.toMatchObject({ code: 'INCOMPATIBLE_WALLET' });
    await expect(connector.connect('wallet-from-an-old-discovery')).rejects.toMatchObject({
      code: 'PROVIDER_DISAPPEARED',
    });
    expect(injected.connect).not.toHaveBeenCalled();
  });

  it('maps a rejected wallet prompt without exposing its reason', async () => {
    const fixture = connectedFixture();
    const rawSecret = 'private rejection details: account 42';
    const injected = wallet('Rejecting', fixture.api, {
      connect: vi.fn().mockRejectedValue({
        type: 'DAppConnectorAPIError',
        code: 'Rejected',
        reason: rawSecret,
        message: rawSecret,
      }),
    });
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    await expect(connector.connect(option!.id)).rejects.toEqual({
      code: 'USER_REJECTED',
      message: 'The wallet connection request was declined.',
      retryable: true,
    });

    const mapped = toPublicWalletError({ code: 'USER_REJECTED', message: rawSecret, retryable: false });
    expect(JSON.stringify(mapped)).not.toContain(rawSecret);
    expect(mapped).toEqual({
      code: 'USER_REJECTED',
      message: 'The wallet connection request was declined.',
      retryable: true,
    });
  });

  it('reports a wallet that remains disconnected as locked after a bounded poll', async () => {
    const fixture = connectedFixture({ status: { status: 'disconnected' } });
    const injected = wallet('Locked', fixture.api);
    const connector = new MidnightWalletConnector(
      () => ({ injected }),
      fastPolling,
    );
    const [option] = connector.discover();

    await expect(connector.connect(option!.id)).rejects.toMatchObject({
      code: 'WALLET_LOCKED',
      retryable: true,
    });
    expect(fixture.getConfiguration).not.toHaveBeenCalled();
  });

  it('rejects a status network mismatch', async () => {
    const fixture = connectedFixture({ status: { status: 'connected', networkId: 'preview' } });
    const injected = wallet('Wrong status', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    await expect(connector.connect(option!.id, 'preprod')).rejects.toMatchObject({ code: 'WRONG_NETWORK' });
    expect(fixture.getConfiguration).not.toHaveBeenCalled();
  });

  it('rejects a configuration network mismatch after status validation', async () => {
    const fixture = connectedFixture({ config: configuration('preview') });
    const injected = wallet('Wrong config', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    await expect(connector.connect(option!.id, 'preprod')).rejects.toMatchObject({
      code: 'WRONG_NETWORK',
      message: 'The wallet is connected to a different network. Switch networks and try again.',
    });
    expect(fixture.getConfiguration).toHaveBeenCalledOnce();
  });

  it('rejects when the wallet switches networks while configuration is being read', async () => {
    const fixture = connectedFixture();
    fixture.getConnectionStatus
      .mockResolvedValueOnce({ status: 'connected', networkId: 'preprod' })
      .mockResolvedValueOnce({ status: 'connected', networkId: 'preview' });
    const injected = wallet('Switching', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    await expect(connector.connect(option!.id)).rejects.toMatchObject({ code: 'WRONG_NETWORK' });
    expect(fixture.getConfiguration).toHaveBeenCalledOnce();
  });

  it('copies a validated configuration instead of exposing the wallet-controlled object', async () => {
    const rawConfiguration = configuration();
    const fixture = connectedFixture({ config: rawConfiguration });
    const injected = wallet('Config copy', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    const session = await connector.connect(option!.id);

    expect(session.configuration).toEqual(rawConfiguration);
    expect(session.configuration).not.toBe(rawConfiguration);
  });

  it('fails closed when a wallet configuration endpoint getter throws', async () => {
    const privateReason = 'private provider topology must not leak';
    const hostileConfiguration = new Proxy(configuration(), {
      get(target, property, receiver) {
        if (property === 'indexerUri') throw new Error(privateReason);
        return Reflect.get(target, property, receiver);
      },
    });
    const fixture = connectedFixture({ config: hostileConfiguration });
    const injected = wallet('Getter safe', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    let caught: unknown;
    try {
      await connector.connect(option!.id);
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual({
      code: 'CONNECTOR_ERROR',
      message: 'The wallet connector returned an invalid or unexpected response. Try again.',
      retryable: true,
    });
    expect(JSON.stringify(caught)).not.toContain(privateReason);
  });

  it('revalidates a connected session without requesting additional permissions', async () => {
    const fixture = connectedFixture();
    const injected = wallet('Still connected', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();
    const session = await connector.connect(option!.id);
    fixture.hintUsage.mockClear();
    fixture.getConnectionStatus.mockClear();
    fixture.getConfiguration.mockClear();

    const refreshed = await connector.revalidate(session);

    expect(refreshed.snapshot).toEqual(session.snapshot);
    expect(refreshed.configuration).toEqual(session.configuration);
    expect(fixture.hintUsage).not.toHaveBeenCalled();
    expect(fixture.getConnectionStatus).toHaveBeenCalledTimes(2);
    expect(fixture.getConfiguration).toHaveBeenCalledOnce();
  });

  it.each([
    { ...configuration(), indexerUri: 'http://indexer.invalid' },
    { ...configuration(), indexerWsUri: 'ws://indexer.invalid' },
    { ...configuration(), substrateNodeUri: 'wss://user:secret@node.invalid' },
  ])('rejects unsafe Preprod service configuration without disclosing it', async (unsafeConfig) => {
    const fixture = connectedFixture({ config: unsafeConfig });
    const injected = wallet('Unsafe config', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

    await expect(connector.connect(option!.id)).rejects.toEqual({
      code: 'CONNECTOR_ERROR',
      message: 'The wallet connector returned an invalid or unexpected response. Try again.',
      retryable: true,
    });
  });

  it.each(['demo', 'undeployed', 'preview', 'mainnet'] as const)(
    'rejects unsupported real-wallet target %s before calling the extension',
    async (networkId) => {
    const fixture = connectedFixture();
    const injected = wallet('Network guarded', fixture.api);
    const connector = new MidnightWalletConnector(() => ({ injected }));
    const [option] = connector.discover();

      await expect(connector.connect(option!.id, networkId)).rejects.toMatchObject({ code: 'WRONG_NETWORK' });
    expect(injected.connect).not.toHaveBeenCalled();
    },
  );

  it('reduces hostile and unknown thrown values to fixed safe copy', () => {
    const rawSecret = 'wallet seed words must never appear';
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error(rawSecret);
        },
      },
    );

    const mapped = toPublicWalletError(hostile);
    expect(mapped).toEqual({
      code: 'CONNECTOR_ERROR',
      message: 'The wallet connector returned an invalid or unexpected response. Try again.',
      retryable: true,
    });
    expect(JSON.stringify(mapped)).not.toContain(rawSecret);
  });

  it.each([
    ['Disconnected', 'WALLET_LOCKED'],
    ['InvalidRequest', 'CONNECTOR_ERROR'],
    ['InternalError', 'CONNECTOR_ERROR'],
  ])('maps connector API code %s to fixed %s copy', (code, publicCode) => {
    expect(
      toPublicWalletError({
        type: 'DAppConnectorAPIError',
        code,
        reason: 'private extension reason',
      }),
    ).toMatchObject({ code: publicCode });
  });

  it('authorizes a first-time Lace session from the explicit connection call', async () => {
    const fixture = connectedFixture();
    const injected = Object.assign(wallet('Lace', fixture.api), {
      isEnabled: vi.fn().mockReturnValue(false),
      enable: vi.fn().mockResolvedValue(fixture.api),
    });
    const connector = new MidnightWalletConnector(() => ({ lace: injected }));
    const [option] = connector.discover();

    const connection = connector.connect(option!.id);

    expect(injected.isEnabled).toHaveBeenCalledOnce();
    expect(injected.enable).toHaveBeenCalledOnce();
    await connection;
    expect(injected.connect).not.toHaveBeenCalled();
    expect(fixture.getConnectionStatus).toHaveBeenCalledTimes(2);
  });

  it('retrieves an already-authorized Lace API without requiring the connector prompt path', async () => {
    const fixture = connectedFixture();
    const injected = Object.assign(wallet('Lace', fixture.api), {
      isEnabled: vi.fn().mockResolvedValue(true),
      enable: vi.fn().mockResolvedValue(fixture.api),
    });
    const connector = new MidnightWalletConnector(() => ({ lace: injected }));
    const [option] = connector.discover();

    await connector.connect(option!.id);

    expect(injected.isEnabled).toHaveBeenCalledOnce();
    expect(injected.enable).toHaveBeenCalledOnce();
    expect(injected.connect).not.toHaveBeenCalled();
    expect(fixture.hintUsage).not.toHaveBeenCalled();
  });

  it('maps an authorization rejection to USER_REJECTED without exposing the wallet reason', async () => {
    const fixture = connectedFixture();
    const secret = 'private Lace authorization state';
    const diagnostics: WalletDiagnosticEvent[] = [];
    const injected = Object.assign(wallet('Lace', fixture.api), {
      address: 'mn_addr_private_value_must_not_be_logged',
      isEnabled: vi.fn().mockResolvedValue(false),
      enable: vi.fn().mockRejectedValue({
        type: 'DAppConnectorAPIError',
        code: 'PermissionRejected',
        reason: secret,
      }),
    });
    const connector = new MidnightWalletConnector(
      () => ({ lace: injected }),
      { ...fastPolling, diagnosticSink: (event) => diagnostics.push(event) },
    );
    const [option] = connector.discover();

    let caught: unknown;
    try {
      await connector.connect(option!.id);
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: 'USER_REJECTED' });
    expect(JSON.stringify(caught)).not.toContain(secret);
    expect(JSON.stringify(diagnostics)).not.toContain(secret);
    expect(JSON.stringify(diagnostics)).not.toContain('mn_addr_private_value_must_not_be_logged');
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ stage: 'authorization_request', status: 'failed', errorCode: 'USER_REJECTED' }),
    );
    expect(injected.connect).not.toHaveBeenCalled();
  });

  it('returns AUTHORIZATION_TIMEOUT when a first-time authorization request never settles', async () => {
    const fixture = connectedFixture();
    const injected = Object.assign(wallet('Lace', fixture.api), {
      isEnabled: vi.fn().mockResolvedValue(false),
      enable: vi.fn(() => new Promise<never>(() => undefined)),
    });
    const connector = new MidnightWalletConnector(() => ({ lace: injected }), fastPolling);
    const [option] = connector.discover();

    await expect(connector.connect(option!.id)).rejects.toMatchObject({ code: 'AUTHORIZATION_TIMEOUT' });
    expect(injected.enable).toHaveBeenCalledOnce();
    expect(injected.connect).not.toHaveBeenCalled();
  });

  it('waits through a delayed connected status instead of failing the first probe', async () => {
    const fixture = connectedFixture();
    fixture.getConnectionStatus
      .mockResolvedValueOnce({ status: 'disconnected' })
      .mockResolvedValueOnce({ status: 'disconnected' })
      .mockResolvedValue({ status: 'connected', networkId: 'preprod' });
    const diagnostics: WalletDiagnosticEvent[] = [];
    const injected = wallet('Delayed Lace', fixture.api);
    const connector = new MidnightWalletConnector(
      () => ({ lace: injected }),
      { ...fastPolling, diagnosticSink: (event) => diagnostics.push(event) },
    );
    const [option] = connector.discover();

    await expect(connector.connect(option!.id)).resolves.toMatchObject({
      snapshot: { connectionState: 'connected', networkId: 'preprod' },
    });
    expect(fixture.getConnectionStatus).toHaveBeenCalledTimes(4);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ stage: 'network_validation', status: 'retrying', attempt: 1 }),
    );
  });

  it('invalidates a wrong-network session and reconnects with the provider rediscovered under the same key', async () => {
    const firstFixture = connectedFixture();
    const secondFixture = connectedFixture();
    const firstProvider = wallet('Lace', firstFixture.api);
    const secondProvider = wallet('Lace', secondFixture.api);
    const registry: Record<string, InitialAPI> = { lace: firstProvider };
    const diagnostics: WalletDiagnosticEvent[] = [];
    const connector = new MidnightWalletConnector(
      () => registry,
      { ...fastPolling, diagnosticSink: (event) => diagnostics.push(event) },
    );
    const [option] = connector.discover();
    const firstSession = await connector.connect(option!.id);
    firstFixture.getConnectionStatus.mockResolvedValue({ status: 'connected', networkId: 'preview' });

    await expect(connector.revalidate(firstSession)).rejects.toMatchObject({ code: 'WRONG_NETWORK' });
    registry.lace = secondProvider;
    const secondSession = await connector.connect(option!.id);

    expect(secondSession.snapshot.networkId).toBe('preprod');
    expect(firstProvider.connect).toHaveBeenCalledOnce();
    expect(secondProvider.connect).toHaveBeenCalledOnce();
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        stage: 'provider_invalidation',
        status: 'invalidated',
        errorCode: 'WRONG_NETWORK',
      }),
    );
  });

  it('does not call a stale provider when Lace replaces it after discovery', async () => {
    const staleFixture = connectedFixture();
    const freshFixture = connectedFixture();
    const staleProvider = wallet('Lace', staleFixture.api);
    const freshProvider = wallet('Lace', freshFixture.api);
    const registry: Record<string, InitialAPI> = { lace: staleProvider };
    const connector = new MidnightWalletConnector(() => registry);
    const [option] = connector.discover();
    registry.lace = freshProvider;

    await connector.connect(option!.id);

    expect(staleProvider.connect).not.toHaveBeenCalled();
    expect(freshProvider.connect).toHaveBeenCalledOnce();
  });
});
