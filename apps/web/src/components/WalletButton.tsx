/**
 * WalletButton — Stellar wallet connectivity using @creit.tech/stellar-wallets-kit
 *
 * Directly uses StellarWalletsKit to:
 *   1. Open the auth modal so the user picks a wallet (Freighter, xBull, Albedo …)
 *   2. Retrieve the connected address via StellarWalletsKit.getAddress()
 *   3. Disconnect via StellarWalletsKit.disconnect()
 *
 * Address state is kept in WalletProvider's context (via STATE_UPDATED event),
 * so other components can read it without re-implementing wallet logic.
 */

import { useState } from 'react';
import {
  StellarWalletsKit,
} from '@creit.tech/stellar-wallets-kit/sdk';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { Networks } from '@creit.tech/stellar-wallets-kit/types';
import { classifyError, type AppError } from '@defirisk/core';
import { truncateAddress, useWallet } from '../wallet/WalletProvider';

/**
 * Ensure the kit is initialised exactly once.
 * WalletProvider also calls this on mount, but we guard here too so the
 * component works even in isolation.
 */
let _kitInitialised = false;
function ensureKitInitialised(): void {
  if (_kitInitialised) return;
  StellarWalletsKit.init({
    modules: [new FreighterModule(), new xBullModule(), new AlbedoModule()],
    network: Networks.TESTNET,
  });
  _kitInitialised = true;
}

export function WalletButton() {
  // Address is kept in shared WalletProvider context, updated by the
  // STATE_UPDATED event that StellarWalletsKit fires after authModal / getAddress.
  const { address } = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [hoverDisc, setHoverDisc] = useState(false);
  const [connectError, setConnectError] = useState<AppError | null>(null);

  /** Open the wallet picker, then retrieve the address. */
  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      ensureKitInitialised();

      // Step 1 – let the user pick a wallet from the built-in auth modal
      await StellarWalletsKit.authModal();

      // Step 2 – read the public key from the chosen wallet module
      await StellarWalletsKit.getAddress();

      // WalletProvider's STATE_UPDATED listener receives the new address and
      // updates the shared context — no extra setState needed here.
    } catch (err) {
      // Classify into wallet-not-found / user-rejected / … and surface it.
      setConnectError(classifyError(err));
    } finally {
      setConnecting(false);
    }
  }

  /** Disconnect from the currently active wallet. */
  async function handleDisconnect() {
    try {
      await StellarWalletsKit.disconnect();
      // WalletProvider's DISCONNECT listener clears the shared address.
    } catch (err) {
      console.error('[WalletButton] disconnect failed:', err);
    }
  }

  /* ── Not connected ─────────────────────────────────────────────────── */
  if (!address) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', position: 'relative' }}>
        <button
          type="button"
          onClick={() => void handleConnect()}
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
          onMouseEnter={(e) => {
            if (!connecting) {
              e.currentTarget.style.background = 'var(--gold-hi)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = connecting ? 'var(--gray-05)' : 'var(--gold)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          {connecting ? <><SpinIcon />Connecting…</> : <><WalletIcon />Connect Wallet</>}
        </button>

        {connectError && (
          <span
            title={connectError.hint ?? connectError.raw}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '240px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', border: '1px solid rgba(229,72,77,0.3)', color: 'var(--red-hi)', fontSize: '11px', fontWeight: 600, lineHeight: 1.3 }}
          >
            {connectError.title}
            <button type="button" onClick={() => setConnectError(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: '12px' }}>✕</button>
          </span>
        )}
      </div>
    );
  }

  /* ── Connected ──────────────────────────────────────────────────────── */
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

      {/* Disconnect button */}
      <button
        type="button"
        onClick={() => void handleDisconnect()}
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
