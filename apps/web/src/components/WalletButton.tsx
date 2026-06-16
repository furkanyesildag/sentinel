import { useState } from 'react';
import { useWallet, truncateAddress } from '../wallet/WalletProvider';

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();
  const [hoverDisc, setHoverDisc] = useState(false);

  if (!address) {
    return (
      <button
        type="button"
        onClick={() => void connect()}
        disabled={connecting}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '10px 22px',
          background: connecting ? 'var(--gray-05)' : 'var(--gold)',
          color: connecting ? 'var(--gray-11)' : '#000',
          border: 'none', borderRadius: 'var(--radius-sm)',
          font: '600 14px/1 var(--ff)',
          cursor: connecting ? 'not-allowed' : 'pointer',
          transition: 'background 120ms, transform 120ms',
          letterSpacing: '0.01em',
          boxShadow: connecting ? 'none' : '0 0 20px rgba(253,218,36,0.2)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => { if (!connecting) { e.currentTarget.style.background = 'var(--gold-hi)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
        onMouseLeave={(e) => { e.currentTarget.style.background = connecting ? 'var(--gray-05)' : 'var(--gold)'; e.currentTarget.style.transform = 'none'; }}
      >
        {connecting ? (
          <><SpinIcon />Connecting…</>
        ) : (
          <><WalletIcon />Connect Wallet</>
        )}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* Address chip */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px',
        background: 'var(--gray-03)',
        border: '1px solid var(--gray-06)',
        borderRadius: 'var(--radius-sm)',
        font: '500 13px/1 var(--mono)',
        color: 'var(--gray-12)',
        cursor: 'default',
        userSelect: 'none',
      }}>
        {/* Pulsing connected dot */}
        <span style={{ position: 'relative', width: '8px', height: '8px', flexShrink: 0 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--mint)', animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.5 }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--mint)' }} />
        </span>
        {truncateAddress(address)}
      </div>

      {/* Disconnect */}
      <button
        type="button"
        onClick={() => void disconnect()}
        onMouseEnter={() => setHoverDisc(true)}
        onMouseLeave={() => setHoverDisc(false)}
        title="Disconnect"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '36px', height: '36px',
          background: hoverDisc ? 'var(--red-bg)' : 'var(--gray-03)',
          border: `1px solid ${hoverDisc ? 'var(--red)' : 'var(--gray-06)'}`,
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          transition: 'all 120ms',
          color: hoverDisc ? 'var(--red-hi)' : 'var(--gray-09)',
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z" />
      <circle cx="17" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
