'use client';

import { useEffect, useMemo, useState } from 'react';
import { AllocationPie } from '../components/AllocationPie';
import { buildAllocation, monthTotalForAccount } from '../lib/allocation';
import type { NetWorthAccountType, Plan } from '../lib/store';
import { loadPlan, newNetWorthAccount, savePlan } from '../lib/store';

function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function parseMoney(v: string) {
  const n = Number(String(v).replace(/[$,%\s,]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function upsertDated(arr: { monthISO: string; amount: number }[], monthISO: string, amount: number) {
  const next = [...arr];
  const idx = next.findIndex((x) => x.monthISO === monthISO);
  if (idx >= 0) next[idx] = { monthISO, amount };
  else next.push({ monthISO, amount });
  next.sort((a, b) => (a.monthISO < b.monthISO ? -1 : 1));
  return next;
}

const TYPE_OPTIONS: NetWorthAccountType[] = ['cash', 'taxable', 'retirement', 'other'];

export default function NetWorthPage() {
  const [plan, setPlan] = useState<Plan>(() => loadPlan());
  const [editMonthISO, setEditMonthISO] = useState(
    plan.netWorthViewMonthISO || plan.startMonthISO || '2026-01'
  );

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  function update(p: Plan) { setPlan(p); savePlan(p); }
  const currency = plan.currency || 'USD';

  const slices = useMemo(() => {
    return buildAllocation(plan, editMonthISO);
  }, [plan, editMonthISO]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Net Worth</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Manage net worth accounts and balances by month.</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-end justify-between gap-3">
            <label className="text-sm">
              <div className="mb-1 text-slate-500 dark:text-slate-400">Edit month (YYYY-MM)</div>
              <input
                className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                value={editMonthISO}
                onChange={(e) => {
                  const monthISO = e.target.value;
                  setEditMonthISO(monthISO);
                  setPlan((prev) => { const updated = { ...prev, netWorthViewMonthISO: monthISO }; savePlan(updated); return updated; });
                }}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setPlan((prev) =>
                  prev
                    ? { ...prev, netWorthAccounts: [...prev.netWorthAccounts, newNetWorthAccount('New account')] }
                    : prev
                )
              }
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800"
            >
              Add account
            </button>
          </div>

          <div className="space-y-3">
            {plan.netWorthAccounts.map((a) => {
              const bal = monthTotalForAccount(plan, a.id, editMonthISO);
              return (
                <div key={a.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-12 md:items-end dark:border-slate-800">
                  <label className="md:col-span-4 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">Account name</div>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                      value={a.name}
                      onChange={(e) =>
                        setPlan((prev) =>
                          prev
                            ? {
                                ...prev,
                                netWorthAccounts: prev.netWorthAccounts.map((x) =>
                                  x.id === a.id ? { ...x, name: e.target.value } : x
                                ),
                              }
                            : prev
                        )
                      }
                    />
                  </label>

                  <label className="md:col-span-3 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">Type</div>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                      value={a.type}
                      onChange={(e) =>
                        setPlan((prev) =>
                          prev
                            ? {
                                ...prev,
                                netWorthAccounts: prev.netWorthAccounts.map((x) =>
                                  x.id === a.id ? { ...x, type: e.target.value as NetWorthAccountType } : x
                                ),
                              }
                            : prev
                        )
                      }
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t[0].toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="md:col-span-4 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">Balance for {editMonthISO}</div>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                      defaultValue={money(bal, currency)}
                      key={`${a.id}_${editMonthISO}_${bal}_${currency}`}
                      onBlur={(e) => {
                        const amount = parseMoney(e.target.value);
                        setPlan((prev) =>
                          prev
                            ? {
                                ...prev,
                                netWorthAccounts: prev.netWorthAccounts.map((x) =>
                                  x.id === a.id ? { ...x, balances: upsertDated(x.balances || [], editMonthISO, amount) } : x
                                ),
                              }
                            : prev
                        );
                      }}
                    />
                  </label>

                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-rose-600 dark:border-slate-800"
                      onClick={() =>
                        setPlan((prev) =>
                          prev
                            ? {
                                ...prev,
                                netWorthAccounts: prev.netWorthAccounts.filter((x) => x.id !== a.id),
                              }
                            : prev
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-4">
          <AllocationPie slices={slices} currency={currency} title={`Allocation (${editMonthISO})`} />
        </div>
      </div>
    </div>
  );
}