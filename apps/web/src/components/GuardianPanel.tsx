/**
 * GuardianPanel — Level 4 MVP: opt-in, non-custodial liquidation protection.
 *
 *   • Activate a protection policy (signed threshold) on the guardian contract.
 *   • Fund / withdraw an XLM reserve held by the contract (real SAC transfers).
 *   • "Protect now" runs the permissionless protect(): when the simulated health
 *     factor is below the policy threshold, the reserve is released to you and a
 *     Protected event is emitted.
 *   • Live guardian event feed + transaction status tracking + typed errors.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import {
  buildFundReserveTx,
  buildProtectTx,
  buildSetPolicyTx,
  buildWithdrawReserveTx,
  bpsToPercent,
  classifyError,
  contractExplorerUrl,
  fetchGuardianEvents,
  percentToBps,
  readPolicy,
  readReserve,
  stroopsToXlm,
  txExplorerUrl,
  xlmToStroops,
  type AppError,
  type GuardianEvent,
  type GuardianPolicy,
} from '@defirisk/core';
import { appConfig } from '../config';
import { track } from '../lib/analytics';
import { submitSignedTransaction } from '../lib/transactions';
import { truncateAddress, useWallet } from '../wallet/WalletProvider';
import { ErrorBanner } from './ErrorBanner';
import { TX_STEPS, TxStatusPill, TxStepper } from './TxProgress';

type Phase = 'idle' | 'building' | 'signing' | 'submitting' | 'success' | 'error';
type Action = 'policy' | 'fund' | 'withdraw' | 'protect';
const PHASE_INDEX: Record<string, number> = { building: 0, signing: 1, submitting: 2 };
const POLL_MS = 20_000;

export function GuardianPanel() {
  const { address } = useWallet();

  const [policy, setPolicy] = useState<GuardianPolicy | null>(null);
  const [reserve, setReserve] = useState<number>(0);
  const [reading, setReading] = useState(false);

  const [thresholdPct, setThresholdPct] = useState('120');
  const [amountXlm, setAmountXlm] = useState('1');
  const [hfPct, setHfPct] = useState('110');

  const [phase, setPhase] = useState<Phase>('idle');
  const [action, setAction] = useState<Action>('policy');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [released, setReleased] = useState<number | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const [events, setEvents] = useState<GuardianEvent[]>([]);

  const busy = phase === 'building' || phase === 'signing' || phase === 'submitting';
  const activeIndex = phase in PHASE_INDEX ? PHASE_INDEX[phase] : phase === 'success' ? TX_STEPS.length : -1;
  const hasPolicy = !!policy && policy.active;

  const refresh = useCallback(async () => {
    if (!address) return;
    setReading(true);
    try {
      const [p, r] = await Promise.all([readPolicy(appConfig, address), readReserve(appConfig, address)]);
      setPolicy(p);
      setReserve(r);
    } catch {
      /* leave previous */
    } finally {
      setReading(false);
    }
  }, [address]);

  const refreshEvents = useCallback(async () => {
    try {
      setEvents(await fetchGuardianEvents(appConfig, { limit: 12 }));
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    setPhase('idle');
    setError(null);
    setTxHash(null);
    setReleased(null);
    if (!address) {
      setPolicy(null);
      setReserve(0);
      setEvents([]);
      return;
    }
    void refresh();
    void refreshEvents();
  }, [address, refresh, refreshEvents]);

  const refRefreshEvents = useRef(refreshEvents);
  refRefreshEvents.current = refreshEvents;
  useEffect(() => {
    if (!address) return;
    const id = setInterval(() => void refRefreshEvents.current(), POLL_MS);
    return () => clearInterval(id);
  }, [address]);

  async function run(kind: Action) {
    if (!address || busy) return;
    setError(null);
    setTxHash(null);
    setReleased(null);
    setAction(kind);
    try {
      setPhase('building');
      let xdr: string;
      if (kind === 'policy') {
        const bps = percentToBps(Number(thresholdPct));
        if (!Number.isFinite(bps) || bps <= 0) throw new Error('Enter a threshold above 0%');
        xdr = await buildSetPolicyTx(appConfig, address, address, bps);
      } else if (kind === 'fund') {
        const stroops = xlmToStroops(Number(amountXlm));
        if (!Number.isFinite(stroops) || stroops <= 0) throw new Error('Enter an amount above 0 XLM');
        xdr = await buildFundReserveTx(appConfig, address, address, stroops);
      } else if (kind === 'withdraw') {
        const stroops = xlmToStroops(Number(amountXlm));
        if (!Number.isFinite(stroops) || stroops <= 0) throw new Error('Enter an amount above 0 XLM');
        xdr = await buildWithdrawReserveTx(appConfig, address, address, stroops);
      } else {
        const bps = percentToBps(Number(hfPct));
        xdr = await buildProtectTx(appConfig, address, address, bps);
      }

      setPhase('signing');
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: appConfig.networkPassphrase,
        address,
      });
      setPhase('submitting');
      const hash = await submitSignedTransaction(appConfig, signedTxXdr);
      setTxHash(hash);
      setPhase('success');
      track(`guardian_${kind}`, { address });

      const before = reserve;
      await Promise.all([refresh(), refreshEvents()]);
      if (kind === 'protect') {
        // released = drop in reserve after protection
        const after = await readReserve(appConfig, address);
        setReleased(Math.max(before - after, 0));
      }
    } catch (err) {
      setError(classifyError(err));
      setPhase('error');
      track('guardian_error', { kind });
    }
  }

  return (
    <section style={CARD} className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, var(--mint) 0%, var(--teal) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(112,225,200,0.25)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>Liquidation Guardian</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--gray-09)' }}>Opt-in · non-custodial protection</p>
          </div>
        </div>
        <a href={contractExplorerUrl(appConfig, appConfig.guardianId)} target="_blank" rel="noreferrer" title={appConfig.guardianId}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--mono)', background: 'var(--green-bg)', color: 'var(--mint)', border: '1px solid rgba(48,164,108,0.25)', textDecoration: 'none' }}>
          {truncateAddress(appConfig.guardianId)} ↗
        </a>
      </div>

      {!address ? (
        <div style={{ padding: '14px 16px', background: 'var(--gray-04)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--gray-09)', textAlign: 'center' }}>
          Connect a wallet to set up automated protection.
        </div>
      ) : (
        <>
          {/* Status row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <StatusBox label="Policy" value={reading && !policy ? '…' : hasPolicy ? `Active · ${bpsToPercent(policy!.thresholdBps)}%` : 'Not set'} color={hasPolicy ? 'var(--mint)' : 'var(--gray-09)'} />
            <StatusBox label="Reserve" value={`${stroopsToXlm(reserve).toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`} color="var(--gold)" />
          </div>

          <p style={{ fontSize: '12px', color: 'var(--gray-09)', lineHeight: 1.6, marginBottom: '18px' }}>
            Your reserve stays in the contract under rules you sign. A breach releases it back to <strong style={{ color: 'var(--gray-11)' }}>you</strong> only. Nobody can redirect it.
          </p>

          {!hasPolicy ? (
            /* Activate policy */
            <Row label="Warn + protect below this health factor">
              <PctInput value={thresholdPct} onChange={setThresholdPct} disabled={busy} />
              <ActionButton onClick={() => void run('policy')} disabled={busy} primary>
                {busy && action === 'policy' ? <><Spin />Activating…</> : 'Activate protection'}
              </ActionButton>
            </Row>
          ) : (
            <>
              {/* Reserve management */}
              <Row label="Protection reserve (XLM)">
                <XlmInput value={amountXlm} onChange={setAmountXlm} disabled={busy} />
                <ActionButton onClick={() => void run('fund')} disabled={busy} primary>
                  {busy && action === 'fund' ? <><Spin />Funding…</> : 'Fund'}
                </ActionButton>
                <ActionButton onClick={() => void run('withdraw')} disabled={busy || reserve <= 0}>
                  {busy && action === 'withdraw' ? <><Spin />…</> : 'Withdraw'}
                </ActionButton>
              </Row>

              {/* Protect now */}
              <Row label="Simulate health factor, then trigger protection">
                <PctInput value={hfPct} onChange={setHfPct} disabled={busy} />
                <ActionButton onClick={() => void run('protect')} disabled={busy || reserve <= 0} primary>
                  {busy && action === 'protect' ? <><Spin />Protecting…</> : '🛡 Protect now'}
                </ActionButton>
              </Row>
              {reserve <= 0 && (
                <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--gray-09)' }}>Fund a reserve above to enable protection.</p>
              )}
            </>
          )}

          {/* Tx tracker */}
          {(busy || phase === 'success') && (
            <div style={{ margin: '6px 0 4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-10)', fontFamily: 'var(--mono)' }}>{ACTION_FN[action]}</span>
              <TxStatusPill phase={phase === 'success' ? 'success' : 'pending'} />
            </div>
          )}
          {(busy || phase === 'success') && <TxStepper steps={TX_STEPS} activeIndex={activeIndex} allDone={phase === 'success'} />}

          {/* Success */}
          {txHash && phase === 'success' && (
            <div style={{ marginTop: '14px', padding: '14px 16px', background: 'var(--green-bg)', border: '1px solid rgba(48,164,108,0.25)', borderRadius: 'var(--radius-sm)' }} className="animate-fade-in">
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: 'var(--mint)' }}>
                {action === 'protect' && released && released > 0
                  ? `🛡 Protected — ${stroopsToXlm(released)} XLM released to you`
                  : '✓ Confirmed on-chain'}
              </p>
              <a href={txExplorerUrl(appConfig, txHash)} target="_blank" rel="noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--teal-hi)', textDecoration: 'none', fontFamily: 'var(--mono)' }}>
                {truncateAddress(txHash)} ↗
              </a>
            </div>
          )}

          {error && phase === 'error' && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

          {/* Event feed */}
          <GuardianFeed events={events} selfAddress={address} />
        </>
      )}
    </section>
  );
}

