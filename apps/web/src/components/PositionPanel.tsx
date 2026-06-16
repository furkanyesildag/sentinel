import { useEffect, useState } from 'react';
import { createNetwork, loadUserPositionDisplay, type UserPositionDisplay, type PoolReserveInfo, type UserPositionLine } from '@defirisk/core';
import { appConfig } from '../config';
import { useWallet } from '../wallet/WalletProvider';

/* ─── formatters ─── */
function fmtAmount(v: number): string {
  if (v === 0) return '—';
  if (v < 0.0001) return v.toExponential(2);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}
function fmtApr(v: number): string { return `${(v * 100).toFixed(2)}%`; }

const ASSET_COLORS: Record<string, { bg: string; text: string }> = {
  XLM:  { bg: '#fdda24', text: '#000' },
  USDC: { bg: '#2775ca', text: '#fff' },
  BLND: { bg: '#05a2c2', text: '#fff' },
  wETH: { bg: '#627eea', text: '#fff' },
  wBTC: { bg: '#f7931a', text: '#fff' },
};
function assetColor(sym: string) {
  return ASSET_COLORS[sym] ?? { bg: 'var(--gray-06)', text: 'var(--gray-12)' };
}

/* ─── Asset avatar ─── */
function AssetAvatar({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const c = assetColor(symbol);
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: c.bg, color: c.text,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, letterSpacing: '-0.02em',
    }}>
      {symbol.length <= 3 ? symbol.slice(0, 2) : symbol[0]}
    </span>
  );
}

/* ─── Stat card ─── */
function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: '130px',
      padding: '16px', borderRadius: 'var(--radius-sm)',
      background: 'var(--gray-03)', border: '1px solid var(--gray-05)',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--mono)', color, letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  );
}

/* ─── Main component ─── */
export function PositionPanel() {
  const { address } = useWallet();
  const [data, setData] = useState<UserPositionDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) { setData(null); setError(null); return; }
    let gone = false;
    setLoading(true); setError(null);
    void loadUserPositionDisplay(createNetwork(appConfig), appConfig.blendPoolId, address)
      .then((r) => { if (!gone) setData(r); })
      .catch((e: unknown) => { if (!gone) { setError(e instanceof Error ? e.message : 'RPC error'); setData(null); } })
      .finally(() => { if (!gone) setLoading(false); });
    return () => { gone = true; };
  }, [address]);

  return (
    <section style={CARD} className="animate-fade-up">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg,var(--teal) 0%,var(--gold) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(5,162,194,0.25)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>Blend Position</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--gray-09)' }}>
              {data ? `Pool: ${data.pool.name || 'TestnetV2'}` : 'Stellar Testnet'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading && <span style={{ fontSize: '12px', color: 'var(--gray-09)' }} className="animate-pulse-slow">Reading chain…</span>}
          <Chip label="Read-only" color="teal" />
        </div>
      </div>

      {/* ── Not connected ── */}
      {!address && <PlaceholderState />}

      {/* ── Loading ── */}
      {address && loading && !data && <SkeletonRows />}

      {/* ── Error ── */}
      {address && error && (
        <div style={{ padding: '14px 16px', background: 'var(--red-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--red-hi)', lineHeight: 1.5 }}>
          <strong>RPC error:</strong> {error}
        </div>
      )}

      {/* ── Data ── */}
      {address && !loading && !error && data && (
        <>
          {/* Summary stats */}
          {data.hasPosition && <PositionStats positions={data.positions} reserves={data.pool.reserves} />}

          {/* No position */}
          {!data.hasPosition && (
            <div style={{ padding: '20px', background: 'var(--gray-03)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--gray-06)', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '14px', color: 'var(--gray-11)' }}>No active position</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--gray-09)', lineHeight: 1.5 }}>
                This address has no open Blend positions.{' '}
                <a href="https://app.blend.capital" target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Open one on Blend</a>
              </p>
            </div>
          )}

          {/* Positions table */}
          {data.hasPosition && <PositionsTable positions={data.positions} />}

          {/* Pool market rates */}
          <MarketRates reserves={data.pool.reserves} />
        </>
      )}
    </section>
  );
}

