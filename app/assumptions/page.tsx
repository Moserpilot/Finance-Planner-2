'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';

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

function parseNumberLoose(s: string) {
  const cleaned = (s ?? '').toString().replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function PercentTextInput({
  valuePct,
  onChange,
}: {
  valuePct: number;
  onChange: (vPct: number) => void;
}) {
  const display = `${Number.isFinite(valuePct) ? valuePct : 0}%`;
  return (
    <input
      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
      inputMode="decimal"
      value={display}
      onChange={(e) => onChange(parseNumberLoose(e.target.value))}
    />
  );
}

function MoneyTextInput({
  value,
  onChange,
  currency,
}: {
  value: number;
  onChange: (v: number) => void;
  currency: string;
}) {
  const fmt = useMemo(() => {
    const cur = safeCurrency(currency);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 });
  }, [currency]);

  return (
    <input
      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/30"
      inputMode="numeric"
      value={fmt.format(Number.isFinite(value) ? value : 0)}
      onChange={(e) => onChange(parseNumberLoose(e.target.value))}
    />
  );
}

export default function AssumptionsPage() {
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    setPlan(loadPlan());
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  if (!plan) return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;

  const currency = safeCurrency(plan.currency || 'USD');

  const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
  const label = 'text-xs font-medium text-slate-500 dark:text-slate-400';
  const hint = 'mt-1 text-xs text-slate-500 dark:text-slate-400';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Assumptions</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Core inputs that drive the projection</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <div className={label}>Expected return</div>
          <PercentTextInput
            valuePct={Number(plan.expectedReturnPct ?? 0)}
            onChange={(v) => setPlan({ ...plan, expectedReturnPct: v })}
          />
          <div className={hint}>Annual return assumption.</div>
        </div>

        <div className={card}>
          <div className={label}>Inflation</div>
          <PercentTextInput
            valuePct={Number(plan.inflationPct ?? 0)}
            onChange={(v) => setPlan({ ...plan, inflationPct: v })}
          />
          <div className={hint}>Used for inflation-adjusted views.</div>
        </div>

        <div className={card}>
          <div className={label}>Goal net worth</div>
          <MoneyTextInput
            value={Number(plan.goalNetWorth ?? 0)}
            currency={currency}
            onChange={(v) => setPlan({ ...plan, goalNetWorth: v })}
          />
          <div className={hint}>Shown on the dashboard goal progress.</div>
        </div>
      </div>
    </div>
  );
}