const ACTION_FN: Record<Action, string> = { policy: 'set_policy', fund: 'fund_reserve', withdraw: 'withdraw_reserve', protect: 'protect' };

function GuardianFeed({ events, selfAddress }: { events: GuardianEvent[]; selfAddress: string }) {
  const labels: Record<GuardianEvent['type'], { text: string; color: string }> = {
    policy: { text: 'policy', color: 'var(--teal)' },
    funded: { text: 'funded', color: 'var(--gold)' },
    withdrawn: { text: 'withdrawn', color: 'var(--gray-10)' },
    protected: { text: 'protected', color: 'var(--mint)' },
  };
  return (
    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--gray-05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Guardian activity</p>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--gray-09)', fontWeight: 600 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--mint)' }} /> Live
        </span>
      </div>
      {events.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', background: 'var(--gray-03)', border: '1px dashed var(--gray-06)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--gray-09)' }}>
          No guardian activity yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map((ev) => {
            const l = labels[ev.type];
            const mine = ev.user === selfAddress;
            return (
              <div key={`${ev.txHash}-${ev.type}-${ev.ledger}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--gray-03)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--gray-04)', color: l.color, flexShrink: 0 }}>{l.text}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--gray-10)', fontSize: '12px', flexShrink: 0 }}>{truncateAddress(ev.user)}{mine && <span style={{ color: 'var(--teal)', marginLeft: '4px' }}>you</span>}</span>
                {ev.amount != null && ev.amount > 0 && <span style={{ fontFamily: 'var(--mono)', color: 'var(--gold)', fontWeight: 600 }}>{stroopsToXlm(ev.amount)} XLM</span>}
                <a href={txExplorerUrl(appConfig, ev.txHash)} target="_blank" rel="noreferrer" title="View transaction" style={{ marginLeft: 'auto', color: 'var(--teal-hi)', display: 'inline-flex', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Small UI primitives ─────────────────────────────────────────────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
    </div>
  );
}

function PctInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--gray-04)', border: '1px solid var(--gray-06)', borderRadius: 'var(--radius-sm)' }}>
      <input type="number" min={1} step={5} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        style={{ width: '78px', padding: '9px 10px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray-12)', fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 600 }} />
      <span style={{ padding: '0 10px', color: 'var(--gray-09)', fontWeight: 600 }}>%</span>
    </div>
  );
}

function XlmInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--gray-04)', border: '1px solid var(--gray-06)', borderRadius: 'var(--radius-sm)' }}>
      <input type="number" min={0} step={0.5} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        style={{ width: '88px', padding: '9px 10px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--gray-12)', fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 600 }} />
      <span style={{ padding: '0 10px', color: 'var(--gray-09)', fontWeight: 600, fontSize: '13px' }}>XLM</span>
    </div>
  );
}

function ActionButton({ onClick, disabled, primary, children }: { onClick: () => void; disabled?: boolean; primary?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--ff)', fontSize: '14px', fontWeight: 600,
        background: primary ? (disabled ? 'var(--gray-05)' : 'var(--gold)') : 'transparent',
        color: primary ? (disabled ? 'var(--gray-10)' : '#000') : 'var(--gray-10)',
        border: primary ? '1px solid transparent' : '1px solid var(--gray-06)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: primary && !disabled ? '0 0 18px rgba(253,218,36,0.18)' : 'none',
      }}>
      {children}
    </button>
  );
}

function StatusBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: '140px', padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--gray-03)', border: '1px solid var(--gray-05)' }}>
      <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: '17px', fontWeight: 700, color, fontFamily: 'var(--mono)', letterSpacing: '-0.01em' }}>{value}</p>
    </div>
  );
}

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>;
}

const CARD: React.CSSProperties = { background: 'var(--gray-02)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius)', padding: '24px' };
