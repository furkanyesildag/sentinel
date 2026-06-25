/**
 * contract.ts — typed client for the deployed `alert_registry` Soroban contract.
 *
 * Read  (no signature):  `readThreshold`  → simulates `get_threshold`
 * Write (needs signature): `buildSetThresholdTx` / `buildRemoveThresholdTx`
 *     → build + simulate + assemble an invocation, returned as XDR for the
 *       wallet to sign. Submit the signed XDR with `submitSignedTransaction`.
 * Events: `fetchThresholdEvents` → reads `ThresholdSet` / `ThresholdRemoved`
 *     contract events back from the network for the live activity feed.
 */

import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import type { AppConfig } from './network.js';
import { createRpcServer } from './network.js';
import { InsufficientBalanceError } from './errors.js';

/** Threshold in basis points → human percent (12000 → 120). */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** Human percent → basis points (120 → 12000). */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/**
 * Read the current on-chain alert threshold (in bps) for `user`.
 *
 * This is a read-only simulation: it costs nothing, needs no signature, and
 * works even for an unfunded account (we pass a zero-sequence placeholder).
 */
export async function readThreshold(config: AppConfig, user: string): Promise<number> {
  const server = createRpcServer(config);
  const contract = new Contract(config.alertRegistryId);

  // get_threshold takes no auth, so a placeholder source account is sufficient
  // and avoids a network round-trip to fetch the real sequence number.
  const source = new Account(user, '0');
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('get_threshold', Address.fromString(user).toScVal()))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const retval = sim.result?.retval;
  if (!retval) return 0;
  return Number(scValToNative(retval) ?? 0);
}

/**
 * Build a prepared (simulated + resource-assembled) `set_threshold` transaction.
 * Returns XDR ready for the wallet to sign.
 *
 * Throws `InsufficientBalanceError` when the source account is not funded.
 */
