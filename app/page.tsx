'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Plan } from './lib/store';
import { EXPENSE_CATEGORIES, loadPlan } from './lib/store';
import { Onboarding, hasCompletedOnboarding } from './components/Onboarding';
import {
  buildNetWorthSeries,
  netWorthAsOf,
  latestNetWorthSnapshotMonth,
  amountForMonth,
} from './lib/engine';
import { NetWorthChart } from './components/NetWorthChart';

const MILESTONE_KEY = 'fp_milestones_seen';
const MILESTONES = [25, 50, 75, 100];

const CATEGORY_COLORS: Record<string, string> = {
  'Housing': '#3b82f6',
  'Food & Dining': '#f59e0b',
  'Transport': '#8b5cf6',
  'Healthcare': '#ef4444',
  'Entertainment': '#ec4899',
  'Shopping': '#14b8a6',
  'Other': '#64748b',
};

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
    style: 'currency', currency: safeCurrency(currency), maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function addMonthsISO(startISO: string, add: number) {
  const ok = /^\d{4}-\d{2}$/.test(startISO);
  const y0 = ok ? Number(startISO.slice(0, 4)) : new Date().getFullYear();
  const m0 = ok ? Number(startISO.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  const y = Math.floor(t / 12);
  const m = t % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function fmtMonthShort(iso: string) {
  if (!/^\d{4}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(`${iso}-01T00:00:00`));
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 md:grid-cols-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-7 w-28 rounded-lg bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" style={{ height: 560 }}>
        <div className="h-full w-full rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

// ─── Milestone toast ──────────────────────────────────────────────────────────
function MilestoneToast({ milestone, onDismiss }: { milestone: number; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 z-50 flex items-center gap-3 rounded-2xl bg-emerald-600 px-5 py-3.5 text-white shadow-xl" style={{ maxWidth: 320 }}>
      <span className="text-2xl">🎉</span>
      <div>
        <div className="text-sm font-semibold">{milestone}% of your goal reached!</div>
        <div className="text-xs text-emerald-100 mt-0.5">Keep it up — you're on track.</div>
      </div>
      <button onClick={onDismiss} className="ml-2 text-emerald-200 hover:text-white text-lg leading-none">×</button>
    </div>
  );
}

// ─── Progress ring ────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const r = (size / 2) - 7;
  const c = 2 * Math.PI * r;
  const p = clamp01(pct);
  const d = c * p;
  const cx = size / 2;
  const sw = size >= 90 ? 7 : 6;
  if (!mounted) {
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" opacity="0.12" strokeWidth={sw} /></svg>;
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Goal progress">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" opacity="0.12" strokeWidth={sw} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" opacity="0.95" strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${d} ${c - d}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
    </svg>
  );
}

// ─── Category breakdown bar ───────────────────────────────────────────────────
function CategoryBar({ items, total, currency }: { items: { cat: string; amount: number }[]; total: number; currency: string }) {
  if (!items.length || total === 0) return null;
  return (
    <div className="mt-2">
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {items.map(x => (
          <div
            key={x.cat}
            style={{ width: `${(x.amount / total) * 100}%`, backgroundColor: CATEGORY_COLORS[x.cat] || '#64748b' }}
            title={`${x.cat}: ${money(x.amount, currency)}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ label, value, tone, sub, delta, currency, invertDelta, extra }: {
  label: string; value: string; tone: 'neutral' | 'positive' | 'negative' | 'accent';
  sub?: string; delta?: number | null; currency?: string; invertDelta?: boolean; extra?: React.ReactNode;
}) {
  const toneText =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'negative' ? 'text-rose-600 dark:text-rose-400' :
    tone === 'accent' ? 'text-blue-600 dark:text-blue-400' :
    'text-slate-900 dark:text-slate-100';
  const fmtDelta = (n: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0,
  }).format(Math.abs(n));

  // invertDelta = positive is bad (e.g. expenses went up)
  const deltaPositive = delta != null && delta > 0;
  const deltaGood = invertDelta ? !deltaPositive : deltaPositive;
  const deltaColor = deltaGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</div>
      <div className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${toneText}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
      {delta != null && delta !== 0 && (
        <div className={`mt-0.5 text-xs font-medium tabular-nums ${deltaColor}`}>
          {deltaPositive ? '↑' : '↓'} {fmtDelta(delta)} vs last mo
        </div>
      )}
      {extra}
    </div>
  );
}

export default function DashboardPage() {
  const [onboarded, setOnboarded] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [mounted, setMounted] = useState(false);
  const [windowMonths, setWindowMonths] = useState(12);
  const [offset, setOffset] = useState(0);
  const [milestoneToast, setMilestoneToast] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [screenW, setScreenW] = useState(375);
  const [screenH, setScreenH] = useState(812);

  useEffect(() => {
    setPlan(loadPlan());
    setMounted(true);
    setOnboarded(hasCompletedOnboarding());
    setScreenW(window.innerWidth);
    setScreenH(window.innerHeight);
    const onResize = () => { setScreenW(window.innerWidth); setScreenH(window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const thisMonthISO = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const prevMonthISO = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const totals = useMemo(() => {
    if (!plan) return { inc: 0, exp: 0, net: 0 };
    const inc = (plan.income || []).reduce((s, i) => s + amountForMonth(i, thisMonthISO), 0)
      + (plan.oneTimeIncome || []).filter(x => x.monthISO === thisMonthISO).reduce((s, x) => s + x.amount, 0);
    const exp = (plan.expenses || []).reduce((s, e) => s + amountForMonth(e, thisMonthISO), 0)
      + (plan.oneTimeExpenses || []).filter(x => x.monthISO === thisMonthISO).reduce((s, x) => s + x.amount, 0);
    return { inc, exp, net: inc - exp };
  }, [plan, thisMonthISO]);

  // Per-category expense breakdown for the bar chart
  const expByCategory = useMemo(() => {
    if (!plan) return [];
    return EXPENSE_CATEGORIES.map(cat => ({
      cat,
      amount: (plan.expenses || []).filter(e => e.category === cat).reduce((s, e) => s + amountForMonth(e, thisMonthISO), 0)
        + (plan.oneTimeExpenses || []).filter(x => x.monthISO === thisMonthISO && x.category === cat).reduce((s, x) => s + x.amount, 0),
    })).filter(x => x.amount > 0);
  }, [plan, thisMonthISO]);

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
      .filter(p => p.monthIndex >= effOffset && p.monthIndex <= effOffset + windowMonths)
      .map(p => ({ ...p, monthIndex: p.monthIndex - effOffset }));
  }, [series, effOffset, windowMonths]);

  const deltas = useMemo(() => {
    if (!plan) return null;
    const thisInc = (plan.income || []).reduce((s, i) => s + amountForMonth(i, thisMonthISO), 0)
      + (plan.oneTimeIncome || []).filter(x => x.monthISO === thisMonthISO).reduce((s, x) => s + x.amount, 0);
    const prevInc = (plan.income || []).reduce((s, i) => s + amountForMonth(i, prevMonthISO), 0)
      + (plan.oneTimeIncome || []).filter(x => x.monthISO === prevMonthISO).reduce((s, x) => s + x.amount, 0);
    const thisExp = (plan.expenses || []).reduce((s, e) => s + amountForMonth(e, thisMonthISO), 0)
      + (plan.oneTimeExpenses || []).filter(x => x.monthISO === thisMonthISO).reduce((s, x) => s + x.amount, 0);
    const prevExp = (plan.expenses || []).reduce((s, e) => s + amountForMonth(e, prevMonthISO), 0)
      + (plan.oneTimeExpenses || []).filter(x => x.monthISO === prevMonthISO).reduce((s, x) => s + x.amount, 0);
    return {
      income: thisInc - prevInc,
      expenses: thisExp - prevExp,
      net: (thisInc - thisExp) - (prevInc - prevExp),
    };
  }, [plan, thisMonthISO, prevMonthISO]);

  const goal = useMemo(() => Math.max(0, plan?.goalNetWorth ?? 0), [plan?.goalNetWorth]);

  const monthsToGoal = useMemo(() => {
    if (!goal || !series.length) return null;
    const idx = series.findIndex(p => p.netWorth >= goal);
    return idx < 0 ? null : idx;
  }, [series, goal]);

  // ── early returns ─────────────────────────────────────────────────────────
  if (!mounted) return <SkeletonDashboard />;
  if (!onboarded) return <Onboarding onComplete={() => { setOnboarded(true); setPlan(loadPlan()); }} />;
  if (!plan) return <div className="text-sm text-slate-500">Loading...</div>;

  // ── derived values ────────────────────────────────────────────────────────
  const netTone: 'positive' | 'negative' = totals.net >= 0 ? 'positive' : 'negative';
  const startMonth = plan.startMonthISO || '2026-01';
  const latestSnap = latestNetWorthSnapshotMonth(plan);
  const asOfMonth = plan.netWorthMode === 'projection' ? startMonth : (latestSnap ?? startMonth);
  const rawKpi = netWorthAsOf(plan, asOfMonth)?.netWorth ?? 0;
  const oneTimeKpiAdj = plan.netWorthMode !== 'snapshot'
    ? (plan.oneTimeIncome || []).filter(x => x.monthISO === asOfMonth && Number.isFinite(x.amount)).reduce((s, x) => s + x.amount, 0)
    - (plan.oneTimeExpenses || []).filter(x => x.monthISO === asOfMonth && Number.isFinite(x.amount)).reduce((s, x) => s + x.amount, 0)
    : 0;
  const netWorthKpi = rawKpi + oneTimeKpiAdj;

  const projectedNW = series.length ? series[series.length - 1].netWorth : netWorthKpi;
  const curPct = goal > 0 ? clamp01(netWorthKpi / goal) : 0;
  const projPct = goal > 0 ? clamp01(projectedNW / goal) : 0;
  const windowEndISO = addMonthsISO(startISO, windowMonths);
  const chartWindowLabel = `${fmtMonthShort(startISO)} – ${fmtMonthShort(windowEndISO)}`;

  // NW delta: compare current month's projected NW vs previous month (using monthIndex)
  const _sY = Number(startMonth.slice(0, 4)), _sM = Number(startMonth.slice(5, 7)) - 1;
  const _nY = Number(thisMonthISO.slice(0, 4)), _nM = Number(thisMonthISO.slice(5, 7)) - 1;
  const thisMonthIdx = (_nY - _sY) * 12 + (_nM - _sM);
  const nwThisMonth = series.find(p => p.monthIndex === thisMonthIdx)?.netWorth ?? netWorthKpi;
  const nwPrevMonth = series.find(p => p.monthIndex === thisMonthIdx - 1)?.netWorth ?? netWorthKpi;
  const nwDelta = nwThisMonth - nwPrevMonth;

  // ── milestone check (deferred so setState doesn't fire inside render) ────
  if (goal > 0 && netWorthKpi > 0 && milestoneToast === null) {
    try {
      const seen: number[] = JSON.parse(localStorage.getItem(MILESTONE_KEY) || '[]');
      const pctNow = (netWorthKpi / goal) * 100;
      const crossed = MILESTONES.filter(m => pctNow >= m && !seen.includes(m));
      if (crossed.length > 0) {
        const highest = Math.max(...crossed);
        localStorage.setItem(MILESTONE_KEY, JSON.stringify([...seen, ...crossed]));
        setTimeout(() => setMilestoneToast(highest), 0);
      }
    } catch { /* ignore */ }
  }

  const onTrackChip = goal > 0
    ? monthsToGoal !== null
      ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">✓ On Track</span>
      : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Behind</span>
    : null;

  return (
    <div className="space-y-6">
      {milestoneToast !== null && (
        <MilestoneToast milestone={milestoneToast} onDismiss={() => setMilestoneToast(null)} />
      )}

      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Your complete financial picture — 100% private, stored only on your device.</div>
      </div>

      {/* ── Net Worth Hero Card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{background:'linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 60%,#2563eb 100%)'}}>
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-blue-200 mb-1 uppercase tracking-widest">Net Worth</div>
            <div className="text-5xl font-bold tracking-tight tabular-nums text-white">
              {money(netWorthKpi, cur)}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-blue-200">as of {fmtMonthShort(asOfMonth)}</span>
              {nwDelta !== 0 && (
                <span className={`text-sm font-semibold tabular-nums px-2 py-0.5 rounded-full ${nwDelta > 0 ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>
                  {nwDelta > 0 ? '↑' : '↓'} {money(Math.abs(nwDelta), cur)}
                </span>
              )}
              {goal > 0 && (
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${monthsToGoal !== null ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
                  {monthsToGoal !== null ? '✓ On Track' : 'Behind'}
                </span>
              )}
            </div>
          </div>
          {goal > 0 && (
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="relative text-white">
                <ProgressRing pct={curPct} size={88} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-white tabular-nums">{(curPct * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-blue-200">of {money(goal, cur)}</div>
                <div className="text-xs text-blue-200 mt-0.5">goal</div>
                {monthsToGoal !== null && monthsToGoal > 0 && (
                  <div className="text-sm font-bold text-emerald-300 mt-1">
                    {monthsToGoal < 12 ? `${monthsToGoal}mo` : `${Math.floor(monthsToGoal / 12)}y ${monthsToGoal % 12}mo`} to go
                  </div>
                )}
                {monthsToGoal === 0 && <div className="text-sm font-bold text-emerald-300 mt-1">Goal reached! 🎉</div>}
                {goal > 0 && projPct > curPct && (
                  <div className="text-xs text-blue-300 mt-0.5">Proj: {(projPct * 100).toFixed(0)}%</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-3" style={{gridTemplateColumns: screenW < 640 ? 'repeat(2,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))'}}>

        <Kpi
          label="Monthly Income"
          value={money(totals.inc, cur)}
          tone="positive"
          delta={deltas?.income}
          currency={cur}
        />
        <Kpi
          label="Monthly Expenses"
          value={money(totals.exp, cur)}
          tone="negative"
          delta={deltas?.expenses}
          currency={cur}
          invertDelta
          extra={<CategoryBar items={expByCategory} total={totals.exp} currency={cur} />}
        />
        <div style={screenW < 640 ? {gridColumn:'1 / -1'} : {}}>
          <Kpi
            label="Net Cash Flow"
            value={money(totals.net, cur)}
            tone={netTone}
            delta={deltas?.net}
            currency={cur}
            sub={totals.inc > 0 ? `${Math.max(0, (totals.net / totals.inc) * 100).toFixed(0)}% savings rate` : undefined}
          />
        </div>
      </div>

      {/* ── Net Worth Projection Chart ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white pt-4 px-4 pb-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="px-2 pt-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Net Worth Projection</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{chartWindowLabel}</div>
          </div>
          <div className="px-2 flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
              {[6, 12, 24, 60].map(m => (
                <button key={m} type="button" onClick={() => setWindowMonths(m)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${windowMonths === m ? 'bg-blue-600/10 text-slate-900 dark:bg-blue-500/20 dark:text-slate-100' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}>
                  {m===6?"6m":m===12?"1y":m===24?"2y":"5y"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setFullscreen(true)}
              className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Expand chart"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-2 px-2">
          <input type="range" min={0} max={maxOffset} value={effOffset}
            onChange={e => setOffset(Number(e.target.value))}
            className="w-full accent-blue-500" aria-label="Scroll chart window" />
        </div>
        <div className="mt-3 px-0 flex-1">
          <NetWorthChart currency={cur} series={windowed} startMonthISO={startISO} heightPx={520} goalNetWorth={goal} />
        </div>
      </div>

      {/* Fullscreen landscape chart overlay — mobile only */}
      {fullscreen && (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-950 md:hidden overflow-hidden">
          <div style={{
            position: 'absolute', width: screenH, height: screenW,
            top: `${(screenH - screenW) / 2}px`, left: `${(screenW - screenH) / 2}px`,
            transform: 'rotate(90deg)', overflow: 'hidden',
          }}>
            <NetWorthChart currency={cur} series={windowed} startMonthISO={startISO} heightPx={screenW} goalNetWorth={goal} />
          </div>
          <div className="absolute top-0 bottom-0 right-0 z-10 flex flex-col items-center justify-between py-3"
            style={{ width: 52, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}>
            <div className="flex flex-col items-center gap-1">
              {[6, 12, 24, 60].map(m => (
                <button key={m} type="button" onClick={() => setWindowMonths(m)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${windowMonths === m ? 'bg-blue-600/10 text-slate-900 dark:bg-blue-400/20 dark:text-slate-100' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}>
                  {m===6?"6m":m===12?"1y":m===24?"2y":"5y"}
                </button>
              ))}
            </div>
            <button onClick={() => setFullscreen(false)}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Close fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="absolute top-0 bottom-0 left-0 z-10 flex items-center justify-center overflow-hidden"
            style={{ width: 40, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}>
            <input type="range" min={0} max={maxOffset} value={effOffset}
              onChange={e => setOffset(Number(e.target.value))}
              className="accent-blue-500" aria-label="Scroll chart window"
              style={{ width: screenH - 80, transform: 'rotate(-90deg)', touchAction: 'none', flexShrink: 0 }} />
          </div>
        </div>
      )}
    </div>
  );
}
