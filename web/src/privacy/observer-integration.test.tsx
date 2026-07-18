import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { MoatProvider } from '../services/moat-provider';
import { MockMoatClient } from '../services/mock-moat-client';
import { PUBLIC_REJECTION_MESSAGE } from './observer-serializer';

const PRIVATE_TEXT_SENTINELS = [
  'Research procurement',
  'Research Agent A',
  'developer-tools',
  'trading-data',
  'CodeShield security report',
  'CodeShield',
  'codeshield',
  'merchant-codeshield',
  'demo-meta:codeshield',
  'req-codeshield-001',
  'AlphaSignal trading dataset',
  'AlphaSignal',
  'alphasignal',
  'merchant-alphasignal',
  'demo-meta:alphasignal',
  'req-alphasignal-001',
  'demo_dest_',
  'PER_TX_LIMIT',
  'TOTAL_BUDGET',
  'MAX_USES',
  'CATEGORY',
  'REPLAY',
  'REVOKED',
  'UNKNOWN',
] as const;

const PUBLIC_RECEIPT_KEYS = [
  'capabilityId',
  'requestCommitment',
  'receiptCommitment',
  'nullifier',
  'capabilityStatus',
  'proofStatus',
  'verificationStatus',
] as const;

function renderApp(client = new MockMoatClient()) {
  return render(
    <MoatProvider client={client}>
      <App />
    </MoatProvider>,
  );
}

async function createDefaultCapability() {
  fireEvent.click(screen.getByRole('button', { name: /use deterministic demo/i }));
  fireEvent.click(screen.getByRole('button', { name: /commit private capability/i }));
  await screen.findByRole('heading', { name: 'Agent activity console' });
}

function expectObserverDomIsProjectedOnly(html = document.documentElement.outerHTML) {
  for (const value of PRIVATE_TEXT_SENTINELS) expect(html).not.toContain(value);
  expect(screen.queryByText('20 credits')).not.toBeInTheDocument();
  expect(screen.queryByText('50')).not.toBeInTheDocument();
  expect(screen.queryByText('38')).not.toBeInTheDocument();
  expect(screen.queryByText('12 credits')).not.toBeInTheDocument();
  expect(screen.queryByText('30 credits')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /run approved request/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /view structured request/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /revoke capability/i })).not.toBeInTheDocument();
}

