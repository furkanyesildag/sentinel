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
