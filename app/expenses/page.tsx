'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan, RecurringItem } from '../lib/store';
import {
  loadPlan,
  savePlan,
  newRecurringItem,
  newOneTimeItem,
} from '../lib/store';
import { amountForMonth } from '../lib/engine';

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'USD';
}

function money(n: number, currency: string) {
  const cur = safeCurrency(currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function parseMoneyLoose(v: string) {
  // allow "$1,234", "1234", "1,234.56"
  const cleaned = String(v).replace(/[$,%\s,]+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function addMonthsISO(startISO: string, add: number) {
  const ok = /^\d{4}-\d{2}$/.test(startISO);
  const y0 = ok ? Number(startISO.slice(0, 4)) : 2026;
  const m0 = ok ? Number(startISO.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  const y = Math.floor(t / 12);
  const m = t % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function buildMonthOptions(startMonthISO: string, months = 360) {
  return Array.from({ length: months + 1 }, (_, i) =>
    addMonthsISO(startMonthISO, i)
  );
}

function upsertDated(
  arr: { monthISO: string; amount: number }[],
  monthISO: string,
  amount: number
) {
  const next = [...arr];
  const i = next.findIndex((x) => x.monthISO === monthISO);
  if (i >= 0) next[i] = { monthISO, amount };
  else next.push({ monthISO, amount });
  next.sort((a, b) =>
    a.monthISO < b.monthISO ? -1 : a.monthISO > b.monthISO ? 1 : 0
  );
  return next;
}

export default function ExpensesPage() {
  const [plan, setPlan] = useState<Plan | null>(null);

  // Month selector for month-specific edits
  const [editMonthISO, setEditMonthISO] = useState<string>('2026-01');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setEditMonthISO(p.startMonthISO || '2026-01');
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const cur = useMemo(
    () => safeCurrency(plan?.currency || 'USD'),
    [plan?.currency]
  );

  const monthOptions = useMemo(() => {
    const start = plan?.startMonthISO || '2026-01';
    return buildMonthOptions(start, 360); // 30 years
  }, [plan?.startMonthISO]);

  if (!plan) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
    );
  }

  function updateItem(id: string, patch: Partial<RecurringItem>) {
    setPlan({
      ...plan,
      expenses: plan.expenses.map((it) =>
        it.id === id ? { ...it, ...patch } : it
      ),
    });
  }

  function removeItem(id: string) {
    setPlan({ ...plan, expenses: plan.expenses.filter((it) => it.id !== id) });
  }

  function setForMonth(it: RecurringItem, amount: number) {
    if (it.behavior === 'carryForward') {
      const changes = upsertDated(it.changes || [], editMonthISO, amount);
      updateItem(it.id, { changes });
    } else {
      const overrides = upsertDated(it.overrides || [], editMonthISO, amount);
      updateItem(it.id, { overrides });
    }
  }

  function addRecurring() {
    setPlan({
      ...plan,
      expenses: [...plan.expenses, newRecurringItem('expense')],
    });
  }

  function addOneTime() {
    setPlan({
      ...plan,
      oneTimeExpenses: [
        ...plan.oneTimeExpenses,
        newOneTimeItem('expense', editMonthISO),
      ],
    });
  }

  function updateOneTime(id: string, patch: any) {
    setPlan({
      ...plan,
      oneTimeExpenses: plan.oneTimeExpenses.map((x) =>
        x.id === id ? { ...x, ...patch } : x
      ),
    });
  }

  function removeOneTime(id: string) {
    setPlan({
      ...plan,
      oneTimeExpenses: plan.oneTimeExpenses.filter((x) => x.id !== id),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Expenses
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Month selector controls overrides / effective changes (YYYY-MM).
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="text-sm">
            <div className="mb-1 text-slate-500 dark:text-slate-400">
              Edit month
            </div>
            <input
              className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
              value={editMonthISO}
              onChange={(e) => setEditMonthISO(e.target.value)}
              placeholder="2026-01"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addRecurring}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800"
            >
              Add recurring
            </button>
            <button
              type="button"
              onClick={addOneTime}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800"
            >
              Add one-time
            </button>
          </div>
        </div>
      </div>

      {/* Recurring expenses */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Recurring expenses
        </div>

        <div className="mt-4 space-y-4">
          {plan.expenses.map((it) => {
            const monthAmount = amountForMonth(it, editMonthISO);
            const draftKey = `draft_${it.id}`;

            return (
              <div
                key={it.id}
                className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="grid gap-3 md:grid-cols-12 md:items-end">
                  <label className="md:col-span-3 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">
                      Name
                    </div>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                      value={it.name}
                      onChange={(e) =>
                        updateItem(it.id, { name: e.target.value })
                      }
                    />
                  </label>

                  <label className="md:col-span-2 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">
                      Default amount ({cur})
                    </div>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                      defaultValue={money(it.defaultAmount, cur)}
                      key={`def_${it.id}_${it.defaultAmount}_${cur}`}
                      onBlur={(e) =>
                        updateItem(it.id, {
                          defaultAmount: parseMoneyLoose(e.target.value),
                        })
                      }
                    />
                  </label>

                  <label className="md:col-span-3 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">
                      Behavior
                    </div>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                      value={it.behavior}
                      onChange={(e) => {
                        const behavior =
                          e.target.value === 'monthOnly'
                            ? 'monthOnly'
                            : 'carryForward';
                        updateItem(it.id, {
                          behavior,
                          changes:
                            behavior === 'carryForward' ? it.changes || [] : [],
                          overrides:
                            behavior === 'monthOnly' ? it.overrides || [] : [],
                        });
                      }}
                    >
                      <option value="carryForward">
                        Carry-forward (future changes)
                      </option>
                      <option value="monthOnly">Month-only (variable)</option>
                    </select>
                  </label>

                  {/* End month */}
                  <label className="md:col-span-3 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">
                      End month
                    </div>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                      value={it.endMonthISO || ''}
                      onChange={(e) =>
                        updateItem(it.id, {
                          endMonthISO: e.target.value || null,
                        })
                      }
                    >
                      <option value="">No end</option>
                      {monthOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-rose-600 dark:border-slate-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-12 md:items-end">
                  <div className="md:col-span-5 text-sm text-slate-500 dark:text-slate-400">
                    Amount for{' '}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {editMonthISO}
                    </span>
                    :{' '}
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {money(monthAmount, cur)}
                    </span>
                    <div className="mt-1 text-xs">
                      {it.behavior === 'carryForward'
                        ? 'Set amount for this month to apply to this month + all future months (until changed again).'
                        : 'Set amount for this month only. Other months keep their own values or default.'}
                      {it.endMonthISO ? ` Ends after ${it.endMonthISO}.` : ''}
                    </div>
                  </div>

                  <label className="md:col-span-5 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">
                      Set amount for {editMonthISO} ({cur})
                    </div>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                      defaultValue={money(monthAmount, cur)}
                      key={
                        draftKey +
                        editMonthISO +
                        it.behavior +
                        monthAmount +
                        cur
                      }
                      onBlur={(e) => {
                        const v = parseMoneyLoose(e.target.value);
                        if (Number.isFinite(v)) setForMonth(it, v);
                      }}
                    />
                  </label>

                  <div className="md:col-span-2" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* One-time expenses */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          One-time expenses
        </div>

        <div className="mt-4 space-y-3">
          {plan.oneTimeExpenses.map((it) => (
            <div
              key={it.id}
              className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-12 md:items-end dark:border-slate-800"
            >
              <label className="md:col-span-5 text-sm">
                <div className="mb-1 text-slate-500 dark:text-slate-400">
                  Name
                </div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                  value={it.name}
                  onChange={(e) =>
                    updateOneTime(it.id, { name: e.target.value })
                  }
                />
              </label>

              <label className="md:col-span-3 text-sm">
                <div className="mb-1 text-slate-500 dark:text-slate-400">
                  Month (YYYY-MM)
                </div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                  value={it.monthISO}
                  onChange={(e) =>
                    updateOneTime(it.id, { monthISO: e.target.value })
                  }
                />
              </label>

              <label className="md:col-span-3 text-sm">
                <div className="mb-1 text-slate-500 dark:text-slate-400">
                  Amount ({cur})
                </div>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                  defaultValue={money(it.amount, cur)}
                  key={`ot_${it.id}_${it.amount}_${cur}`}
                  onBlur={(e) =>
                    updateOneTime(it.id, {
                      amount: parseMoneyLoose(e.target.value),
                    })
                  }
                />
              </label>

              <div className="md:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeOneTime(it.id)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-rose-600 dark:border-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          {!plan.oneTimeExpenses.length ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              No one-time expense items.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
