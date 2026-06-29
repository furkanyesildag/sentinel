/**
 * RiskMonitorPanel — Level 3 centrepiece: inter-contract communication +
 * real-time event streaming, driven from the browser.
 *
 *   • READ (live)  — simulates risk_monitor.assess(user, hf), which performs a
 *                    cross-contract call into alert_registry.get_threshold and
 *                    returns a classified RiskLevel. Re-runs as you move the
 *                    health-factor slider (debounced), no signature or fee.
 *   • WRITE        — publishes an assessment on-chain (build → sign → submit →
 *                    confirm) so RiskAssessed / AlertTriggered events persist.
 *   • EVENTS       — streams those events into a live feed (polls + refreshes
 *                    after each write).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import {
  assessRisk,
  buildAssessTx,
  bpsToPercent,
  classifyError,
  contractExplorerUrl,
  fetchRiskEvents,
  txExplorerUrl,
  type AppError,
  type RiskEvent,
  type RiskLevel,
} from '@defirisk/core';
import { appConfig } from '../config';
import { track } from '../lib/analytics';
import { submitSignedTransaction } from '../lib/transactions';
import { truncateAddress, useWallet } from '../wallet/WalletProvider';
import { ErrorBanner } from './ErrorBanner';
import { TX_STEPS, TxStatusPill, TxStepper } from './TxProgress';

type Phase = 'idle' | 'building' | 'signing' | 'submitting' | 'success' | 'error';
const PHASE_INDEX: Record<string, number> = { building: 0, signing: 1, submitting: 2 };
const POLL_MS = 20_000;

const LEVELS: Record<RiskLevel, { label: string; color: string; bg: string; border: string; emoji: string; blurb: string }> = {
  Unconfigured: { label: 'No threshold', color: 'var(--gray-10)', bg: 'var(--gray-04)', border: 'var(--gray-06)', emoji: '○', blurb: 'Set a threshold in the registry above to enable risk alerts.' },
  Safe:         { label: 'Safe',         color: 'var(--mint)',    bg: 'var(--green-bg)', border: 'rgba(48,164,108,0.3)', emoji: '🛡️', blurb: 'Health factor is comfortably above your warning threshold.' },
  Warning:      { label: 'Warning',      color: 'var(--amber)',   bg: 'var(--amber-bg)', border: 'rgba(255,178,36,0.35)', emoji: '⚠️', blurb: 'Within 5% of your threshold — keep an eye on this position.' },
  Breached:     { label: 'Breached',     color: 'var(--red-hi)',  bg: 'var(--red-bg)',   border: 'rgba(229,72,77,0.35)', emoji: '🚨', blurb: 'Below your threshold — Sentinel would fire a liquidation alert.' },
};

export function RiskMonitorPanel() {
  const { address } = useWallet();

  const [hfPct, setHfPct] = useState('130');
  const [level, setLevel] = useState<RiskLevel | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<AppError | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<AppError | null>(null);

  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const busy = phase === 'building' || phase === 'signing' || phase === 'submitting';
  const activeIndex = phase in PHASE_INDEX ? PHASE_INDEX[phase] : phase === 'success' ? TX_STEPS.length : -1;
  const hfBps = Math.round(Number(hfPct) * 100);
  const validHf = Number.isFinite(Number(hfPct)) && Number(hfPct) > 0;

  /* ── Live read (cross-contract simulation), debounced ─────────────────── */
  useEffect(() => {
    if (!address || !validHf) { setLevel(null); return; }
    let cancelled = false;
    setAssessing(true);
    setAssessError(null);
    const t = setTimeout(() => {
      void assessRisk(appConfig, address, hfBps)
        .then((lvl) => { if (!cancelled) setLevel(lvl); })
        .catch((e: unknown) => { if (!cancelled) { setAssessError(classifyError(e)); setLevel(null); } })
        .finally(() => { if (!cancelled) setAssessing(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [address, hfBps, validHf]);

  /* ── Event stream ─────────────────────────────────────────────────────── */
  const refreshEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      setEvents(await fetchRiskEvents(appConfig, { limit: 12 }));
    } catch {
      /* best-effort */
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const refreshEventsRef = useRef(refreshEvents);
  refreshEventsRef.current = refreshEvents;
  useEffect(() => {
    if (!address) { setEvents([]); return; }
    void refreshEventsRef.current();
    const id = setInterval(() => void refreshEventsRef.current(), POLL_MS);
    return () => clearInterval(id);
  }, [address]);

  /* ── Write (publish assessment on-chain) ──────────────────────────────── */
  async function publish() {
    if (!address || busy || !validHf) return;
    setWriteError(null);
    setTxHash(null);
    try {
      setPhase('building');
      const xdr = await buildAssessTx(appConfig, address, address, hfBps);
      setPhase('signing');
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: appConfig.networkPassphrase,
        address,
      });
      setPhase('submitting');
      const hash = await submitSignedTransaction(appConfig, signedTxXdr);
      setTxHash(hash);
      setPhase('success');
      track('risk_published', { address, level });
      await refreshEvents();
    } catch (err) {
      setWriteError(classifyError(err));
      setPhase('error');
    }
  }

  const lv = level ? LEVELS[level] : null;

  return (
    <section style={CARD} className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, var(--red) 0%, var(--amber) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(229,72,77,0.2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>Risk Monitor</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--gray-09)' }}>Inter-contract risk assessment · live events</p>
          </div>
        </div>
        <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--red-bg)', color: 'var(--red-hi)', border: '1px solid rgba(229,72,77,0.25)' }}>
          Cross-contract
        </span>
      </div>

      {/* Inter-contract relationship */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '18px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius-sm)', fontSize: '12px', flexWrap: 'wrap' }}>
        <ContractChip label="risk_monitor" id={appConfig.riskMonitorId} color="var(--amber)" />
        <span style={{ color: 'var(--gray-09)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>— reads → </span>
        <ContractChip label="alert_registry" id={appConfig.alertRegistryId} color="var(--teal)" />
        <span style={{ color: 'var(--gray-08)', marginLeft: 'auto', fontSize: '11px' }}>via <code style={{ fontFamily: 'var(--mono)' }}>get_threshold</code></span>
      </div>

      {!address ? (
        <div style={{ padding: '14px 16px', background: 'var(--gray-04)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--gray-09)', textAlign: 'center' }}>
          Connect a wallet to assess your liquidation risk.
        </div>
      ) : (
        <>
          {/* Health factor input */}
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Simulate your current health factor
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <input
              type="range" min={50} max={250} step={1}
              value={validHf ? Number(hfPct) : 130}
              onChange={(e) => setHfPct(e.target.value)}
              style={{ flex: '1 1 200px', accentColor: 'var(--gold)' }}
            />
            <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--gray-04)', border: '1px solid var(--gray-06)', borderRadius: 'var(--radius-sm)' }}>
              <input
                type="number" min={1} step={5} value={hfPct}
                onChange={(e) => setHfPct(e.target.value)}
                style={{ width: '74px', padding: '9px 10px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray-12)', fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 600 }}
              />
              <span style={{ padding: '0 10px', color: 'var(--gray-09)', fontWeight: 600 }}>%</span>
            </div>
          </div>

          {/* Live risk verdict */}
          <div style={{ padding: '16px', marginBottom: '18px', borderRadius: 'var(--radius-sm)', background: lv ? lv.bg : 'var(--gray-03)', border: `1px solid ${lv ? lv.border : 'var(--gray-05)'}`, transition: 'all 200ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '26px', lineHeight: 1 }}>{assessing ? '⏳' : lv ? lv.emoji : '—'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '18px', color: lv ? lv.color : 'var(--gray-09)', letterSpacing: '-0.01em' }}>
                  {assessing ? 'Assessing…' : lv ? lv.label : 'Enter a value'}
                  {lv && lv.label !== 'No threshold' && <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--gray-09)', marginLeft: '8px' }}>at {hfPct}% HF</span>}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--gray-10)', lineHeight: 1.5 }}>
                  {lv ? lv.blurb : 'risk_monitor.assess simulates a cross-contract read of your threshold.'}
                </p>
              </div>
            </div>
          </div>

          {assessError && <ErrorBanner error={assessError} onDismiss={() => setAssessError(null)} />}

          {/* Tx tracker for the publish flow */}
          {(busy || phase === 'success') && (
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-10)', fontFamily: 'var(--mono)' }}>assess()</span>
              <TxStatusPill phase={phase === 'success' ? 'success' : 'pending'} />
            </div>
          )}
          {(busy || phase === 'success') && <TxStepper steps={TX_STEPS} activeIndex={activeIndex} allDone={phase === 'success'} />}

          {/* Publish */}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy || !validHf}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '11px 22px', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--ff)', fontSize: '14px', fontWeight: 600,
              background: busy ? 'var(--gray-05)' : 'var(--gold)',
              color: busy ? 'var(--gray-10)' : '#000',
              border: '1px solid transparent',
              cursor: busy || !validHf ? 'not-allowed' : 'pointer',
              boxShadow: busy ? 'none' : '0 0 20px rgba(253,218,36,0.2)',
            }}
          >
            {busy ? <><Spin />Publishing…</> : <>Publish assessment on-chain</>}
          </button>

          {/* Success */}
          {txHash && phase === 'success' && (
            <div style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--green-bg)', border: '1px solid rgba(48,164,108,0.25)', borderRadius: 'var(--radius-sm)' }} className="animate-fade-in">
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: 'var(--mint)' }}>
                ✓ Assessment recorded — events streamed below
              </p>
              <a href={txExplorerUrl(appConfig, txHash)} target="_blank" rel="noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--teal-hi)', textDecoration: 'none', fontFamily: 'var(--mono)' }}>
                {truncateAddress(txHash)} ↗
              </a>
            </div>
          )}

          {writeError && phase === 'error' && <ErrorBanner error={writeError} onDismiss={() => setWriteError(null)} />}

          {/* Event stream */}
          <RiskEventFeed events={events} loading={eventsLoading} selfAddress={address} />
        </>
      )}
    </section>
  );
}

