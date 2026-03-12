// app/components/SidebarAssumptions.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

type AllocationBucket = 'Cash' | 'Investments' | 'Retirement' | 'Other';

type AllocationRow = {
  key: AllocationBucket;
  label: AllocationBucket;
  value: number;
  color: string;
};

const BUCKET_COLORS: Record<AllocationBucket, string> = {
  Cash: '#22c55e',
  Investments: '#3b82f6',
  Retirement: '#8b5cf6',
  Other: '#94a3b8',
};

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return 'USD';
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(0);
    return c;
  } catch {
    return 'USD';
  }
}

function toMonthISO(v: string) {
  return /^\d{4}-\d{2}$/.test(v) ? v : '2026-01';
}

function parseMoneyLoose(v: string) {
  const cleaned = String(v).replace(/[$,%\s,]+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function toNumberLoose(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,%\s,]+/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return (
      toNumberLoose(o.amount) ||
      toNumberLoose(o.balance) ||
      toNumberLoose(o.value) ||
      toNumberLoose(o.total)
    );
  }
  return 0;
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function compactMoney(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(n) ? n : 0);
}
function normalizeBucket(v: unknown): AllocationBucket {
  const s = String(v ?? '').toLowerCase();
  if (s.includes('cash') || s.includes('checking') || s.includes('savings') || s.includes('money market')) return 'Cash';
  if (s.includes('taxable') || s.includes('brokerage') || s.includes('invest') || s.includes('stock') || s.includes('etf') || s.includes('fund')) return 'Investments';
  if (s.includes('retire') || s.includes('ira') || s.includes('401k') || s.includes('403b') || s.includes('roth') || s.includes('pension')) return 'Retirement';
  return 'Other';
}

function emptyBuckets(): Record<AllocationBucket, number> {
  return { Cash: 0, Investments: 0, Retirement: 0, Other: 0 };
}

function rowsFromBuckets(buckets: Record<AllocationBucket, number>): AllocationRow[] {
  return (Object.keys(buckets) as AllocationBucket[])
    .map((k) => ({ key: k, label: k, value: buckets[k], color: BUCKET_COLORS[k] }))
    .filter((r) => r.value > 0);
}

function pickLatestFromRows(rowsLike: unknown): number {
  if (!Array.isArray(rowsLike)) return 0;
  const entries = rowsLike
    .map((v) => {
      if (!v || typeof v !== 'object') return null;
      const row = v as Record<string, unknown>;
      const monthISO = String(row.monthISO ?? row.month ?? row.date ?? '').trim();
      const amount = toNumberLoose(row.amount ?? row.balance ?? row.value);
      if (!/^\d{4}-\d{2}$/.test(monthISO) || !Number.isFinite(amount)) return null;
      return { monthISO, amount };
    })
    .filter((x): x is { monthISO: string; amount: number } => !!x)
    .sort((a, b) => (a.monthISO < b.monthISO ? -1 : a.monthISO > b.monthISO ? 1 : 0));

  return entries.length ? entries[entries.length - 1].amount : 0;
}

function pickLatestFromMap(mapLike: unknown): number {
  if (!mapLike || typeof mapLike !== 'object' || Array.isArray(mapLike)) return 0;
  const entries = Object.entries(mapLike as Record<string, unknown>)
    .filter(([k]) => /^\d{4}-\d{2}$/.test(k))
    .map(([k, v]) => ({ monthISO: k, amount: toNumberLoose(v) }))
    .filter((x) => Number.isFinite(x.amount))
    .sort((a, b) => (a.monthISO < b.monthISO ? -1 : a.monthISO > b.monthISO ? 1 : 0));

  return entries.length ? entries[entries.length - 1].amount : 0;
}

function latestAccountAmount(acct: Record<string, unknown>): number {
  return (
    pickLatestFromRows(acct.balances) ||
    pickLatestFromRows(acct.history) ||
    pickLatestFromRows(acct.snapshots) ||
    pickLatestFromMap(acct.balances) ||
    pickLatestFromMap(acct.history) ||
    pickLatestFromMap(acct.snapshots) ||
    pickLatestFromMap(acct.balancesByMonth) ||
    pickLatestFromMap(acct.historyByMonth) ||
    pickLatestFromMap(acct.snapshotsByMonth) ||
    toNumberLoose(acct.latestBalance ?? acct.currentBalance ?? acct.balance ?? acct.value ?? acct.amount)
  );
}

