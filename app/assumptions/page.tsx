'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';
import { netWorthAsOf, latestNetWorthSnapshotMonth } from '../lib/engine';

function safeCurrency(c: string) {
  const x = (c || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(x) ? x : 'USD';
}
function money(n: number, c: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency(c), maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}
function monthLabel(iso: string) {
  if (!/^\d{4}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${iso}-01T00:00:00`));
}
function parseNum(v: string) {
  const n = Number(String(v).replace(/[$,%\s,]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function AssumptionsPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [mounted, setMounted] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [retDraft, setRetDraft] = useState('');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setGoalDraft(new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency(p.currency || 'USD'), maximumFractionDigits: 0 }).format(p.goalNetWorth ?? 0));
    setRetDraft((p.expectedReturnPct ?? 7) + '%');
    setMounted(true);
  }, []);

  function save(p: Plan) { setPlan(p); savePlan(p); }
  function update(patch: Partial<Plan>) { if (!plan) return; save({ ...plan, ...patch }); }

  const cur = useMemo(() => safeCurrency(plan?.currency || 'USD'), [plan?.currency]);

  if (!mounted || !plan) return <div className="min-h-screen bg-slate-50 dark:bg-black" />;

  const startMonth = plan.startMonthISO || '2026-01';
  const latestSnap = latestNetWorthSnapshotMonth(plan);
  const anchorMonth = plan.netWorthMode === 'projection' ? startMonth : (latestSnap ?? startMonth);
  const anchorNW = netWorthAsOf(plan, anchorMonth)?.netWorth ?? 0;

  const inp = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
  const sel = 'w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
  const lbl = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';
  const card = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900';

  const modeHelp =
    plan.netWorthMode === 'snapshot' ? 'Shows only the balances you manually enter each month. No math, no predictions.' :
    plan.netWorthMode === 'projection' ? 'Calculates growth from your starting point using income, expenses, and expected return. Ignores manual balances.' :
    'Projects growth into the future, but automatically corrects itself whenever you enter a real account balance. Best for most people.';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Assumptions</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Customize your financial goal, return rate, and projection settings.</div>
      </div>

      {/* Card 1 — Your Goal */}
      <div className={card}>
        <div className="mb-5 text-base font-semibold text-slate-900 dark:text-slate-100">Your Goal</div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={lbl}>My financial goal</label>
            <input
              className={inp}
              value={goalDraft}
              placeholder="$1,000,000"
              onChange={e => setGoalDraft(e.target.value)}
              onBlur={() => {
                const v = parseNum(goalDraft);
                update({ goalNetWorth: v });
                setGoalDraft(new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v));
              }}
            />
            <div className="mt-1.5 text-xs text-slate-500">Target net worth you want to reach</div>
          </div>

          <div>
            <label className={lbl}>Expected annual return</label>
            <input
              className={inp}
              value={retDraft}
              placeholder="7%"
              onChange={e => setRetDraft(e.target.value)}
              onBlur={() => {
                const v = parseNum(retDraft);
                update({ expectedReturnPct: v });
                setRetDraft(v + '%');
              }}
            />
            <div className="mt-1.5 text-xs text-slate-500">Typical long-term stock market average is 7–10% annually</div>
          </div>
        </div>

        {/* Current net worth summary */}
        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Current net worth</div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{money(anchorNW, cur)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">as of {monthLabel(anchorMonth)}</div>
          {plan.goalNetWorth > 0 && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">{((anchorNW / plan.goalNetWorth) * 100).toFixed(1)}%</span> of your {money(plan.goalNetWorth, cur)} goal
            </div>
          )}
        </div>
      </div>

      {/* Card 2 — Plan Setup */}
      <div className={card}>
        <div className="mb-5 text-base font-semibold text-slate-900 dark:text-slate-100">Plan Setup</div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={lbl}>Currency</label>
            <input
              className={inp}
              value={plan.currency}
              onChange={e => update({ currency: e.target.value })}
              placeholder="USD"
            />
          </div>
          <div>
            <label className={lbl}>Plan start date</label>
            <input
              type="month"
              className={inp}
              value={plan.startMonthISO}
              onChange={e => update({ startMonthISO: e.target.value })}
            />
            <div className="mt-1.5 text-xs text-slate-500">The month your plan begins tracking from</div>
          </div>
        </div>
      </div>

      {/* Card 3 — Projection Mode */}
      <div className={card}>
        <div className="mb-5 text-base font-semibold text-slate-900 dark:text-slate-100">How to track net worth</div>
        <div>
          <label className={lbl}>Tracking mode</label>
          <select
            className={sel}
            value={plan.netWorthMode}
            onChange={e => {
              const v = e.target.value;
              update({ netWorthMode: v === 'snapshot' || v === 'projection' || v === 'hybrid' ? v : 'hybrid' });
            }}
          >
            <option value="snapshot">Real balances only</option>
            <option value="projection">Projections only</option>
            <option value="hybrid">Smart tracking (recommended)</option>
          </select>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-sm text-slate-600 dark:text-slate-400">{modeHelp}</div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            💡 Most people should use <span className="font-medium text-slate-600 dark:text-slate-400">Smart tracking</span> — it uses projections but self-corrects when you update real balances.
          </div>
        </div>
      </div>
    </div>
  );
}
