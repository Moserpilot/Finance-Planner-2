'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronIcon } from '../components/ChevronIcon';
import { amountForMonth } from '../lib/engine';
import type { OneTimeItem, Plan, RecurringItem } from '../lib/store';
import { loadPlan, newOneTimeItem, newRecurringItem, savePlan } from '../lib/store';
import { addMonthsISO, money, monthLabel, parseMoney, safeCurrency, upsertDated } from '../lib/utils';

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
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-lg flex-shrink-0">{incomeIcon(item.name)}</span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.name || 'Unnamed income'}</span>
          <span className="text-xs text-slate-400 dark:text-slate-300 flex-shrink-0">{item.behavior === 'carryForward' ? '· monthly' : '· one-time'}</span>
        </div>
        <div className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">{money(ma, currency)}</div>
        <div className="text-slate-400 dark:text-slate-300"><ChevronIcon open={expanded} /></div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Name</label>
            <input className={inp} value={item.name} placeholder="Income name"
              onChange={e => onUpdate({ name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Default monthly amount</label>
            <input className={inp} type="text" inputMode="decimal"
              defaultValue={money(item.defaultAmount, currency)}
              key={'d' + item.id + item.defaultAmount}
              onBlur={e => onUpdate({ defaultAmount: parseMoney(e.target.value) })} />
          </div>
          <div className="grid gap-3" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Frequency</label>
              <select className={inp} value={item.behavior}
                onChange={e => onUpdate({ behavior: e.target.value === 'monthOnly' ? 'monthOnly' : 'carryForward' })}>
                <option value="carryForward">Monthly recurring</option>
                <option value="monthOnly">This month only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Stop after</label>
              <select className={inp} value={item.endMonthISO || ''}
                onChange={e => onUpdate({ endMonthISO: e.target.value || null })}>
                <option value="">Never</option>
                {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Amount for {monthLabel(editMonth)}</label>
            <input className={inp} type="text" inputMode="decimal"
              defaultValue={money(ma, currency)}
              key={'m' + item.id + editMonth + ma}
              onBlur={e => onSetAmt(item, parseMoney(e.target.value))} />
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

function OneTimeIncomeCard({ item, currency, monthOptions, accounts, onChange, onDelete }: {
  item: OneTimeItem; currency: string; monthOptions: string[];
  accounts: import('../lib/store').NetWorthAccount[];
  onChange: (patch: Partial<OneTimeItem>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [amtDraft, setAmtDraft] = useState(item.amount > 0 ? money(item.amount, currency) : '');
  const [saved, setSaved] = useState(false);
  const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  function saveAmt() {
    const n = parseMoney(amtDraft);
    onChange({ amount: n });
    setAmtDraft(n > 0 ? money(n, currency) : '');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-2xl flex-shrink-0">💰</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.name || 'One-time income'}</div>
          <div className="text-xs text-slate-400 dark:text-slate-300 mt-0.5">{monthLabel(item.monthISO)}</div>
        </div>
        <div className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">{money(item.amount, currency)}</div>
        <div className="text-slate-400 dark:text-slate-300"><ChevronIcon open={expanded} /></div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Description</label>
            <input className={inp} value={item.name} placeholder="e.g. Tax refund"
              onChange={e => onChange({ name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Month</label>
            <select className={inp} value={item.monthISO} onChange={e => onChange({ monthISO: e.target.value })}>
              {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Account (for allocation pie)</label>
              <select className={inp} value={item.accountId || ''} onChange={e => onChange({ accountId: e.target.value || undefined })}>
                <option value="">— None —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-200 pointer-events-none select-none">$</span>
              <input className={inp + ' pl-6'} type="text" inputMode="decimal" value={amtDraft}
                placeholder="0"
                onChange={e => setAmtDraft(e.target.value)}
                onFocus={e => { setAmtDraft(String(parseMoney(amtDraft) || '')); e.target.select(); }}
                onBlur={saveAmt} />
            </div>
          </div>
          <button
            className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
            onClick={saveAmt}>
            {saved ? '✓ Saved' : 'Save'}
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
                <div className="text-xs font-medium text-slate-500 dark:text-slate-300 mt-0.5">{pct.toFixed(0)}% of total</div>
              </div>
            );
          })}
          {!items.length && <div className="text-sm text-slate-400 dark:text-slate-300">No income sources yet.</div>}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-500 dark:text-slate-200">Monthly total</span>
          <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(total, currency)}</span>
        </div>
      </div>
      {total > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Monthly Cash Flow</div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-200">Income</span>
              <span className="font-semibold text-base tabular-nums text-emerald-600 dark:text-emerald-400">{money(total, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-200">Expenses</span>
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
            <div className="text-sm text-slate-400 dark:text-slate-300">{savingsRate.toFixed(0)}% savings rate</div>
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
    const n = new Date(); setEditMonth(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`);
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

  function saveUpdate(fn: (p: Plan) => Plan) {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = fn(prev);
      savePlan(updated);
      return updated;
    });
  }

  const cur = safeCurrency(plan?.currency || 'USD');
  const monthOptions = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => addMonthsISO(plan?.startMonthISO || '', i)),
    [plan?.startMonthISO]
  );

  if (!mounted || !plan) return <div className="min-h-screen bg-slate-50 dark:bg-black" />;

  const ri = plan.income || [];
  const oi = plan.oneTimeIncome || [];

  const updRec = (id: string, patch: Partial<RecurringItem>) =>
    saveUpdate(p => ({ ...p, income: (p.income || []).map(x => x.id === id ? { ...x, ...patch } : x) }));

  const setAmt = (item: RecurringItem, amount: number) => {
    if (item.behavior === 'carryForward')
      saveUpdate(p => ({ ...p, income: (p.income || []).map(x => x.id === item.id ? { ...x, changes: upsertDated(x.changes || [], editMonth, amount) } : x) }));
    else
      saveUpdate(p => ({ ...p, income: (p.income || []).map(x => x.id === item.id ? { ...x, overrides: upsertDated(x.overrides || [], editMonth, amount) } : x) }));
  };

  const recTotal = ri.reduce((s, it) => s + amountForMonth(it, editMonth), 0);
  const otTotal = oi.filter(x => x.monthISO === editMonth).reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Income</h1>
          <p className="text-sm text-slate-500 dark:text-slate-200">Recurring and one-time income streams.</p>
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

      <div className="flex flex-wrap gap-6 items-start">
        <div className="space-y-3" style={{flex:'3 1 320px', minWidth:0}}>
          <div className="grid gap-3" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">Recurring</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(recTotal, cur)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">One-time</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(otTotal, cur)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recurring Income</div>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                onClick={() => saveUpdate(p => ({ ...p, income: [...(p.income || []), newRecurringItem('income')] }))}>
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
                  onDelete={() => saveUpdate(p => ({ ...p, income: (p.income || []).filter(x => x.id !== item.id) }))}
                  onSetAmt={setAmt}
                />
              ))}
              {!ri.length && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="text-sm text-slate-400 dark:text-slate-300">No recurring income yet — add salary, freelance work, or any regular income stream.</div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">One-time Income</div>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                onClick={() => saveUpdate(p => ({ ...p, oneTimeIncome: [...(p.oneTimeIncome || []), newOneTimeItem('income', editMonth)] }))}>
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
                  accounts={plan.netWorthAccounts || []}
                  onChange={patch => saveUpdate(p => ({ ...p, oneTimeIncome: (p.oneTimeIncome || []).map(x => x.id === item.id ? { ...x, ...patch } : x) }))}
                  onDelete={() => saveUpdate(p => ({ ...p, oneTimeIncome: (p.oneTimeIncome || []).filter(x => x.id !== item.id) }))}
                />
              ))}
              {!oi.length && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="text-sm text-slate-400 dark:text-slate-300">No one-time income — add bonuses, tax refunds, or any non-recurring income.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{flex:'2 1 260px', minWidth:0}}>
          <IncomeBreakdownPanel items={ri} total={recTotal + otTotal} currency={cur} plan={plan} editMonth={editMonth} />
        </div>
      </div>
    </div>
  );
}
