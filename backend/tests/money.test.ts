import { describe, it, expect } from 'vitest';
import { round2, computeDiscount, computeBalances } from '../src/utils/money';
import { normalizePhone, isValidLibyanPhone } from '../src/utils/phone';
import { shapeArabic } from '../src/utils/arabic';

describe('money utilities', () => {
  it('rounds to two decimals', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1 / 3)).toBe(0.33);
  });

  it('computes discounts', () => {
    expect(computeDiscount(1000, 'percentage', 10)).toEqual({ discountAmount: 100, finalAmount: 900 });
    expect(computeDiscount(1000, 'fixed', 250.5)).toEqual({ discountAmount: 250.5, finalAmount: 749.5 });
    expect(computeDiscount(1000, 'none', 50)).toEqual({ discountAmount: 0, finalAmount: 1000 });
  });

  it('never returns a negative remaining balance and refuses overpayment', () => {
    expect(computeBalances(500, 200)).toEqual({ paid: 200, remaining: 300 });
    expect(computeBalances(500, 500)).toEqual({ paid: 500, remaining: 0 });
    expect(() => computeBalances(500, 900)).toThrow();
  });
});

describe('phone utilities', () => {
  it('normalizes Libyan numbers to local format', () => {
    expect(normalizePhone('+218912345678')).toBe('0912345678');
    expect(normalizePhone('00218912345678')).toBe('0912345678');
    expect(normalizePhone('0912345678')).toBe('0912345678');
    expect(normalizePhone('091 234 5678')).toBe('0912345678');
  });

  it('validates Libyan mobile numbers', () => {
    expect(isValidLibyanPhone('0912345678')).toBe(true);
    expect(isValidLibyanPhone('0812345678')).toBe(false);
    expect(isValidLibyanPhone('+218912345678')).toBe(true);
    expect(isValidLibyanPhone('091234')).toBe(false);
  });
});

describe('arabic shaper (PDF output)', () => {
  it('keeps latin text untouched and reshapes arabic text', () => {
    expect(shapeArabic('Amwali 2026')).toBe('Amwali 2026');
    const shaped = shapeArabic('أموالي');
    expect(shaped.length).toBeGreaterThan(0);
    expect(shaped).not.toBe('أموالي');
  });
});
