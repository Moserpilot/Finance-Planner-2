'use client';
import { useEffect, useMemo, useState } from 'react';
import { amountForMonth } from '../lib/engine';
import type { DatedAmount, OneTimeItem, Plan, RecurringItem } from '../lib/store';
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
function incomeIcon(name: string): string {
  const n = name.toLowerCase();
  if (/salary|wage|job|work|employ/.test(n)) return '💼';
  if (/freelance|contract|consult/.test(n)) return '💻';
  if (/rent|rental|property/.test(n)) return '🏠';
  if (/dividend|invest|stock|portfolio/.test(n)) return '📈';
  if (/bonus|commission/.test(n)) return '🎯';
  if (/pension|social|benefit/.test(n)) return '🏛️';
  return '💰';
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IncomeCard({ item, editMonth, currency, monthOptions, onUpdate, onDelete, onSetAmt }: {
  item: RecurringItem; editMonth: string; currency: string; monthOptions: string[];
  onUpdate: (patch: Partial<RecurringItem>) => void;
  onDelete: () => void;
  onSetAmt: (item: RecurringItem, amount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ma = amountForMonth(item, editMonth);
  const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-lg flex-shrink-0">{incomeIcon(item.name)}</span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.name || 'Unnamed income'}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{item.behavior === 'carryForward' ? '· monthly' : '· one-time'}</span>
        </div>
        <div className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">{money(ma, currency)}</div>
        <div className="text-slate-400 dark:text-slate-500"><ChevronIcon open={expanded} /></div>
      </div>

      {/* Expanded fields */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
            <input className={inp} value={item.name} placeholder="Income name"
              onChange={e => onUpdate({ name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Default monthly amount</label>
            <input className={inp} type="text"
              defaultValue={money(item.defaultAmount, currency)}
              key={'d' + item.id + item.defaultAmount}
              onBlur={e => onUpdate({ defaultAmount: asNum(e.target.value) })} />
          </div>
          <div className="grid gap-3" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Frequency</label>
              <select className={inp} value={item.behavior}
                onChange={e => onUpdate({ behavior: e.target.value === 'monthOnly' ? 'monthOnly' : 'carryForward' })}>
                <option value="carryForward">Monthly recurring</option>
                <option value="monthOnly">This month only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Stop after</label>
              <select className={inp} value={item.endMonthISO || ''}
                onChange={e => onUpdate({ endMonthISO: e.target.value || null })}>
                <option value="">Never</option>
                {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Amount for {monthLabel(editMonth)}</label>
            <input className={inp} type="text"
              defaultValue={money(ma, currency)}
              key={'m' + item.id + editMonth + ma}
              onBlur={e => onSetAmt(item, asNum(e.target.value))} />
          </div>
          <button
            className="w-full rounded-xl border border-rose-200 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
            onClick={onDelete}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function OneTimeIncomeCard({ item, currency, monthOptions, onChange, onDelete }: {
  item: OneTimeItem; currency: string; monthOptions: string[];
  onChange: (patch: Partial<OneTimeItem>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [amtDraft, setAmtDraft] = useState(money(item.amount, currency));
  const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  function saveAmt() { onChange({ amount: asNum(amtDraft) }); }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-2xl flex-shrink-0">💰</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.name || 'One-time income'}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{monthLabel(item.monthISO)}</div>
        </div>
        <div className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">{money(item.amount, currency)}</div>
        <div className="text-slate-400 dark:text-slate-500"><ChevronIcon open={expanded} /></div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
            <input className={inp} value={item.name} placeholder="e.g. Tax refund"
              onChange={e => onChange({ name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Month</label>
            <select className={inp} value={item.monthISO} onChange={e => onChange({ monthISO: e.target.value })}>
              {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Amount</label>
            <input className={inp} type="text" value={amtDraft}
              onChange={e => setAmtDraft(e.target.value)}
              onBlur={saveAmt} />
          </div>
          <button
            className="w-full rounded-xl bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            onClick={saveAmt}>
            Save
          </button>
          <button
            className="w-full rounded-xl border border-rose-200 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
            onClick={onDelete}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

const INCOME_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899'];

function IncomeBreakdownPanel({ items, total, currency, plan, editMonth }: {
  items: RecurringItem[]; total: number; currency: string; plan: Plan; editMonth: string;
}) {
  const totalExp = (plan.expenses || []).reduce((s, e) => s + amountForMonth(e, editMonth), 0)
    + (plan.oneTimeExpenses || []).filter(x => x.monthISO === editMonth).reduce((s, x) => s + x.amount, 0);
  const savings = total - totalExp;
  const savingsRate = total > 0 ? (savings / total) * 100 : 0;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Income Sources</div>
        <div className="space-y-3">
          {items.map((item, i) => {
            const amt = amountForMonth(item, editMonth);
            const pct = total > 0 ? (amt / total) * 100 : 0;
            return (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                  <span className="text-base font-bold tabular-nums text-slate-900 dark:text-slate-100 ml-2 flex-shrink-0">{money(amt, currency)}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct.toFixed(1)}%`, backgroundColor: INCOME_COLORS[i % INCOME_COLORS.length] }} />
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-500 mt-0.5">{pct.toFixed(0)}% of total</div>
              </div>
            );
          })}
          {!items.length && <div className="text-sm text-slate-400 dark:text-slate-500">No income sources yet.</div>}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-500 dark:text-slate-400">Monthly total</span>
          <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(total, currency)}</span>
        </div>
      </div>
      {total > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Monthly Cash Flow</div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Income</span>
              <span className="font-semibold text-base tabular-nums text-emerald-600 dark:text-emerald-400">{money(total, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Expenses</span>
              <span className="font-semibold text-base tabular-nums text-rose-500">−{money(totalExp, currency)}</span>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Savings</span>
              <span className={`font-semibold text-base tabular-nums ${savings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{money(savings, currency)}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1">
              <div className={`h-full rounded-full ${savings >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, Math.abs(savingsRate)).toFixed(1)}%` }} />
            </div>
            <div className="text-sm text-slate-400 dark:text-slate-500">{savingsRate.toFixed(0)}% savings rate</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IncomePage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editMonth, setEditMonth] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setEditMonth(p.startMonthISO || '');
    setMounted(true);
  }, []);

  function save(p: Plan) { setPlan(p); savePlan(p); }

  const cur = safeCurrency(plan?.currency || 'USD');
  const monthOptions = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => addMonthsISO(plan?.startMonthISO || '', i)),
    [plan?.startMonthISO]
  );

  if (!mounted || !plan) return <div className="min-h-screen bg-slate-50 dark:bg-black" />;

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Income</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Recurring and one-time income streams.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={editMonth}
            onChange={e => setEditMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-wrap gap-6 items-start">
        {/* Left — list */}
        <div className="space-y-3" style={{flex:'3 1 320px', minWidth:0}}>
          {/* Summary */}
          <div className="grid gap-3" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Recurring</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(recTotal, cur)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">One-time</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(otTotal, cur)}</div>
            </div>
          </div>

          {/* Recurring income */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recurring Income</div>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                onClick={() => save({ ...plan, income: [...ri, newRecurringItem('income')] })}>
                + Add Income
              </button>
            </div>
            <div className="space-y-2">
              {ri.map(item => (
                <IncomeCard
                  key={item.id}
                  item={item}
                  editMonth={editMonth}
                  currency={cur}
                  monthOptions={monthOptions}
                  onUpdate={patch => updRec(item.id, patch)}
                  onDelete={() => save({ ...plan, income: ri.filter(x => x.id !== item.id) })}
                  onSetAmt={setAmt}
                />
              ))}
              {!ri.length && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="text-sm text-slate-400 dark:text-slate-500">No recurring income yet — add salary, freelance work, or any regular income stream.</div>
                </div>
              )}
            </div>
          </div>

          {/* One-time income */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">One-time Income</div>
              <button
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => save({ ...plan, oneTimeIncome: [...oi, newOneTimeItem('income', editMonth)] })}>
                + Add One-time
              </button>
            </div>
            <div className="space-y-2">
              {oi.map(item => (
                <OneTimeIncomeCard
                  key={item.id}
                  item={item}
                  currency={cur}
                  monthOptions={monthOptions}
                  onChange={patch => save({ ...plan, oneTimeIncome: oi.map(x => x.id === item.id ? { ...x, ...patch } : x) })}
                  onDelete={() => save({ ...plan, oneTimeIncome: oi.filter(x => x.id !== item.id) })}
                />
              ))}
              {!oi.length && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="text-sm text-slate-400 dark:text-slate-500">No one-time income — add bonuses, tax refunds, or any non-recurring income.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — breakdown panel */}
        <div style={{flex:'2 1 260px', minWidth:0}}>
          <IncomeBreakdownPanel items={ri} total={recTotal + otTotal} currency={cur} plan={plan} editMonth={editMonth} />
        </div>
      </div>
    </div>
  );
}
