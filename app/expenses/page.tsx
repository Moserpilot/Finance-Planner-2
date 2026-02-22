'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan, IncomeExpenseItem } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';
import { amountForMonth, addMonthsISO } from '../lib/engine';

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

function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function toNumber(v: string) {
  const n = Number(String(v).replace(/[$, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function ExpensesPage() {
  const [plan, setPlanState] = useState<Plan | null>(null);
  const [editMonthISO, setEditMonthISO] = useState('2026-01');

  useEffect(() => {
    const p = loadPlan();
    setPlanState(p);
    setEditMonthISO(p.startMonthISO || '2026-01');
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const cur = useMemo(() => safeCurrency(plan?.currency || 'USD'), [plan?.currency]);

  const expenseList = useMemo<IncomeExpenseItem[]>(
    () => (plan?.expenses && Array.isArray(plan.expenses) ? plan.expenses : []),
    [plan]
  );

  const monthTotal = useMemo(() => {
    return expenseList.reduce((sum, it) => sum + amountForMonth(it, editMonthISO), 0);
  }, [expenseList, editMonthISO]);

  function setPlan(next: Plan) {
    setPlanState(next);
  }

  function updateItem(id: string, patch: Partial<IncomeExpenseItem>) {
    if (!plan) return;
    const next = {
      ...plan,
      expenses: expenseList.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    };
    setPlan(next);
  }

  function addItem() {
    if (!plan) return;
    const nextItem: IncomeExpenseItem = {
      id: uid(),
      name: 'New expense',
      amount: 0,
      cadence: 'monthly',
      startMonthISO: plan.startMonthISO || '2026-01',
    };
    setPlan({ ...plan, expenses: [...expenseList, nextItem] });
  }

  function removeItem(id: string) {
    if (!plan) return;
    setPlan({ ...plan, expenses: expenseList.filter((it) => it.id !== id) });
  }

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  const start = plan.startMonthISO || '2026-01';

  const label = 'text-xs font-medium text-slate-500 dark:text-slate-400';
  const input =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ' +
    'text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
    'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Expenses</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Add recurring and one-time expense items</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Month total</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{money(monthTotal, cur)}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
              onClick={() => setEditMonthISO(addMonthsISO(editMonthISO, -1))}
            >
              ◀
            </button>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {editMonthISO}
            </div>

            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
              onClick={() => setEditMonthISO(addMonthsISO(editMonthISO, 1))}
            >
              ▶
            </button>

            <button
              type="button"
              className="ml-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={addItem}
            >
              + Add expense
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {expenseList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No expense items yet. Click “Add expense”.
            </div>
          ) : null}

          {expenseList.map((it) => (
            <div
              key={it.id}
              className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[1fr_200px_160px_160px_44px]"
            >
              <div>
                <div className={label}>Name</div>
                <input value={it.name || ''} onChange={(e) => updateItem(it.id, { name: e.target.value })} className={input} />
              </div>

              <div className="relative">
                <div className={label}>Amount</div>
                <span className="pointer-events-none absolute left-3 top-[34px] text-sm text-slate-400">$</span>
                <input
                  value={String(it.amount ?? 0)}
                  onChange={(e) => updateItem(it.id, { amount: toNumber(e.target.value) })}
                  className={input + ' pl-7'}
                  inputMode="decimal"
                />
              </div>

              <div>
                <div className={label}>Cadence</div>
                <select
                  value={it.cadence || 'monthly'}
                  onChange={(e) => updateItem(it.id, { cadence: e.target.value as any })}
                  className={input}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one-time">One-time</option>
                </select>
              </div>

              <div>
                <div className={label}>Start</div>
                <input
                  value={it.startMonthISO || start}
                  onChange={(e) => updateItem(it.id, { startMonthISO: e.target.value })}
                  className={input}
                  placeholder="YYYY-MM"
                />
              </div>

              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="mt-5 h-10 w-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-white/5"
                aria-label="Remove"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}