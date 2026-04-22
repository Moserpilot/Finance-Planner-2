'use client';
import { useEffect, useMemo, useState } from 'react';
import { amountForMonth } from '../lib/engine';
import type { ExpenseCategory, Plan } from '../lib/store';
import { EXPENSE_CATEGORIES, loadPlan, savePlan } from '../lib/store';
import { addMonthsISO, CATEGORY_COLORS, money, monthLabel, parseMoney, safeCurrency } from '../lib/utils';

const HousingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const FoodIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="1" x2="6" y2="4"/>
    <line x1="10" y1="1" x2="10" y2="4"/>
    <line x1="14" y1="1" x2="14" y2="4"/>
  </svg>
);
const TransportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="2"/>
    <path d="M16 8h4l3 5v3h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const HealthIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const EntertainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const ShoppingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const OtherIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1"/>
    <circle cx="19" cy="12" r="1"/>
    <circle cx="5" cy="12" r="1"/>
  </svg>
);

function CategoryIcon({ cat }: { cat: ExpenseCategory }) {
  if (cat === 'Housing') return <HousingIcon />;
  if (cat === 'Food & Dining') return <FoodIcon />;
  if (cat === 'Transport') return <TransportIcon />;
  if (cat === 'Healthcare') return <HealthIcon />;
  if (cat === 'Entertainment') return <EntertainIcon />;
  if (cat === 'Shopping') return <ShoppingIcon />;
  return <OtherIcon />;
}

function barFill(pct: number) {
  if (pct > 1) return 'bg-rose-500';
  return 'bg-blue-500';
}

function StatusPill({ pct, spent, budget, cur }: { pct: number; spent: number; budget: number; cur: string }) {
  if (budget === 0) {
    return <span className="text-xs text-slate-400 dark:text-slate-300">No budget</span>;
  }
  if (pct > 1) {
    return <span className="text-xs font-medium text-rose-500">{money(spent - budget, cur)} over</span>;
  }
  return <span className="text-xs text-slate-400 dark:text-slate-300">{money(budget - spent, cur)} left</span>;
}


