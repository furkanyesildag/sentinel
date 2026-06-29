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
  xdr,
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

/* ── Guardian (liquidation protection) ───────────────────────────────────── */

export interface GuardianPolicy {
  thresholdBps: number;
  beneficiary: string;
  active: boolean;
}

/** Read a user's protection policy, or null if they have none. */
export async function readPolicy(config: AppConfig, user: string): Promise<GuardianPolicy | null> {
  const server = createRpcServer(config);
  const contract = new Contract(config.guardianId);
  const source = new Account(user, '0');

  const sim = await simulateView(server, source, config, contract.call('has_policy', Address.fromString(user).toScVal()));
  if (!sim || safeNative(sim) !== true) return null;

  const policySim = await simulateView(server, source, config, contract.call('get_policy', Address.fromString(user).toScVal()));
  const raw = safeNative(policySim) as Record<string, unknown> | undefined;
  if (!raw) return null;
  return {
    thresholdBps: Number(raw.threshold_bps ?? 0),
    beneficiary: String(raw.beneficiary ?? ''),
    active: Boolean(raw.active),
  };
}

/** Read a user's reserve balance in stroops (1 XLM = 10,000,000 stroops). */
export async function readReserve(config: AppConfig, user: string): Promise<number> {
  const server = createRpcServer(config);
  const contract = new Contract(config.guardianId);
  const source = new Account(user, '0');
  const sim = await simulateView(server, source, config, contract.call('get_reserve', Address.fromString(user).toScVal()));
  return Number(safeNative(sim) ?? 0);
}

async function simulateView(
  server: rpc.Server,
  source: Account,
  config: AppConfig,
  op: xdr.Operation,
): Promise<xdr.ScVal | undefined> {
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: config.networkPassphrase })
    .addOperation(op)
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return sim.result?.retval;
}

export async function buildSetPolicyTx(config: AppConfig, source: string, user: string, thresholdBps: number): Promise<string> {
  return buildGuardianTx(config, source, 'set_policy', [
    Address.fromString(user).toScVal(),
    nativeToScVal(thresholdBps, { type: 'u32' }),
  ]);
}

export async function buildFundReserveTx(config: AppConfig, source: string, user: string, amountStroops: number): Promise<string> {
  return buildGuardianTx(config, source, 'fund_reserve', [
    Address.fromString(user).toScVal(),
    nativeToScVal(BigInt(Math.round(amountStroops)), { type: 'i128' }),
  ]);
}

export async function buildWithdrawReserveTx(config: AppConfig, source: string, user: string, amountStroops: number): Promise<string> {
  return buildGuardianTx(config, source, 'withdraw_reserve', [
    Address.fromString(user).toScVal(),
    nativeToScVal(BigInt(Math.round(amountStroops)), { type: 'i128' }),
  ]);
}

export async function buildProtectTx(config: AppConfig, source: string, user: string, currentHfBps: number): Promise<string> {
  return buildGuardianTx(config, source, 'protect', [
    Address.fromString(user).toScVal(),
    nativeToScVal(currentHfBps, { type: 'u32' }),
  ]);
}

async function buildGuardianTx(config: AppConfig, source: string, fn: string, args: xdr.ScVal[]): Promise<string> {
  const server = createRpcServer(config);
  const account = await loadSourceAccount(server, source);
  const contract = new Contract(config.guardianId);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: config.networkPassphrase })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(30)
    .build();
  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

export interface GuardianEvent {
  type: 'policy' | 'funded' | 'withdrawn' | 'protected';
  user: string;
  amount: number | null;
  ledger: number;
  txHash: string;
  createdAt: string;
}

const GUARDIAN_ACTIONS: Record<string, GuardianEvent['type']> = {
  policy: 'policy',
  funded: 'funded',
  withdrawn: 'withdrawn',
  protected: 'protected',
};

