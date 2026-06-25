/**
 * errors.ts — typed wallet / transaction error handling.
 *
 * Level 2 requires explicit handling of at least three error classes. We model
 * them as dedicated error subclasses plus a `classifyError` helper that maps any
 * thrown value (wallet-kit error, RPC error, Horizon 404, …) onto a small set of
 * user-facing kinds with a title, message and actionable hint.
 *
 * Handled kinds:
 *   • wallet-not-found     — no wallet installed / selected / reachable
 *   • user-rejected        — the user declined the signature or closed the modal
 *   • insufficient-balance — account unfunded or lacks XLM to pay the fee
 *   • network              — RPC / Horizon transport failure
 *   • unknown              — anything we could not confidently classify
 */

export type AppErrorKind =
  | 'wallet-not-found'
  | 'user-rejected'
  | 'insufficient-balance'
  | 'network'
  | 'unknown';

export interface AppError {
  kind: AppErrorKind;
  /** Short, human title for the error banner. */
  title: string;
  /** One-line explanation safe to show to the user. */
  message: string;
  /** Optional actionable next step. */
  hint?: string;
  /** Raw error message, preserved for debugging / display. */
  raw?: string;
}

/* ── Typed errors the app can throw proactively ──────────────────────────── */

export class WalletNotFoundError extends Error {
  constructor(message = 'No Stellar wallet is available.') {
    super(message);
    this.name = 'WalletNotFoundError';
  }
}

export class UserRejectedError extends Error {
  constructor(message = 'The request was rejected in the wallet.') {
    super(message);
    this.name = 'UserRejectedError';
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message = 'The account has insufficient XLM balance.') {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

/* ── Classification ──────────────────────────────────────────────────────── */

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function matches(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

const PRESETS: Record<Exclude<AppErrorKind, 'unknown'>, Omit<AppError, 'raw' | 'kind'>> = {
  'wallet-not-found': {
    title: 'Wallet not found',
    message: 'No Stellar wallet extension was detected or selected.',
    hint: 'Install Freighter (or pick xBull / Albedo in the picker) and reload, then connect again.',
  },
  'user-rejected': {
    title: 'Request rejected',
    message: 'You declined the request in your wallet.',
    hint: 'Approve the signature in the wallet popup to continue.',
  },
  'insufficient-balance': {
    title: 'Insufficient balance',
    message: 'This account is unfunded or does not have enough XLM to cover the network fee.',
    hint: 'Fund the account on testnet with Friendbot, then try again.',
  },
  network: {
    title: 'Network error',
    message: 'Could not reach the Stellar network (RPC / Horizon).',
    hint: 'Check your connection and retry in a moment.',
  },
};

export function classifyError(err: unknown): AppError {
  const raw = rawMessage(err);
  const m = raw.toLowerCase();

  // Subclass checks take priority over string heuristics.
  if (err instanceof WalletNotFoundError) return { kind: 'wallet-not-found', ...PRESETS['wallet-not-found'], raw };
  if (err instanceof UserRejectedError) return { kind: 'user-rejected', ...PRESETS['user-rejected'], raw };
  if (err instanceof InsufficientBalanceError) return { kind: 'insufficient-balance', ...PRESETS['insufficient-balance'], raw };

  // 1) User-rejected — checked first because some wallets phrase it with "not".
  if (
    matches(m, [
      'reject',
      'denied',
      'declined',
      'cancel',
      'user closed',
      'closed the modal',
      'modal closed',
      'request was rejected',
      'did not approve',
      'not approve',
      'user refused',
    ])
  ) {
    return { kind: 'user-rejected', ...PRESETS['user-rejected'], raw };
  }

  // 2) Insufficient balance — includes the Horizon 404 "account not found" case,
  //    which on testnet means the account was never funded.
  if (
    matches(m, [
      'insufficient',
      'underfunded',
      'op_underfunded',
      'txinsufficientbalance',
      'tx_insufficient_balance',
      'not enough',
      'too low',
      'account not found',
      'account_not_found',
      'resource missing',
      'status code 404',
      'not found on the network',
    ])
  ) {
    return { kind: 'insufficient-balance', ...PRESETS['insufficient-balance'], raw };
  }

  // 3) Wallet not found / unavailable.
  if (
    matches(m, [
      'wallet not found',
      'no wallet',
      'wallet is not',
      'not installed',
      'not available',
      'no public key',
      'unable to obtain',
      'no such wallet',
      'freighter',
      'xbull',
      'albedo',
      'extension not',
      'no module',
      'could not connect to wallet',
    ])
  ) {
    return { kind: 'wallet-not-found', ...PRESETS['wallet-not-found'], raw };
  }

  // 4) Network / transport.
  if (matches(m, ['failed to fetch', 'network error', 'timeout', 'timed out', 'econnrefused', 'fetch failed', 'load failed'])) {
    return { kind: 'network', ...PRESETS.network, raw };
  }

  return {
    kind: 'unknown',
    title: 'Something went wrong',
    message: raw || 'An unexpected error occurred.',
    raw,
  };
}
