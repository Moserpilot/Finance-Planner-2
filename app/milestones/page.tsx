// app/milestones/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Milestone, Plan } from '../lib/store';
import { loadPlan, savePlan, newOneTimeItem } from '../lib/store';

function uid() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {}
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function safeMonth(v: string, fallback: string) {
  return /^\d{4}-\d{2}$/.test(v) ? v : fallback;
}

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'USD';
}

function money0(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function MilestonesPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [monthISO, setMonthISO] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Milestone['kind']>('note');
  const [amount, setAmount] = useState('0');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setMonthISO(p.startMonthISO || '2026-01');
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const cur = useMemo(() => plan?.currency || 'USD', [plan?.currency]);
  const startISO = plan?.startMonthISO || '2026-01';

  function addMilestone() {
    if (!plan) return;
    const id = uid();
    const m: Milestone = {
      id,
      monthISO: safeMonth(monthISO, startISO),
      title: title.trim() || 'Milestone',
      kind,
      amount: kind === 'note' ? undefined : Number(String(amount).replace(/[$,\s]+/g, '')) || 0,
    };

    setPlan((prev) => {
      if (!prev) return prev;

      const milestones = [...(prev.milestones || []), m].sort((a, b) => (a.monthISO < b.monthISO ? -1 : a.monthISO > b.monthISO ? 1 : 0));

      // Mirror to one-time items for cashflow/net worth math.
      let oneTimeIncome = prev.oneTimeIncome || [];
      let oneTimeExpenses = prev.oneTimeExpenses || [];
      if (m.kind === 'oneTimeIncome') {
        const it = { ...newOneTimeItem('income', m.monthISO), id: m.id, name: m.title, amount: m.amount ?? 0 };
        oneTimeIncome = [...oneTimeIncome, it];
      }
      if (m.kind === 'oneTimeExpense') {
        const it = { ...newOneTimeItem('expense', m.monthISO), id: m.id, name: m.title, amount: m.amount ?? 0 };
        oneTimeExpenses = [...oneTimeExpenses, it];
      }

      return { ...prev, milestones, oneTimeIncome, oneTimeExpenses };
    });

    setTitle('');
    setAmount('0');
    setKind('note');
  }

  function removeMilestone(id: string) {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        milestones: (prev.milestones || []).filter((m) => m.id !== id),
        oneTimeIncome: (prev.oneTimeIncome || []).filter((x) => x.id !== id),
        oneTimeExpenses: (prev.oneTimeExpenses || []).filter((x) => x.id !== id),
      };
    });
  }

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  const milestones = (plan.milestones || []).slice().sort((a, b) => (a.monthISO < b.monthISO ? -1 : a.monthISO > b.monthISO ? 1 : 0));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Milestones</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Notes and one-time events that matter</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-2">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Month</div>
            <input
              value={monthISO}
              onChange={(e) => setMonthISO(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
              placeholder="YYYY-MM"
            />
          </div>

          <div className="md:col-span-5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
              placeholder="e.g., Buy house, New job, Big trip"
            />
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Type</div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
            >
              <option value="note">Note (no cash impact)</option>
              <option value="oneTimeIncome">One-time income</option>
              <option value="oneTimeExpense">One-time expense</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Amount</div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={kind === 'note'}
              className={
                'mt-1 w-full rounded-xl border px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30 ' +
                (kind === 'note'
                  ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40'
                  : 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100')
              }
              placeholder="$0"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={addMilestone}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Add milestone
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Timeline</div>
        <div className="mt-3 space-y-2">
          {milestones.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No milestones yet.</div>
          ) : (
            milestones.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center dark:border-slate-800"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{m.title}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {m.monthISO} ·{' '}
                    {m.kind === 'note'
                      ? 'Note'
                      : m.kind === 'oneTimeIncome'
                      ? `One-time income · ${money0(m.amount ?? 0, cur)}`
                      : `One-time expense · ${money0(m.amount ?? 0, cur)}`}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeMilestone(m.id)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
