// app/assumptions/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';
import { netWorthAsOf, latestNetWorthSnapshotMonth } from '../lib/engine';

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'USD';
}

function money(n: number, currency: string) {
  const cur = safeCurrency(currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function parseMoneyLoose(v: string) {
  const cleaned = String(v).replace(/[$,%\s,]+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parsePctLoose(v: string) {
  const cleaned = String(v).replace(/[%\s]+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export default function AssumptionsPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editMonthISO, setEditMonthISO] = useState<string>('2026-01');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setEditMonthISO(p.startMonthISO || '2026-01');
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const cur = useMemo(() => safeCurrency(plan?.currency || 'USD'), [plan?.currency]);

  function updatePlan(patch: Partial<Plan>) {
    setPlan((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  const startMonth = plan.startMonthISO || '2026-01';
  const latestSnap = latestNetWorthSnapshotMonth(plan);
  const anchorMonth = plan.netWorthMode === 'projection' ? startMonth : (latestSnap ?? startMonth);

  const monthNetWorth = netWorthAsOf(plan, editMonthISO)?.netWorth ?? 0;
  const anchorNetWorth = netWorthAsOf(plan, anchorMonth)?.netWorth ?? 0;

  const modeHelp =
    plan.netWorthMode === 'snapshot'
      ? 'Track actual balances only. Uses only balances you enter. No projections or cash-flow compounding.'
      : plan.netWorthMode === 'projection'
      ? 'Hypothetical “what-if” model. Uses expected return + cash flow and ignores real balances you enter later.'
      : 'Reality-anchored projection. Projects forward, but snaps to your real balance updates when you enter them.';

  const whichShouldIUse =
    'Which should I use? Most people should pick “Reality-anchored projection” (it stays grounded while still forecasting).';

  const label = 'text-xs font-medium text-slate-500 dark:text-slate-400';
  const input =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ' +
    'text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
    'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30';

  const selectStrong =
    'mt-1 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ' +
    'text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
    'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Assumptions
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Configure currency, goal, expected return, and net worth mode.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-12 md:items-end">
          <label className="md:col-span-3">
            <div className={label}>Currency</div>
            <input
              className={input}
              value={plan.currency}
              onChange={(e) => updatePlan({ currency: e.target.value })}
              placeholder="USD"
            />
          </label>

          <label className="md:col-span-3">
            <div className={label}>Start month (YYYY-MM)</div>
            <input
              className={input}
              value={plan.startMonthISO}
              onChange={(e) => updatePlan({ startMonthISO: e.target.value })}
              placeholder="2026-01"
            />
          </label>

          <label className="md:col-span-3">
            <div className={label}>Goal net worth ({cur})</div>
            <input
              type="text"
              className={input}
              defaultValue={money(plan.goalNetWorth ?? 0, cur)}
              key={`goal_${plan.goalNetWorth}_${cur}`}
              onBlur={(e) => updatePlan({ goalNetWorth: parseMoneyLoose(e.target.value) })}
            />
          </label>

          <label className="md:col-span-3">
            <div className={label}>Expected return (annual %)</div>
            <input
              type="text"
              className={input}
              defaultValue={`${String(plan.expectedReturnPct ?? 0)}%`}
              key={`ret_${plan.expectedReturnPct}`}
              onBlur={(e) =>
                updatePlan({ expectedReturnPct: parsePctLoose(e.target.value) })
              }
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-12 md:items-start">
          <label className="md:col-span-4">
            <div className={label}>Net worth mode</div>
            <select
              className={selectStrong}
              value={plan.netWorthMode}
              onChange={(e) => {
                const v = e.target.value;
                const mode =
                  v === 'snapshot' || v === 'projection' || v === 'hybrid' ? v : 'hybrid';
                updatePlan({ netWorthMode: mode });
              }}
            >
              <option value="snapshot">Track actual balances</option>
              <option value="projection">Hypothetical projection</option>
              <option value="hybrid">Reality-anchored projection</option>
            </select>

            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{modeHelp}</div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{whichShouldIUse}</div>
          </label>

          <div className="md:col-span-8 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Net worth quick read
            </div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Anchor month:{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">{anchorMonth}</span>
              {' · '}
              Anchor net worth:{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {money(anchorNetWorth, cur)}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Selected month:{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">{editMonthISO}</span>
              {' · '}
              Net worth as-of:{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {money(monthNetWorth, cur)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Net worth accounts
        </div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Net worth accounts are managed in the <span className="font-medium">Net Worth</span> page only.
        </div>
      </div>
    </div>
  );
}