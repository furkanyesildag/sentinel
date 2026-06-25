import { Buffer } from 'buffer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WalletProvider } from './wallet/WalletProvider';
import { DashboardPage } from './pages/DashboardPage';
import './index.css';

globalThis.Buffer = Buffer;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <WalletProvider>
        <DashboardPage />
      </WalletProvider>
    </ErrorBoundary>
  </StrictMode>,
);
