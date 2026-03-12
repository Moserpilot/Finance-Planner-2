'use client';

import { useEffect, useMemo, useState } from 'react';
import { AllocationPie } from './AllocationPie';
import { buildAllocation } from '../lib/allocation';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';

function parsePct(v: string) {
  const n = Number(String(v).replace(/[%\s]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function SidebarAssumptions() {
  const [plan, setPlan] = useState<Plan>(() => loadPlan());
  const [returnDraft, setReturnDraft] = useState(String(plan.expectedReturnPct ?? 5));

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  const asOfMonth = plan.netWorthViewMonthISO || plan.startMonthISO;
  const slices = useMemo(() => buildAllocation(plan, asOfMonth), [plan, asOfMonth]);

  return (
    <div className="mt-6 space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quick assumptions</div>

        <label className="mt-3 block text-xs text-slate-500 dark:text-slate-400">
          Goal net worth
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-white/[0.04] dark:text-slate-100"
            value={String(Math.round(plan.goalNetWorth ?? 0))}
            onChange={(e) => setPlan({ ...plan, goalNetWorth: Number(e.target.value.replace(/[,\s]+/g, '')) || 0 })}
          />
        </label>

        <label className="mt-3 block text-xs text-slate-500 dark:text-slate-400">
          Expected return
          <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm dark:border-slate-800 dark:bg-white/[0.04]">
            <input
              className="w-full bg-transparent text-slate-900 outline-none dark:text-slate-100"
              value={returnDraft}
              onChange={(e) => setReturnDraft(e.target.value)}
              onBlur={() => {
                const v = parsePct(returnDraft);
                setPlan({ ...plan, expectedReturnPct: v });
                setReturnDraft(String(v));
              }}
            />
            <span className="pl-0 text-slate-500 dark:text-slate-400">%</span>
          </div>
        </label>
      </div>

      <AllocationPie slices={slices} currency={plan.currency || 'USD'} title={`Allocation (${asOfMonth})`} />
    </div>
  );
}