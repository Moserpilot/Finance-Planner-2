'use client';
import { useEffect, useMemo, useState } from 'react';
import { amountForMonth } from '../lib/engine';
import type { ExpenseCategory, Plan } from '../lib/store';
import { EXPENSE_CATEGORIES, loadPlan, savePlan } from '../lib/store';

function safeCurrency(c: string) { const x = (c || '').trim().toUpperCase(); return /^[A-Z]{3}$/.test(x) ? x : 'USD'; }
function money(n: number, c: string) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency(c), maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0); }
function addMonthsISO(s: string, add: number) { const ok = /^\d{4}-\d{2}$/.test(s); const y0 = ok ? Number(s.slice(0, 4)) : 2026; const m0 = ok ? Number(s.slice(5, 7)) - 1 : 0; const t = y0 * 12 + m0 + add; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; }
function parseAmount(v: string) { const n = Number(String(v).replace(/[$,\s]+/g, '')); return Number.isFinite(n) ? n : 0; }

function barColor(pct: number) {
  if (pct > 1) return 'bg-rose-500';
  if (pct >= 1) return 'bg-blue-500';
  if (pct >= 0.8) return 'bg-amber-400';
  return 'bg-emerald-500';
}

const CAT_CONFIG: Record<ExpenseCategory, { color: string; iconBg: string; icon: React.ReactNode }> = {
  'Housing': {
    color: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  'Food & Dining': {
    color: 'text-orange-500',
    iconBg: 'bg-orange-500/10',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  },
  'Transport': {
    color: 'text-violet-500',
    iconBg: 'bg-violet-500/10',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  },
  'Healthcare': {
    color: 'text-rose-500',
    iconBg: 'bg-rose-500/10',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  },
  'Entertainment': {
    color: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  },
  'Shopping': {
    color: 'text-pink-500',
    iconBg: 'bg-pink-500/10',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  },
  'Other': {
    color: 'text-slate-500',
    iconBg: 'bg-slate-500/10',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  },
};

export default function BudgetPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [month, setMonth] = useState('');
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setMonth(p.startMonthISO || '2026-01');
    setMounted(true);
  }, []);

  function saveBudget(cat: ExpenseCategory) {
    if (!plan) return;
    const n = parseAmount(draft);
    const updated = { ...plan, budgets: { ...plan.budgets, [cat]: n } };
    setPlan(updated);
    savePlan(updated);
    setEditing(null);
  }

  const currency = plan?.currency || 'USD';
  const monthOptions = useMemo(() => Array.from({ length: 120 }, (_, i) => addMonthsISO(plan?.startMonthISO || '2026-01', i)), [plan?.startMonthISO]);

  const stats = useMemo(() => {
    if (!plan) return [];
    return EXPENSE_CATEGORIES.map(cat => {
      const spent =
        (plan.expenses || []).filter(e => e.category === cat).reduce((s, e) => s + amountForMonth(e, month), 0) +
        (plan.oneTimeExpenses || []).filter(e => e.category === cat && e.monthISO === month).reduce((s, e) => s + e.amount, 0);
      const uncategorized = cat === 'Other'
        ? (plan.expenses || []).filter(e => !e.category).reduce((s, e) => s + amountForMonth(e, month), 0) +
          (plan.oneTimeExpenses || []).filter(e => !e.category && e.monthISO === month).reduce((s, e) => s + e.amount, 0)
        : 0;
      const total = spent + uncategorized;
      const budget = plan.budgets?.[cat] ?? 0;
      const pct = budget > 0 ? total / budget : 0;
      return { cat, spent: total, budget, pct };
    });
  }, [plan, month]);

  const totalSpent = stats.reduce((s, x) => s + x.spent, 0);
  const totalBudget = stats.reduce((s, x) => s + x.budget, 0);
  const totalPct = totalBudget > 0 ? totalSpent / totalBudget : 0;

  if (!mounted || !plan) return <div className="min-h-screen bg-slate-50 dark:bg-black" />;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Budget</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Track spending against monthly targets.</div>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        >
          {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Total hero card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Total Spent</div>
            <div className="text-4xl font-bold text-slate-900 dark:text-slate-100">{money(totalSpent, currency)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Budget</div>
            <div className="text-xl font-semibold text-slate-400">{totalBudget > 0 ? money(totalBudget, currency) : '—'}</div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${totalBudget > 0 ? barColor(totalPct) : 'bg-slate-300'}`}
            style={{ width: totalBudget > 0 ? `${Math.min(100, totalPct * 100).toFixed(1)}%` : '0%' }}
          />
        </div>
        {totalBudget > 0 && (
          <div className="mt-2 text-xs text-slate-400">
            {totalPct > 1
              ? <span className="text-rose-500 font-medium">{money(totalSpent - totalBudget, currency)} over budget</span>
              : totalPct >= 1
                ? <span className="text-blue-500 font-medium">Total budget met</span>
                : <span>{(totalPct * 100).toFixed(0)}% used · {money(totalBudget - totalSpent, currency)} remaining</span>}
          </div>
        )}
        {totalBudget === 0 && <div className="mt-2 text-xs text-slate-400">Click "+ Set budget" on any category below to get started.</div>}
      </div>

      {/* Category grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map(({ cat, spent, budget, pct }) => {
          const cfg = CAT_CONFIG[cat];
          const isEditing = editing === cat;
          return (
            <div key={cat} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col gap-4">

              {/* Icon + name */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                  <span className={cfg.color}>{cfg.icon}</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cat}</div>
              </div>

              {/* Spent + budget */}
              <div className="flex items-end justify-between">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{money(spent, currency)}</div>
                <div className="text-right">
                  {isEditing ? (
                    <input
                      autoFocus
                      className="w-28 rounded-lg border border-blue-400 bg-transparent px-2 py-1 text-sm text-right text-slate-900 outline-none dark:text-slate-100"
                      value={draft}
                      placeholder="0"
                      onChange={e => setDraft(e.target.value)}
                      onBlur={() => saveBudget(cat)}
                      onKeyDown={e => { if (e.key === 'Enter') saveBudget(cat); if (e.key === 'Escape') setEditing(null); }}
                    />
                  ) : (
                    <button
                      className="text-sm text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      onClick={() => { setEditing(cat); setDraft(budget > 0 ? String(budget) : ''); }}
                    >
                      {budget > 0 ? `/ ${money(budget, currency)}` : '+ Set budget'}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${budget > 0 ? barColor(pct) : 'bg-slate-200 dark:bg-slate-700'}`}
                  style={{ width: budget > 0 ? `${Math.min(100, pct * 100).toFixed(1)}%` : '0%' }}
                />
              </div>

              {/* Status line */}
              <div className="text-xs -mt-2">
                {budget > 0
                  ? pct > 1
                    ? <span className="text-rose-500 font-medium">{money(spent - budget, currency)} over</span>
                    : pct >= 1
                      ? <span className="text-blue-500 font-medium">Budget met</span>
                      : <span className="text-slate-400">{money(budget - spent, currency)} left</span>
                  : <span className="text-slate-300 dark:text-slate-600">No budget set</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