/** Fetch recent guardian events (policy / funded / withdrawn / protected). */
export async function fetchGuardianEvents(config: AppConfig, opts: { limit?: number } = {}): Promise<GuardianEvent[]> {
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
        filters: [{ type: 'contract', contractIds: [config.guardianId] }],
        limit,
      });
      return resp.events
        .map((ev): GuardianEvent | null => {
          const topics = ev.topic.map(safeNative);
          const action = GUARDIAN_ACTIONS[String(topics[1] ?? '')];
          const user = typeof topics[2] === 'string' ? topics[2] : '';
          if (!action || !user) return null;
          const data = safeNative(ev.value);
          let amount: number | null = null;
          if (data && typeof data === 'object') {
            const d = data as Record<string, unknown>;
            amount = d.amount != null ? Number(d.amount) : null;
          } else if (typeof data === 'bigint' || typeof data === 'number') {
            amount = Number(data);
          }
          return { type: action, user, amount, ledger: ev.ledger, txHash: ev.txHash, createdAt: ev.ledgerClosedAt };
        })
        .filter((e): e is GuardianEvent => e !== null)
        .reverse();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to load guardian events');
}

/* ── Network activity (analytics + user-interaction proof) ───────────────── */

export interface ActivityItem {
  contract: 'alert_registry' | 'risk_monitor' | 'guardian';
  label: string;
  user: string;
  txHash: string;
  ledger: number;
  createdAt: string;
}

export interface ActivityStats {
  /** Distinct wallet addresses that have interacted with any contract. */
  uniqueWallets: number;
  /** Distinct on-chain transactions across the contracts. */
  totalTransactions: number;
  /** Total decoded contract events. */
  totalEvents: number;
  byContract: { alert_registry: number; risk_monitor: number; guardian: number };
  wallets: string[];
  recent: ActivityItem[];
}

/**
 * Aggregate recent activity across all Sentinel contracts into network stats.
 * The unique-wallet count is real, on-chain proof of distinct user interactions.
 */
export async function fetchActivityStats(config: AppConfig, opts: { limit?: number } = {}): Promise<ActivityStats> {
  const limit = opts.limit ?? 60;
  const [thresholds, risks, guardians] = await Promise.allSettled([
    fetchThresholdEvents(config, { limit }),
    fetchRiskEvents(config, { limit }),
    fetchGuardianEvents(config, { limit }),
  ]);

  const items: ActivityItem[] = [];
  if (thresholds.status === 'fulfilled') {
    for (const e of thresholds.value) {
      items.push({ contract: 'alert_registry', label: e.type === 'set' ? 'Threshold set' : 'Threshold removed', user: e.user, txHash: e.txHash, ledger: e.ledger, createdAt: e.createdAt });
    }
  }
  if (risks.status === 'fulfilled') {
    for (const e of risks.value) {
      items.push({ contract: 'risk_monitor', label: e.type === 'alert' ? `Alert · ${e.level}` : `Risk · ${e.level}`, user: e.user, txHash: e.txHash, ledger: e.ledger, createdAt: e.createdAt });
    }
  }
  if (guardians.status === 'fulfilled') {
    for (const e of guardians.value) {
      const label = e.type === 'protected' ? 'Protected' : e.type === 'funded' ? 'Reserve funded' : e.type === 'withdrawn' ? 'Reserve withdrawn' : 'Policy set';
      items.push({ contract: 'guardian', label, user: e.user, txHash: e.txHash, ledger: e.ledger, createdAt: e.createdAt });
    }
  }

  const wallets = Array.from(new Set(items.map((i) => i.user).filter(Boolean)));
  const txs = new Set(items.map((i) => i.txHash));
  const recent = items.sort((a, b) => b.ledger - a.ledger).slice(0, 20);

  return {
    uniqueWallets: wallets.length,
    totalTransactions: txs.size,
    totalEvents: items.length,
    byContract: {
      alert_registry: items.filter((i) => i.contract === 'alert_registry').length,
      risk_monitor: items.filter((i) => i.contract === 'risk_monitor').length,
      guardian: items.filter((i) => i.contract === 'guardian').length,
    },
    wallets,
    recent,
  };
}

/** Stroops <-> XLM helpers. */
export const STROOPS_PER_XLM = 10_000_000;
export function stroopsToXlm(stroops: number): number {
  return stroops / STROOPS_PER_XLM;
}
export function xlmToStroops(xlm: number): number {
  return Math.round(xlm * STROOPS_PER_XLM);
}
