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

function parseNumberLoose(v: string) {
  // keeps decimals; removes $, commas, %, spaces
  const cleaned = String(v).replace(/[$,%\s]/g, '').replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizePctInput(v: string) {
  // If user types 0.025 we treat as 2.5%
  const n = parseNumberLoose(v);
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function InputGroup({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  inputMode = 'decimal',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  inputMode?: 'decimal' | 'numeric';
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>

      <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {prefix ? <span className="mr-2 text-sm text-slate-400">{prefix}</span> : null}

        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-slate-100"
        />

        {suffix ? <span className="ml-2 text-sm text-slate-400">{suffix}</span> : null}
      </div>

      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

export default function AssumptionsPage() {
  const [plan, setPlan] = useState<Plan | null>(null);

  // local string state prevents “helpful” formatting from breaking decimals
  const [expRetStr, setExpRetStr] = useState('6.0');
  const [inflStr, setInflStr] = useState('3.0');
  const [goalStr, setGoalStr] = useState('1000000');
  const [startStr, setStartStr] = useState('2026-01');

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);

    setExpRetStr(String(Number(p.expectedReturnPct ?? 6)));
    setInflStr(String(Number(p.inflationPct ?? 3)));
    setGoalStr(String(Number(p.goalNetWorth ?? 1000000)));
    setStartStr(String(p.startMonthISO ?? '2026-01'));
  }, []);

  useEffect(() => {
    if (!plan) return;
    savePlan(plan);
  }, [plan]);

  const cur = useMemo(() => safeCurrency(plan?.currency || 'USD'), [plan?.currency]);

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  function patch(p: Partial<Plan>) {
    setPlan({ ...plan, ...p });
  }

  function commitExpectedReturn() {
    const pct = normalizePctInput(expRetStr);
    patch({ expectedReturnPct: pct });
    setExpRetStr(String(pct));
  }

  function commitInflation() {
    const pct = normalizePctInput(inflStr);
    patch({ inflationPct: pct });
    setInflStr(String(pct));
  }

  function commitGoal() {
    const n = parseNumberLoose(goalStr);
    patch({ goalNetWorth: n });
    setGoalStr(String(n));
  }

  function commitStart() {
    patch({ startMonthISO: startStr });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Assumptions</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Baseline settings for projections</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div onBlur={commitExpectedReturn}>
          <InputGroup
            label="Expected return"
            value={expRetStr}
            onChange={setExpRetStr}
            suffix="%"
            hint="Decimals allowed (e.g., 2.5)."
          />
        </div>

        <div onBlur={commitInflation}>
          <InputGroup
            label="Inflation"
            value={inflStr}
            onChange={setInflStr}
            suffix="%"
            hint="Decimals allowed (e.g., 2.5)."
          />
        </div>

        <div onBlur={commitGoal}>
          <InputGroup
            label="Goal net worth"
            value={goalStr}
            onChange={setGoalStr}
            prefix="$"
            hint={`Currently: ${money(Number(plan.goalNetWorth ?? 0), cur)}`}
          />
        </div>

        <div onBlur={commitStart}>
          <InputGroup
            label="Start month"
            value={startStr}
            onChange={setStartStr}
            hint="Format: YYYY-MM"
            inputMode="numeric"
          />
        </div>
      </div>
    </div>
  );
}