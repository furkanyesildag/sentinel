/**
 * Onboarding — first-run welcome overlay.
 *
 * Shows the four-step flow once (persisted in localStorage) so new users know
 * what to do. Dismissible and re-openable from the footer "How it works" link.
 */

import { useEffect, useState } from 'react';

const KEY = 'sentinel.onboarded.v1';

const STEPS = [
  { icon: '🔗', title: 'Connect your wallet', body: 'Freighter, xBull or Albedo on Stellar Testnet. Reads need no signature.' },
  { icon: '🎯', title: 'Set a warning threshold', body: 'Pick the health-factor level where you want to be warned. Stored on-chain.' },
  { icon: '🚨', title: 'Check your risk', body: 'The Risk Monitor reads your threshold cross-contract and classifies your position live.' },
  { icon: '🛡️', title: 'Activate protection', body: 'Fund a reserve in the Guardian. If you breach, it releases the reserve to you — non-custodial.' },
];

export function useOnboarding() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  function close() {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  }
  function reopen() { setOpen(true); }
  return { open, close, reopen };
}

export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-fade-up"
        style={{ width: '100%', maxWidth: '460px', background: 'var(--gray-02)', border: '1px solid var(--gray-06)', borderRadius: 'var(--radius)', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#000" /><path d="M9 12l2 2 4-4" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, letterSpacing: '-0.02em' }}>Welcome to Sentinel</h2>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--gray-10)', lineHeight: 1.6 }}>
          A non-custodial risk layer for Blend borrowers. Four steps:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--gray-04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>
                  <span style={{ color: 'var(--gold)', marginRight: '6px' }}>{i + 1}.</span>{s.title}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--gray-09)', lineHeight: 1.5 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={onClose}
          style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--gold)', color: '#000', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
          Get started
        </button>
      </div>
    </div>
  );
}
