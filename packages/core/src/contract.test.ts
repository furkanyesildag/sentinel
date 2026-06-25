import { describe, it, expect } from 'vitest';
import { bpsToPercent, percentToBps, riskLevelFromCode } from './contract.js';

describe('bps / percent helpers', () => {
  it('converts bps to percent', () => {
    expect(bpsToPercent(12_000)).toBe(120);
    expect(bpsToPercent(0)).toBe(0);
    expect(bpsToPercent(11_050)).toBe(110.5);
  });

  it('converts percent to bps (rounding fractional inputs)', () => {
    expect(percentToBps(120)).toBe(12_000);
    expect(percentToBps(110.5)).toBe(11_050);
    expect(percentToBps(99.999)).toBe(10_000);
  });

  it('round-trips percent → bps → percent', () => {
    for (const pct of [100, 120, 150, 175]) {
      expect(bpsToPercent(percentToBps(pct))).toBe(pct);
    }
  });
});

describe('riskLevelFromCode', () => {
  it('maps every defined code', () => {
    expect(riskLevelFromCode(0)).toBe('Unconfigured');
    expect(riskLevelFromCode(1)).toBe('Safe');
    expect(riskLevelFromCode(2)).toBe('Warning');
    expect(riskLevelFromCode(3)).toBe('Breached');
  });

  it('defaults out-of-range codes to Unconfigured', () => {
    expect(riskLevelFromCode(99)).toBe('Unconfigured');
    expect(riskLevelFromCode(-1)).toBe('Unconfigured');
  });
});