function BudgetSummaryPanel({ stats, currency }: { stats: { cat: string; spent: number; budget: number; pct: number }[]; currency: string }) {
  const withBudget = stats.filter(s => s.budget > 0);
  const totalSpent = stats.reduce((s, x) => s + x.spent, 0);
  const totalBudget = stats.reduce((s, x) => s + x.budget, 0);
  const overCats = stats.filter(s => s.budget > 0 && s.pct > 1);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Spending by Category</div>
        <div className="space-y-3">
          {stats.filter(s => s.spent > 0).sort((a,b) => b.spent - a.spent).map(s => {
            const color = CATEGORY_COLORS[s.cat] || '#64748b';
            const pctOfTotal = totalSpent > 0 ? (s.spent / totalSpent) * 100 : 0;
            return (
              <div key={s.cat}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-100 truncate">{s.cat}</span>
                  </div>
                  <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100 ml-2 flex-shrink-0">{money(s.spent, currency)}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pctOfTotal.toFixed(1)}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
          {totalSpent === 0 && <div className="text-sm text-slate-400 dark:text-slate-300">No spending recorded yet.</div>}
        </div>
        {totalBudget > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total budget</span>
              <span className="text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">{money(totalBudget, currency)}</span>
            </div>
          </div>
        )}
      </div>

      {overCats.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-500/10">
          <div className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-2">Over Budget</div>
          <div className="space-y-1.5">
            {overCats.map(s => (
              <div key={s.cat} className="flex justify-between text-sm">
                <span className="text-rose-600 dark:text-rose-400">{s.cat}</span>
                <span className="text-base font-semibold tabular-nums text-rose-600 dark:text-rose-400">+{money(s.spent - s.budget, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {withBudget.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-400 dark:text-slate-300">Click any budget amount in the table to set a target.</div>
        </div>
      )}
    </div>
  );
}

export default function BudgetPage() {
  const [plan, setPlan]       = useState<Plan | null>(null);
  const [month, setMonth]     = useState('');
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [draft, setDraft]     = useState('');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    const n = new Date(); setMonth(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`);
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

  function saveBudget(cat: ExpenseCategory) {
    if (!plan) return;
    const n = parseMoney(draft);
    const updated = { ...plan, budgets: { ...plan.budgets, [cat]: n } };
    setPlan(updated);
    savePlan(updated);
    setEditing(null);
  }

  const currency = plan?.currency || 'USD';

  const monthOptions = useMemo(
    () => Array.from({ length: 120 }, (_, i) => addMonthsISO(plan?.startMonthISO || '2026-01', i)),
    [plan?.startMonthISO]
  );

  const stats = useMemo(() => {
    if (!plan) return [];
    return EXPENSE_CATEGORIES.map(cat => {
      const recurring = (plan.expenses || [])
        .filter(e => e.category === cat)
        .reduce((s, e) => s + amountForMonth(e, month), 0);
      const oneTime = (plan.oneTimeExpenses || [])
        .filter(e => e.category === cat && e.monthISO === month)
        .reduce((s, e) => s + e.amount, 0);
      const uncategorized = cat === 'Other'
        ? (plan.expenses || []).filter(e => !e.category).reduce((s, e) => s + amountForMonth(e, month), 0)
          + (plan.oneTimeExpenses || []).filter(e => !e.category && e.monthISO === month).reduce((s, e) => s + e.amount, 0)
        : 0;
      const spent  = recurring + oneTime + uncategorized;
      const budget = plan.budgets?.[cat] ?? 0;
      const pct    = budget > 0 ? spent / budget : 0;
      return { cat, spent, budget, pct };
    });
  }, [plan, month]);

  const totalSpent  = stats.reduce((s, x) => s + x.spent, 0);
  const totalBudget = stats.reduce((s, x) => s + x.budget, 0);
  const totalPct    = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const totalOver   = totalSpent - totalBudget;

  if (!mounted || !plan) {
    return <div className="min-h-screen bg-slate-50 dark:bg-black" />;
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Budget</div>
          <div className="text-sm text-slate-500 dark:text-slate-200">Track spending against your monthly targets.</div>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* Summary strip */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-1">Spent</div>
              <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{money(totalSpent, currency)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-1">Remaining</div>
              <div className={`text-3xl font-bold tabular-nums ${totalOver > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'}`}>
                {totalBudget === 0 ? '—' : totalOver > 0 ? `-${money(totalOver, currency)}` : money(totalBudget - totalSpent, currency)}
              </div>
            </div>
          </div>

          {totalBudget > 0 ? (
            <div className="space-y-1.5">
              <div className="relative h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${barFill(totalPct)}`}
                  style={{ width: `${Math.min(100, totalPct * 100).toFixed(1)}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 tabular-nums">
                {totalPct > 1
                  ? <span className="text-rose-500 font-medium">{money(totalOver, currency)} over budget</span>
                  : `${(totalPct * 100).toFixed(0)}% of ${money(totalBudget, currency)}`}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">Set budgets below to track progress</div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-wrap gap-6 items-start">
        <div style={{flex:'3 1 320px', minWidth:0}}>
        {/* Category list */}
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden">

        {/* ── Mobile card list (< 640px) ── */}
        <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {stats.map(({ cat, spent, budget, pct }, i) => {
            const isEditing = editing === cat;
            const isLast = i === stats.length - 1;
            return (
              <div
                key={cat}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors${!isLast ? '' : ''}`}
              >
                {/* Icon */}
                <span className="text-slate-400 dark:text-slate-300 shrink-0">
                  <CategoryIcon cat={cat} />
                </span>
                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{cat}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${budget > 0 ? barFill(pct) : 'bg-slate-200 dark:bg-slate-700'}`}
                      style={{ width: budget > 0 ? `${Math.min(100, pct * 100).toFixed(1)}%` : '0%' }}
                    />
                  </div>
                  <div className="mt-0.5 text-xs">
                    <StatusPill pct={pct} spent={spent} budget={budget} cur={currency} />
                  </div>
                </div>
                {/* Right: spent + tap-to-set-budget */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">{money(spent, currency)}</div>
                  {isEditing ? (
                    <input
                      autoFocus
                      className="mt-0.5 w-20 rounded-lg border border-blue-400 bg-transparent px-2 py-0.5 text-xs text-right text-slate-900 outline-none dark:text-slate-100"
                      value={draft}
                      placeholder="0"
                      inputMode="decimal"
                      onChange={e => setDraft(e.target.value)}
                      onBlur={() => saveBudget(cat)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveBudget(cat);
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : (
                    <button
                      className="mt-0.5 text-xs tabular-nums text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      onClick={() => { setEditing(cat); setDraft(budget > 0 ? String(budget) : ''); }}
                      title="Tap to set budget"
                    >
                      {budget > 0 ? money(budget, currency) : <span className="text-xs text-blue-400">+ Set</span>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {/* Mobile totals footer */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-100 dark:bg-slate-800">
            <span className="text-slate-400 dark:text-slate-300 shrink-0" style={{width:20}} />
            <div className="flex-1 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-200">Total</div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{money(totalSpent, currency)}</div>
              <div className={`text-xs font-semibold tabular-nums ${totalOver > 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-300'}`}>
                {totalBudget === 0 ? '—' : totalOver > 0 ? `-${money(totalOver, currency)}` : money(totalBudget - totalSpent, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Desktop table (≥ 640px) ── */}
        <div className="hidden sm:block">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 480 }}>
            {/* Table header */}
            <div
              className="grid gap-4 items-center px-6 py-3 border-b border-slate-100 dark:border-slate-800"
              style={{ gridTemplateColumns: '1fr 6rem 6rem 6rem' }}
            >
              <div className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-300">Category</div>
              <div className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-300 text-right">Spent</div>
              <div className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-300 text-right">Budget</div>
              <div className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-300 text-right">Remaining</div>
            </div>

            {/* Category rows */}
            {stats.map(({ cat, spent, budget, pct }, i) => {
              const isEditing = editing === cat;
              const isLast    = i === stats.length - 1;
              return (
                <div
                  key={cat}
                  className={`group grid gap-4 items-center px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors${!isLast ? ' border-b border-slate-100 dark:border-slate-800' : ''}`}
                  style={{ gridTemplateColumns: '1fr 6rem 6rem 6rem' }}
                >
                  {/* Category name + progress bar */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-slate-400 dark:text-slate-300 shrink-0">
                        <CategoryIcon cat={cat} />
                      </span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{cat}</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden w-full max-w-xs">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${budget > 0 ? barFill(pct) : 'bg-slate-200 dark:bg-slate-700'}`}
                        style={{ width: budget > 0 ? `${Math.min(100, pct * 100).toFixed(1)}%` : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Spent */}
                  <div className="text-sm font-medium tabular-nums text-slate-800 dark:text-slate-200 text-right">
                    {money(spent, currency)}
                  </div>

                  {/* Budget — click to edit */}
                  <div className="text-right">
                    {isEditing ? (
                      <input
                        autoFocus
                        className="w-24 rounded-lg border border-blue-400 bg-transparent px-2 py-0.5 text-sm text-right text-slate-900 outline-none dark:text-slate-100"
                        value={draft}
                        placeholder="0"
                        inputMode="decimal"
                        onChange={e => setDraft(e.target.value)}
                        onBlur={() => saveBudget(cat)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveBudget(cat);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <button
                        className="text-sm tabular-nums text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        onClick={() => { setEditing(cat); setDraft(budget > 0 ? String(budget) : ''); }}
                        title="Click to set budget"
                      >
                        {budget > 0 ? money(budget, currency) : <span className="text-xs">+ Set</span>}
                      </button>
                    )}
                  </div>

                  {/* Remaining / status */}
                  <div className="text-right">
                    <StatusPill pct={pct} spent={spent} budget={budget} cur={currency} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals footer */}
        <div
          className="grid gap-4 items-center px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
          style={{ gridTemplateColumns: '1fr 6rem 6rem 6rem' }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-200">Total</div>
          <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 text-right">{money(totalSpent, currency)}</div>
          <div className="text-sm font-semibold tabular-nums text-slate-400 text-right">{totalBudget > 0 ? money(totalBudget, currency) : '—'}</div>
          <div className={`text-sm font-semibold tabular-nums text-right ${totalOver > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'}`}>
            {totalBudget === 0 ? '—' : totalOver > 0 ? `-${money(totalOver, currency)}` : money(totalBudget - totalSpent, currency)}
          </div>
        </div>
        </div>{/* end hidden sm:block */}
        </div>{/* end card */}
        </div>

        {/* Right panel */}
        <div style={{flex:'2 1 260px', minWidth:0}}>
          <BudgetSummaryPanel stats={stats} currency={currency} />
        </div>
      </div>
    </div>
  );
}
