import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenView(): never {
  throw new Error('INJECTED_PRIVATE_PROVIDER_DETAIL');
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fixed recovery copy without echoing raw error details or making a disclosure guarantee', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Latch does not show or log raw error details.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('INJECTED_PRIVATE_PROVIDER_DETAIL');
    expect(screen.getByRole('alert')).not.toHaveTextContent('No policy data was displayed or sent');
  });
});
