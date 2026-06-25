import { useState } from 'react';
import { WalletButton } from '../components/WalletButton';
import { WalletBalance } from '../components/WalletBalance';
import { PositionPanel } from '../components/PositionPanel';
import { AlertRegistryPanel } from '../components/AlertRegistryPanel';
import { TestTransaction } from '../components/TestTransaction';
import { useWallet } from '../wallet/WalletProvider';

export function DashboardPage() {
  const { address } = useWallet();
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);

  return (
    <div style={{ minHeight: '100svh', background: 'var(--gray-01)', overflowX: 'hidden' }}>

      {/* ── Ambient glow ── */}
      <div style={{ position: 'fixed', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '700px', height: '500px', background: 'radial-gradient(ellipse at 50% 0%, rgba(253,218,36,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto', padding: '0 20px 80px' }}>

        {/* ── Navigation ── */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0', borderBottom: '1px solid var(--gray-04)', marginBottom: address ? '32px' : '0', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SentinelLogo />
            <div>
              <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.03em', display: 'block', lineHeight: 1 }}>
                Sentinel
              </span>
              <span style={{ fontSize: '10px', color: 'var(--gray-09)', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                by DeFi Risk Copilot
              </span>
            </div>
            <NetworkBadge />
          </div>
          <WalletButton />
        </nav>

        {/* ── HERO — only when NOT connected ── */}
        {!address && <HeroSection />}

        {address && (
          <>
            <AddressBar />
            <WalletBalance refreshKey={balanceRefreshKey} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <PositionPanel />
              <AlertRegistryPanel />
              <TestTransaction onConfirmed={() => setBalanceRefreshKey((k) => k + 1)} />
            </div>
          </>
        )}

        {/* ── Footer ── */}
        <footer style={{ marginTop: '56px', paddingTop: '20px', borderTop: '1px solid var(--gray-04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-08)' }}>
            Built on{' '}
            <a href="https://stellar.org" target="_blank" rel="noreferrer"
              style={{ color: 'var(--gold)', fontWeight: 500 }}
              onMouseEnter={(e) => { (e.currentTarget.style.textDecoration = 'underline'); }}
              onMouseLeave={(e) => { (e.currentTarget.style.textDecoration = 'none'); }}
            >Stellar</a>
            {' · '}
            <a href="https://blend.capital" target="_blank" rel="noreferrer"
              style={{ color: 'var(--teal)', fontWeight: 500 }}
              onMouseEnter={(e) => { (e.currentTarget.style.textDecoration = 'underline'); }}
              onMouseLeave={(e) => { (e.currentTarget.style.textDecoration = 'none'); }}
            >Blend Protocol</a>
            {' · '}Non-custodial · Read-only
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-08)' }}>
            Sentinel v0.1 · <span style={{ color: 'var(--gold-lo)' }}>Testnet</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ─── Hero section ─── */
function HeroSection() {
  return (
    <div className="animate-fade-up" style={{ paddingTop: '64px', paddingBottom: '64px', textAlign: 'center' }}>

      {/* Shield icon */}
      <div style={{ display: 'inline-flex', marginBottom: '32px', position: 'relative' }}>
        <div style={{ width: 80, height: 80, borderRadius: '20px', background: 'linear-gradient(135deg, var(--gray-04) 0%, var(--gray-03) 100%)', border: '1px solid var(--gray-06)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(253,218,36,0.1), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(253,218,36,0.15)" stroke="var(--gold)" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {/* Glow */}
        <div style={{ position: 'absolute', inset: '-10px', borderRadius: '30px', background: 'radial-gradient(ellipse, rgba(253,218,36,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      </div>

      {/* Headline */}
      <h1 style={{
        margin: '0 0 16px',
        fontSize: 'clamp(32px, 6vw, 52px)',
        fontWeight: 800,
        letterSpacing: '-0.035em',
        lineHeight: 1.1,
        background: 'linear-gradient(135deg, var(--gray-12) 30%, var(--gold) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        Guard your Blend<br />positions on Stellar.
      </h1>

      {/* Subhead */}
      <p style={{ margin: '0 0 36px', fontSize: '16px', color: 'var(--gray-09)', lineHeight: 1.65, maxWidth: '480px', marginInline: 'auto' }}>
        Sentinel watches your Blend lending positions in real-time and warns you <em style={{ color: 'var(--gray-11)', fontStyle: 'normal', fontWeight: 500 }}>before</em> liquidation hits. Non-custodial. No signing required to read.
      </p>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
        {[
          { icon: '🔐', text: 'Non-custodial' },
          { icon: '👁', text: 'Read-only RPC' },
          { icon: '⚡', text: 'Soroban native' },
          { icon: '🔔', text: 'Alerts coming' },
        ].map((f) => (
          <span key={f.text} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderRadius: '20px', fontSize: '13px', fontWeight: 500, color: 'var(--gray-11)', whiteSpace: 'nowrap' }}>
            {f.icon} {f.text}
          </span>
        ))}
      </div>

      {/* Instruction */}
      <p style={{ fontSize: '13px', color: 'var(--gray-09)', marginBottom: '0' }}>
        ↑ Connect your wallet to get started
      </p>

      {/* Preview cards */}
      <div style={{ marginTop: '60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', textAlign: 'left' }}>
        {PREVIEW_FEATURES.map((f) => (
          <div key={f.title} style={{ padding: '20px', background: 'var(--gray-02)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius)', opacity: f.live ? 1 : 0.55, position: 'relative', overflow: 'hidden' }}>
            {!f.live && (
              <span style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '10px', fontWeight: 700, padding: '2px 7px', background: 'var(--gray-04)', borderRadius: '20px', color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Soon
              </span>
            )}
            <div style={{ fontSize: '22px', marginBottom: '10px' }}>{f.emoji}</div>
            <p style={{ margin: '0 0 5px', fontWeight: 700, fontSize: '14px' }}>{f.title}</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-09)', lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PREVIEW_FEATURES = [
  { emoji: '📊', title: 'Live Positions', desc: 'Collateral, supplied and borrowed amounts read direct from Soroban RPC.', live: true },
  { emoji: '🛡️', title: 'Alert Registry', desc: 'Set liquidation warning thresholds on-chain via a deployed Soroban contract, with live events.', live: true },
  { emoji: '🤖', title: 'AI Risk Copilot', desc: 'Plain-language risk explanations powered by LLM + RAG.', live: false },
  { emoji: '🔔', title: 'Alerts', desc: 'Telegram and email alerts when you approach liquidation.', live: false },
];

/* ─── Address bar ─── */
function AddressBar() {
  const { address } = useWallet();
  if (!address) return null;

  function copyAddress() {
    if (address) void navigator.clipboard.writeText(address);
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', marginBottom: '20px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderLeft: '3px solid var(--gold)', borderRadius: 'var(--radius-sm)', fontSize: '13px', flexWrap: 'wrap' }}>
      <span style={{ position: 'relative', width: '8px', height: '8px', flexShrink: 0 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--mint)', animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.5 }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--mint)' }} />
      </span>
      <span style={{ color: 'var(--gray-09)', fontWeight: 500 }}>Connected</span>
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--gray-12)', flex: 1, wordBreak: 'break-all', minWidth: '100px' }}>{address}</span>
      <button onClick={copyAddress} title="Copy address" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-08)', padding: '2px', display: 'inline-flex', transition: 'color 100ms' }}
        onMouseEnter={(e) => { (e.currentTarget.style.color = 'var(--gray-12)'); }}
        onMouseLeave={(e) => { (e.currentTarget.style.color = 'var(--gray-08)'); }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Primitives ─── */
function NetworkBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', background: 'var(--gray-04)', border: '1px solid var(--gray-06)', borderRadius: '20px', fontSize: '10px', fontWeight: 600, color: 'var(--gray-10)', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} />
      Testnet
    </span>
  );
}

function SentinelLogo() {
  return (
    <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 10px rgba(253,218,36,0.3)' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#000" />
        <path d="M9 12l2 2 4-4" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
