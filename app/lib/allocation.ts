import type { Plan } from './store';

export type AllocationSlice = {
  key: 'cash' | 'taxable' | 'retirement' | 'other';
  label: string;
  value: number;
  color: string;
};

const COLORS: Record<AllocationSlice['key'], string> = {
  cash: '#22c55e',
  taxable: '#3b82f6',
  retirement: '#8b5cf6',
  other: '#64748b',
};

const LABELS: Record<AllocationSlice['key'], string> = {
  cash: 'Cash',
  taxable: 'Taxable',
  retirement: 'Retirement',
  other: 'Other',
};

export function monthTotalForAccount(plan: Plan, accountId: string, monthISO: string): number {
  const acct = plan.netWorthAccounts.find((a) => a.id === accountId);
  if (!acct || !acct.balances || acct.balances.length === 0) return 0;
  const exact = acct.balances.find((b) => b.monthISO === monthISO);
  if (exact && Number.isFinite(exact.amount)) return exact.amount;
  const prior = acct.balances
    .filter((b) => b.monthISO <= monthISO && Number.isFinite(b.amount))
    .sort((a, b) => (a.monthISO > b.monthISO ? -1 : 1));
  if (prior.length > 0) return prior[0].amount;
  return 0;
}

function latestBalanceMonth(plan: Plan): string | null {
  let latest: string | null = null;
  for (const acct of plan.netWorthAccounts || []) {
    for (const b of acct.balances || []) {
      if (b.monthISO && Number.isFinite(b.amount)) {
        if (!latest || b.monthISO > latest) latest = b.monthISO;
      }
    }
  }
  return latest;
}

export function buildAllocation(plan: Plan, monthISO?: string): AllocationSlice[] {
  const asOfMonth = monthISO || latestBalanceMonth(plan) || plan.startMonthISO || '2026-01';
  const buckets: Record<AllocationSlice['key'], number> = { cash: 0, taxable: 0, retirement: 0, other: 0 };
  for (const acct of plan.netWorthAccounts || []) {
    const type = (acct.type || 'other') as AllocationSlice['key'];
    const key = Object.prototype.hasOwnProperty.call(buckets, type) ? type : 'other';
    buckets[key] += monthTotalForAccount(plan, acct.id, asOfMonth);
  }
  return (['cash', 'taxable', 'retirement', 'other'] as AllocationSlice['key'][])
    .map((key) => ({ key, label: LABELS[key], value: buckets[key], color: COLORS[key] }))
    .filter((slice) => slice.value > 0);
}

export function allocationTotal(slices: AllocationSlice[]): number {
  return slices.reduce((s, x) => s + Math.max(0, x.value), 0);
}