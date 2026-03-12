'use client';

import { useEffect, useMemo, useState } from 'react';
import { amountForMonth } from '../lib/engine';
import type { DatedAmount, Plan, RecurringItem } from '../lib/store';
import { loadPlan, newOneTimeItem, newRecurringItem, savePlan } from '../lib/store';

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'USD';
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
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

function asNumber(v: string) {
  const n = Number(String(v).replace(/[$,%\s,]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function upsert(arr: DatedAmount[], monthISO: string, amount: number) {
  const next = [...arr];
  const idx = next.findIndex((x) => x.monthISO === monthISO);
  if (idx >= 0) next[idx] = { monthISO, amount };
  else next.push({ monthISO, amount });
  next.sort((a, b) => (a.monthISO < b.monthISO ? -1 : 1));
  return next;
}

export default function IncomePage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editMonth, setEditMonth] = useState('2026-01');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setEditMonth(p.startMonthISO || '2026-01');
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const cur = safeCurrency(plan?.currency || 'USD');

  const monthOptions = useMemo(
    () => Array.from({ length: 120 }, (_, i) => addMonthsISO(plan?.startMonthISO || '2026-01', i)),
    [plan?.startMonthISO]
  );

  if (!plan) return <div className="text-sm text-slate-500">Loading…</div>;

  const recurringIncomeItems = plan.income || [];
  const oneTimeIncomeItems = plan.oneTimeIncome || [];

  const updateRecurring = (id: string, patch: Partial<RecurringItem>) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return { ...prev, income: recurringIncomeItems.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
    });
  };

  const setMonthAmount = (item: RecurringItem, amount: number) => {
    if (item.behavior === 'carryForward') {
      updateRecurring(item.id, { changes: upsert(item.changes || [], editMonth, amount) });
    } else {
      updateRecurring(item.id, { overrides: upsert(item.overrides || [], editMonth, amount) });
    }
  };

  const recurringTotal = recurringIncomeItems.reduce((s, it) => s + amountForMonth(it, editMonth), 0);
  const oneTimeTotal = oneTimeIncomeItems.filter((x) => x.monthISO === editMonth).reduce((s, x) => s + x.amount, 0);

  const label = 'text-xs font-medium text-slate-500';
  const input = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Income</h1>
        <p className="text-sm text-slate-500">Recurring and one-time income with month-based editing.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Editing month</div>
          <select value={editMonth} onChange={(e) => setEditMonth(e.target.value)} className={input}>
            {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Recurring ({editMonth})</div>
          <div className="mt-1 text-xl font-semibold text-emerald-600">{money(recurringTotal, cur)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">One-time ({editMonth})</div>
          <div className="mt-1 text-xl font-semibold text-emerald-600">{money(oneTimeTotal, cur)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap gap-2">
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={() => setPlan({ ...plan, income: [...recurringIncomeItems, newRecurringItem('income')] })}>+ Recurring income</button>
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700" onClick={() => setPlan({ ...plan, oneTimeIncome: [...oneTimeIncomeItems, newOneTimeItem('income', editMonth)] })}>+ One-time income</button>
        </div>

        <div className="mb-2 grid gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid-cols-6">
          <div>Name</div>
          <div>Default amount ({cur})</div>
          <div>Behavior</div>
          <div>End month</div>
          <div>Set amount for {editMonth}</div>
          <div>Action</div>
        </div>

        <div className="space-y-3">
          {recurringIncomeItems.map((item) => {
            const monthAmt = amountForMonth(item, editMonth);
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="grid gap-2 md:grid-cols-6">
                  <input className={input} value={item.name} onChange={(e) => updateRecurring(item.id, { name: e.target.value })} />
                  <input className={input} type="text" defaultValue={money(item.defaultAmount, cur)} key={`d_${item.id}_${item.defaultAmount}_${cur}`} onBlur={(e) => updateRecurring(item.id, { defaultAmount: asNumber(e.target.value) })} />
                  <select className={input} value={item.behavior} onChange={(e) => updateRecurring(item.id, { behavior: e.target.value === 'monthOnly' ? 'monthOnly' : 'carryForward' })}>
                    <option value="carryForward">Carry-forward</option>
                    <option value="monthOnly">Month-only (variable)</option>
                  </select>
                  <select className={input} value={item.endMonthISO || ''} onChange={(e) => updateRecurring(item.id, { endMonthISO: e.target.value || null })}>
                    <option value="">No end</option>
                    {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input className={input} type="text" defaultValue={money(monthAmt, cur)} key={`m_${item.id}_${editMonth}_${monthAmt}_${cur}`} onBlur={(e) => setMonthAmount(item, asNumber(e.target.value))} />
                  <button className="rounded-lg border border-rose-200 px-2 py-2 text-rose-600" onClick={() => setPlan({ ...plan, income: recurringIncomeItems.filter((x) => x.id !== item.id) })}>Remove</button>
                </div>
              </div>
            );
          })}
          {!recurringIncomeItems.length ? <div className="text-sm text-slate-500">No recurring income yet.</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium">One-time income</div>
        <div className="mb-2 mt-2 grid gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid-cols-4">
          <div>Name</div>
          <div>Month</div>
          <div>Amount ({cur})</div>
          <div>Action</div>
        </div>
        <div className="space-y-2">
          {oneTimeIncomeItems.map((item) => (
            <div key={item.id} className="grid gap-2 md:grid-cols-4">
              <input className={input} value={item.name} onChange={(e) => setPlan({ ...plan, oneTimeIncome: oneTimeIncomeItems.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)) })} />
              <select className={input} value={item.monthISO} onChange={(e) => setPlan({ ...plan, oneTimeIncome: oneTimeIncomeItems.map((x) => (x.id === item.id ? { ...x, monthISO: e.target.value } : x)) })}>
                {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input className={input} type="text" defaultValue={money(item.amount, cur)} key={`ot_${item.id}_${item.amount}_${cur}`} onBlur={(e) => setPlan({ ...plan, oneTimeIncome: oneTimeIncomeItems.map((x) => (x.id === item.id ? { ...x, amount: asNumber(e.target.value) } : x)) })} />
              <button className="rounded-lg border border-rose-200 px-2 py-2 text-rose-600" onClick={() => setPlan({ ...plan, oneTimeIncome: oneTimeIncomeItems.filter((x) => x.id !== item.id) })}>Remove</button>
            </div>
          ))}
          {!oneTimeIncomeItems.length ? <div className="text-sm text-slate-500">No one-time income items yet.</div> : null}
        </div>
      </div>
    </div>
  );
}