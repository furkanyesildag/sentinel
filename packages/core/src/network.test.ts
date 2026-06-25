import { describe, it, expect } from 'vitest';
import { loadConfigFromEnv, validateConfig, txExplorerUrl, contractExplorerUrl } from './network.js';

describe('loadConfigFromEnv', () => {
  it('falls back to testnet defaults when env is empty', () => {
    const c = loadConfigFromEnv({});
    expect(c.sorobanRpcUrl).toMatch(/^https:\/\//);
    expect(c.alertRegistryId).toMatch(/^C[A-Z2-7]{55}$/);
    expect(c.riskMonitorId).toMatch(/^C[A-Z2-7]{55}$/);
  });

  it('prefers provided env values', () => {
    const c = loadConfigFromEnv({ VITE_SOROBAN_RPC_URL: 'https://example.test/rpc' });
    expect(c.sorobanRpcUrl).toBe('https://example.test/rpc');
  });
});

describe('validateConfig', () => {
  it('returns no warnings for a valid (default) config', () => {
    expect(validateConfig(loadConfigFromEnv({}))).toEqual([]);
  });

  it('flags an invalid contract id and a bad rpc url', () => {
    const c = loadConfigFromEnv({ VITE_ALERT_REGISTRY_ID: 'not-a-contract', VITE_SOROBAN_RPC_URL: 'ftp://nope' });
    const warnings = validateConfig(c);
    expect(warnings.some((w) => w.includes('alertRegistryId'))).toBe(true);
    expect(warnings.some((w) => w.includes('sorobanRpcUrl'))).toBe(true);
  });
});

describe('explorer url helpers', () => {
  it('builds tx and contract urls', () => {
    const c = loadConfigFromEnv({});
    expect(txExplorerUrl(c, 'abc')).toBe('https://stellar.expert/explorer/testnet/tx/abc');
    expect(contractExplorerUrl(c, 'CID')).toBe('https://stellar.expert/explorer/testnet/contract/CID');
  });
});
