/**
 * ActivityPanel — on-chain analytics + proof of real user interactions.
 *
 * Reads events from all three Sentinel contracts and shows network-wide stats:
 * unique wallets, transactions, and a recent activity feed. The unique-wallet
 * count is verifiable on-chain proof that distinct users have interacted with
 * the product — no off-chain analytics needed.
 */

import { useEffect, useState } from 'react';
import { fetchActivityStats, txExplorerUrl, type ActivityStats } from '@defirisk/core';
import { appConfig } from '../config';
import { truncateAddress } from '../wallet/WalletProvider';

const REFRESH_MS = 30_000;

const CONTRACT_COLORS: Record<string, string> = {
  alert_registry: 'var(--teal)',
  risk_monitor: 'var(--amber)',
  guardian: 'var(--mint)',
};

export function ActivityPanel() {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await fetchActivityStats(appConfig, { limit: 60 });
        if (!cancelled) { setStats(s); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <section style={CARD} className="animate-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, var(--gold) 0%, var(--teal) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2"><path d="M3 3v18h18" /><path d="M18 9l-5 5-3-3-4 4" /></svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>Network Activity</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--gray-09)' }}>Live on-chain usage across all contracts</p>
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--gray-09)', fontWeight: 600 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--mint)' }} /> {loading ? 'Loading…' : 'Live'}
        </span>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '18px' }}>
        <Stat label="Unique wallets" value={stats ? stats.uniqueWallets : '—'} accent />
        <Stat label="Transactions" value={stats ? stats.totalTransactions : '—'} />
        <Stat label="Events" value={stats ? stats.totalEvents : '—'} />
        <Stat label="Protections" value={stats ? stats.protections : '—'} />
      </div>

      {error && !stats && (
        <div style={{ padding: '12px 14px', background: 'var(--gray-03)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--gray-09)' }}>
          Could not reach the network right now. Retrying…
        </div>
      )}

      {/* Recent activity */}
      {stats && stats.recent.length > 0 && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent interactions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
            {stats.recent.map((it) => (
              <div key={`${it.txHash}-${it.label}-${it.ledger}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: CONTRACT_COLORS[it.contract], flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--gray-11)', flexShrink: 0 }}>{it.label}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--gray-09)', fontSize: '12px', flexShrink: 0 }}>{truncateAddress(it.user)}</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--gray-08)', fontFamily: 'var(--mono)', flexShrink: 0 }}>L{it.ledger}</span>
                <a href={txExplorerUrl(appConfig, it.txHash)} target="_blank" rel="noreferrer" style={{ color: 'var(--teal-hi)', display: 'inline-flex', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: accent ? 'var(--gold-bg)' : 'var(--gray-03)', border: `1px solid ${accent ? 'rgba(253,218,36,0.3)' : 'var(--gray-05)'}` }}>
      <p style={{ margin: 0, fontSize: '24px', fontWeight: 800, fontFamily: 'var(--mono)', color: accent ? 'var(--gold)' : 'var(--gray-12)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: '11px', fontWeight: 600, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
    </div>
  );
}

const CARD: React.CSSProperties = { background: 'var(--gray-02)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius)', padding: '24px' };
