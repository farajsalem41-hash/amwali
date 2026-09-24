/** All money is handled as numbers rounded to 2 decimals. Backend is the only source of truth. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type DiscountType = 'none' | 'fixed' | 'percentage';

export interface DiscountResult {
  discountAmount: number;
  finalAmount: number;
}

export function computeDiscount(originalAmount: number, discountType: DiscountType, discountValue: number): DiscountResult {
  const original = round2(originalAmount);
  if (original < 0) throw new Error('originalAmount must be >= 0');
  let discountAmount = 0;
  if (discountType === 'fixed') {
    discountAmount = round2(Math.max(0, discountValue));
  } else if (discountType === 'percentage') {
    const pct = Math.min(100, Math.max(0, discountValue));
    discountAmount = round2((original * pct) / 100);
  }
  if (discountAmount > original) discountAmount = original;
  return { discountAmount, finalAmount: round2(original - discountAmount) };
}

/** Enforces the business rules: paid <= final and remaining >= 0. */
export function computeBalances(finalAmount: number, paidAmount: number): { paid: number; remaining: number } {
  const final = round2(finalAmount);
  const paid = round2(paidAmount);
  if (paid > final + 0.001) {
    throw new Error('paid amount cannot exceed final amount');
  }
  const remaining = round2(Math.max(0, final - paid));
  return { paid, remaining };
}
