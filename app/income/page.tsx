'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan, RecurringItem } from '../lib/store';
import { loadPlan, savePlan, newRecurringItem, newOneTimeItem } from '../lib/store';
import { amountForMonth } from '../lib/engine';

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'USD';
}

const selectStrong =
  'w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ' +
  'text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
  'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30';

function money(n: number, currency: string) {
  const cur = safeCurrency(currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function parseMoneyLoose(v: string) {
  const cleaned = String(v).replace(/[$,%\s,]+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyInput(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  const body = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
  return `$${body}`;
}

function MoneyInput({
  value,
  onValue,
}: {
  value: number;
  onValue: (n: number) => void;
}) {
  const [text, setText] = useState<string>(() => formatMoneyInput(value));

  useEffect(() => {
    setText(formatMoneyInput(value));
  }, [value]);

  return (
    <input
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onValue(parseMoneyLoose(next));
      }}
      onBlur={() => {
        const n = parseMoneyLoose(text);
        setText(formatMoneyInput(n));
      }}
    />
  );
}

function addMonthsISO(startISO: string, add: number) {
  const [y, m] = startISO.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1 + add, 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function formatMonth(iso: string) {
  const [y, m] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function upsertDated(list: { monthISO: string; amount: number }[], monthISO: string, amount: number) {
  const next = [...(list || [])];
  const idx = next.findIndex((x) => x.monthISO === monthISO);
  if (idx >= 0) next[idx] = { monthISO, amount };
  else next.push({ monthISO, amount });
  next.sort((a, b) => a.monthISO.localeCompare(b.monthISO));
  return next;
}

export default function IncomePage() {
  const [{ plan, editMonthISO }, setState] = useState(() => {
    const p = loadPlan();
    return { plan: p, editMonthISO: p.startMonthISO };
  });

  // Debounced save for smoother typing
  useEffect(() => {
    const t = window.setTimeout(() => savePlan(plan), 400);
    return () => window.clearTimeout(t);
  }, [plan]);

  // Keep edit month aligned if start month changes
  useEffect(() => {
    if (plan.startMonthISO && editMonthISO < plan.startMonthISO) {
      setState((s) => ({ ...s, editMonthISO: plan.startMonthISO }));
    }
  }, [plan.startMonthISO]); // eslint-disable-line react-hooks/exhaustive-deps

  const currency = safeCurrency(plan.currency);

  const months = useMemo(() => {
    const count = 24;
    return Array.from({ length: count }, (_, i) => addMonthsISO(plan.startMonthISO, i));
  }, [plan.startMonthISO]);

  const monthTotal = useMemo(() => {
    // ✅ INCOME keys
    return plan.income.reduce((sum, it) => sum + amountForMonth(it, editMonthISO), 0);
  }, [plan.income, editMonthISO]);

  function setPlan(next: Plan) {
    setState((s) => ({ ...s, plan: next }));
  }

  function setEditMonth(next: string) {
    setState((s) => ({ ...s, editMonthISO: next }));
  }

  function updateItem(id: string, patch: Partial<RecurringItem>) {
    setPlan({
      ...plan,
      // ✅ INCOME keys
      income: plan.income.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  }

  function removeItem(id: string) {
    setPlan({ ...plan, income: plan.income.filter((it) => it.id !== id) });
  }

  function addRecurring() {
    // ✅ income kind
    setPlan({ ...plan, income: [...plan.income, newRecurringItem('income')] });
  }

  function updateOneTime(id: string, patch: any) {
    setPlan({
      ...plan,
      // ✅ oneTimeIncome
      oneTimeIncome: plan.oneTimeIncome.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  }

  function removeOneTime(id: string) {
    setPlan({ ...plan, oneTimeIncome: plan.oneTimeIncome.filter((it) => it.id !== id) });
  }

  function addOneTime() {
    setPlan({
      ...plan,
      // ✅ income kind
      oneTimeIncome: [...plan.oneTimeIncome, newOneTimeItem('income', editMonthISO)],
    });
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Income</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add recurring and one-time income. Use the month selector to edit month-specific amounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Editing month:{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {formatMonth(editMonthISO)}
            </span>
          </div>

          <input
            className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
            type="month"
            value={editMonthISO}
            onChange={(e) => setEditMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Total income for {formatMonth(editMonthISO)}:{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {money(monthTotal, currency)}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            onClick={addRecurring}
          >
            + Add recurring income
          </button>
          <button
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
            onClick={addOneTime}
          >
            + Add one-time income
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {plan.income.map((it) => {
          const amt = amountForMonth(it, editMonthISO);

          return (
            <div
              key={it.id}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-12 md:items-end dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="md:col-span-4">
                <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">Name</div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                  value={it.name}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">
                  Amount ({formatMonth(editMonthISO)})
                </div>
                <MoneyInput
                  value={amt}
                  onValue={(amount) => {
                    if (it.behavior === 'carryForward') {
                      const changes = upsertDated(it.changes || [], editMonthISO, amount);
                      updateItem(it.id, { changes });
                    } else {
                      const overrides = upsertDated(it.overrides || [], editMonthISO, amount);
                      updateItem(it.id, { overrides });
                    }
                  }}
                />
              </div>

              <div className="md:col-span-3 text-sm">
                <div className="mb-1 text-slate-500 dark:text-slate-400">Behavior</div>
                <select
                  className={selectStrong}
                  value={it.behavior}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'carryForward' || v === 'monthOnly') updateItem(it.id, { behavior: v });
                  }}
                >
                  <option value="carryForward">Carry forward (recurring)</option>
                  <option value="monthOnly">Month-only (does not carry)</option>
                </select>

                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {it.behavior === 'carryForward'
                    ? 'Edits apply to this month and all future months until changed again.'
                    : 'Edits apply only to the selected month.'}
                </div>
              </div>

              <div className="md:col-span-3 text-sm">
                <div className="mb-1 text-slate-500 dark:text-slate-400">End month</div>
                <select
                  className={selectStrong}
                  value={it.endMonthISO || ''}
                  onChange={(e) => updateItem(it.id, { endMonthISO: e.target.value || null })}
                >
                  <option value="">No end</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {formatMonth(m)}
                    </option>
                  ))}
                </select>

                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {it.endMonthISO ? `Stops after ${formatMonth(it.endMonthISO)}.` : 'Continues indefinitely.'}
                </div>
              </div>

              <div className="md:col-span-12 mt-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500 dark:text-slate-400" />
                <button
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                  onClick={() => removeItem(it.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">One-time income</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">These apply to a single month only.</p>

        <div className="mt-4 space-y-3">
          {plan.oneTimeIncome.map((it) => (
            <div
              key={it.id}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-12 md:items-end dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="md:col-span-5">
                <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">Name</div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                  value={it.name}
                  onChange={(e) => updateOneTime(it.id, { name: e.target.value })}
                />
              </div>

              <div className="md:col-span-3">
                <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">Month</div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                  type="month"
                  value={it.monthISO}
                  onChange={(e) => updateOneTime(it.id, { monthISO: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">Amount</div>
                <MoneyInput value={it.amount} onValue={(n) => updateOneTime(it.id, { amount: n })} />
              </div>

              <div className="md:col-span-2">
                <button
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                  onClick={() => removeOneTime(it.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {plan.oneTimeIncome.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No one-time income yet.
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
            onClick={addOneTime}
          >
            + Add one-time income
          </button>
        </div>
      </div>
    </div>
  );
}
