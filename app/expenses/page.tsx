'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronIcon } from '../components/ChevronIcon';
import { amountForMonth } from '../lib/engine';
import type { OneTimeItem, Plan, RecurringItem } from '../lib/store';
import { EXPENSE_CATEGORIES, loadPlan, newOneTimeItem, newRecurringItem, savePlan } from '../lib/store';
import type { ExpenseCategory } from '../lib/store';
import { addMonthsISO, CATEGORY_COLORS, money, monthLabel, parseMoney, safeCurrency, upsertDated } from '../lib/utils';

function expenseIcon(name: string, category?: string): string {
  if (category) {
    if (category === 'Housing') return '🏠';
    if (category === 'Food & Dining') return '🍽️';
    if (category === 'Transport') return '🚗';
    if (category === 'Healthcare') return '🏥';
    if (category === 'Entertainment') return '🎬';
    if (category === 'Shopping') return '🛍️';
  }
  const n = name.toLowerCase();
  if (/rent|mortgage|utility|utilities|water|electric|gas/.test(n)) return '🏠';
  if (/food|dining|restaurant|grocery|groceries/.test(n)) return '🍽️';
  if (/car|gas|uber|transit|transport/.test(n)) return '🚗';
  if (/health|medical|doctor|pharmacy|insurance/.test(n)) return '🏥';
  if (/netflix|hulu|spotify|youtube|stream|entertain|hbo|sirius|disney/.test(n)) return '🎬';
  if (/amazon|shop|cloth/.test(n)) return '🛍️';
  return '💳';
}

