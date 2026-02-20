'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from './lib/store';
import { loadPlan, savePlan } from './lib/store';
import { amountForMonth, buildNetWorthSeries, buildNetWorthBands } from './lib/engine';
import { NetWorthChart } from './components/NetWorthChart';

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return 'USD';
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(0);
    return c;
  } catch {
    return 'USD';
  }
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

function isoToIndex(monthISO: string) {
  const y = Number(monthISO.slice(0, 4));
  const m = Number(monthISO.slice(5, 7)) - 1;
  return y * 12 + m;
}

function num(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Dashboard Net Worth that mirrors the Net Worth page:
 * - Find latest month across ALL account balances
 * - Per account: use exact month if present, otherwise carry-forward most recent prior balance
 * - Sum all accounts
 */
function netWorthFromAccountsLatest(plan: Plan | null): { monthISO: string | null; netWorth: number } {
  if (!plan) return { monthISO: null, netWorth: 0 };

  const accounts: any[] = Array.isArray((plan as any).netWorthAccounts) ? (plan as any).netWorthAccounts : [];
  if (!accounts.length) return { monthISO: null, netWorth: 0 };

  const months: string[] = [];
  for (const acct of accounts) {
    const balances: any[] = Array.isArray(acct?.balances) ? acct.balances : [];
    for (const b of balances) {
      const m = b?.monthISO;
      if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) months.push(m);
    }
  }
  if (!months.length) return { monthISO: null, netWorth: 0 };

  const latest = Array.from(new Set(months)).sort().pop() as string;
  const latestIdx = isoToIndex(latest);

  let total = 0;

  for (const acct of accounts) {
    const balances: any[] = Array.isArray(acct?.balances) ? acct.balances : [];
    if (!balances.length) continue;

    let bestIdx = -Infinity;
    let bestVal = 0;

    for (const b of balances) {
      const m = b?.monthISO;
      if (typeof m !== 'string' || !/^\d{4}-\d{2}$/.test(m)) continue;

      const idx = isoToIndex(m);
      if (idx > latestIdx) continue;

      if (idx > bestIdx) {
        bestIdx = idx;
        bestVal = num(b?.value ?? b?.balance ?? b?.amount);
      }
    }

    if (bestIdx !== -Infinity) total += bestVal;
  }

  return { monthISO: latest, netWorth: total };
}

export default function DashboardPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [windowMonths, setWindowMonths] = useState(12);
  const [offset, setOffset] = useState(0);
  const [showRisk, setShowRisk] = useState(false);

  useEffect(() => {
    setPlan(loadPlan());
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  // ✅ All hooks must run every render — no hooks below an early return
  const cur = useMemo(() => safeCurrency(plan?.currency || 'USD'), [plan?.currency]);

  const latestNW = useMemo(() => netWorthFromAccountsLatest(plan), [plan]);

  const seriesFull = useMemo(() => {
    if (!plan) return [];
    return buildNetWorthSeries(plan);
  }, [plan]);

  const totals = useMemo(() => {
    if (!plan) return { inc: 0, exp: 0, net: 0 };
    const m = plan.startMonthISO || '2026-01';
    const inc = (plan.income || []).reduce((s, it) => s + amountForMonth(it, m), 0);
    const exp = (plan.expenses || []).reduce((s, it) => s + amountForMonth(it, m), 0);
    return { inc, exp, net: inc - exp };
  }, [plan]);

  const bandsFull = useMemo(() => {
    if (!plan || !showRisk) return null;
    if (plan.netWorthMode === 'snapshot') return null;
    return buildNetWorthBands(plan, 12 * 30, 750);
  }, [plan, showRisk]);

  const maxIdx = useMemo(
    () => (seriesFull.length ? seriesFull[seriesFull.length - 1].monthIndex : 0),
    [seriesFull]
  );
  const maxOffset = useMemo(() => Math.max(0, maxIdx - windowMonths), [maxIdx, windowMonths]);
  const effOffset = useMemo(() => Math.min(offset, maxOffset), [offset, maxOffset]);

  useEffect(() => {
    if (offset > maxOffset) setOffset(maxOffset);
  }, [maxOffset]); // keep stable

  const startISO = useMemo(() => {
    const base = plan?.startMonthISO || '2026-01';
    return addMonthsISO(base, effOffset);
  }, [plan?.startMonthISO, effOffset]);

  const windowedSeries = useMemo(() => {
    if (!seriesFull.length) return [];
    return seriesFull
      .filter((p) => p.monthIndex >= effOffset && p.monthIndex <= effOffset + windowMonths)
      .map((p) => ({ ...p, monthIndex: p.monthIndex - effOffset }));
  }, [seriesFull, effOffset, windowMonths]);

  const windowedBands = useMemo(() => {
    if (!bandsFull) return undefined;
    return bandsFull
      .filter((b) => b.monthIndex >= effOffset && b.monthIndex <= effOffset + windowMonths)
      .map((b) => ({ ...b, monthIndex: b.monthIndex - effOffset }));
  }, [bandsFull, effOffset, windowMonths]);

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  const netTone =
    totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Local-only cash flow + net worth projection</div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Net Worth</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {money(latestNW.netWorth, cur)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            As of: {latestNW.monthISO ?? '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Monthly Income</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {money(totals.inc, cur)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Monthly Expenses</div>
          <div className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
            {money(totals.exp, cur)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Net Cash Flow</div>
          <div className={`mt-2 text-2xl font-semibold ${netTone}`}>{money(totals.net, cur)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="px-2 pt-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Net Worth Projection</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Window {windowMonths}m · Start {startISO}
            </div>
          </div>

          <div className="flex items-center gap-2 px-2">
            <button
              onClick={() => setShowRisk(!showRisk)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
              type="button"
            >
              {showRisk ? 'Hide risk bands' : 'Show risk bands'}
            </button>

            <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
              {[6, 12, 24, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWindowMonths(m)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    windowMonths === m
                      ? 'bg-blue-600/10 text-slate-900 dark:bg-blue-500/20 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 px-2">
          <input
            type="range"
            min={0}
            max={maxOffset}
            value={effOffset}
            onChange={(e) => setOffset(Number(e.target.value))}
            className="w-full accent-blue-500"
            aria-label="Scroll chart window"
          />
        </div>

        <div className="mt-3 px-2">
          <NetWorthChart
            currency={cur}
            startMonthISO={startISO}
            planSeries={windowedSeries}
            bands={showRisk ? windowedBands : undefined}
            heightPx={660}
            fixedWidthPx={1080}
          />
        </div>
      </div>
    </div>
  );
}