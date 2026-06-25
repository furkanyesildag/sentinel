import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorBanner } from './ErrorBanner';
import { TxStatusPill } from './TxProgress';

afterEach(cleanup);

describe('ErrorBanner', () => {
  it('renders the classified title, message and kind tag', () => {
    render(
      <ErrorBanner
        error={{
          kind: 'user-rejected',
          title: 'Request rejected',
          message: 'You declined the request in your wallet.',
        }}
      />,
    );
    expect(screen.getByText('Request rejected')).toBeTruthy();
    expect(screen.getByText(/declined the request/i)).toBeTruthy();
    expect(screen.getByText('user-rejected')).toBeTruthy();
  });

  it('shows the actionable hint when provided', () => {
    render(
      <ErrorBanner
        error={{
          kind: 'insufficient-balance',
          title: 'Insufficient balance',
          message: 'The account is unfunded.',
          hint: 'Fund the account with Friendbot.',
        }}
      />,
    );
    expect(screen.getByText(/Friendbot/)).toBeTruthy();
  });
});

describe('TxStatusPill', () => {
  it('renders a label for each transaction phase', () => {
    const { rerender } = render(<TxStatusPill phase="pending" />);
    expect(screen.getByText(/Pending/)).toBeTruthy();

    rerender(<TxStatusPill phase="success" />);
    expect(screen.getByText(/Success/)).toBeTruthy();

    rerender(<TxStatusPill phase="failed" />);
    expect(screen.getByText(/Failed/)).toBeTruthy();
  });
});
