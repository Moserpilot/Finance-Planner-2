import type { Plan } from './store';
import { snapshotMonthAtOrBefore } from './engine';

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

export function monthTotalForAccount(
  plan: Plan,
  accountId: string,
  monthISO: string
): number {
  const acct = plan.netWorthAccounts.find((a) => a.id === accountId);
  if (!acct) return 0;
  const balance = (acct.balances || []).find((b) => b.monthISO === monthISO);
  return Number.isFinite(balance?.amount) ? Number(balance?.amount) : 0;
}

export function buildAllocation(plan: Plan, monthISO?: string): AllocationSlice[] {
  const asOfMonth = monthISO || snapshotMonthAtOrBefore(plan, '9999-12') || plan.startMonthISO;

  const buckets: Record<AllocationSlice['key'], number> = {
    cash: 0,
    taxable: 0,
    retirement: 0,
    other: 0,
  };

  for (const acct of plan.netWorthAccounts || []) {
    const t = acct.type || 'taxable';
    const v = monthTotalForAccount(plan, acct.id, asOfMonth);
    buckets[t] += v;
  }

  return (Object.keys(buckets) as AllocationSlice['key'][])
    .map((key) => ({
      key,
      label: key[0].toUpperCase() + key.slice(1),
      value: buckets[key],
      color: COLORS[key],
    }));
}

export function allocationTotal(slices: AllocationSlice[]) {
  return slices.reduce((s, x) => s + x.value, 0);
}