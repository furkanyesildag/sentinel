import { Buffer } from 'buffer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WalletProvider } from './wallet/WalletProvider';
import { DashboardPage } from './pages/DashboardPage';
import { track } from './lib/analytics';
import './index.css';

globalThis.Buffer = Buffer;
track('app_loaded');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <WalletProvider>
        <DashboardPage />
      </WalletProvider>
      <Analytics />
    </ErrorBoundary>
  </StrictMode>,
);
