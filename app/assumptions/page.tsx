// app/assumptions/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan, newNetWorthAccount } from '../lib/store';
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

function addMonthsISO(startISO: string, add: number) {
  const ok = /^\d{4}-\d{2}$/.test(startISO);
  const y0 = ok ? Number(startISO.slice(0, 4)) : 2026;
  const m0 = ok ? Number(startISO.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  const y = Math.floor(t / 12);
  const m = t % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function buildMonthOptions(startMonthISO: string, months = 360) {
  return Array.from({ length: months + 1 }, (_, i) => addMonthsISO(startMonthISO, i));
}

function upsertDated(
  arr: { monthISO: string; amount: number }[],
  monthISO: string,
  amount: number
) {
  const next = [...arr];
  const i = next.findIndex((x) => x.monthISO === monthISO);
  if (i >= 0) next[i] = { monthISO, amount };
  else next.push({ monthISO, amount });
  next.sort((a, b) => (a.monthISO < b.monthISO ? -1 : a.monthISO > b.monthISO ? 1 : 0));
  return next;
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

  const monthOptions = useMemo(() => {
    const start = plan?.startMonthISO || '2026-01';
    return buildMonthOptions(start, 360);
  }, [plan?.startMonthISO]);

  // ✅ Null-safe updater helpers
  function updatePlan(patch: Partial<Plan>) {
    setPlan((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateAccount(id: string, patch: any) {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        netWorthAccounts: prev.netWorthAccounts.map((a) =>
          a.id === id ? { ...a, ...patch } : a
        ),
      };
    });
  }

  function removeAccount(id: string) {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        netWorthAccounts: prev.netWorthAccounts.filter((a) => a.id !== id),
      };
    });
  }

  function setAccountForMonth(accountId: string, amount: number) {
    setPlan((prev) => {
      if (!prev) return prev;
      const acct = prev.netWorthAccounts.find((a) => a.id === accountId);
      if (!acct) return prev;

      const balances = upsertDated(acct.balances || [], editMonthISO, amount);

      return {
        ...prev,
        netWorthAccounts: prev.netWorthAccounts.map((a) =>
          a.id === accountId ? { ...a, balances } : a
        ),
      };
    });
  }

  function addAccount() {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        netWorthAccounts: [...prev.netWorthAccounts, newNetWorthAccount('New account')],
      };
    });
  }

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  const balancesDisabled = plan.netWorthMode === 'projection';

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

  // ✅ Centralized input styles (keeps everything consistent)
  const label = 'text-xs font-medium text-slate-500 dark:text-slate-400';
  const input =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ' +
    'text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
    'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30';

  // ✅ FIX: select needs a real background + stronger text to avoid washed-out rendering
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
          Configure currency, goal, expected return, and net worth mode / balances.
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
            <div className={label}>Expected return (% / year)</div>
            <input
              type="text"
              className={input}
              defaultValue={String(plan.expectedReturnPct ?? 0)}
              key={`ret_${plan.expectedReturnPct}`}
              onBlur={(e) => updatePlan({ expectedReturnPct: parsePctLoose(e.target.value) })}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-12 md:items-start">
          <label className="md:col-span-4">
            <div className={label}>Net worth mode</div>

            {/* ✅ Fixed select styling */}
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Net worth accounts
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enter balances by month. In “Hypothetical projection”, balances are disabled.
            </div>
          </div>

          <label className="text-sm">
            <div className="mb-1 text-slate-500 dark:text-slate-400">Edit month</div>
            <input
              className={input}
              value={editMonthISO}
              onChange={(e) => setEditMonthISO(e.target.value)}
              placeholder="2026-01"
            />
          </label>

          <button
            type="button"
            onClick={addAccount}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800"
          >
            Add account
          </button>
        </div>

        {balancesDisabled ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Balances are disabled in <span className="font-medium">Hypothetical projection</span> mode.
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {plan.netWorthAccounts.map((a) => {
            const acctAsOf =
              netWorthAsOf({ ...plan, netWorthAccounts: [a] }, editMonthISO)?.netWorth ?? 0;

            return (
              <div
                key={a.id}
                className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="grid gap-3 md:grid-cols-12 md:items-end">
                  <label className="md:col-span-5">
                    <div className={label}>Account name</div>
                    <input
                      className={input}
                      value={a.name}
                      onChange={(e) => updateAccount(a.id, { name: e.target.value })}
                    />
                  </label>

                  <label className="md:col-span-4">
                    <div className={label}>Balance for {editMonthISO} ({cur})</div>
                    <input
                      type="text"
                      disabled={balancesDisabled}
                      className={
                        balancesDisabled
                          ? 'mt-1 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400 outline-none dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500'
                          : input
                      }
                      defaultValue={money(acctAsOf, cur)}
                      key={`bal_${a.id}_${editMonthISO}_${acctAsOf}_${cur}_${balancesDisabled ? 'd' : 'e'}`}
                      onBlur={(e) => {
                        if (balancesDisabled) return;
                        setAccountForMonth(a.id, parseMoneyLoose(e.target.value));
                      }}
                    />
                  </label>

                  <div className="md:col-span-3 flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeAccount(a.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-rose-600 dark:border-slate-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Tip: Enter a balance in a later month and “Reality-anchored projection” will snap the forecast to it.
                </div>
              </div>
            );
          })}
        </div>

        {!plan.netWorthAccounts.length ? (
          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No accounts yet.</div>
        ) : null}
      </div>
    </div>
  );
}
