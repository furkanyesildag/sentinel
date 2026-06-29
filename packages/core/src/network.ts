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
  /** Deployed `guardian` contract id — opt-in liquidation protection. */
  guardianId: string;
  /** Reserve asset contract (native XLM Stellar Asset Contract). */
  reserveTokenId: string;
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
    guardianId:
      env.VITE_GUARDIAN_ID ??
      'CCBOH4QO4UQ5MR4EJV2VOWOGP3S5J2T5ZPXQHNXSJJKDTVYO7UKQMGTK',
    reserveTokenId:
      env.VITE_RESERVE_TOKEN_ID ??
      'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    explorerBaseUrl:
      env.VITE_EXPLORER_BASE_URL ?? 'https://stellar.expert/explorer/testnet',
  };
}

/**
 * Validate a loaded config and return a list of human-readable warnings
 * (empty when everything looks right). Non-throwing so a single bad env var
 * never hard-crashes the app — callers decide how loudly to surface issues.
 */
export function validateConfig(config: AppConfig): string[] {
  const warnings: string[] = [];
  const isContractId = (id: string) => /^C[A-Z2-7]{55}$/.test(id);
  const isUrl = (u: string) => /^https?:\/\//.test(u);

  if (!isContractId(config.alertRegistryId)) warnings.push(`alertRegistryId "${config.alertRegistryId}" is not a valid contract id`);
  if (!isContractId(config.riskMonitorId)) warnings.push(`riskMonitorId "${config.riskMonitorId}" is not a valid contract id`);
  if (!isContractId(config.guardianId)) warnings.push(`guardianId "${config.guardianId}" is not a valid contract id`);
  if (!isContractId(config.blendPoolId)) warnings.push(`blendPoolId "${config.blendPoolId}" is not a valid contract id`);
  if (!isUrl(config.sorobanRpcUrl)) warnings.push('sorobanRpcUrl must be an http(s) URL');
  if (!isUrl(config.horizonUrl)) warnings.push('horizonUrl must be an http(s) URL');
  if (!config.networkPassphrase) warnings.push('networkPassphrase is empty');

  return warnings;
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
