import { useEffect, useState } from 'react';
import { fetchNativeXlmBalance, formatXlmBalance } from '@defirisk/core';
import { appConfig } from '../config';
import { useWallet } from '../wallet/WalletProvider';

interface WalletBalanceProps {
  /** Increment to trigger a refresh (e.g. after a confirmed transaction). */
  refreshKey?: number;
}

export function WalletBalance({ refreshKey = 0 }: WalletBalanceProps) {
  const { address } = useWallet();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setBalance(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchNativeXlmBalance(appConfig, address)
      .then((b) => { if (!cancelled) setBalance(b); })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load balance');
          setBalance(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [address, refreshKey]);

  if (!address) return null;

  return (
    <div
      className="animate-fade-up"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '18px 20px',
        marginBottom: '16px',
        background: 'linear-gradient(135deg, var(--gray-03) 0%, var(--gray-02) 100%)',
        border: '1px solid var(--gray-05)',
        borderRadius: 'var(--radius)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--gold)', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '11px', letterSpacing: '-0.02em',
          boxShadow: '0 4px 16px rgba(253,218,36,0.25)',
          flexShrink: 0,
        }}>
          XLM
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'var(--gray-09)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Wallet Balance
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--gray-09)' }}>
            Stellar Testnet · native XLM
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        {loading && (
          <span style={{ fontSize: '14px', color: 'var(--gray-09)' }} className="animate-pulse-slow">
            Loading…
          </span>
        )}
        {!loading && error && (
          <span style={{ fontSize: '13px', color: 'var(--red-hi)' }}>{error}</span>
        )}
        {!loading && !error && balance !== null && (
          <>
            <p style={{
              margin: 0,
              fontFamily: 'var(--mono)',
              fontSize: 'clamp(22px, 4vw, 28px)',
              fontWeight: 700,
              color: 'var(--gold)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
              {formatXlmBalance(balance)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--gray-09)', fontWeight: 500 }}>
              XLM available
            </p>
          </>
        )}
      </div>
    </div>
  );
}
