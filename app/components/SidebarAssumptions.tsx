'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AllocationPie } from './AllocationPie';
import { buildAllocation } from '../lib/allocation';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';

function formatMoney(n: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}
function parseMoney(v: string): number {
  const n = Number(String(v).replace(/[$,\s]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function parsePct(v: string): number {
  const n = Number(String(v).replace(/[%\s]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function SidebarAssumptions() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goalDraft, setGoalDraft] = useState('');
  const [returnDraft, setReturnDraft] = useState('');

  const reload = useCallback(() => {
    const p = loadPlan();
    setPlan(p);
    setGoalDraft(formatMoney(p.goalNetWorth ?? 0, p.currency || 'USD'));
    setReturnDraft(`${p.expectedReturnPct ?? 5}%`);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    window.addEventListener('finance_planner_plan_updated', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('finance_planner_plan_updated', reload);
      window.removeEventListener('storage', reload);
    };
  }, [reload]);

  const currency = plan?.currency || 'USD';
  const asOfMonth = plan?.netWorthViewMonthISO || plan?.startMonthISO || '2026-01';

  const slices = useMemo(() => {
    if (!plan) return [];
    return buildAllocation(plan, asOfMonth);
  }, [plan, asOfMonth]);

  if (!plan) {
    return (
      <div className="mt-6 space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-white/[0.04]">
          <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">Quick assumptions</div>
        <label className="mt-3 block text-xs text-slate-900 dark:text-slate-100">
          Goal net worth
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-white/[0.04] dark:text-slate-100"
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onFocus={() => setGoalDraft(String(Math.round(plan.goalNetWorth ?? 0)))}
            onBlur={(e) => {
              const val = parseMoney(e.target.value);
              const updated = { ...plan, goalNetWorth: val };
              setPlan(updated);
              setGoalDraft(formatMoney(val, currency));
              savePlan(updated);
            }}
          />
        </label>
        <label className="mt-3 block text-xs text-slate-900 dark:text-slate-100">
          Expected return
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-white/[0.04] dark:text-slate-100"
            value={returnDraft}
            onChange={(e) => setReturnDraft(e.target.value)}
            onFocus={() => setReturnDraft(String(plan.expectedReturnPct ?? 5))}
            onBlur={() => {
              const val = parsePct(returnDraft);
              const updated = { ...plan, expectedReturnPct: val };
              setPlan(updated);
              setReturnDraft(`${val}%`);
              savePlan(updated);
            }}
          />
        </label>
      </div>
      <AllocationPie slices={slices} currency={currency} title={`Allocation (${asOfMonth})`} />
    </div>
  );
}
