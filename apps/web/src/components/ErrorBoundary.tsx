/**
 * ErrorBoundary — last line of defence for the UI.
 *
 * Catches render-time exceptions anywhere in the tree and shows a recoverable
 * fallback instead of a blank white screen — a basic production-readiness
 * practice. Async / event errors are handled closer to their source via
 * classifyError + ErrorBanner; this only catches synchronous render crashes.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In a real deployment this is where you would forward to Sentry/Logflare.
    console.error('[Sentinel] render error:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ minHeight: '100svh', background: 'var(--gray-01)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '440px', width: '100%', background: 'var(--gray-02)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius)', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡️</div>
          <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>Something broke</h1>
          <p style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--gray-10)', lineHeight: 1.6 }}>
            Sentinel hit an unexpected error and stopped rendering this view. Your funds and on-chain data are untouched — nothing here is custodial.
          </p>
          <p style={{ margin: '0 0 24px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--red-hi)', wordBreak: 'break-word' }}>
            {error.message}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.reset}
              style={{ padding: '11px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--gold)', color: '#000', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: '11px 22px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--gray-10)', border: '1px solid var(--gray-06)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
