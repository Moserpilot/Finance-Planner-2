/** Shared formatting / parsing utilities used across multiple pages. */

export function safeCurrency(code: string): string {
  const c = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return 'USD';
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(0);
    return c;
  } catch { return 'USD'; }
}

export function money(n: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function addMonthsISO(startISO: string, add: number): string {
  const ok = /^\d{4}-\d{2}$/.test(startISO);
  const y0 = ok ? Number(startISO.slice(0, 4)) : new Date().getFullYear();
  const m0 = ok ? Number(startISO.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`;
}

export function monthLabel(iso: string): string {
  if (!/^\d{4}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
    new Date(`${iso}-01T00:00:00`)
  );
}

export function parseMoney(v: string): number {
  const n = Number(String(v).replace(/[$,%\s,]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function upsertDated(
  arr: { monthISO: string; amount: number }[],
  monthISO: string,
  amount: number
): { monthISO: string; amount: number }[] {
  const next = [...arr];
  const i = next.findIndex(x => x.monthISO === monthISO);
  if (i >= 0) next[i] = { monthISO, amount };
  else next.push({ monthISO, amount });
  next.sort((a, b) => (a.monthISO < b.monthISO ? -1 : 1));
  return next;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Housing: '#3b82f6',
  'Food & Dining': '#f59e0b',
  Transport: '#8b5cf6',
  Healthcare: '#ef4444',
  Entertainment: '#ec4899',
  Shopping: '#14b8a6',
  Other: '#64748b',
};
