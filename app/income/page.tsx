'use client';
import { useEffect, useMemo, useState } from 'react';
import { amountForMonth } from '../lib/engine';
import type { DatedAmount, Plan, RecurringItem } from '../lib/store';
import { loadPlan, newOneTimeItem, newRecurringItem, savePlan } from '../lib/store';

function safeCurrency(c: string) {
  const x = (c || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(x) ? x : 'USD';
}
function money(n: number, c: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency(c), maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}
function addMonthsISO(s: string, add: number) {
  const ok = /^\d{4}-\d{2}$/.test(s);
  const y0 = ok ? Number(s.slice(0, 4)) : new Date().getFullYear();
  const m0 = ok ? Number(s.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`;
}
function monthLabel(iso: string) {
  if (!/^\d{4}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(`${iso}-01T00:00:00`));
}
function asNum(v: string) {
  const n = Number(String(v).replace(/[$,%\s,]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function upsert(arr: DatedAmount[], monthISO: string, amount: number) {
  const next = [...arr];
  const i = next.findIndex(x => x.monthISO === monthISO);
  if (i >= 0) next[i] = { monthISO, amount };
  else next.push({ monthISO, amount });
  next.sort((a, b) => a.monthISO < b.monthISO ? -1 : 1);
  return next;
}

export default function IncomePage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editMonth, setEditMonth] = useState('');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setEditMonth(p.startMonthISO || '');
  }, []);

  function save(p: Plan) { setPlan(p); savePlan(p); }

  const cur = safeCurrency(plan?.currency || 'USD');
  const monthOptions = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => addMonthsISO(plan?.startMonthISO || '', i)),
    [plan?.startMonthISO]
  );

  if (!plan) return <div className="min-h-screen bg-slate-50 dark:bg-black" />;

  const ri = plan.income || [];
  const oi = plan.oneTimeIncome || [];

  const updRec = (id: string, patch: Partial<RecurringItem>) =>
    save({ ...plan, income: ri.map(x => x.id === id ? { ...x, ...patch } : x) });

  const setAmt = (item: RecurringItem, amount: number) => {
    if (item.behavior === 'carryForward')
      updRec(item.id, { changes: upsert(item.changes || [], editMonth, amount) });
    else
      updRec(item.id, { overrides: upsert(item.overrides || [], editMonth, amount) });
  };

  const recTotal = ri.reduce((s, it) => s + amountForMonth(it, editMonth), 0);
  const otTotal = oi.filter(x => x.monthISO === editMonth).reduce((s, x) => s + x.amount, 0);

  const inp = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Income</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Recurring and one-time income sources.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Editing Month</div>
          <select value={editMonth} onChange={e => setEditMonth(e.target.value)} className={inp}>
            {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Recurring</div>
          <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">{money(recTotal, cur)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">One-time</div>
          <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">{money(otTotal, cur)}</div>
        </div>
      </div>

      {/* Recurring income */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recurring Income</div>
          <div className="flex gap-2">
            <button
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => save({ ...plan, income: [...ri, newRecurringItem('income')] })}>
              + Recurring
            </button>
          </div>
        </div>

        {ri.length > 0 && (
          <div className="mb-1 hidden grid-cols-6 gap-2 px-1 md:grid">
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">Name</div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">Default</div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">Behavior</div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">Ends</div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">{monthLabel(editMonth)}</div>
            <div />
          </div>
        )}

        <div className="space-y-2">
          {ri.map(item => {
            const ma = amountForMonth(item, editMonth);
            return (
              <div key={item.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <div className="grid gap-2 md:grid-cols-6">
                  <input className={inp} value={item.name} placeholder="Income name"
                    onChange={e => updRec(item.id, { name: e.target.value })} />
                  <input className={inp} type="text"
                    defaultValue={money(item.defaultAmount, cur)}
                    key={'d' + item.id + item.defaultAmount}
                    onBlur={e => updRec(item.id, { defaultAmount: asNum(e.target.value) })} />
                  <select className={inp} value={item.behavior}
                    onChange={e => updRec(item.id, { behavior: e.target.value === 'monthOnly' ? 'monthOnly' : 'carryForward' })}>
                    <option value="carryForward">Carry forward</option>
                    <option value="monthOnly">Month only</option>
                  </select>
                  <select className={inp} value={item.endMonthISO || ''}
                    onChange={e => updRec(item.id, { endMonthISO: e.target.value || null })}>
                    <option value="">No end date</option>
                    {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </select>
                  <input className={inp} type="text"
                    defaultValue={money(ma, cur)}
                    key={'m' + item.id + editMonth + ma}
                    onBlur={e => setAmt(item, asNum(e.target.value))} />
                  <button
                    className="mt-1 rounded-xl border border-rose-200 px-2 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    onClick={() => save({ ...plan, income: ri.filter(x => x.id !== item.id) })}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          {!ri.length && (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">No recurring income yet</div>
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Click <span className="font-semibold">+ Recurring</span> above to add salary, rent, or any regular income.</div>
            </div>
          )}
        </div>
      </div>

      {/* One-time income */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">One-time Income</div>
          <button
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-white/5"
            onClick={() => save({ ...plan, oneTimeIncome: [...oi, newOneTimeItem('income', editMonth)] })}>
            + One-time
          </button>
        </div>
        <div className="space-y-2">
          {oi.map(item => (
            <div key={item.id} className="grid gap-2 md:grid-cols-4">
              <input className={inp} value={item.name} placeholder="Description"
                onChange={e => save({ ...plan, oneTimeIncome: oi.map(x => x.id === item.id ? { ...x, name: e.target.value } : x) })} />
              <select className={inp} value={item.monthISO}
                onChange={e => save({ ...plan, oneTimeIncome: oi.map(x => x.id === item.id ? { ...x, monthISO: e.target.value } : x) })}>
                {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <input className={inp} type="text"
                defaultValue={money(item.amount, cur)}
                key={'ot' + item.id + item.amount}
                onBlur={e => save({ ...plan, oneTimeIncome: oi.map(x => x.id === item.id ? { ...x, amount: asNum(e.target.value) } : x) })} />
              <button
                className="mt-1 rounded-xl border border-rose-200 px-2 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-500/10"
                onClick={() => save({ ...plan, oneTimeIncome: oi.filter(x => x.id !== item.id) })}>
                Remove
              </button>
            </div>
          ))}
          {!oi.length && (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">No one-time income yet</div>
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Add bonuses, tax refunds, or any non-recurring income.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