function allocationFromAccounts(accountsLike: unknown): AllocationRow[] {
  if (!Array.isArray(accountsLike)) return [];
  const buckets = emptyBuckets();

  for (const item of accountsLike) {
    if (!item || typeof item !== 'object') continue;
    const acct = item as Record<string, unknown>;
    const amount = latestAccountAmount(acct);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const bucketLike = acct.type ?? acct.accountType ?? acct.bucket ?? acct.category ?? acct.label ?? acct.name;
    const bucket = normalizeBucket(bucketLike);
    buckets[bucket] += amount;
  }

  return rowsFromBuckets(buckets);
}

function allocationFromAllocationRows(rowsLike: unknown): AllocationRow[] {
  if (!Array.isArray(rowsLike)) return [];
  const buckets = emptyBuckets();

  for (const item of rowsLike) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const bucket = normalizeBucket(row.type ?? row.label ?? row.name ?? row.key ?? row.bucket ?? row.category);
    const amount = toNumberLoose(row.amount ?? row.value ?? row.balance ?? row.total);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    buckets[bucket] += amount;
  }

  return rowsFromBuckets(buckets);
}

function allocationFromObject(obj: Record<string, unknown>): AllocationRow[] {
  // direct map shape
  const direct = emptyBuckets();
  direct.Cash += toNumberLoose(obj.cash ?? obj.Cash);
  direct.Investments += toNumberLoose(obj.investments ?? obj.Investments ?? obj.taxable ?? obj.Taxable);
  direct.Retirement += toNumberLoose(obj.retirement ?? obj.Retirement);
  direct.Other += toNumberLoose(obj.other ?? obj.Other);
  const directRows = rowsFromBuckets(direct);
  if (directRows.length > 0) return directRows;

  // common nested keys (including net worth page/dedicated backups)
  const nestedKeys = [
    'allocation',
    'allocationByType',
    'byType',
    'buckets',
    'totals',
    'summary',
    'netWorth',
    'snapshot',
    'data',
    'plan',
  ];
  for (const key of nestedKeys) {
    if (!(key in obj)) continue;
    const rows = extractAllocationRows(obj[key]);
    if (rows.length > 0) return rows;
  }

  // account arrays under common keys
  const accountKeys = ['netWorthAccounts', 'accounts', 'items', 'rows'];
  for (const key of accountKeys) {
    if (!(key in obj)) continue;
    const rows = allocationFromAccounts(obj[key]);
    if (rows.length > 0) return rows;
  }

  return [];
}

function extractAllocationRows(value: unknown): AllocationRow[] {
  if (!value) return [];

  const fromAllocationRows = allocationFromAllocationRows(value);
  if (fromAllocationRows.length > 0) return fromAllocationRows;

  const fromAccounts = allocationFromAccounts(value);
  if (fromAccounts.length > 0) return fromAccounts;

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return allocationFromObject(value as Record<string, unknown>);
  }

  return [];
}


function normalizeMonthKey(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

function parseActiveMonthFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('cf_nw_active_month_v1');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return normalizeMonthKey(parsed);
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      return (
        normalizeMonthKey(o.monthISO) ||
        normalizeMonthKey(o.month) ||
        normalizeMonthKey(o.activeMonth) ||
        null
      );
    }
  } catch {
    return normalizeMonthKey(raw);
  }
  return null;
}

function amountForMonthFromMap(mapLike: unknown, monthISO: string | null): number {
  if (!mapLike || typeof mapLike !== 'object' || Array.isArray(mapLike)) return 0;
  const obj = mapLike as Record<string, unknown>;

  if (monthISO && monthISO in obj) {
    return toNumberLoose(obj[monthISO]);
  }

  let bestMonth = '';
  let bestAmount = 0;
  for (const [k, v] of Object.entries(obj)) {
    const m = normalizeMonthKey(k);
    if (!m) continue;
    const amt = toNumberLoose(v);
    if (!Number.isFinite(amt)) continue;
    if (m > bestMonth) {
      bestMonth = m;
      bestAmount = amt;
    }
  }
  return bestAmount;
}

function allocationFromCfNetWorthAccounts(): AllocationRow[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('cf_nw_accounts_v1');
  if (!raw) return [];

  let accounts: unknown = null;
  try {
    accounts = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(accounts)) return [];
  const activeMonth = parseActiveMonthFromStorage();
  const buckets = emptyBuckets();

  for (const item of accounts) {
    if (!item || typeof item !== 'object') continue;
    const acct = item as Record<string, unknown>;

    const amount =
      amountForMonthFromMap(acct.balances, activeMonth) ||
      amountForMonthFromMap(acct.history, activeMonth) ||
      amountForMonthFromMap(acct.snapshots, activeMonth) ||
      latestAccountAmount(acct);

    if (!Number.isFinite(amount) || amount <= 0) continue;

    const bucketLike =
      acct.type ??
      acct.accountType ??
      acct.bucket ??
      acct.category ??
      acct.label ??
      acct.name;
    const bucket = normalizeBucket(bucketLike);
    buckets[bucket] += amount;
  }

  return rowsFromBuckets(buckets);
}

