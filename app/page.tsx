'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Plan } from './lib/store';
import { loadPlan } from './lib/store';
import {
  buildNetWorthSeries,
  netWorthAsOf,
  latestNetWorthSnapshotMonth,
} from './lib/engine';
import { NetWorthChart } from './components/NetWorthChart';

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return 'USD';
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(0);
    return c;
  } catch { return 'USD'; }
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function addMonthsISO(startISO: string, add: number) {
  const ok = /^\d{4}-\d{2}$/.test(startISO);
  const y0 = ok ? Number(startISO.slice(0, 4)) : 2026;
  const m0 = ok ? Number(startISO.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  const y = Math.floor(t / 12);
  const m = t % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function ProgressRing({ pct }: { pct: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const r = 22;
  const c = 2 * Math.PI * r;
  const p = clamp01(pct);
  const d = c * p;
  if (!mounted) {
    return <svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" opacity="0.12" strokeWidth="6" /></svg>;
  }
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-label="Goal progress">
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" opacity="0.12" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" opacity="0.95" strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${d} ${c - d}`}
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

function Kpi({ label, value, tone, sub }: { label: string; value: string; tone: 'neutral' | 'positive' | 'negative' | 'accent'; sub?: string; }) {
  const toneText =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'negative' ? 'text-rose-600 dark:text-rose-400' :
    tone === 'accent' ? 'text-blue-600 dark:text-blue-400' :
    'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${toneText}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [windowMonths, setWindowMonths] = useState(12);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setPlan(loadPlan());
  }, []);

  // Listen for plan updates from other pages - reload but do NOT save
  useEffect(() => {
    function onPlanUpdate() { setPlan(loadPlan()); }
    window.addEventListener('finance_planner_plan_updated', onPlanUpdate);
    window.addEventListener('storage', onPlanUpdate);
    return () => {
      window.removeEventListener('finance_planner_plan_updated', onPlanUpdate);
      window.removeEventListener('storage', onPlanUpdate);
    };
  }, []);

  const cur = useMemo(() => safeCurrency(plan?.currency || 'USD'), [plan?.currency]);

  const series = useMemo(() => {
    if (!plan) return [];
    return buildNetWorthSeries(plan);
  }, [plan]);

  const totals = useMemo(() => {
    if (!plan) return { inc: 0, exp: 0, net: 0 };
    const inc = (plan.income || []).reduce((s, i) => s + (Number.isFinite(i.defaultAmount) ? i.defaultAmount : 0), 0);
    const exp = (plan.expenses || []).reduce((s, e) => s + (Number.isFinite(e.defaultAmount) ? e.defaultAmount : 0), 0);
    return { inc, exp, net: inc - exp };
  }, [plan]);

  const maxIdx = useMemo(() => (series.length ? series[series.length - 1].monthIndex : 0), [series]);
  const maxOffset = useMemo(() => Math.max(0, maxIdx - windowMonths), [maxIdx, windowMonths]);
  const effOffset = useMemo(() => Math.min(offset, maxOffset), [offset, maxOffset]);

  useEffect(() => {
    if (offset > maxOffset) setOffset(maxOffset);
  }, [maxOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const startISO = useMemo(() => {
    const base = plan?.startMonthISO || '2026-01';
    return addMonthsISO(base, effOffset);
  }, [plan?.startMonthISO, effOffset]);

  const windowed = useMemo(() => {
    if (!series.length) return [];
    return series
      .filter((p) => p.monthIndex >= effOffset && p.monthIndex <= effOffset + windowMonths)
      .map((p) => ({ ...p, monthIndex: p.monthIndex - effOffset }));
  }, [series, effOffset, windowMonths]);

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  const netTone: 'positive' | 'negative' = totals.net >= 0 ? 'positive' : 'negative';
  const modeLabel =
    plan.netWorthMode === 'snapshot' ? 'Track actual balances' :
    plan.netWorthMode === 'projection' ? 'Hypothetical projection' :
    'Reality-anchored projection';

  const startMonth = plan.startMonthISO || '2026-01';
  const latestSnap = latestNetWorthSnapshotMonth(plan);
  const asOfMonth = plan.netWorthMode === 'projection' ? startMonth : (latestSnap ?? startMonth);
  const netWorthKpi = netWorthAsOf(plan, asOfMonth)?.netWorth ?? 0;
  const netWorthSub = `Mode: ${modeLabel} - As of: ${asOfMonth}`;

  const projectedNW = series.length ? series[series.length - 1].netWorth : netWorthKpi;
  const goal = Math.max(0, plan.goalNetWorth ?? 0);
  const curPct = goal > 0 ? clamp01(netWorthKpi / goal) : 0;
  const projPct = goal > 0 ? clamp01(projectedNW / goal) : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Local-only cash flow + net worth projection</div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Kpi label="Net Worth (balances)" value={money(netWorthKpi, cur)} tone="neutral" sub={netWorthSub} />
        <Kpi label="Monthly Income" value={money(totals.inc, cur)} tone="positive" />
        <Kpi label="Monthly Expenses" value={money(totals.exp, cur)} tone="negative" />
        <Kpi label="Net Cash Flow" value={money(totals.net, cur)} tone={netTone} />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Goal Progress</div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{(curPct * 100).toFixed(1)}%</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{money(netWorthKpi, cur)} / {money(goal, cur)}</div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Projected: <span className="font-medium text-slate-900 dark:text-slate-100">{(projPct * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-blue-600 dark:text-blue-400">
              <ProgressRing pct={curPct} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white pt-4 px-4 pb-0 overflow-hidden shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="px-2 pt-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Net Worth Projection</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Window {windowMonths}m - Start {startISO}</div>
          </div>
          <div className="px-2">
            <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
              {[6, 12, 24, 60].map((m) => (
                <button key={m} type="button" onClick={() => setWindowMonths(m)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${windowMonths === m ? 'bg-blue-600/10 text-slate-900 dark:bg-blue-500/20 dark:text-slate-100' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}>
                  {m===6?"6m":m===12?"1y":m===24?"2y":"5y"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-2 px-2">
          <input type="range" min={0} max={maxOffset} value={effOffset}
            onChange={(e) => setOffset(Number(e.target.value))}
            className="w-full accent-blue-500" aria-label="Scroll chart window" />
        </div>
        <div className="mt-3 px-0 flex-1">
          <NetWorthChart currency={cur} series={windowed} startMonthISO={startISO} heightPx={520} />
        </div>
      </div>
    </div>
  );
}
