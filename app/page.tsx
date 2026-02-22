'use client'; 

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from './lib/store';
import { loadPlan, savePlan } from './lib/store';
import {
  amountForMonth,
  buildCashFlowSeries,
  buildNetWorthBands,
  buildNetWorthSeries,
  latestNetWorthSnapshotMonth,
  netWorthAsOf,
  netWorthForMonth,
} from './lib/engine';
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

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
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

function ProgressRing({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const p = clamp01(pct);
  const d = c * p;

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-label="Goal progress">
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" opacity="0.12" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="currentColor"
        opacity="0.95"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${d} ${c - d}`}
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

function Kpi({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'positive' | 'negative' | 'accent';
  sub?: string;
}) {
  const toneText =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'accent'
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${toneText}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div> : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ' +
        (checked
          ? 'border-slate-200 bg-slate-900 text-white dark:border-slate-700 dark:bg-white dark:text-slate-900'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5')
      }
      aria-pressed={checked}
    >
      <span
        className={
          'h-4 w-4 rounded-md border ' +
          (checked
            ? 'border-white/40 bg-white/10 dark:border-slate-900/20 dark:bg-slate-900/10'
            : 'border-slate-300 bg-transparent dark:border-slate-700')
        }
      />
      {label}
    </button>
  );
}

export default function DashboardPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [windowMonths, setWindowMonths] = useState(12);
  const [offset, setOffset] = useState(0);
  const [showActual, setShowActual] = useState(true);
  const [showRisk, setShowRisk] = useState(false);

  useEffect(() => setPlan(loadPlan()), []);
  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  // ✅ ALL HOOKS MUST BE ABOVE ANY EARLY RETURN
  const cur = useMemo(() => safeCurrency(plan?.currency || 'USD'), [plan?.currency]);

  const startMonth = plan?.startMonthISO || '2026-01';

  const latestSnap = useMemo(() => (plan ? latestNetWorthSnapshotMonth(plan) : null), [plan]);

  const asOf = useMemo(() => {
    if (!plan) return null;
    return netWorthAsOf(plan, latestSnap ?? startMonth);
  }, [plan, latestSnap, startMonth]);

  const netWorthKpi = asOf?.netWorth ?? 0;

  const planSeriesFull = useMemo(() => {
    if (!plan) return [];
    return buildNetWorthSeries(plan);
  }, [plan]);

  const actualSeriesFull = useMemo(() => {
    if (!plan || !showActual) return [];
    return buildNetWorthSeries({ ...plan, netWorthMode: 'snapshot' } as any);
  }, [plan, showActual]);

  const bandsFull = useMemo(() => {
    if (!plan || !showRisk) return null;
    if (plan.netWorthMode === 'snapshot') return null;
    return buildNetWorthBands(plan, 12 * 30, 750);
  }, [plan, showRisk]);

  const totals = useMemo(() => {
    if (!plan) return { inc: 0, exp: 0, net: 0 };
    const m = plan.startMonthISO || '2026-01';
    const inc = (plan.income || []).reduce((s, it) => s + amountForMonth(it, m), 0);
    const exp = (plan.expenses || []).reduce((s, it) => s + amountForMonth(it, m), 0);
    return { inc, exp, net: inc - exp };
  }, [plan]);

  const insights = useMemo(() => {
    if (!plan) return { savingsRate: 0, surplus12: 0 };
    const cf = buildCashFlowSeries(plan, 12);
    const income12 = cf.slice(0, 12).reduce((s, x) => s + x.income, 0);
    const exp12 = cf.slice(0, 12).reduce((s, x) => s + x.expenses, 0);
    const net12 = income12 - exp12;
    return { savingsRate: income12 > 0 ? net12 / income12 : 0, surplus12: net12 / 12 };
  }, [plan]);

  const maxIdx = useMemo(
    () => (planSeriesFull.length ? planSeriesFull[planSeriesFull.length - 1].monthIndex : 0),
    [planSeriesFull]
  );
  const maxOffset = useMemo(() => Math.max(0, maxIdx - windowMonths), [maxIdx, windowMonths]);
  const effOffset = useMemo(() => Math.min(offset, maxOffset), [offset, maxOffset]);

  useEffect(() => {
    if (offset > maxOffset) setOffset(maxOffset);
  }, [offset, maxOffset]);

  const startISO = useMemo(() => addMonthsISO(startMonth, effOffset), [startMonth, effOffset]);

  const windowedPlan = useMemo(() => {
    if (!planSeriesFull.length) return [];
    return planSeriesFull
      .filter((p) => p.monthIndex >= effOffset && p.monthIndex <= effOffset + windowMonths)
      .map((p) => ({ ...p, monthIndex: p.monthIndex - effOffset }));
  }, [planSeriesFull, effOffset, windowMonths]);

  const windowedActual = useMemo(() => {
    if (!actualSeriesFull.length) return [];
    return actualSeriesFull
      .filter((p) => p.monthIndex >= effOffset && p.monthIndex <= effOffset + windowMonths)
      .map((p) => ({ ...p, monthIndex: p.monthIndex - effOffset }));
  }, [actualSeriesFull, effOffset, windowMonths]);

  const windowedBands = useMemo(() => {
    if (!bandsFull) return undefined;
    return bandsFull
      .filter((b) => b.monthIndex >= effOffset && b.monthIndex <= effOffset + windowMonths)
      .map((b) => ({ ...b, monthIndex: b.monthIndex - effOffset }));
  }, [bandsFull, effOffset, windowMonths]);

  // ✅ Variance computed WITHOUT hooks (prevents hook-order crashes)
  let variance: number | null = null;
  if (plan && showActual && latestSnap && planSeriesFull.length) {
    const base = startMonth;
    const startY = Number(base.slice(0, 4));
    const startM = Number(base.slice(5, 7)) - 1;

    const y = Number(latestSnap.slice(0, 4));
    const m = Number(latestSnap.slice(5, 7)) - 1;
    const idx = y * 12 + m - (startY * 12 + startM);

    const planPt = planSeriesFull.find((p) => p.monthIndex === idx);
    if (planPt) {
      const actualVal = netWorthForMonth(plan, latestSnap);
      variance = actualVal - planPt.netWorth;
    }
  }

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  const goal = Math.max(0, Number(plan.goalNetWorth ?? 0));
  const curPct = goal > 0 ? clamp01(netWorthKpi / goal) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Local-only cash flow + net worth projection</div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Kpi
            label="Net Worth"
            value={money(netWorthKpi, cur)}
            tone="neutral"
            sub={`As of: ${asOf?.monthISO ?? '—'}`}
          />
          <Kpi label="Monthly Income" value={money(totals.inc, cur)} tone="positive" />
          <Kpi label="Monthly Expenses" value={money(totals.exp, cur)} tone="negative" />
          <Kpi label="Net Cash Flow" value={money(totals.net, cur)} tone={totals.net >= 0 ? 'positive' : 'negative'} />

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Goal Progress</div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {(curPct * 100).toFixed(1)}%
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {money(netWorthKpi, cur)} / {money(goal, cur)}
                </div>
              </div>
              <div className="text-blue-600 dark:text-blue-400">
                <ProgressRing pct={curPct} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="px-2 pt-1">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Net Worth Projection</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Window {windowMonths}m · Start {startISO}
                {variance != null ? (
                  <span className="ml-2 rounded-lg bg-slate-900/5 px-2 py-0.5 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">
                    Actual vs Plan: {variance >= 0 ? '+' : ''}
                    {money(variance, cur)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-2">
              <Toggle checked={showActual} onChange={setShowActual} label="Show actual" />
              <Toggle checked={showRisk} onChange={setShowRisk} label="Risk bands" />
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
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Chart temporarily disabled for hook test.</div>
        
          </div>
        </div>
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Insights</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Quick signals from your plan</div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Savings rate (12m)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {(insights.savingsRate * 100).toFixed(1)}%
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg monthly surplus (12m)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {money(insights.surplus12, cur)}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}