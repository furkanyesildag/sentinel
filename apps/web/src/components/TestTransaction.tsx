import { useState } from 'react';
import { txExplorerUrl } from '@defirisk/core';
import { StellarWalletsKit } from '../wallet/kit';
import { useWallet } from '../wallet/WalletProvider';
import { appConfig } from '../config';
import { buildSelfPaymentTransaction, submitSignedTransaction } from '../lib/transactions';

type TxStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'done' | 'error';

const STEPS: { key: TxStatus; label: string }[] = [
  { key: 'building',   label: 'Build' },
  { key: 'signing',    label: 'Sign' },
  { key: 'submitting', label: 'Submit' },
  { key: 'done',       label: 'Confirm' },
];

function stepIndex(s: TxStatus): number {
  return STEPS.findIndex((x) => x.key === s);
}

export function TestTransaction({ onConfirmed }: { onConfirmed?: () => void }) {
  const { address } = useWallet();
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeIdx = stepIndex(status);
  const busy = status === 'building' || status === 'signing' || status === 'submitting';

  async function run() {
    if (!address || busy) return;
    setError(null); setTxHash(null);
    try {
      setStatus('building');
      const xdr = await buildSelfPaymentTransaction(appConfig, address);
      setStatus('signing');
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: appConfig.networkPassphrase,
        address,
      });
      setStatus('submitting');
      const hash = await submitSignedTransaction(appConfig, signedTxXdr);
      setTxHash(hash);
      setStatus('done');
      onConfirmed?.();
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Transaction failed');
    }
  }

  return (
    <section style={CARD} className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, var(--gold) 0%, var(--amber) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(253,218,36,0.2)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>Proof of Transaction</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--gray-09)' }}>
              Full sign → submit → confirm pipeline
            </p>
          </div>
        </div>
        <Chip label="Testnet" color="amber" />
      </div>

      {/* Description */}
      <p style={{ fontSize: '13px', color: 'var(--gray-10)', lineHeight: 1.65, marginBottom: '20px' }}>
        Sends <code style={{ fontFamily: 'var(--mono)', background: 'var(--gray-04)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px', color: 'var(--gray-12)' }}>0.0000001 XLM</code> to yourself — a harmless 1-stroop self-payment that proves the entire Stellar transaction lifecycle works end-to-end.
      </p>

      {/* Step tracker */}
      {status !== 'idle' && status !== 'error' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', marginBottom: '24px' }}>
          {STEPS.map((step, i) => {
            const done  = status === 'done' || activeIdx > i;
            const active = activeIdx === i;
            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700,
                    background: done ? 'var(--mint)' : active ? 'var(--gold)' : 'var(--gray-05)',
                    color: done || active ? '#000' : 'var(--gray-08)',
                    transition: 'all 200ms',
                    boxShadow: active ? '0 0 14px rgba(253,218,36,0.35)' : done ? '0 0 10px rgba(112,225,200,0.3)' : 'none',
                  }}>
                    {done ? '✓' : active ? <span className="animate-pulse-slow">{i + 1}</span> : i + 1}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: done ? 'var(--mint)' : active ? 'var(--gold)' : 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', background: done ? 'var(--mint)' : 'var(--gray-05)', margin: '0 6px', marginBottom: '20px', transition: 'background 300ms', borderRadius: '1px' }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      {!address ? (
        <div style={{ padding: '14px 16px', background: 'var(--gray-04)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--gray-09)', textAlign: 'center' }}>
          Connect a wallet to send transactions
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '11px 24px', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--ff)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.01em',
            background: status === 'done' ? 'var(--green-bg)' : status === 'error' ? 'var(--red-bg)' : busy ? 'var(--gray-05)' : 'var(--gold)',
            color: status === 'done' ? 'var(--green-hi)' : status === 'error' ? 'var(--red-hi)' : busy ? 'var(--gray-10)' : '#000',
            border: status === 'done' ? '1px solid rgba(48,164,108,0.3)' : status === 'error' ? '1px solid rgba(229,72,77,0.3)' : '1px solid transparent',
            cursor: busy ? 'not-allowed' : 'pointer',
            transition: 'all 120ms',
            boxShadow: (!busy && status !== 'done' && status !== 'error') ? '0 0 20px rgba(253,218,36,0.2)' : 'none',
          }}
          onMouseEnter={(e) => { if (!busy && status !== 'done' && status !== 'error') { e.currentTarget.style.background = 'var(--gold-hi)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
          onMouseLeave={(e) => { if (!busy && status !== 'done' && status !== 'error') { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.transform = 'none'; } }}
        >
          {status === 'building'   && <><SpinIcon />Building transaction…</>}
          {status === 'signing'    && <><SpinIcon />Waiting for signature…</>}
          {status === 'submitting' && <><SpinIcon />Broadcasting to Stellar…</>}
          {status === 'done'       && <>✓ Confirmed — run again</>}
          {status === 'error'      && <>↺ Retry transaction</>}
          {status === 'idle'       && <><SendIcon />Send test transaction</>}
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--red-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--red-hi)', lineHeight: 1.5 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Success */}
      {txHash && status === 'done' && (
        <div style={{ marginTop: '16px', padding: '16px', background: 'var(--green-bg)', border: '1px solid rgba(48,164,108,0.25)', borderRadius: 'var(--radius-sm)' }} className="animate-fade-in">
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '14px', color: 'var(--mint)' }}>
            ✓ Transaction confirmed on Stellar Testnet
          </p>
          <p style={{ margin: '0 0 12px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--gray-10)', wordBreak: 'break-all', lineHeight: 1.5 }}>
            {txHash}
          </p>
          <a
            href={txExplorerUrl(appConfig, txHash)}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 600, color: 'var(--teal-hi)', textDecoration: 'none', transition: 'color 120ms' }}
            onMouseEnter={(e) => { (e.currentTarget.style.color = 'var(--teal)'); }}
            onMouseLeave={(e) => { (e.currentTarget.style.color = 'var(--teal-hi)'); }}
          >
            View on StellarExpert
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}
    </section>
  );
}

function Chip({ label, color }: { label: string; color: 'amber' | 'teal' | 'gold' }) {
  const map = {
    amber: { bg: 'var(--amber-bg)', text: 'var(--amber)', border: 'rgba(255,178,36,0.25)' },
    teal:  { bg: 'var(--teal-bg)',  text: 'var(--teal)',  border: 'rgba(5,162,194,0.25)' },
    gold:  { bg: 'var(--gold-bg)',  text: 'var(--gold)',  border: 'rgba(253,218,36,0.25)' },
  };
  const c = map[color];
  return <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{label}</span>;
}

function SendIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" /></svg>;
}

function SpinIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>;
}

const CARD: React.CSSProperties = { background: 'var(--gray-02)', border: '1px solid var(--gray-05)', borderRadius: 'var(--radius)', padding: '24px' };
