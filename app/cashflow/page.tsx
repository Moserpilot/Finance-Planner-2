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

  useEffect(() => {
    setPlan(loadPlan());
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

  if (!plan) return <div className="text-sm text-slate-500">Loading…</div>;

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
          <h1 className="text-2xl font-semibold">Cash Flow Planner</h1>
          <p className="text-sm text-slate-500">Track recurring, variable, and one-time cash flow month by month.</p>
        </div>
        <label className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Duration</div>
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[12, 24, 36, 60, 120].map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Income</div>
          <div className="mt-1 text-xl font-semibold text-emerald-600">{money(totals.income, currency)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Expenses</div>
          <div className="mt-1 text-xl font-semibold text-rose-600">{money(totals.expenses, currency)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500">Net</div>
          <div className={`mt-1 text-xl font-semibold ${totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(totals.net, currency)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-right">Recurring Income</th>
                <th className="px-3 py-2 text-right">One-time Income</th>
                <th className="px-3 py-2 text-right">Recurring Expenses</th>
                <th className="px-3 py-2 text-right">One-time Expenses</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-right">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.monthISO} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{monthLabel(r.monthISO)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{money(r.recurringIncome, currency)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{money(r.oneTimeIncome, currency)}</td>
                  <td className="px-3 py-2 text-right text-rose-600">{money(r.recurringExpenses, currency)}</td>
                  <td className="px-3 py-2 text-right text-rose-600">{money(r.oneTimeExpenses, currency)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(r.net, currency)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.cum >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{money(r.cum, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}