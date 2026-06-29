/**
 * FeedbackButton — floating feedback entry point.
 *
 * Opens an embedded feedback form (Tally / Google Form) configured via
 * `VITE_FEEDBACK_URL`. Until a form URL is set it links to GitHub issues so
 * feedback is never a dead end. Required for Level 4 user-feedback collection.
 */

import { useState } from 'react';
import { track } from '../lib/analytics';

const FORM_URL = import.meta.env.VITE_FEEDBACK_URL as string | undefined;
const FALLBACK_URL = 'https://github.com/furkanyesildag/sentinel/issues/new';

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  function openModal() {
    track('feedback_opened');
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        style={{
          position: 'fixed', right: '20px', bottom: '20px', zIndex: 50,
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '12px 18px', borderRadius: '999px',
          background: 'var(--gold)', color: '#000', border: 'none',
          font: '600 14px/1 var(--ff)', cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(253,218,36,0.35)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Feedback
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', background: 'var(--gray-02)', border: '1px solid var(--gray-06)', borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            className="animate-fade-up"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-05)' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '15px' }}>Share feedback</p>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--gray-09)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>✕</button>
            </div>

            {FORM_URL ? (
              <iframe
                title="Feedback form"
                src={FORM_URL}
                style={{ width: '100%', height: '520px', border: 'none', background: '#fff' }}
              />
            ) : (
              <div style={{ padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '16px' }}>We'd love your thoughts</p>
                <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--gray-10)', lineHeight: 1.6 }}>
                  Tried setting a threshold, checking your risk, or running protection? Tell us what worked and what didn't.
                </p>
                <a
                  href={FALLBACK_URL}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-block', padding: '11px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}
                >
                  Open feedback form ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
