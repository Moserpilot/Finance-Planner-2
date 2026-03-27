'use client';

import { useEffect, useMemo, useState } from 'react';
import { amountForMonth } from '../lib/engine';
import type { Plan } from '../lib/store';
import { loadPlan } from '../lib/store';

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

function monthLabel(monthISO: string) {
  if (!/^\d{4}-\d{2}$/.test(monthISO)) return monthISO;
  const d = new Date(`${monthISO}-01T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(d);
}

export default function CashflowPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [months, setMonths] = useState(24);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function load() { setPlan(loadPlan()); }
    load();
    setMounted(true);
    window.addEventListener('finance_planner_plan_updated', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('finance_planner_plan_updated', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  const rows = useMemo(() => {
    if (!plan) return [] as Array<{ monthISO: string; recurringIncome: number; recurringExpenses: number; oneTimeIncome: number; oneTimeExpenses: number; net: number; cum: number }>;
    let cumulative = 0;
    return Array.from({ length: months }, (_, i) => {
      const monthISO = addMonthsISO(plan.startMonthISO || '2026-01', i);
      const recurringIncome = (plan.income || []).reduce((s, x) => s + amountForMonth(x, monthISO), 0);
      const recurringExpenses = (plan.expenses || []).reduce((s, x) => s + amountForMonth(x, monthISO), 0);
      const oneTimeIncome = (plan.oneTimeIncome || []).filter((x) => x.monthISO === monthISO).reduce((s, x) => s + x.amount, 0);
      const oneTimeExpenses = (plan.oneTimeExpenses || []).filter((x) => x.monthISO === monthISO).reduce((s, x) => s + x.amount, 0);
      const net = recurringIncome + oneTimeIncome - recurringExpenses - oneTimeExpenses;
      cumulative += net;
      return { monthISO, recurringIncome, recurringExpenses, oneTimeIncome, oneTimeExpenses, net, cum: cumulative };
    });
  }, [plan, months]);

  if (!mounted || !plan) return <div className="min-h-screen bg-slate-50 dark:bg-black" />;

  const currency = safeCurrency(plan.currency);
  const totals = rows.reduce(
    (acc, row) => {
      acc.income += row.recurringIncome + row.oneTimeIncome;
      acc.expenses += row.recurringExpenses + row.oneTimeExpenses;
      acc.net += row.net;
      return acc;
    },
    { income: 0, expenses: 0, net: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Cash Flow Planner</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Month-by-month income, expenses, and running total.</p>
        </div>
        <label className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Duration</div>
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[12, 24, 36, 60, 120].map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Total Income</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{money(totals.income, currency)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Total Expenses</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">{money(totals.expenses, currency)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Net Cash Flow</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{money(totals.net, currency)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Month</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Rec. Income</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">One-time Inc.</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Rec. Expenses</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">One-time Exp.</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Net</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Running Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.monthISO} className={`border-t border-slate-100 dark:border-slate-800 ${r.net < 0 ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium">{monthLabel(r.monthISO)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{money(r.recurringIncome, currency)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{r.oneTimeIncome > 0 ? money(r.oneTimeIncome, currency) : <span className="text-slate-300 dark:text-slate-700">—</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{money(r.recurringExpenses, currency)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{r.oneTimeExpenses > 0 ? money(r.oneTimeExpenses, currency) : <span className="text-slate-300 dark:text-slate-700">—</span>}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{money(r.net, currency)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.cum >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>{money(r.cum, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}