// app/assumptions/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan, newNetWorthAccount } from '../lib/store';
import { netWorthForMonth } from '../lib/engine';

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

function parseNumberLoose(v: string) {
  const cleaned = String(v).replace(/[$,%\s,]+/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatPct(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `${x}%`;
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
  next.sort((a, b) =>
    a.monthISO < b.monthISO ? -1 : a.monthISO > b.monthISO ? 1 : 0
  );
  return next;
}

export default function AssumptionsPage() {
  const [plan, setPlan] = useState<Plan | null>(null);

  const [editMonthISO, setEditMonthISO] = useState<string>('2026-01');
  const [returnText, setReturnText] = useState('0%');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setEditMonthISO(p.startMonthISO || '2026-01');
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const cur = useMemo(
    () => safeCurrency(plan?.currency || 'USD'),
    [plan?.currency]
  );

  useEffect(() => {
    if (!plan) return;
    setReturnText(formatPct(plan.expectedReturnPct ?? 0));
  }, [plan]);

  if (!plan) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
    );
  }

  const label = 'text-xs font-medium text-slate-500 dark:text-slate-400';
  const input =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ' +
    'text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ' +
    'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30';
  const hint = 'mt-1 text-xs text-slate-500 dark:text-slate-400';

  const balancesDisabled = plan.netWorthMode === 'projection';

  function updateAccount(id: string, patch: any) {
    setPlan({
      ...plan,
      netWorthAccounts: plan.netWorthAccounts.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    });
  }

  function removeAccount(id: string) {
    setPlan({
      ...plan,
      netWorthAccounts: plan.netWorthAccounts.filter((a) => a.id !== id),
    });
  }

  function setAccountForMonth(accountId: string, amount: number) {
    const acct = plan.netWorthAccounts.find((a) => a.id === accountId);
    if (!acct) return;
    const balances = upsertDated(acct.balances || [], editMonthISO, amount);
    updateAccount(accountId, { balances });
  }

  function addAccount() {
    setPlan({
      ...plan,
      netWorthAccounts: [
        ...plan.netWorthAccounts,
        newNetWorthAccount('New account'),
      ],
    });
  }

  const monthNetWorth = netWorthForMonth(plan, editMonthISO);

  const modeHelp =
    plan.netWorthMode === 'snapshot'
      ? 'Shows what you really have. Uses only balances you enter. No projections.'
      : plan.netWorthMode === 'projection'
      ? 'A pure “what-if” model based on expected return and cash flow. Real balances entered later are ignored.'
      : 'Projects forward, but snaps to your real balance updates when you enter them.';

  const whichShouldIUse =
    'Which should I use? Most people should pick “Reality-anchored projection” (it stays grounded while still forecasting).';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Assumptions
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Inputs that drive your projection.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-2">
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
            <div className={label}>Start month (YYYY-MM)</div>
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
            <div className={label}>Goal net worth</div>
            <input
              className={input}
              inputMode="decimal"
              defaultValue={money(plan.goalNetWorth ?? 0, cur)}
              key={`goal_${plan.goalNetWorth}_${cur}`}
              onBlur={(e) =>
                setPlan({
                  ...plan,
                  goalNetWorth: parseNumberLoose(e.target.value),
                })
              }
            />
          </div>

          <div>
            <div className={label}>Expected return (annual)</div>
            <input
              className={input}
              inputMode="decimal"
              value={returnText}
              onChange={(e) => setReturnText(e.target.value)}
              onBlur={() => {
                const n = parseNumberLoose(returnText);
                setPlan({ ...plan, expectedReturnPct: n });
                setReturnText(formatPct(n));
              }}
              placeholder="6%"
            />
            <div className={hint}>
              Used only in Hypothetical/Reality-anchored modes.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Net Worth (investments)
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enter balances by month. The sum becomes Net Worth for that month.
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addAccount}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800"
            >
              Add account
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className={label}>Net worth mode</div>
            <select
              className={input}
              value={plan.netWorthMode}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  netWorthMode:
                    e.target.value === 'projection'
                      ? 'projection'
                      : e.target.value === 'hybrid'
                      ? 'hybrid'
                      : 'snapshot',
                })
              }
            >
              <option value="snapshot">Track actual balances</option>
              <option value="projection">Hypothetical projection</option>
              <option value="hybrid">Reality-anchored projection</option>
            </select>

            <div className={hint}>{modeHelp}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {whichShouldIUse}
            </div>

            {balancesDisabled ? (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Balances are disabled in Hypothetical projection because that
                mode ignores later balance entries.
              </div>
            ) : null}
          </div>

          <div>
            <div className={label}>Edit month</div>
            <input
              className={input}
              value={editMonthISO}
              onChange={(e) => setEditMonthISO(toMonthISO(e.target.value))}
              placeholder="2026-01"
            />
            <div className={hint}>
              Total Net Worth for{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {editMonthISO}
              </span>
              :{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {money(monthNetWorth, cur)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {plan.netWorthAccounts.map((acct) => {
            const bal =
              (acct.balances || []).find((b) => b.monthISO === editMonthISO)
                ?.amount ?? 0;

            return (
              <div
                key={acct.id}
                className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="grid gap-3 md:grid-cols-12 md:items-end">
                  <label className="md:col-span-6 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">
                      Account
                    </div>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none dark:border-slate-800 dark:text-slate-100"
                      value={acct.name}
                      onChange={(e) =>
                        updateAccount(acct.id, { name: e.target.value })
                      }
                    />
                  </label>

                  <label className="md:col-span-5 text-sm">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">
                      Balance for {editMonthISO} ({cur})
                    </div>
                    <input
                      type="text"
                      disabled={balancesDisabled}
                      className={
                        'w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-slate-900 outline-none ' +
                        'dark:border-slate-800 dark:text-slate-100 ' +
                        (balancesDisabled
                          ? 'opacity-50 cursor-not-allowed'
                          : '')
                      }
                      defaultValue={money(bal, cur)}
                      key={`bal_${acct.id}_${editMonthISO}_${bal}_${cur}`}
                      onBlur={(e) => {
                        if (balancesDisabled) return;
                        setAccountForMonth(
                          acct.id,
                          parseNumberLoose(e.target.value)
                        );
                      }}
                    />
                  </label>

                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeAccount(acct.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-rose-600 dark:border-slate-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!plan.netWorthAccounts.length ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              No accounts yet. Click “Add account”.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
