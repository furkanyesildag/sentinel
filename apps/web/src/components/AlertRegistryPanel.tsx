/**
 * AlertRegistryPanel — the on-chain heart of Level 2.
 *
 * Talks to the deployed `alert_registry` Soroban contract from the browser:
 *   • READ   — get_threshold (simulation, no signature) shows the current value
 *   • WRITE  — set_threshold / remove_threshold: build → sign → submit → confirm,
 *              with a live transaction-status tracker (pending / success / failed)
 *   • EVENTS — ThresholdSet / ThresholdRemoved contract events are streamed back
 *              into a live activity feed and re-read after every write, so the UI
 *              stays synchronised with chain state.
 *
 * Errors from every step are classified into the three required kinds
 * (wallet-not-found / user-rejected / insufficient-balance) and rendered
 * through the shared ErrorBanner.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import {
  buildRemoveThresholdTx,
  buildSetThresholdTx,
  bpsToPercent,
  classifyError,
  contractExplorerUrl,
  fetchThresholdEvents,
  percentToBps,
  readThreshold,
  txExplorerUrl,
  type AppError,
  type ThresholdEvent,
} from '@defirisk/core';
import { appConfig } from '../config';
import { submitSignedTransaction } from '../lib/transactions';
import { truncateAddress, useWallet } from '../wallet/WalletProvider';
import { ErrorBanner } from './ErrorBanner';
import { TX_STEPS, TxStatusPill, TxStepper } from './TxProgress';

type Phase = 'idle' | 'building' | 'signing' | 'submitting' | 'success' | 'error';
const PHASE_INDEX: Record<string, number> = { building: 0, signing: 1, submitting: 2 };

const PRESETS_PCT = [110, 120, 150];
const POLL_MS = 20_000;

export function AlertRegistryPanel() {
  const { address } = useWallet();

  const [onchainBps, setOnchainBps] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const [inputPct, setInputPct] = useState('');
  const [touched, setTouched] = useState(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [action, setAction] = useState<'set' | 'remove'>('set');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const [events, setEvents] = useState<ThresholdEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const busy = phase === 'building' || phase === 'signing' || phase === 'submitting';
  const activeIndex = phase in PHASE_INDEX ? PHASE_INDEX[phase] : phase === 'success' ? TX_STEPS.length : -1;

  /* ── Reads ──────────────────────────────────────────────────────────── */

  const refreshThreshold = useCallback(async () => {
    if (!address) return;
    setReading(true);
    try {
      const bps = await readThreshold(appConfig, address);
      setOnchainBps(bps);
    } catch {
      setOnchainBps(null);
    } finally {
      setReading(false);
    }
  }, [address]);

  const refreshEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      setEvents(await fetchThresholdEvents(appConfig, { limit: 12 }));
    } catch {
      /* feed is best-effort; ignore transient RPC errors */
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // Reset + load whenever the connected address changes.
  useEffect(() => {
    setPhase('idle');
    setError(null);
    setTxHash(null);
    setTouched(false);
    setInputPct('');
    if (!address) {
      setOnchainBps(null);
      setEvents([]);
      return;
    }
    void refreshThreshold();
    void refreshEvents();
  }, [address, refreshThreshold, refreshEvents]);

  // Keep the input synced to the on-chain value until the user edits it.
  useEffect(() => {
    if (touched) return;
    if (onchainBps && onchainBps > 0) setInputPct(String(bpsToPercent(onchainBps)));
    else setInputPct('120');
  }, [onchainBps, touched]);

  // Live event listening: poll the contract's events while connected.
  const refreshEventsRef = useRef(refreshEvents);
  refreshEventsRef.current = refreshEvents;
  useEffect(() => {
    if (!address) return;
    const id = setInterval(() => void refreshEventsRef.current(), POLL_MS);
    return () => clearInterval(id);
  }, [address]);

  /* ── Writes ─────────────────────────────────────────────────────────── */

  async function runWrite(kind: 'set' | 'remove') {
    if (!address || busy) return;

    let bps = 0;
    if (kind === 'set') {
      const pct = Number(inputPct);
      if (!Number.isFinite(pct) || pct <= 0) {
        setError({ kind: 'unknown', title: 'Invalid threshold', message: 'Enter a warning level greater than 0%.' });
        return;
      }
      bps = percentToBps(pct);
    }

    setError(null);
    setTxHash(null);
    setAction(kind);
    try {
      setPhase('building');
      const xdr =
        kind === 'set'
          ? await buildSetThresholdTx(appConfig, address, address, bps)
          : await buildRemoveThresholdTx(appConfig, address, address);

      setPhase('signing');
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: appConfig.networkPassphrase,
        address,
      });

      setPhase('submitting');
      const hash = await submitSignedTransaction(appConfig, signedTxXdr);
      setTxHash(hash);
      setPhase('success');

      // State synchronisation: re-read the stored value and pull fresh events.
      await Promise.all([refreshThreshold(), refreshEvents()]);
    } catch (err) {
      setError(classifyError(err));
      setPhase('error');
    }
  }

  const hasThreshold = !!onchainBps && onchainBps > 0;

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <section style={CARD} className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--gold) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(5,162,194,0.25)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>Alert Threshold Registry</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--gray-09)' }}>
              On-chain Soroban contract · set, read & stream events
            </p>
          </div>
        </div>
        <a
          href={contractExplorerUrl(appConfig, appConfig.alertRegistryId)}
          target="_blank"
          rel="noreferrer"
          title={appConfig.alertRegistryId}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--mono)', background: 'var(--teal-bg)', color: 'var(--teal)', border: '1px solid rgba(5,162,194,0.25)', textDecoration: 'none' }}
        >
          {truncateAddress(appConfig.alertRegistryId)}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {!address ? (
        <div style={{ padding: '14px 16px', background: 'var(--gray-04)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--gray-09)', textAlign: 'center' }}>
          Connect a wallet to read and set your on-chain alert threshold.
        </div>
      ) : (
        <>
          {/* Current on-chain value */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px', marginBottom: '18px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Your stored threshold
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--gray-09)' }}>
                Read live from <code style={{ fontFamily: 'var(--mono)' }}>get_threshold</code>
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {reading ? (
                <span style={{ fontSize: '14px', color: 'var(--gray-09)' }} className="animate-pulse-slow">Reading…</span>
              ) : hasThreshold ? (
                <>
                  <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: '26px', fontWeight: 700, color: 'var(--gold)', lineHeight: 1.1 }}>
                    {bpsToPercent(onchainBps!)}%
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--gray-09)', fontFamily: 'var(--mono)' }}>{onchainBps} bps</p>
                </>
              ) : (
                <span style={{ fontSize: '14px', color: 'var(--gray-08)' }}>Not set</span>
              )}
            </div>
          </div>

          {/* Setter */}
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Warn me below this health factor
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--gray-04)', border: '1px solid var(--gray-06)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <input
                type="number"
                min={1}
                step={5}
                value={inputPct}
                disabled={busy}
                onChange={(e) => { setTouched(true); setInputPct(e.target.value); }}
                style={{ width: '90px', padding: '10px 12px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray-12)', fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 600 }}
              />
              <span style={{ padding: '0 12px', color: 'var(--gray-09)', fontWeight: 600, fontSize: '14px' }}>%</span>
            </div>
            {PRESETS_PCT.map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => { setTouched(true); setInputPct(String(p)); }}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-06)', background: Number(inputPct) === p ? 'var(--gold-bg)' : 'var(--gray-03)', color: Number(inputPct) === p ? 'var(--gold)' : 'var(--gray-10)', fontWeight: 600, fontSize: '13px', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'var(--mono)' }}
              >
                {p}%
              </button>
            ))}
          </div>
          <p style={{ margin: '0 0 18px', fontSize: '12px', color: 'var(--gray-09)', lineHeight: 1.5 }}>
            Stored as <code style={{ fontFamily: 'var(--mono)' }}>{inputPct ? percentToBps(Number(inputPct)) : '—'}</code> bps via a signed{' '}
            <code style={{ fontFamily: 'var(--mono)' }}>set_threshold</code> call.
          </p>

          {/* Step tracker (only while a tx is in flight or just finished) */}
          {(busy || phase === 'success') && (
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-10)', textTransform: 'capitalize' }}>
                {action === 'set' ? 'set_threshold' : 'remove_threshold'}
              </span>
              <TxStatusPill phase={phase === 'success' ? 'success' : 'pending'} />
            </div>
          )}
          {(busy || phase === 'success') && <TxStepper steps={TX_STEPS} activeIndex={activeIndex} allDone={phase === 'success'} />}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void runWrite('set')}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '11px 22px', borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--ff)', fontSize: '14px', fontWeight: 600,
                background: busy ? 'var(--gray-05)' : 'var(--gold)',
                color: busy ? 'var(--gray-10)' : '#000',
                border: '1px solid transparent',
                cursor: busy ? 'not-allowed' : 'pointer',
                boxShadow: busy ? 'none' : '0 0 20px rgba(253,218,36,0.2)',
              }}
            >
              {busy && action === 'set' ? <><Spin />Working…</> : <>{hasThreshold ? 'Update threshold' : 'Set threshold'}</>}
            </button>

            {hasThreshold && (
              <button
                type="button"
                onClick={() => void runWrite('remove')}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '11px 18px', borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--ff)', fontSize: '14px', fontWeight: 600,
                  background: 'transparent', color: 'var(--gray-10)',
                  border: '1px solid var(--gray-06)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {busy && action === 'remove' ? <><Spin />Removing…</> : 'Remove'}
              </button>
            )}

            <button
              type="button"
              onClick={() => { void refreshThreshold(); void refreshEvents(); }}
              disabled={reading || eventsLoading}
              title="Re-read from chain"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '11px 14px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--gray-09)', border: '1px solid var(--gray-06)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              ↻ Sync
            </button>
          </div>

          {/* Success */}
          {txHash && phase === 'success' && (
            <div style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--green-bg)', border: '1px solid rgba(48,164,108,0.25)', borderRadius: 'var(--radius-sm)' }} className="animate-fade-in">
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: 'var(--mint)' }}>
                ✓ Contract call confirmed — state synced from chain
              </p>
              <a href={txExplorerUrl(appConfig, txHash)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 600, color: 'var(--teal-hi)', textDecoration: 'none', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
                {truncateAddress(txHash)} ↗
              </a>
            </div>
          )}

          {/* Error */}
          {error && phase === 'error' && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

          {/* Event feed */}
          <EventFeed events={events} loading={eventsLoading} selfAddress={address} />
        </>
      )}
    </section>
  );
}