function CategoryBreakdownChart({ items, oneTime, editMonth, currency }: {
  items: RecurringItem[]; oneTime: OneTimeItem[]; editMonth: string; currency: string;
}) {
  const byCategory = useMemo(() => {
    return EXPENSE_CATEGORIES.map(cat => {
      const recAmt = items.filter(e => e.category === cat).reduce((s, e) => s + amountForMonth(e, editMonth), 0);
      const otAmt = oneTime.filter(x => x.monthISO === editMonth && x.category === cat).reduce((s, x) => s + x.amount, 0);
      return { cat, amount: recAmt + otAmt };
    }).filter(x => x.amount > 0);
  }, [items, oneTime, editMonth]);

  const total = byCategory.reduce((s, x) => s + x.amount, 0);
  if (total === 0 || byCategory.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Spending by Category</div>
        <div className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{money(total, currency)}</div>
      </div>
      <div className="flex h-5 rounded-xl overflow-hidden gap-px mb-4">
        {byCategory.map(x => (
          <div
            key={x.cat}
            style={{ width: `${(x.amount / total) * 100}%`, backgroundColor: CATEGORY_COLORS[x.cat] || '#64748b' }}
            title={`${x.cat}: ${money(x.amount, currency)}`}
          />
        ))}
      </div>
      <div className="space-y-2">
        {byCategory.sort((a,b) => b.amount - a.amount).map(x => (
          <div key={x.cat}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[x.cat] || '#64748b' }} />
                <span className="text-sm text-slate-600 dark:text-slate-200 truncate">{x.cat}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{money(x.amount, currency)}</span>
                <span className="text-xs text-slate-400 dark:text-slate-300 w-8 text-right">{((x.amount / total) * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(x.amount/total)*100}%`, backgroundColor: CATEGORY_COLORS[x.cat] || '#64748b' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpenseCard({ item, editMonth, currency, monthOptions, onUpdate, onDelete, onSetAmt }: {
  item: RecurringItem; editMonth: string; currency: string; monthOptions: string[];
  onUpdate: (patch: Partial<RecurringItem>) => void;
  onDelete: () => void;
  onSetAmt: (item: RecurringItem, amount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ma = amountForMonth(item, editMonth);
  const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
  const color = CATEGORY_COLORS[item.category || ''] || '#64748b';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-lg flex-shrink-0">{expenseIcon(item.name, item.category)}</span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.name || 'Unnamed expense'}</span>
          {item.category && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0" style={{ backgroundColor: color + '18', color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              {item.category}
            </span>
          )}
        </div>
        <div className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums flex-shrink-0">{money(ma, currency)}</div>
        <div className="text-slate-400 dark:text-slate-300"><ChevronIcon open={expanded} /></div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Name</label>
            <input className={inp} value={item.name} placeholder="Expense name"
              onChange={e => onUpdate({ name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Category</label>
            <select className={inp} value={item.category || ''}
              onChange={e => onUpdate({ category: (e.target.value as ExpenseCategory) || undefined })}>
              <option value="">No category</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
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

function OneTimeExpenseCard({ item, currency, monthOptions, accounts, onChange, onDelete }: {
  item: OneTimeItem; currency: string; monthOptions: string[];
  accounts: import('../lib/store').NetWorthAccount[];
  onChange: (patch: Partial<OneTimeItem>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [amtDraft, setAmtDraft] = useState(item.amount > 0 ? money(item.amount, currency) : '');
  const [saved, setSaved] = useState(false);
  const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
  const color = CATEGORY_COLORS[item.category || ''] || '#64748b';

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
        <span className="text-2xl flex-shrink-0">{expenseIcon(item.name, item.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.name || 'One-time expense'}</span>
            {item.category && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: color + '18', color }}>
                {item.category}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-300 mt-0.5">{monthLabel(item.monthISO)}</div>
        </div>
        <div className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums flex-shrink-0">{money(item.amount, currency)}</div>
        <div className="text-slate-400 dark:text-slate-300"><ChevronIcon open={expanded} /></div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Description</label>
            <input className={inp} value={item.name} placeholder="e.g. Car repair"
              onChange={e => onChange({ name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-200 mb-1">Category</label>
            <select className={inp} value={item.category || ''}
              onChange={e => onChange({ category: (e.target.value as ExpenseCategory) || undefined })}>
              <option value="">No category</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
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

export default function ExpensesPage() {
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

  const re = plan.expenses || [];
  const oe = plan.oneTimeExpenses || [];

  const updRec = (id: string, patch: Partial<RecurringItem>) =>
    saveUpdate(p => ({ ...p, expenses: (p.expenses || []).map(x => x.id === id ? { ...x, ...patch } : x) }));

  const setAmt = (item: RecurringItem, amount: number) => {
    if (item.behavior === 'carryForward')
      saveUpdate(p => ({ ...p, expenses: (p.expenses || []).map(x => x.id === item.id ? { ...x, changes: upsertDated(x.changes || [], editMonth, amount) } : x) }));
    else
      saveUpdate(p => ({ ...p, expenses: (p.expenses || []).map(x => x.id === item.id ? { ...x, overrides: upsertDated(x.overrides || [], editMonth, amount) } : x) }));
  };

  const recTotal = re.reduce((s, it) => s + amountForMonth(it, editMonth), 0);
  const otTotal = oe.filter(x => x.monthISO === editMonth).reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-200">Fixed and variable monthly expenses.</p>
        </div>
        <select
          value={editMonth}
          onChange={e => setEditMonth(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-6 items-start">
        <div className="space-y-3" style={{flex:'3 1 320px', minWidth:0}}>
          <div className="grid gap-3" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">Recurring</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{money(recTotal, cur)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">One-time</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{money(otTotal, cur)}</div>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 shadow-sm dark:border-rose-900/30 dark:bg-rose-500/10">
              <div className="text-xs font-medium uppercase tracking-wide text-rose-400 dark:text-rose-500">Total</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-rose-700 dark:text-rose-300">{money(recTotal + otTotal, cur)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recurring Expenses</div>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                onClick={() => saveUpdate(p => ({ ...p, expenses: [...(p.expenses || []), newRecurringItem('expense')] }))}>
                + Add Expense
              </button>
            </div>
            <div className="space-y-2">
              {re.map(item => (
                <ExpenseCard
                  key={item.id}
                  item={item}
                  editMonth={editMonth}
                  currency={cur}
                  monthOptions={monthOptions}
                  onUpdate={patch => updRec(item.id, patch)}
                  onDelete={() => saveUpdate(p => ({ ...p, expenses: (p.expenses || []).filter(x => x.id !== item.id) }))}
                  onSetAmt={setAmt}
                />
              ))}
              {!re.length && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="text-sm text-slate-400 dark:text-slate-300">No recurring expenses yet.</div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">One-time Expenses</div>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                onClick={() => saveUpdate(p => ({ ...p, oneTimeExpenses: [...(p.oneTimeExpenses || []), newOneTimeItem('expense', editMonth)] }))}>
                + Add One-time
              </button>
            </div>
            <div className="space-y-2">
              {oe.map(item => (
                <OneTimeExpenseCard
                  key={item.id}
                  item={item}
                  currency={cur}
                  monthOptions={monthOptions}
                  accounts={plan.netWorthAccounts || []}
                  onChange={patch => saveUpdate(p => ({ ...p, oneTimeExpenses: (p.oneTimeExpenses || []).map(x => x.id === item.id ? { ...x, ...patch } : x) }))}
                  onDelete={() => saveUpdate(p => ({ ...p, oneTimeExpenses: (p.oneTimeExpenses || []).filter(x => x.id !== item.id) }))}
                />
              ))}
              {!oe.length && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="text-sm text-slate-400 dark:text-slate-300">No one-time expenses — add car repairs, medical bills, vacations, or any non-recurring cost.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{flex:'2 1 260px', minWidth:0}}>
          <CategoryBreakdownChart items={re} oneTime={oe} editMonth={editMonth} currency={cur} />
        </div>
      </div>
    </div>
  );
}
