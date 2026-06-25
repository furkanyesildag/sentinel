import type { Network } from '@blend-capital/blend-sdk';
import { Networks, rpc } from '@stellar/stellar-sdk';

export interface AppConfig {
  sorobanRpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  blendPoolId: string;
  blendBackstopId: string;
  /** Deployed `alert_registry` Soroban contract id (testnet). */
  alertRegistryId: string;
  /** Deployed `risk_monitor` contract id — reads alert_registry cross-contract. */
  riskMonitorId: string;
  explorerBaseUrl: string;
}

export function loadConfigFromEnv(env: Record<string, string | undefined>): AppConfig {
  return {
    sorobanRpcUrl: env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    horizonUrl: env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    networkPassphrase: env.VITE_NETWORK_PASSPHRASE ?? Networks.TESTNET,
    blendPoolId:
      env.VITE_BLEND_POOL_ID ??
      'CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF',
    blendBackstopId:
      env.VITE_BLEND_BACKSTOP_ID ??
      'CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA',
    alertRegistryId:
      env.VITE_ALERT_REGISTRY_ID ??
      'CAMPKYYYATXAZQDIPVDGVMPCP53A5BEQYXI3KIP3XO6S5AOUIB3PFNWV',
    riskMonitorId:
      env.VITE_RISK_MONITOR_ID ??
      'CCLHYNH4GA6IDBNYHSZNKTXIVOPUIFBP3FP43UCCNRHR5RHDSLIQGA5R',
    explorerBaseUrl:
      env.VITE_EXPLORER_BASE_URL ?? 'https://stellar.expert/explorer/testnet',
  };
}

export function createNetwork(config: AppConfig): Network {
  return {
    rpc: config.sorobanRpcUrl,
    passphrase: config.networkPassphrase,
  };
}

export function createRpcServer(config: AppConfig): rpc.Server {
  return new rpc.Server(config.sorobanRpcUrl, { allowHttp: true });
}

export function txExplorerUrl(config: AppConfig, txHash: string): string {
  return `${config.explorerBaseUrl}/tx/${txHash}`;
}

export function contractExplorerUrl(config: AppConfig, contractId: string): string {
  return `${config.explorerBaseUrl}/contract/${contractId}`;
}
