'use client';

import { useEffect, useMemo, useState } from 'react';
import { AllocationPie } from '../components/AllocationPie';
import { ChevronIcon } from '../components/ChevronIcon';
import { buildAllocation } from '../lib/allocation';
import { accountBalanceForMonth, computedAccountBalance, netWorthProjected } from '../lib/engine';
import type { NetWorthAccountType, Plan } from '../lib/store';
import { loadPlan, newNetWorthAccount, savePlan } from '../lib/store';
import { addMonthsISO, money, monthLabel, parseMoney, upsertDated } from '../lib/utils';

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
  cash: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300',
  taxable: 'bg-blue-100 text-blue-800 dark:bg-blue-500/25 dark:text-blue-300',
  retirement: 'bg-purple-100 text-purple-800 dark:bg-purple-500/25 dark:text-purple-300',
  other: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};


export default function NetWorthPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editMonthISO, setEditMonthISO] = useState('');
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    const n = new Date(); const cur = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
    setEditMonthISO(cur);
    setMounted(true);
  }, []);

  useEffect(() => {
    function load() { setPlan(loadPlan()); }
    window.addEventListener('finance_planner_plan_updated', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('finance_planner_plan_updated', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  function update(p: Plan) { setPlan(p); savePlan(p); }
  const currency = plan?.currency || 'USD';

  const slices = useMemo(() => {
    if (!plan) return [];
    return buildAllocation(plan, editMonthISO);
  }, [plan, editMonthISO]);

  const nwTotal = useMemo(() => {
    if (!plan) return 0;
    return netWorthProjected(plan, editMonthISO);
  }, [plan, editMonthISO]);

  const monthOptions = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => addMonthsISO(plan?.startMonthISO || '2026-01', i)),
    [plan?.startMonthISO]
  );

  if (!mounted || !plan) return <div className="min-h-screen bg-slate-50 dark:bg-black" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Net Worth</div>
        <div className="text-sm text-slate-500 dark:text-slate-200">Track your account balances over time.</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-4">
          {/* Month selector + total header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-200 mb-0.5">Total net worth</div>
                <div className="text-4xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">{money(nwTotal, currency)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-200 mt-1">as of {monthLabel(editMonthISO)}</div>
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
              const bal = computedAccountBalance(plan, a.id, editMonthISO);
              const startMonth = plan.startMonthISO || '2026-01';
              const isExpanded = expandedId === a.id;

              // Transaction log: one-time items linked to this account up to editMonthISO
              const linkedIncome = plan.netWorthMode !== 'snapshot'
                ? (plan.oneTimeIncome || []).filter(x => x.accountId === a.id && x.monthISO >= startMonth && x.monthISO <= editMonthISO && x.amount > 0)
                : [];
              const linkedExpenses = plan.netWorthMode !== 'snapshot'
                ? (plan.oneTimeExpenses || []).filter(x => x.accountId === a.id && x.monthISO >= startMonth && x.monthISO <= editMonthISO && x.amount > 0)
                : [];
              const hasTransactions = linkedIncome.length > 0 || linkedExpenses.length > 0;

              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
                >
                  {/* Collapsed header */}
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
                      {hasTransactions && (
                        <div className="text-xs text-slate-400 dark:text-slate-300 mt-0.5">{linkedIncome.length + linkedExpenses.length} adjustment{linkedIncome.length + linkedExpenses.length !== 1 ? 's' : ''}</div>
                      )}
                    </div>
                    <div className="text-slate-400 dark:text-slate-300 flex-shrink-0">
                      <ChevronIcon open={isExpanded} />
                    </div>
                  </div>

                  {/* Expanded edit fields */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Account name</label>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:text-slate-100"
                          value={a.name}
                          onChange={e => update({ ...plan, netWorthAccounts: plan.netWorthAccounts.map(x => x.id === a.id ? { ...x, name: e.target.value } : x) })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Account type</label>
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
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Base balance — {monthLabel(editMonthISO)}</label>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:text-slate-100"
                          inputMode="decimal"
                          defaultValue={money(accountBalanceForMonth(a, editMonthISO), currency)}
                          key={`${a.id}_${editMonthISO}_${accountBalanceForMonth(a, editMonthISO)}_${currency}`}
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
                        <div className="mt-1 text-xs text-slate-400 dark:text-slate-300">Enter your actual account balance. One-time income/expenses add to this automatically.</div>
                      </div>

                      {/* Transaction log */}
                      {hasTransactions && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-200 mb-1.5">One-time adjustments</div>
                          <div className="space-y-1">
                            {linkedIncome.map(x => (
                              <div key={x.id} className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5">
                                <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{x.name} · {monthLabel(x.monthISO)}</span>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums ml-2 flex-shrink-0">+{money(x.amount, currency)}</span>
                              </div>
                            ))}
                            {linkedExpenses.map(x => (
                              <div key={x.id} className="flex items-center justify-between rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5">
                                <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{x.name} · {monthLabel(x.monthISO)}</span>
                                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 tabular-nums ml-2 flex-shrink-0">−{money(x.amount, currency)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300 px-1">
                            <span>Computed balance</span>
                            <span className="tabular-nums">{money(bal, currency)}</span>
                          </div>
                        </div>
                      )}

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
                <div className="text-sm font-medium text-slate-500 dark:text-slate-200">No accounts yet</div>
                <div className="mt-1 text-xs text-slate-400 dark:text-slate-300">Click "+ Add account" to start tracking your net worth.</div>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <AllocationPie slices={slices} currency={currency} title={`Allocation — ${monthLabel(editMonthISO)}`} total={nwTotal} />

          {/* Quick Update */}
          {plan.netWorthAccounts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Update</div>
                <div className="text-xs text-slate-400 dark:text-slate-300 mt-0.5">{monthLabel(editMonthISO)}</div>
              </div>
              <div className="space-y-2.5">
                {plan.netWorthAccounts.map(a => {
                  const current = computedAccountBalance(plan, a.id, editMonthISO);
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 truncate">{a.name}</div>
                      <div className="relative flex-shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">$</span>
                        <input
                          className="w-36 rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 tabular-nums"
                          inputMode="decimal"
                          defaultValue={current > 0 ? new Intl.NumberFormat('en-US').format(current) : ''}
                          placeholder="0"
                          key={`qu_${a.id}_${editMonthISO}_${current}`}
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