/* ── Live event feed ─────────────────────────────────────────────────────── */

function EventFeed({ events, loading, selfAddress }: { events: ThresholdEvent[]; loading: boolean; selfAddress: string }) {
  return (
    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--gray-05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Live contract events
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
          {loading ? 'Reading recent events…' : 'No recent events. Set a threshold to publish one.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map((ev) => {
            const mine = ev.user === selfAddress;
            const isSet = ev.type === 'set';
            return (
              <div key={`${ev.txHash}-${ev.ledger}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: isSet ? 'var(--gold-bg)' : 'var(--gray-04)', color: isSet ? 'var(--gold)' : 'var(--gray-10)', flexShrink: 0 }}>
                  {isSet ? 'set' : 'removed'}
                </span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--gray-11)', flexShrink: 0 }}>
                  {truncateAddress(ev.user)}{mine && <span style={{ color: 'var(--teal)', marginLeft: '5px' }}>you</span>}
                </span>
                {isSet && ev.bps !== null && (
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--gold)', fontWeight: 600 }}>{bpsToPercent(ev.bps)}%</span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--gray-08)', fontFamily: 'var(--mono)', flexShrink: 0 }}>L{ev.ledger}</span>
                <a href={txExplorerUrl(appConfig, ev.txHash)} target="_blank" rel="noreferrer" title="View transaction" style={{ color: 'var(--teal-hi)', display: 'inline-flex', flexShrink: 0 }}>
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

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>;
}

const CARD: React.CSSProperties = { background: 'var(--gray-02)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius)', padding: '24px' };
