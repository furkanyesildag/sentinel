/**
 * WalletProvider — React context that surfaces Stellar wallet state to the app.
 *
 * Directly uses @creit.tech/stellar-wallets-kit for:
 *   • Wallet initialisation (FreighterModule, xBullModule, AlbedoModule)
 *   • Address retrieval  — StellarWalletsKit.getAddress()
 *   • Wallet connection  — StellarWalletsKit.authModal()
 *   • Disconnection      — StellarWalletsKit.disconnect()
 *   • Live state updates — StellarWalletsKit.on(KitEventType.STATE_UPDATED, …)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { KitEventType, Networks } from '@creit.tech/stellar-wallets-kit/types';

/* ── Context shape ─────────────────────────────────────────────────────── */

interface WalletContextValue {
  address: string | null;
  walletId: string | undefined;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  openProfile: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/* ── Provider ──────────────────────────────────────────────────────────── */

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Initialise the wallet kit once with the supported wallet modules
    StellarWalletsKit.init({
      modules: [new FreighterModule(), new xBullModule(), new AlbedoModule()],
      network: Networks.TESTNET,
    });

    // Listen for address changes (connect / network switch / account change)
    const unsub = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
      setAddress(event.payload.address ?? null);
    });

    // Restore a previously connected session if one exists
    void StellarWalletsKit.getAddress()
      .then(({ address: addr }) => setAddress(addr))
      .catch(() => setAddress(null));

    return unsub;
  }, []);

  /**
   * Open the built-in auth modal so the user can pick a wallet.
   * After selection, retrieve the public key with getAddress().
   */
  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      // Opens the wallet-picker modal
      const { address: addr } = await StellarWalletsKit.authModal();
      setAddress(addr);

      // Confirm address is accessible from the selected module
      await StellarWalletsKit.getAddress();

      setWalletId(StellarWalletsKit.selectedModule?.productId);
    } finally {
      setConnecting(false);
    }
  }, []);

  /** Disconnect from the currently selected wallet. */
  const disconnect = useCallback(async () => {
    await StellarWalletsKit.disconnect();
    setAddress(null);
    setWalletId(undefined);
  }, []);

  /** Open the profile modal (shows connected address, copy button …). */
  const openProfile = useCallback(async () => {
    await StellarWalletsKit.profileModal();
  }, []);

  const value = useMemo(
    () => ({ address, walletId, connecting, connect, disconnect, openProfile }),
    [address, walletId, connecting, connect, disconnect, openProfile],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/* ── Hook ──────────────────────────────────────────────────────────────── */

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return ctx;
}

/* ── Utility ───────────────────────────────────────────────────────────── */

export function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
