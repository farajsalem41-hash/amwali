/** Normalizes Libyan phone numbers to a canonical local form: 09XXXXXXXX. */
export function normalizePhone(input: string): string {
  let p = (input || '').replace(/[\s\-()]/g, '').replace(/^\+/, '00');
  if (p.startsWith('00218')) p = '0' + p.slice(5);
  else if (p.startsWith('218') && p.length >= 12) p = '0' + p.slice(3);
  if (p.length === 9 && p.startsWith('9')) p = '0' + p;
  return p;
}

export function isValidLibyanPhone(input: string): boolean {
  const p = normalizePhone(input);
  return /^09[1-6]\d{7}$/.test(p);
}
