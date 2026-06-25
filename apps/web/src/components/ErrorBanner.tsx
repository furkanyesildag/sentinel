/**
 * ErrorBanner — renders a classified {@link AppError} with a kind-specific
 * colour, icon, message and actionable hint. Shared by every flow that can
 * fail (wallet connect, self-payment, contract calls) so the three required
 * error classes — wallet-not-found, user-rejected, insufficient-balance —
 * always look and read the same.
 */

import type { AppError, AppErrorKind } from '@defirisk/core';

const STYLES: Record<AppErrorKind, { bg: string; border: string; text: string; emoji: string }> = {
  'wallet-not-found':     { bg: 'var(--amber-bg)', border: 'rgba(255,178,36,0.3)', text: 'var(--amber)',  emoji: '🔌' },
  'user-rejected':        { bg: 'var(--gray-04)',  border: 'var(--gray-06)',       text: 'var(--gray-11)', emoji: '✋' },
  'insufficient-balance': { bg: 'var(--amber-bg)', border: 'rgba(255,178,36,0.3)', text: 'var(--amber)',  emoji: '💸' },
  network:                { bg: 'var(--red-bg)',   border: 'rgba(229,72,77,0.3)',  text: 'var(--red-hi)',  emoji: '📡' },
  unknown:                { bg: 'var(--red-bg)',   border: 'rgba(229,72,77,0.3)',  text: 'var(--red-hi)',  emoji: '⚠️' },
};

export function ErrorBanner({ error, onDismiss }: { error: AppError; onDismiss?: () => void }) {
  const s = STYLES[error.kind];
  return (
    <div
      className="animate-fade-in"
      style={{
        marginTop: '16px',
        padding: '14px 16px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '18px', lineHeight: 1.2, flexShrink: 0 }}>{s.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: s.text }}>
          {error.title}
          <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 600, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {error.kind}
          </span>
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--gray-11)', lineHeight: 1.5 }}>
          {error.message}
        </p>
        {error.hint && (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--gray-09)', lineHeight: 1.5 }}>
            → {error.hint}
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-08)', padding: '2px', flexShrink: 0, fontSize: '14px', lineHeight: 1 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