function bestAllocationFromStorage(): AllocationRow[] {
  if (typeof window === 'undefined') return [];

  let best: AllocationRow[] = [];
  let bestTotal = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const rows = extractAllocationRows(parsed);
      const total = rows.reduce((s, r) => s + r.value, 0);
      if (total > bestTotal) {
        best = rows;
        bestTotal = total;
      }
    } catch {
      // ignore unrelated keys
    }
  }

  return best;
}

export function SidebarAssumptions() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setPlan(loadPlan());

    const sync = () => {
      setPlan(loadPlan());
      setRefreshToken((n) => n + 1);
    };

    window.addEventListener('storage', sync);
    window.addEventListener('finance-plan-updated', sync as EventListener);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('finance-plan-updated', sync as EventListener);
    };
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const currency = safeCurrency(plan?.currency || 'USD');

  const allocation = useMemo(() => {
    const fromPlan = allocationFromAccounts(plan?.netWorthAccounts || []);
    if (fromPlan.length > 0) return fromPlan;

    const fromCf = allocationFromCfNetWorthAccounts();
    if (fromCf.length > 0) return fromCf;

    const fromStorage = bestAllocationFromStorage();
    if (fromStorage.length > 0) return fromStorage;

    return [];
  }, [plan?.netWorthAccounts, refreshToken]);

  const total = allocation.reduce((s, x) => s + Math.max(0, x.value), 0);

  if (!plan) return null;

  const sectionTitle =
    'px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  const label =
    'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  const input =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm ' +
    'text-slate-900 shadow-sm outline-none ' +
    'focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
    'dark:border-slate-800 dark:bg-white/[0.04] dark:text-slate-100 dark:focus:ring-blue-500/30';

  const pieData =
    total > 0
      ? allocation
      : [{ key: 'empty', label: 'No data', value: 1, color: '#cbd5e1' }];

  return (
    <div className="mt-6 space-y-3">
      <div>
        <div className={sectionTitle}>Assumptions</div>

        <div className="mt-2 rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
          <div className="space-y-3">
            <div>
              <div className={label}>Currency</div>
              <input
                className={input}
                value={plan.currency || 'USD'}
                onChange={(e) =>
                  setPlan({ ...plan, currency: safeCurrency(e.target.value) })
                }
                placeholder="USD"
              />
            </div>

            <div>
              <div className={label}>Start month</div>
              <input
                className={input}
                value={plan.startMonthISO || '2026-01'}
                onChange={(e) =>
                  setPlan({ ...plan, startMonthISO: toMonthISO(e.target.value) })
                }
                placeholder="2026-01"
              />
            </div>

            <div>
              <div className={label}>Starting Net Worth</div>
              <input
                type="text"
                className={input}
                defaultValue={money(plan.startingNetWorth ?? 0, currency)}
                key={`sidebar_start_${plan.startingNetWorth ?? 0}_${currency}`}
                onBlur={(e) =>
                  setPlan({
                    ...plan,
                    startingNetWorth: parseMoneyLoose(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <div className={label}>Goal Net Worth</div>
              <input
                type="text"
                className={input}
                defaultValue={money(plan.goalNetWorth ?? 0, currency)}
                key={`sidebar_goal_${plan.goalNetWorth ?? 0}_${currency}`}
                onBlur={(e) =>
                  setPlan({
                    ...plan,
                    goalNetWorth: parseMoneyLoose(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
        <div className={sectionTitle}>Allocation by type</div>

        <div className="mt-2 h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {total > 0 ? (
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-slate-700 text-xs font-semibold dark:fill-slate-200"
                >
                  {compactMoney(total, currency)}
                </text>
              ) : null}
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={68}
                innerRadius={38}
                paddingAngle={2}
              >
                {pieData.map((item) => (
                  <Cell key={item.key} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 space-y-1">
          {allocation.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">No allocation data yet.</div>
          ) : allocation.map((item) => {
            const safeVal = Math.max(0, item.value);
            const pct = total > 0 ? (safeVal / total) * 100 : 0;
            return (
              <div key={item.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    {item.label}
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  {pct.toFixed(1)}% · {money(safeVal, currency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}