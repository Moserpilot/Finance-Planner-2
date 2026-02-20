'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Label,
} from 'recharts';

type NetWorthAccountType = 'cash' | 'taxable' | 'retirement' | 'real_estate' | 'other';

type NetWorthAccount = {
  id: string;
  name: string;
  type: NetWorthAccountType;
  balances: Record<string, number>; // YYYY-MM-01 -> number
};

const TYPE_COLORS: Record<NetWorthAccountType, string> = {
  cash: '#16A34A',
  taxable: '#2563EB',
  retirement: '#7C3AED',
  real_estate: '#F59E0B',
  other: '#64748B',
};

const TYPE_LABELS: Record<NetWorthAccountType, string> = {
  cash: 'Cash',
  taxable: 'Taxable',
  retirement: 'Retirement',
  real_estate: 'Real Estate',
  other: 'Other',
};

// Dedicated backup keys so Net Worth can't be wiped by other pages saving the plan.
const NW_BACKUP_KEY = 'cf_nw_accounts_v1';
const NW_ACTIVE_MONTH_KEY = 'cf_nw_active_month_v1';

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toMonthISO(year: number, month1to12: number) {
  return `${year}-${pad2(month1to12)}-01`;
}

function parseMonthISO(m: string): { y: number; m: number } | null {
  const match = /^(\d{4})-(\d{2})-01$/.exec(m);
  if (!match) return null;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

function monthLabel(mIso: string) {
  const p = parseMonthISO(mIso);
  if (!p) return mIso;
  const d = new Date(p.y, p.m - 1, 1);
  return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

function addMonths(monthIso: string, delta: number) {
  const p = parseMonthISO(monthIso);
  if (!p) return monthIso;
  const d = new Date(p.y, p.m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return toMonthISO(d.getFullYear(), d.getMonth() + 1);
}

function money(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function moneyCompact(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

function numFromCurrencyLike(input: string): number {
  const cleaned = (input || '').replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizeAccounts(raw: any): NetWorthAccount[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  const out: NetWorthAccount[] = [];
  const seen = new Set<string>();

  for (const it of arr) {
    const id = typeof it?.id === 'string' && it.id ? it.id : uid('acct');
    if (seen.has(id)) continue;
    seen.add(id);

    const name = typeof it?.name === 'string' && it.name.trim() ? it.name.trim() : 'Account';
    const type: NetWorthAccountType =
      it?.type === 'cash' ||
      it?.type === 'taxable' ||
      it?.type === 'retirement' ||
      it?.type === 'real_estate' ||
      it?.type === 'other'
        ? it.type
        : 'other';

    const balancesObj = it?.balances && typeof it.balances === 'object' ? it.balances : {};
    const balances: Record<string, number> = {};
    for (const [k, v] of Object.entries(balancesObj)) {
      if (!parseMonthISO(k)) continue;
      const n = Number(v);
      balances[k] = Number.isFinite(n) ? n : 0;
    }

    out.push({ id, name, type, balances });
  }

  return out;
}

function collectAllMonths(accounts: NetWorthAccount[]): string[] {
  const set = new Set<string>();
  for (const a of accounts) {
    for (const k of Object.keys(a.balances || {})) {
      if (parseMonthISO(k)) set.add(k);
    }
  }
  if (set.size === 0) {
    const now = new Date();
    set.add(toMonthISO(now.getFullYear(), now.getMonth() + 1));
  }
  return Array.from(set).sort();
}

function monthTotal(accounts: NetWorthAccount[], mIso: string) {
  let total = 0;
  for (const a of accounts) {
    const v = a.balances?.[mIso];
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

function typeTotalsForMonth(accounts: NetWorthAccount[], mIso: string) {
  const buckets: Record<NetWorthAccountType, number> = {
    cash: 0,
    taxable: 0,
    retirement: 0,
    real_estate: 0,
    other: 0,
  };
  for (const a of accounts) {
    const v = a.balances?.[mIso] ?? 0;
    buckets[a.type] += Number.isFinite(v) ? v : 0;
  }
  return buckets;
}

/**
 * Merge two account lists by id, preferring "right" balances if present.
 * - Keeps all balances from both sides (union of months).
 * - If both have same month, right wins.
 * - Includes accounts that exist only on one side.
 */
function mergePreferRight(existing: NetWorthAccount[], right: NetWorthAccount[]) {
  const exById = new Map(existing.map((a) => [a.id, a]));
  const rightById = new Map(right.map((a) => [a.id, a]));

  const merged: NetWorthAccount[] = [];

  for (const r of right) {
    const ex = exById.get(r.id);
    if (!ex) {
      merged.push(r);
      continue;
    }
    merged.push({
      ...ex,
      ...r,
      balances: { ...(ex.balances || {}), ...(r.balances || {}) },
    });
  }

  for (const ex of existing) {
    if (!rightById.has(ex.id)) merged.push(ex);
  }

  return merged;
}

function safeReadBackup(): NetWorthAccount[] {
  try {
    const raw = localStorage.getItem(NW_BACKUP_KEY);
    if (!raw) return [];
    return normalizeAccounts(JSON.parse(raw));
  } catch {
    return [];
  }
}

function safeWriteBackup(accounts: NetWorthAccount[]) {
  try {
    localStorage.setItem(NW_BACKUP_KEY, JSON.stringify(accounts));
  } catch {
    // ignore quota or privacy mode issues
  }
}

function safeReadActiveMonth(): string {
  try {
    const v = localStorage.getItem(NW_ACTIVE_MONTH_KEY) || '';
    return parseMonthISO(v) ? v : '';
  } catch {
    return '';
  }
}

function safeWriteActiveMonth(mIso: string) {
  try {
    if (parseMonthISO(mIso)) localStorage.setItem(NW_ACTIVE_MONTH_KEY, mIso);
  } catch {
    // ignore
  }
}

function TypeDot({ type }: { type: NetWorthAccountType }) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.other;
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color }}
      title={TYPE_LABELS[type]}
    />
  );
}

type PieRow = {
  key: NetWorthAccountType;
  name: string;
  value: number;
  pct: number;
};

export default function NetWorthPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [localAccounts, setLocalAccounts] = useState<NetWorthAccount[]>([]);
  const [activeMonth, setActiveMonth] = useState<string>('');
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [activeCell, setActiveCell] = useState<string>(''); // `${acctId}__${mIso}`
  const [status, setStatus] = useState<string>('');
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  // Load + rehydrate from dedicated backup to survive other pages overwriting the plan.
  useEffect(() => {
    const p = loadPlan();
    setPlan(p);

    const planAccounts = normalizeAccounts((p as any).netWorthAccounts);
    const backupAccounts = safeReadBackup();

    // If plan got overwritten, backup restores balances.
    const rehydrated = backupAccounts.length ? mergePreferRight(planAccounts, backupAccounts) : planAccounts;

    // If we restored anything, push it back into the plan immediately.
    if (backupAccounts.length) {
      const nextPlan: Plan = { ...p, netWorthAccounts: rehydrated as any };
      savePlan(nextPlan);
      setPlan(nextPlan);
    }

    setLocalAccounts(rehydrated);
    safeWriteBackup(rehydrated);

    const ms = collectAllMonths(rehydrated);
    const savedActive = safeReadActiveMonth();
    const startMonth = savedActive && ms.includes(savedActive) ? savedActive : ms[ms.length - 1];
    setActiveMonth(startMonth);
  }, []);

  // Persist activeMonth selection
  useEffect(() => {
    if (activeMonth) safeWriteActiveMonth(activeMonth);
  }, [activeMonth]);

  const months = useMemo(() => collectAllMonths(localAccounts), [localAccounts]);

  useEffect(() => {
    if (!months.length) return;
    if (!activeMonth || !months.includes(activeMonth)) setActiveMonth(months[months.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.join('|')]);

  const series = useMemo(() => {
    return months.map((mIso) => ({
      monthISO: mIso,
      month: monthLabel(mIso),
      total: monthTotal(localAccounts, mIso),
    }));
  }, [months, localAccounts]);

  const latestTotal = months.length ? monthTotal(localAccounts, months[months.length - 1]) : 0;

  const activeTotalsByType = useMemo(() => {
    if (!activeMonth) return null;
    return typeTotalsForMonth(localAccounts, activeMonth);
  }, [localAccounts, activeMonth]);

  const pieRows: PieRow[] = useMemo(() => {
    if (!activeTotalsByType) return [];
    const order: NetWorthAccountType[] = ['cash', 'taxable', 'retirement', 'real_estate', 'other'];
    const total = order.reduce((s, k) => s + (activeTotalsByType[k] || 0), 0) || 0;

    const rows = order
      .map((k) => {
        const v = Math.round(activeTotalsByType[k] || 0);
        const pct = total > 0 ? v / total : 0;
        return { key: k, name: TYPE_LABELS[k], value: v, pct };
      })
      .filter((r) => Math.abs(r.value) > 0);

    return rows.length ? rows : [{ key: 'other', name: 'No Data', value: 1, pct: 1 }];
  }, [activeTotalsByType]);

  const activeMonthTotal = useMemo(() => {
    if (!activeMonth) return 0;
    return monthTotal(localAccounts, activeMonth);
  }, [localAccounts, activeMonth]);

  function setCellEdit(acctId: string, mIso: string, value: string) {
    setEditing((prev) => ({ ...prev, [`${acctId}__${mIso}`]: value }));
  }

  function getCellDisplayValue(acct: NetWorthAccount, mIso: string) {
    const key = `${acct.id}__${mIso}`;
    if (activeCell === key) return editing[key] ?? '';
    if (editing[key] !== undefined) return editing[key];
    const v = acct.balances?.[mIso] ?? 0;
    return v ? money(v) : '';
  }

  function commitCell(local: NetWorthAccount[], acctId: string, mIso: string) {
    const key = `${acctId}__${mIso}`;
    const raw = editing[key] ?? '';
    const n = numFromCurrencyLike(raw);

    const next = local.map((a) => {
      if (a.id !== acctId) return a;
      return { ...a, balances: { ...(a.balances || {}), [mIso]: n } };
    });

    setEditing((prev) => {
      if (prev[key] === undefined) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    return next;
  }

  function saveNetWorth(nextAccounts: NetWorthAccount[]) {
    if (!plan) return;

    // Always write backup first (survives other pages overwriting plan)
    safeWriteBackup(nextAccounts);

    const currentPlan = loadPlan();
    const planAccounts = normalizeAccounts((currentPlan as any).netWorthAccounts);
    const merged = mergePreferRight(planAccounts, nextAccounts);

    const nextPlan: Plan = {
      ...currentPlan,
      netWorthAccounts: merged as any,
    };

    savePlan(nextPlan);
    setPlan(nextPlan);

    setStatus(`Saved ${new Date().toLocaleTimeString()}`);
    setTimeout(() => setStatus(''), 2500);
  }

  function addAccount() {
    const next = [
      ...localAccounts,
      { id: uid('acct'), name: `Account ${localAccounts.length + 1}`, type: 'other' as NetWorthAccountType, balances: {} },
    ];
    setLocalAccounts(next);
    saveNetWorth(next);
  }

  function deleteAccount(id: string) {
    const next = localAccounts.filter((a) => a.id !== id);
    setLocalAccounts(next);
    saveNetWorth(next);
  }

  function updateAccountMeta(id: string, patch: Partial<Pick<NetWorthAccount, 'name' | 'type'>>) {
    const next = localAccounts.map((a) => (a.id === id ? { ...a, ...patch } : a));
    setLocalAccounts(next);
    saveNetWorth(next);
  }

  function addMonth() {
    const base =
      (months.length ? months[months.length - 1] : '') ||
      activeMonth ||
      toMonthISO(new Date().getFullYear(), new Date().getMonth() + 1);

    const nextMonth = addMonths(base, 1);

    const next = localAccounts.map((a) => {
      const balances = { ...(a.balances || {}) };
      if (balances[nextMonth] === undefined) balances[nextMonth] = balances[base] ?? 0;
      return { ...a, balances };
    });

    setLocalAccounts(next);
    setActiveMonth(nextMonth);
    saveNetWorth(next);
  }

  function removeMonth(mIso: string) {
    const next = localAccounts.map((a) => {
      const balances = { ...(a.balances || {}) };
      delete balances[mIso];
      return { ...a, balances };
    });

    setLocalAccounts(next);
    const ms = collectAllMonths(next);
    setActiveMonth(ms[ms.length - 1]);
    saveNetWorth(next);
  }

  function renderSliceLabel(props: any) {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, value, name } = props;
    if (name === 'No Data') return null;
    if (!Number.isFinite(value) || value <= 0) return null;
    if (percent < 0.07) return null;

    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        className="select-none"
        style={{
          fontSize: 12,
          fontWeight: 700,
          fill: 'rgba(255,255,255,0.92)',
          paintOrder: 'stroke',
          stroke: 'rgba(2,6,23,0.55)',
          strokeWidth: 3,
        }}
      >
        {moneyCompact(value)}
      </text>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-sm text-slate-600 dark:text-slate-300">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Net Worth</h1>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Track balances by month. Values are saved locally.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={addMonth}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            + Add month
          </button>

          <button
            onClick={addAccount}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            + Add account
          </button>

          <div className="ml-2 text-xs text-slate-500 dark:text-slate-400">{status}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Latest month</div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {months.length ? monthLabel(months[months.length - 1]) : '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Latest net worth</div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{money(latestTotal)}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Active month</div>
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
            value={activeMonth}
            onChange={(e) => setActiveMonth(e.target.value)}
          >
            {months.map((mIso) => (
              <option key={mIso} value={mIso}>
                {monthLabel(mIso)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Net worth over time</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickMargin={8} />
                <YAxis tickFormatter={(v) => money(Number(v))} width={90} />
                <Tooltip
                  formatter={(v: any) => money(Number(v) || 0)}
                  contentStyle={{
                    borderRadius: 14,
                    border: '1px solid rgba(148,163,184,0.35)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                  }}
                />
                <Line type="monotone" dataKey="total" dot={false} strokeWidth={2.75} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Allocation by type</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{activeMonth ? monthLabel(activeMonth) : ''}</div>
          </div>

          <div className="flex h-72 items-center gap-4">
            <div className="h-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="rgba(0,0,0,0.35)" />
                    </filter>
                  </defs>

                  <Pie
                    data={pieRows as any}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="52%"
                    innerRadius={56}
                    outerRadius={108}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive
                    labelLine={false}
                    label={renderSliceLabel as any}
                    onMouseLeave={() => setActiveSlice(null)}
                    onMouseEnter={(_, idx) => setActiveSlice(idx)}
                    style={{ filter: 'url(#softShadow)' }}
                  >
                    {(pieRows as any[]).map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={TYPE_COLORS[entry.key as NetWorthAccountType] || TYPE_COLORS.other}
                        opacity={activeSlice === null || activeSlice === idx ? 1 : 0.45}
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth={1.5}
                      />
                    ))}

                    <Label
                      position="center"
                      content={({ viewBox }: any) => {
                        const cx = viewBox?.cx ?? 0;
                        const cy = viewBox?.cy ?? 0;
                        return (
                          <g>
                            <text
                              x={cx}
                              y={cy - 6}
                              textAnchor="middle"
                              className="select-none"
                              style={{ fill: 'rgba(226,232,240,0.85)', fontSize: 11, fontWeight: 600 }}
                            >
                              Total
                            </text>
                            <text
                              x={cx}
                              y={cy + 14}
                              textAnchor="middle"
                              className="select-none"
                              style={{ fill: 'rgba(248,250,252,0.96)', fontSize: 16, fontWeight: 800 }}
                            >
                              {moneyCompact(activeMonthTotal)}
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Pie>

                  <Tooltip
                    formatter={(v: any) => money(Number(v) || 0)}
                    contentStyle={{
                      borderRadius: 14,
                      border: '1px solid rgba(148,163,184,0.35)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-52 shrink-0">
              <div className="space-y-1">
                {(pieRows || []).map((r, i) => {
                  if (r.name === 'No Data') return null;
                  return (
                    <div
                      key={`${r.key}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-white/40 px-3 py-2 text-xs dark:border-slate-800/60 dark:bg-slate-900/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[r.key] }} />
                        <div className="leading-tight">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{r.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{Math.round(r.pct * 100)}%</div>
                        </div>
                      </div>
                      <div className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">{money(r.value)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Exact dollars preserved (plan + dedicated backup).
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Balances</div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => activeMonth && removeMonth(activeMonth)}
              disabled={!activeMonth || months.length <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Remove active month
            </button>

            <button
              onClick={() => saveNetWorth(localAccounts)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Save now
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  Account
                </th>
                <th className="bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  Type
                </th>
                {months.map((mIso) => (
                  <th
                    key={mIso}
                    className="bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300"
                  >
                    {monthLabel(mIso)}
                  </th>
                ))}
                <th className="bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {localAccounts.map((acct) => (
                <tr key={acct.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-slate-950">
                    <input
                      value={acct.name}
                      onChange={(e) => updateAccountMeta(acct.id, { name: e.target.value })}
                      className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <TypeDot type={acct.type} />
                      <select
                        value={acct.type}
                        onChange={(e) => updateAccountMeta(acct.id, { type: e.target.value as NetWorthAccountType })}
                        className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                      >
                        <option value="cash">{TYPE_LABELS.cash}</option>
                        <option value="taxable">{TYPE_LABELS.taxable}</option>
                        <option value="retirement">{TYPE_LABELS.retirement}</option>
                        <option value="real_estate">{TYPE_LABELS.real_estate}</option>
                        <option value="other">{TYPE_LABELS.other}</option>
                      </select>
                    </div>
                  </td>

                  {months.map((mIso) => {
                    const key = `${acct.id}__${mIso}`;
                    return (
                      <td key={mIso} className="px-3 py-2 text-right">
                        <input
                          value={getCellDisplayValue(acct, mIso)}
                          onFocus={() => {
                            setActiveCell(key);
                            setEditing((prev) => ({
                              ...prev,
                              [key]: prev[key] ?? (acct.balances?.[mIso] ? String(acct.balances[mIso]) : ''),
                            }));
                          }}
                          onChange={(e) => setCellEdit(acct.id, mIso, e.target.value)}
                          onBlur={() => {
                            setActiveCell('');
                            const next = commitCell(localAccounts, acct.id, mIso);
                            setLocalAccounts(next);
                            saveNetWorth(next);
                          }}
                          inputMode="decimal"
                          className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                          placeholder="$"
                        />
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => deleteAccount(acct.id)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              <tr className="border-t border-slate-200 dark:border-slate-800">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                  Total
                </td>
                <td className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">—</td>
                {months.map((mIso) => (
                  <td key={mIso} className="px-3 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {money(monthTotal(localAccounts, mIso))}
                  </td>
                ))}
                <td className="px-3 py-2" />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          If another page overwrites the plan, Net Worth restores from its dedicated backup automatically.
        </div>
      </div>
    </div>
  );
}