/* ── Event feed ──────────────────────────────────────────────────────────── */

function RiskEventFeed({ events, loading, selfAddress }: { events: RiskEvent[]; loading: boolean; selfAddress: string }) {
  return (
    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--gray-05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Live risk events
        </p>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--gray-09)', fontWeight: 600 }}>
          <span style={{ position: 'relative', width: '7px', height: '7px' }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--mint)', animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.5 }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--mint)' }} />
          </span>
          {loading ? 'Syncing…' : 'Live'}
        </span>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', background: 'var(--gray-03)', border: '1px dashed var(--gray-06)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--gray-09)' }}>
          {loading ? 'Reading recent events…' : 'No assessments yet. Publish one above to stream an event.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map((ev) => {
            const lv = LEVELS[ev.level];
            const mine = ev.user === selfAddress;
            return (
              <div key={`${ev.txHash}-${ev.type}-${ev.ledger}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: ev.type === 'alert' ? 'var(--red-bg)' : 'var(--gray-04)', color: ev.type === 'alert' ? 'var(--red-hi)' : 'var(--gray-10)', flexShrink: 0 }}>
                  {ev.type === 'alert' ? 'alert' : 'assessed'}
                </span>
                <span style={{ color: lv.color, fontWeight: 700, flexShrink: 0 }}>{lv.label}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--gray-10)', fontSize: '12px', flexShrink: 0 }}>
                  {bpsToPercent(ev.currentHfBps)}% / {bpsToPercent(ev.thresholdBps)}%
                </span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--gray-09)', fontSize: '11px', flexShrink: 0 }}>
                  {truncateAddress(ev.user)}{mine && <span style={{ color: 'var(--teal)', marginLeft: '4px' }}>you</span>}
                </span>
                <a href={txExplorerUrl(appConfig, ev.txHash)} target="_blank" rel="noreferrer" title="View transaction" style={{ marginLeft: 'auto', color: 'var(--teal-hi)', display: 'inline-flex', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContractChip({ label, id, color }: { label: string; id: string; color: string }) {
  return (
    <a href={contractExplorerUrl(appConfig, id)} target="_blank" rel="noreferrer" title={id}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--mono)', background: 'var(--gray-04)', color, border: `1px solid ${color}33`, textDecoration: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
      {label}
    </a>
  );
}

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>;
}

const CARD: React.CSSProperties = { background: 'var(--gray-02)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius)', padding: '24px' };