export async function buildSetThresholdTx(
  config: AppConfig,
  source: string,
  user: string,
  thresholdBps: number,
): Promise<string> {
  const server = createRpcServer(config);
  const account = await loadSourceAccount(server, source);
  const contract = new Contract(config.alertRegistryId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'set_threshold',
        Address.fromString(user).toScVal(),
        nativeToScVal(thresholdBps, { type: 'u32' }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

/** Build a prepared `remove_threshold` transaction, returned as XDR for signing. */
export async function buildRemoveThresholdTx(
  config: AppConfig,
  source: string,
  user: string,
): Promise<string> {
  const server = createRpcServer(config);
  const account = await loadSourceAccount(server, source);
  const contract = new Contract(config.alertRegistryId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('remove_threshold', Address.fromString(user).toScVal()))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

async function loadSourceAccount(server: rpc.Server, source: string): Promise<Account> {
  try {
    return await server.getAccount(source);
  } catch (err) {
    // A 404 here means the account has never been funded on this network.
    throw new InsufficientBalanceError(
      `Account ${source.slice(0, 6)}… is not funded on this network.`,
    );
  }
}

/* ── Events ──────────────────────────────────────────────────────────────── */

export interface ThresholdEvent {
  type: 'set' | 'removed';
  user: string;
  /** bps for `set` events; null for `removed`. */
  bps: number | null;
  ledger: number;
  txHash: string;
  createdAt: string;
}

function safeNative(val: unknown): unknown {
  try {
    return scValToNative(val as never);
  } catch {
    return undefined;
  }
}

/**
 * Fetch recent `ThresholdSet` / `ThresholdRemoved` events emitted by the
 * registry contract, newest first. Used for the live activity feed and to
 * confirm that a write landed on-chain (state synchronisation).
 *
 * The lookback window is clamped down on retry so the call still succeeds when
 * the requested start ledger is older than the RPC's retention window.
 */
export async function fetchThresholdEvents(
  config: AppConfig,
  opts: { limit?: number } = {},
): Promise<ThresholdEvent[]> {
  const server = createRpcServer(config);
  const limit = opts.limit ?? 15;
  const { sequence } = await server.getLatestLedger();

  // Try progressively smaller windows until one falls inside RPC retention.
  const lookbacks = [9000, 4000, 1500, 400];
  let lastErr: unknown;

  for (const lookback of lookbacks) {
    const startLedger = Math.max(sequence - lookback, 1);
    try {
      const resp = await server.getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds: [config.alertRegistryId] }],
        limit,
      });

      return resp.events
        .map((ev): ThresholdEvent | null => {
          const topics = ev.topic.map(safeNative);
          const action = String(topics[1] ?? '');
          const user = typeof topics[2] === 'string' ? topics[2] : '';
          const type: ThresholdEvent['type'] = action === 'removed' ? 'removed' : 'set';
          const bps = type === 'set' ? Number(safeNative(ev.value) ?? 0) : null;
          if (!user) return null;
          return { type, user, bps, ledger: ev.ledger, txHash: ev.txHash, createdAt: ev.ledgerClosedAt };
        })
        .filter((e): e is ThresholdEvent => e !== null)
        .reverse();
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Failed to load contract events');
}

/* ── Risk monitor (inter-contract) ───────────────────────────────────────── */

export type RiskLevel = 'Unconfigured' | 'Safe' | 'Warning' | 'Breached';

const RISK_BY_CODE: RiskLevel[] = ['Unconfigured', 'Safe', 'Warning', 'Breached'];

export function riskLevelFromCode(code: number): RiskLevel {
  return RISK_BY_CODE[code] ?? 'Unconfigured';
}

/** Decode the `RiskLevel` enum returned by `assess` (a unit-variant enum). */
function decodeRiskLevel(val: unknown): RiskLevel {
  const n = safeNative(val);
  let name: string;
  if (Array.isArray(n)) name = String(n[0]);
  else if (typeof n === 'string') name = n;
  else if (n && typeof n === 'object' && 'tag' in (n as object)) name = String((n as { tag: unknown }).tag);
  else name = String(n);
  return (RISK_BY_CODE.find((l) => l === name) ?? 'Unconfigured');
}

/**
 * Read-only risk assessment: simulates `risk_monitor.assess`, which performs a
 * cross-contract call into `alert_registry` to read the user's threshold and
 * classify their current health factor. No signature, no fee.
 */
export async function assessRisk(
  config: AppConfig,
  user: string,
  currentHfBps: number,
): Promise<RiskLevel> {
  const server = createRpcServer(config);
  const contract = new Contract(config.riskMonitorId);
  const source = new Account(user, '0');
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'assess',
        Address.fromString(user).toScVal(),
        nativeToScVal(currentHfBps, { type: 'u32' }),
      ),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  return decodeRiskLevel(sim.result?.retval);
}

/**
 * Build a prepared `assess` transaction for signing. Submitting it persists the
 * `RiskAssessed` / `AlertTriggered` events on-chain so they appear in the live
 * event stream.
 */
export async function buildAssessTx(
  config: AppConfig,
  source: string,
  user: string,
  currentHfBps: number,
): Promise<string> {
  const server = createRpcServer(config);
  const account = await loadSourceAccount(server, source);
  const contract = new Contract(config.riskMonitorId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'assess',
        Address.fromString(user).toScVal(),
        nativeToScVal(currentHfBps, { type: 'u32' }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

export interface RiskEvent {
  type: 'assessed' | 'alert';
  user: string;
  level: RiskLevel;
  currentHfBps: number;
  thresholdBps: number;
  ledger: number;
  txHash: string;
  createdAt: string;
}

/** Fetch recent RiskAssessed / AlertTriggered events, newest first. */
export async function fetchRiskEvents(
  config: AppConfig,
  opts: { limit?: number } = {},
): Promise<RiskEvent[]> {
  const server = createRpcServer(config);
  const limit = opts.limit ?? 15;
  const { sequence } = await server.getLatestLedger();
  const lookbacks = [9000, 4000, 1500, 400];
  let lastErr: unknown;

  for (const lookback of lookbacks) {
    const startLedger = Math.max(sequence - lookback, 1);
    try {
      const resp = await server.getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds: [config.riskMonitorId] }],
        limit,
      });

      return resp.events
        .map((ev): RiskEvent | null => {
          const topics = ev.topic.map(safeNative);
          const action = String(topics[1] ?? '');
          const user = typeof topics[2] === 'string' ? topics[2] : '';
          const data = (safeNative(ev.value) ?? {}) as Record<string, unknown>;
          if (!user) return null;
          return {
            type: action === 'alert' ? 'alert' : 'assessed',
            user,
            level: riskLevelFromCode(Number(data.level ?? 0)),
            currentHfBps: Number(data.current_hf_bps ?? 0),
            thresholdBps: Number(data.threshold_bps ?? 0),
            ledger: ev.ledger,
            txHash: ev.txHash,
            createdAt: ev.ledgerClosedAt,
          };
        })
        .filter((e): e is RiskEvent => e !== null)
        .reverse();
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Failed to load risk events');
}
