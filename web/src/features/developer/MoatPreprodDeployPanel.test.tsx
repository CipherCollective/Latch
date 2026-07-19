import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

import type { ConnectedWalletSession } from '../../wallet/midnight-wallet-connector';
import { MoatPreprodDeployPanel } from './MoatPreprodDeployPanel';
import type { MoatDeploymentResult } from './lace-moat-deploy';
import { DeveloperRouteFailure } from './developer-route-diagnostics';

const connectedSession = (networkId = 'preprod'): ConnectedWalletSession =>
  ({
    snapshot: { mode: 'real', connectionState: 'connected', networkId, walletName: 'lace' },
    configuration: { networkId },
  }) as ConnectedWalletSession;

const laceApi = {} as ConnectedAPI;

function deployment(overrides: Partial<MoatDeploymentResult> = {}): MoatDeploymentResult {
  return {
    contractAddress: 'contract-preprod-123',
    txId: 'tx-preprod-456',
    waitForIndexer: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('MoatPreprodDeployPanel', () => {
  it('blocks deployment while Lace is disconnected', () => {
    render(<MoatPreprodDeployPanel session={null} connectedApi={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Connect Lace to Midnight Preprod before deploying.');
    expect(screen.getByRole('button', { name: 'Deploy Moat contract on Preprod' })).toBeDisabled();
  });

  it('blocks deployment on the wrong network', () => {
    const deploy = vi.fn();
    render(<MoatPreprodDeployPanel session={connectedSession('preview')} connectedApi={laceApi} deploy={deploy} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Connect Lace to Midnight Preprod before deploying.');
    expect(screen.getByRole('button', { name: 'Deploy Moat contract on Preprod' })).toBeDisabled();
    expect(deploy).not.toHaveBeenCalled();
  });

  it('shows the returned contract address and transaction id after a successful deployment', async () => {
    const deploy = vi.fn().mockResolvedValue(deployment());
    render(<MoatPreprodDeployPanel session={connectedSession()} connectedApi={laceApi} deploy={deploy} />);

    fireEvent.click(screen.getByRole('button', { name: 'Deploy Moat contract on Preprod' }));

    expect(await screen.findByText('contract-preprod-123')).toBeVisible();
    expect(screen.getByText('tx-preprod-456')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy contract address' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Copy transaction ID' })).toBeEnabled();
  });

  it('prevents duplicate deployment clicks while a request is running', async () => {
    const pending = deferred<MoatDeploymentResult>();
    const deploy = vi.fn().mockReturnValue(pending.promise);
    render(<MoatPreprodDeployPanel session={connectedSession()} connectedApi={laceApi} deploy={deploy} />);

    const button = screen.getByRole('button', { name: 'Deploy Moat contract on Preprod' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(deploy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Deploying Moat contract on Preprod…' })).toBeDisabled();
    pending.resolve(deployment());
    await screen.findByText('contract-preprod-123');
  });

  it('shows a privacy-safe deployment failure diagnostic', async () => {
    const privateValue = 'wallet_payload_must_not_render';
    const deploy = vi.fn().mockRejectedValue(new Error(privateValue));
    render(<MoatPreprodDeployPanel session={connectedSession()} connectedApi={laceApi} deploy={deploy} />);

    fireEvent.click(screen.getByRole('button', { name: 'Deploy Moat contract on Preprod' }));

    expect(await screen.findByText('deployment_submission')).toBeVisible();
    expect(screen.getByText('Error')).toBeVisible();
    expect(document.body).not.toHaveTextContent(privateValue);
  });

  it('identifies provider adapter construction failures without exposing the provider error', async () => {
    const privateValue = 'private_provider_configuration_must_not_render';
    const deploy = vi.fn().mockRejectedValue(
      new DeveloperRouteFailure('provider_adapter_construction', new TypeError(privateValue)),
    );
    render(<MoatPreprodDeployPanel session={connectedSession()} connectedApi={laceApi} deploy={deploy} />);

    fireEvent.click(screen.getByRole('button', { name: 'Deploy Moat contract on Preprod' }));

    expect(await screen.findByText('provider_adapter_construction')).toBeVisible();
    expect(screen.getByText('TypeError')).toBeVisible();
    expect(document.body).not.toHaveTextContent(privateValue);
  });
});