/* ─── Stats strip ─── */
function PositionStats({ positions, reserves }: { positions: UserPositionLine[]; reserves: PoolReserveInfo[] }) {
  const totals = positions.reduce((acc, p) => {
    const r = reserves.find((x) => x.assetId === p.assetId);
    const price = r ? 1 : 1; // prices not available in White Belt; show raw amounts
    return {
      collateral: acc.collateral + p.collateral * price,
      supplied: acc.supplied + p.supplied * price,
      borrowed: acc.borrowed + p.borrowed * price,
    };
  }, { collateral: 0, supplied: 0, borrowed: 0 });

  const fmtTot = (v: number) => v === 0 ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 4 });

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
      <StatCard label="Collateral" value={fmtTot(totals.collateral)} color="var(--gold)" icon={<ShieldIcon size={14} />} />
      <StatCard label="Supplied" value={fmtTot(totals.supplied)} color="var(--teal-hi)" icon={<ArrowUpIcon size={14} />} />
      <StatCard label="Borrowed" value={fmtTot(totals.borrowed)} color="var(--amber)" icon={<ArrowDownIcon size={14} />} />
    </div>
  );
}

/* ─── Table ─── */
function PositionsTable({ positions }: { positions: UserPositionLine[] }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <SectionLabel>Your positions</SectionLabel>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-05)', background: 'var(--gray-03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gray-05)' }}>
              {['Asset', 'Collateral', 'Supplied', 'Borrowed'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr key={p.assetId} style={{ borderBottom: i < positions.length - 1 ? '1px solid var(--gray-04)' : 'none', transition: 'background 100ms' }}
                onMouseEnter={(e) => { (e.currentTarget.style.background = 'var(--gray-04)'); }}
                onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); }}
              >
                <td style={{ padding: '13px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <AssetAvatar symbol={p.symbol} size={26} />
                    <span style={{ fontWeight: 600 }}>{p.symbol}</span>
                  </span>
                </td>
                <td style={{ padding: '13px 16px', fontFamily: 'var(--mono)', fontSize: '13px', color: p.collateral > 0 ? 'var(--gold)' : 'var(--gray-08)' }}>{fmtAmount(p.collateral)}</td>
                <td style={{ padding: '13px 16px', fontFamily: 'var(--mono)', fontSize: '13px', color: p.supplied > 0 ? 'var(--teal-hi)' : 'var(--gray-08)' }}>{fmtAmount(p.supplied)}</td>
                <td style={{ padding: '13px 16px', fontFamily: 'var(--mono)', fontSize: '13px', color: p.borrowed > 0 ? 'var(--amber)' : 'var(--gray-08)' }}>{fmtAmount(p.borrowed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Market rates ─── */
function MarketRates({ reserves }: { reserves: PoolReserveInfo[] }) {
  return (
    <div>
      <SectionLabel>Pool market rates</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
        {reserves.map((r) => (
          <div key={r.assetId} style={{ padding: '14px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius-sm)', transition: 'border-color 120ms' }}
            onMouseEnter={(e) => { (e.currentTarget.style.borderColor = 'var(--gray-07)'); }}
            onMouseLeave={(e) => { (e.currentTarget.style.borderColor = 'var(--gray-05)'); }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AssetAvatar symbol={r.symbol} size={24} />
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{r.symbol}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: '10px', color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supply</p>
                <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--mint)', fontWeight: 600 }}>{fmtApr(r.supplyApr)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 2px', fontSize: '10px', color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Borrow</p>
                <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--amber)', fontWeight: 600 }}>{fmtApr(r.borrowApr)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Placeholder ─── */
function PlaceholderState() {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'var(--gray-04)', marginBottom: '16px', color: 'var(--gray-08)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <p style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>Connect wallet to view positions</p>
      <p style={{ fontSize: '13px', color: 'var(--gray-09)', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
        Sentinel reads your Blend lending position directly from Soroban RPC — no custody, no signing required.
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
      {[100, 75, 85, 65].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: '18px', width: `${w}%` }} />
      ))}
    </div>
  );
}

/* ─── Primitives ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</p>;
}

function Chip({ label, color }: { label: string; color: 'teal' | 'gold' | 'amber' }) {
  const map = {
    teal:  { bg: 'var(--teal-bg)',  text: 'var(--teal)',  border: 'rgba(5,162,194,0.25)' },
    gold:  { bg: 'var(--gold-bg)',  text: 'var(--gold)',  border: 'rgba(253,218,36,0.25)' },
    amber: { bg: 'var(--amber-bg)', text: 'var(--amber)', border: 'rgba(255,178,36,0.25)' },
  };
  const c = map[color];
  return (
    <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function ArrowUpIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
}
function ArrowDownIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
}

const CARD: React.CSSProperties = {
  background: 'var(--gray-02)',
  border: '1px solid var(--gray-05)',
  borderRadius: 'var(--radius)',
  padding: '24px',
};
