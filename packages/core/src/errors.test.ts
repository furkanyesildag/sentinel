import { describe, it, expect } from 'vitest';
import {
  classifyError,
  WalletNotFoundError,
  UserRejectedError,
  InsufficientBalanceError,
} from './errors.js';

describe('classifyError — typed errors', () => {
  it('classifies WalletNotFoundError', () => {
    expect(classifyError(new WalletNotFoundError()).kind).toBe('wallet-not-found');
  });
  it('classifies UserRejectedError', () => {
    expect(classifyError(new UserRejectedError()).kind).toBe('user-rejected');
  });
  it('classifies InsufficientBalanceError', () => {
    expect(classifyError(new InsufficientBalanceError()).kind).toBe('insufficient-balance');
  });
});

describe('classifyError — message heuristics', () => {
  it('detects user rejection', () => {
    expect(classifyError(new Error('User declined the request')).kind).toBe('user-rejected');
    expect(classifyError('The request was rejected').kind).toBe('user-rejected');
    expect(classifyError(new Error('Modal closed by user')).kind).toBe('user-rejected');
  });

  it('detects insufficient balance incl. Horizon 404 / unfunded account', () => {
    expect(classifyError(new Error('tx_insufficient_balance')).kind).toBe('insufficient-balance');
    expect(classifyError(new Error('op_underfunded')).kind).toBe('insufficient-balance');
    expect(classifyError(new Error('Request failed with status code 404')).kind).toBe('insufficient-balance');
    expect(classifyError(new Error('account not found')).kind).toBe('insufficient-balance');
  });

  it('does not misclassify "account not found" as wallet-not-found', () => {
    // "not found" is a wallet-not-found token, but insufficient-balance is checked first.
    expect(classifyError(new Error('account not found')).kind).toBe('insufficient-balance');
  });

  it('detects wallet not found / unavailable', () => {
    expect(classifyError(new Error('Freighter is not available')).kind).toBe('wallet-not-found');
    expect(classifyError(new Error('No wallet selected')).kind).toBe('wallet-not-found');
    expect(classifyError(new Error('extension not installed')).kind).toBe('wallet-not-found');
  });

  it('detects network errors', () => {
    expect(classifyError(new Error('Failed to fetch')).kind).toBe('network');
    expect(classifyError(new Error('request timed out')).kind).toBe('network');
  });
});

describe('classifyError — shape & fallback', () => {
  it('falls back to unknown and preserves the message', () => {
    const e = classifyError(new Error('totally weird internal failure'));
    expect(e.kind).toBe('unknown');
    expect(e.message).toContain('totally weird');
  });

  it('always returns a non-empty title and message, even for null', () => {
    const e = classifyError(null);
    expect(e.title).toBeTruthy();
    expect(e.message).toBeTruthy();
  });

  it('extracts message from plain objects', () => {
    expect(classifyError({ message: 'User rejected signature' }).kind).toBe('user-rejected');
  });
});
