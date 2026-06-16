import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { initWalletKit, KitEventType, StellarWalletsKit } from './kit';

interface WalletContextValue {
  address: string | null;
  walletId: string | undefined;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  openProfile: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    initWalletKit();

    const unsub = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
      setAddress(event.payload.address ?? null);
    });

    void StellarWalletsKit.getAddress()
      .then(({ address: addr }) => setAddress(addr))
      .catch(() => setAddress(null));

    return unsub;
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { address: addr } = await StellarWalletsKit.authModal();
      setAddress(addr);
      setWalletId(StellarWalletsKit.selectedModule?.productId);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await StellarWalletsKit.disconnect();
    setAddress(null);
    setWalletId(undefined);
  }, []);

  const openProfile = useCallback(async () => {
    await StellarWalletsKit.profileModal();
  }, []);

  const value = useMemo(
    () => ({
      address,
      walletId,
      connecting,
      connect,
      disconnect,
      openProfile,
    }),
    [address, walletId, connecting, connect, disconnect, openProfile],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return ctx;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
