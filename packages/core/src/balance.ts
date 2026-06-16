import { Horizon } from '@stellar/stellar-sdk';
import type { AppConfig } from './network.js';

export function createHorizonServer(config: AppConfig): Horizon.Server {
  return new Horizon.Server(config.horizonUrl);
}

/** Returns native XLM balance as a decimal string (e.g. "125.5000000"). */
export async function fetchNativeXlmBalance(
  config: AppConfig,
  address: string,
): Promise<string> {
  const server = createHorizonServer(config);
  const account = await server.loadAccount(address);
  const native = account.balances.find((b) => b.asset_type === 'native');
  if (!native || native.asset_type !== 'native') {
    return '0';
  }
  return native.balance;
}

export function formatXlmBalance(balance: string): string {
  const num = Number.parseFloat(balance);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}