describe('observer-mode integration privacy boundary', () => {
  it('unmounts the complete owner tree, including an open structured request dialog', async () => {
    renderApp();
    await createDefaultCapability();

    const inspect = screen.getAllByRole('button', { name: 'View structured request' })[0];
    if (!inspect) throw new Error('Expected an owner request inspection control.');
    fireEvent.click(inspect);
    expect(screen.getByRole('dialog', { name: /codeshield request/i })).toBeVisible();
    expect(document.documentElement.outerHTML).toContain('req-codeshield-001');

    fireEvent.click(screen.getByRole('button', { name: 'Public observer view' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Public observer' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/renders only the public protocol projection/i)).toBeVisible();
    expectObserverDomIsProjectedOnly();
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });

  it('never introduces owner values while delayed proof callbacks update observer mode', async () => {
    renderApp(new MockMoatClient({ stepDelayMs: 18 }));
    await createDefaultCapability();

    fireEvent.click(screen.getByRole('button', { name: 'Run approved request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Public observer view' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Public observer' })).toBeVisible();
    expect(screen.getByText('Fixture evaluation in progress')).toBeVisible();

    const snapshots: string[] = [];
    const observer = new MutationObserver(() => {
      snapshots.push(document.documentElement.outerHTML);
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    await screen.findByRole('heading', { name: 'Authorization receipt' });
    await waitFor(() => expect(screen.getAllByText('Fixture approved').length).toBeGreaterThan(0));
    observer.disconnect();
    snapshots.push(document.documentElement.outerHTML);

    expect(snapshots.length).toBeGreaterThan(1);
    for (const snapshot of snapshots) {
      for (const value of PRIVATE_TEXT_SENTINELS) expect(snapshot).not.toContain(value);
    }
    expectObserverDomIsProjectedOnly();
    expect(screen.getByText(/per-step labels, timing, and failure locations are not included/i)).toBeVisible();
  });

  it('copies only the public receipt allowlist and verifies it without rendering destination data', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderApp();
    await createDefaultCapability();
    fireEvent.click(screen.getByRole('button', { name: 'Run approved request' }));
    await screen.findByRole('heading', { name: 'Private gate passed' });

    const destinationField = screen.getByText('Demo one-time destination fixture').closest('.receipt-field');
    if (!(destinationField instanceof HTMLElement)) throw new Error('Expected the owner destination field.');
    const destination = within(destinationField).getByRole('definition').textContent;
    expect(destination).toMatch(/^demo_dest_/);

    fireEvent.click(screen.getByRole('button', { name: 'Public observer view' }));
    await screen.findByRole('heading', { name: 'Authorization receipt' });
    if (destination) expect(document.documentElement.outerHTML).not.toContain(destination);
    expectObserverDomIsProjectedOnly();

    fireEvent.click(screen.getByRole('button', { name: 'Copy public receipt JSON' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const serialized = writeText.mock.calls[0]?.[0];
    if (typeof serialized !== 'string') throw new Error('Expected serialized observer receipt.');
    const copied = JSON.parse(serialized) as Record<string, unknown>;
    expect(Object.keys(copied)).toEqual(PUBLIC_RECEIPT_KEYS);
    for (const value of PRIVATE_TEXT_SENTINELS) expect(serialized).not.toContain(value);
    if (destination) expect(serialized).not.toContain(destination);

    fireEvent.click(screen.getByRole('button', { name: 'Verify receipt' }));
    await waitFor(() => expect(screen.getAllByText('Verification passed').length).toBeGreaterThan(0));
    expectObserverDomIsProjectedOnly();
  });

  it('renders the same aggregate public rejection without the owner reason or failure step', async () => {
    renderApp();
    await createDefaultCapability();
    fireEvent.click(screen.getByRole('button', { name: 'Run rejected request' }));
    await screen.findByText(/private per-transaction limit/i);

    fireEvent.click(screen.getByRole('button', { name: 'Public observer view' }));

    const rejection = await screen.findByRole('alert');
    expect(rejection).toHaveTextContent(PUBLIC_REJECTION_MESSAGE);
    expect(screen.getAllByText('Fixture rejected').length).toBeGreaterThan(0);
    expect(document.documentElement.outerHTML).not.toContain('per-transaction limit');
    expect(document.documentElement.outerHTML).not.toContain('Evaluating hidden spending constraints');
    expect(document.documentElement.outerHTML).not.toContain('privateReason');
    expectObserverDomIsProjectedOnly();
  });

  it('projects replay as the same generic rejection without a destination or nullifier-step side channel', async () => {
    renderApp();
    await createDefaultCapability();
    fireEvent.click(screen.getByRole('button', { name: 'Run approved request' }));
    await screen.findByRole('heading', { name: 'Private gate passed' });
    fireEvent.click(screen.getByRole('button', { name: 'Replay same authorization' }));
    await screen.findByText(/already consumed and cannot be replayed/i);

    fireEvent.click(screen.getByRole('button', { name: 'Public observer view' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(PUBLIC_REJECTION_MESSAGE);
    expect(document.documentElement.outerHTML).not.toContain('already consumed');
    expect(document.documentElement.outerHTML).not.toContain('Checking nullifier');
    expect(document.documentElement.outerHTML).not.toContain('demo_dest_');
    expect(screen.queryByRole('heading', { name: 'Authorization receipt' })).not.toBeInTheDocument();
    expectObserverDomIsProjectedOnly();
  });

  it('shows only public revoked status after owner confirmation', async () => {
    renderApp();
    await createDefaultCapability();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke capability' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm revoke' }));
    await waitFor(() => expect(screen.getByText('Revoked')).toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: 'Public observer view' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Public observer' })).toBeVisible();
    expect(screen.getByText('Revoked')).toBeVisible();
    expectObserverDomIsProjectedOnly();
  });
});
