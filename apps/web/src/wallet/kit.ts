/**
 * kit.ts — One-time initialisation of @creit.tech/stellar-wallets-kit.
 *
 * StellarWalletsKit is a static singleton. This module ensures init() runs
 * exactly once regardless of how many components import it.
 *
 * Supported modules:
 *   • Freighter  — most popular browser extension
 *   • xBull      — feature-rich Stellar wallet
 *   • Albedo     — web-based, no install required
 */

import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { KitEventType, Networks } from '@creit.tech/stellar-wallets-kit/types';

export { StellarWalletsKit, KitEventType, Networks };
export { FreighterModule, xBullModule, AlbedoModule };

let initialized = false;

export function initWalletKit(): void {
  if (initialized) return;

  StellarWalletsKit.init({
    modules: [new FreighterModule(), new xBullModule(), new AlbedoModule()],
    network: Networks.TESTNET,
  });

  initialized = true;
}
