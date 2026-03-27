'use client';

import { useEffect, useMemo, useState } from 'react';
import { AllocationPie } from '../components/AllocationPie';
import { buildAllocation, monthTotalForAccount } from '../lib/allocation';
import type { NetWorthAccountType, Plan } from '../lib/store';
import { loadPlan, newNetWorthAccount, savePlan } from '../lib/store';

function addMonthsISO(s: string, add: number) {
  const ok = /^\d{4}-\d{2}$/.test(s);
  const y0 = ok ? Number(s.slice(0, 4)) : new Date().getFullYear();
  const m0 = ok ? Number(s.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`;
}
function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}
function monthLabel(iso: string) {
  if (!/^\d{4}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(`${iso}-01T00:00:00`));
}
function parseMoney(v: string) {
  const n = Number(String(v).replace(/[$,%\s,]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function upsertDated(arr: { monthISO: string; amount: number }[], monthISO: string, amount: number) {
  const next = [...arr];
  const idx = next.findIndex(x => x.monthISO === monthISO);
  if (idx >= 0) next[idx] = { monthISO, amount };
  else next.push({ monthISO, amount });
  next.sort((a, b) => a.monthISO < b.monthISO ? -1 : 1);
  return next;
}

const TYPE_OPTIONS: NetWorthAccountType[] = ['cash', 'taxable', 'retirement', 'other'];

const TYPE_ICONS: Record<NetWorthAccountType, string> = {
  cash: '💵',
  taxable: '📈',
  retirement: '🏛️',
  other: '🏦',
};

const TYPE_LABELS: Record<NetWorthAccountType, string> = {
  cash: 'Cash & Checking',
  taxable: 'Taxable Brokerage',
  retirement: 'Retirement (401k/IRA)',
  other: 'Other',
};

const TYPE_BADGE: Record<NetWorthAccountType, string> = {
  cash: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  taxable: 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  retirement: 'bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function NetWorthPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editMonthISO, setEditMonthISO] = useState('');
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setEditMonthISO(p.netWorthViewMonthISO || p.startMonthISO || '2026-01');
    setMounted(true);
  }, []);

  function update(p: Plan) { setPlan(p); savePlan(p); }
  const currency = plan?.currency || 'USD';

  const slices = useMemo(() => {
    if (!plan) return [];
    return buildAllocation(plan, editMonthISO);
  }, [plan, editMonthISO]);

  const totalNW = useMemo(() => slices.reduce((s, x) => s + x.value, 0), [slices]);

  const monthOptions = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => addMonthsISO(plan?.startMonthISO || '2026-01', i)),
    [plan?.startMonthISO]
  );

  if (!mounted || !plan) return <div className="min-h-screen bg-slate-50 dark:bg-black" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Net Worth</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Track your account balances over time.</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-4">
          {/* Month selector + total header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Total net worth</div>
                <div className="text-4xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">{money(totalNW, currency)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">as of {monthLabel(editMonthISO)}</div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  value={editMonthISO}
                  onChange={e => {
                    const monthISO = e.target.value;
                    setEditMonthISO(monthISO);
                    setPlan(prev => { if (!prev) return prev; const updated = { ...prev, netWorthViewMonthISO: monthISO }; savePlan(updated); return updated; });
                  }}
                >
                  {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => { if (!plan) return; const updated = { ...plan, netWorthAccounts: [...plan.netWorthAccounts, newNetWorthAccount('New account')] }; update(updated); }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  + Add account
                </button>
              </div>
            </div>
          </div>

          {/* Account cards */}
          <div className="space-y-3">
            {plan.netWorthAccounts.map(a => {
              const bal = monthTotalForAccount(plan, a.id, editMonthISO);
              const isExpanded = expandedId === a.id;
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
                >
                  {/* Collapsed header — always visible */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <span className="text-2xl flex-shrink-0">{TYPE_ICONS[a.type] || '🏦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{a.name || 'Untitled account'}</div>
                      <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[a.type]}`}>
                        {TYPE_LABELS[a.type] || a.type}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{money(bal, currency)}</div>
                    </div>
                    <div className="text-slate-400 dark:text-slate-500 flex-shrink-0">
                      <ChevronIcon open={isExpanded} />
                    </div>
                  </div>

                  {/* Expanded edit fields */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Account name</label>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:text-slate-100"
                          value={a.name}
                          onChange={e => update({ ...plan, netWorthAccounts: plan.netWorthAccounts.map(x => x.id === a.id ? { ...x, name: e.target.value } : x) })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Account type</label>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          value={a.type}
                          onChange={e => update({ ...plan, netWorthAccounts: plan.netWorthAccounts.map(x => x.id === a.id ? { ...x, type: e.target.value as NetWorthAccountType } : x) })}
                        >
                          {TYPE_OPTIONS.map(t => (
                            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Balance — {monthLabel(editMonthISO)}</label>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:text-slate-100"
                          defaultValue={money(bal, currency)}
                          key={`${a.id}_${editMonthISO}_${bal}_${currency}`}
                          onBlur={e => {
                            const amount = parseMoney(e.target.value);
                            setPlan(prev => {
                              if (!prev) return prev;
                              const updated = { ...prev, netWorthAccounts: prev.netWorthAccounts.map(x => x.id === a.id ? { ...x, balances: upsertDated(x.balances || [], editMonthISO, amount) } : x) };
                              savePlan(updated);
                              return updated;
                            });
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-rose-200 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
                        onClick={() => {
                          update({ ...plan, netWorthAccounts: plan.netWorthAccounts.filter(x => x.id !== a.id) });
                          setExpandedId(null);
                        }}
                      >
                        Remove account
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {plan.netWorthAccounts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
                <div className="text-3xl mb-3">🏦</div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">No accounts yet</div>
                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Click "+ Add account" to start tracking your net worth.</div>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-4">
          <AllocationPie slices={slices} currency={currency} title={`Allocation — ${monthLabel(editMonthISO)}`} />
        </div>
      </div>
    </div>
  );
}
