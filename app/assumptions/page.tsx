'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';

function money(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0%';
  return `${v.toFixed(2)}%`;
}

function numFromInput(s: string) {
  const cleaned = (s || '').replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export default function AssumptionsPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setPlan(loadPlan());
  }, []);

  // IMPORTANT: Always re-load latest plan right before saving
  // so this page cannot overwrite netWorthAccounts (or anything else)
  function safeSavePlan(patch: Partial<Plan>) {
    const current = loadPlan();

    const next: Plan = {
      ...current,
      ...patch,
      // Hard preserve netWorthAccounts unless you explicitly set it in patch
      netWorthAccounts: (patch as any).netWorthAccounts ?? (current as any).netWorthAccounts,
    };

    savePlan(next);
    setPlan(next);

    setStatus(`Saved ${new Date().toLocaleTimeString()}`);
    setTimeout(() => setStatus(''), 2000);
  }

  function resetAllData() {
    const ok = window.confirm(
      'This will erase ALL locally saved data for this planner (cash flow, net worth, settings) and reload fresh. Continue?',
    );
    if (!ok) return;
    localStorage.clear();
    window.location.href = '/';
  }

  const summary = useMemo(() => {
    if (!plan) return null;
    const nwAccounts = Array.isArray((plan as any).netWorthAccounts) ? (plan as any).netWorthAccounts : [];
    const hasNW = nwAccounts.length > 0;
    return { hasNW };
  }, [plan]);

  if (!plan) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-sm text-slate-600 dark:text-slate-300">Loading…</div>
        </div>
      </div>
    );
  }

  // These fields are intentionally minimal and safe.
  // /net-worth is the only place you edit account balances.
  const currency = (plan as any).currency ?? 'USD';
  const expectedReturnPct = Number((plan as any).expectedReturnPct ?? 6);
  const inflationPct = Number((plan as any).inflationPct ?? 2.5);
  const goalNetWorth = Number((plan as any).goalNetWorth ?? 0);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Assumptions</h1>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Forecast inputs live here. Account balances are edited only in Net Worth.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">{status}</div>

          <button
            onClick={resetAllData}
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            Reset all data
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Market assumptions</div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Expected return (annual)</div>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                value={String(expectedReturnPct)}
                onChange={(e) => safeSavePlan({ ...(plan as any), expectedReturnPct: numFromInput(e.target.value) } as any)}
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Currently: {pct(expectedReturnPct)}</div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Inflation (annual)</div>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                value={String(inflationPct)}
                onChange={(e) => safeSavePlan({ ...(plan as any), inflationPct: numFromInput(e.target.value) } as any)}
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Currently: {pct(inflationPct)}</div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Goal net worth ({currency})</div>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
                value={String(goalNetWorth)}
                onChange={(e) => safeSavePlan({ ...(plan as any), goalNetWorth: numFromInput(e.target.value) } as any)}
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Currently: {money(goalNetWorth)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Net Worth input location</div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
            <div className="font-semibold">Balances are edited on the Net Worth page only.</div>
            <div className="mt-2">
              This prevents data loss from competing saves. Your dashboard reads net worth directly from Net Worth.
            </div>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Status: {summary?.hasNW ? 'Net Worth accounts exist ✅' : 'No Net Worth accounts yet'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
