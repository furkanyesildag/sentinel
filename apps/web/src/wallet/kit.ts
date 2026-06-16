import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { KitEventType, Networks } from '@creit.tech/stellar-wallets-kit/types';

let initialized = false;

export function initWalletKit(): void {
  if (initialized) return;

  StellarWalletsKit.init({
    modules: [new FreighterModule(), new xBullModule(), new AlbedoModule()],
    network: Networks.TESTNET,
  });

  initialized = true;
}

export { StellarWalletsKit, KitEventType };
