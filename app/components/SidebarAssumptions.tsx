// app/components/SidebarAssumptions.tsx
'use client';

import { useEffect, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return 'USD';
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(
      0
    );
    return c;
  } catch {
    return 'USD';
  }
}

function toMonthISO(v: string) {
  return /^\d{4}-\d{2}$/.test(v) ? v : '2026-01';
}

function toNumber(v: string) {
  const n = Number(String(v).replace(/[, ]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function SidebarAssumptions() {
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    setPlan(loadPlan());
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  if (!plan) return null;

  const sectionTitle =
    'px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  const label =
    'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  const input =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm ' +
    'text-slate-900 shadow-sm outline-none ' +
    'focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
    'dark:border-slate-800 dark:bg-white/[0.04] dark:text-slate-100 dark:focus:ring-blue-500/30';

  return (
    <div className="mt-6">
      <div className={sectionTitle}>Assumptions</div>

      <div className="mt-2 rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
        <div className="space-y-3">
          <div>
            <div className={label}>Currency</div>
            <input
              className={input}
              value={plan.currency || 'USD'}
              onChange={(e) =>
                setPlan({ ...plan, currency: safeCurrency(e.target.value) })
              }
              placeholder="USD"
            />
          </div>

          <div>
            <div className={label}>Start month</div>
            <input
              className={input}
              value={plan.startMonthISO || '2026-01'}
              onChange={(e) =>
                setPlan({ ...plan, startMonthISO: toMonthISO(e.target.value) })
              }
              placeholder="2026-01"
            />
          </div>

          <div>
            <div className={label}>Legacy starting net worth (fallback)</div>
            <input
              className={input}
              inputMode="numeric"
              value={String(plan.startingNetWorth ?? 0)}
              onChange={(e) =>
                setPlan({ ...plan, startingNetWorth: toNumber(e.target.value) })
              }
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Used only if you have no account balances. Prefer adding balances
              under Assumptions → Net Worth (investments).
            </div>
          </div>

          <div>
            <div className={label}>Goal net worth</div>
            <input
              className={input}
              inputMode="numeric"
              value={String(plan.goalNetWorth ?? 0)}
              onChange={(e) =>
                setPlan({ ...plan, goalNetWorth: toNumber(e.target.value) })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
