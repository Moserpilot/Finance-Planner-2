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

function formatWithCommas(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(x);
}

function parseMoneyLoose(v: string) {
  const cleaned = String(v).replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="mr-2 text-sm text-slate-400">$</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-slate-100"
        />
      </div>
    </div>
  );
}

export default function IncomePage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editMonthISO, setEditMonthISO] = useState('2026-01');

  // local input strings for money fields
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setEditMonthISO(p.startMonthISO || '2026-01');
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const items = useMemo(() => (Array.isArray(plan?.income) ? plan!.income : []), [plan]);

  const monthTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + amountForMonth(it, editMonthISO), 0);
  }, [items, editMonthISO]);

  function patchPlan(next: Plan) {
    setPlan(next);
  }

  function updateItem(id: string, patch: Partial<IncomeExpenseItem>) {
    if (!plan) return;
    patchPlan({ ...plan, income: items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  }

  function addItem() {
    if (!plan) return;
    const nextItem: IncomeExpenseItem = {
      id: uid(),
      name: 'New income',
      amount: 0,
      cadence: 'monthly',
      startMonthISO: plan.startMonthISO || '2026-01',
    };
    patchPlan({ ...plan, income: [...items, nextItem] });
    setAmountDraft((d) => ({ ...d, [nextItem.id]: '0' }));
  }

  function removeItem(id: string) {
    if (!plan) return;
    patchPlan({ ...plan, income: items.filter((it) => it.id !== id) });
    setAmountDraft((d) => {
      const { [id]: _, ...rest } = d;
      return rest;
    });
  }

  function getDraft(id: string, amt: number) {
    const v = amountDraft[id];
    return v != null ? v : formatWithCommas(amt);
  }

  function commitAmount(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const raw = amountDraft[id] ?? String(it.amount ?? 0);
    const n = parseMoneyLoose(raw);
    updateItem(id, { amount: n });
    setAmountDraft((d) => ({ ...d, [id]: formatWithCommas(n) }));
  }

  if (!plan) return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;

  const inputBase =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ' +
    'text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
    'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Income</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Recurring + one-time income</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Month total</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency(plan.currency || 'USD'), maximumFractionDigits: 0 }).format(monthTotal)}
            </div>
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
              + Add income
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[1fr_220px_160px_160px_44px]"
            >
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Name</div>
                <input
                  value={it.name || ''}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                  className={inputBase}
                />
              </div>

              <div onBlur={() => commitAmount(it.id)}>
                <MoneyInput
                  label="Amount"
                  value={getDraft(it.id, Number(it.amount ?? 0))}
                  onChange={(v) => setAmountDraft((d) => ({ ...d, [it.id]: v }))}
                />
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Cadence</div>
                <select
                  value={it.cadence || 'monthly'}
                  onChange={(e) => updateItem(it.id, { cadence: e.target.value as any })}
                  className={inputBase}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one-time">One-time</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Start</div>
                <input
                  value={it.startMonthISO || plan.startMonthISO || '2026-01'}
                  onChange={(e) => updateItem(it.id, { startMonthISO: e.target.value })}
                  className={inputBase}
                  placeholder="YYYY-MM"
                />
              </div>

              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="mt-5 h-10 w-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-white/5"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No income items yet. Click “Add income”.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}