// app/lib/store.ts
'use client';

export type NetWorthMode = 'snapshot' | 'projection' | 'hybrid';

export type IncomeExpenseItem = {
  id: string;
  name: string;
  amount: number;
  cadence?: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  startMonthISO?: string;
  endMonthISO?: string;
};

export type NetWorthBalance = {
  monthISO: string;
  balance: number;
};

export type NetWorthAccount = {
  id: string;
  name: string;
  type?: string;
  subtype?: string;
  balances?: NetWorthBalance[] | any; // tolerate legacy/corrupt shapes
};

export type Plan = {
  currency: string;
  startMonthISO: string;

  expectedReturnPct?: number;
  inflationPct?: number;

  startingNetWorth?: number;
  goalNetWorth?: number;

  netWorthMode?: NetWorthMode;

  income: IncomeExpenseItem[];
  expenses: IncomeExpenseItem[];

  netWorthAccounts: NetWorthAccount[];

  [key: string]: any;
};

const STORAGE_KEY = 'cashflow_networth_plan_v1';

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function ensureArrays(p: any): Plan {
  const plan: any = p && typeof p === 'object' ? p : {};
  return {
    currency: typeof plan.currency === 'string' ? plan.currency : 'USD',
    startMonthISO: typeof plan.startMonthISO === 'string' ? plan.startMonthISO : '2026-01',
    expectedReturnPct: plan.expectedReturnPct,
    inflationPct: plan.inflationPct,
    startingNetWorth: plan.startingNetWorth,
    goalNetWorth: plan.goalNetWorth,
    netWorthMode: plan.netWorthMode,
    income: Array.isArray(plan.income) ? plan.income : [],
    expenses: Array.isArray(plan.expenses) ? plan.expenses : [],
    netWorthAccounts: Array.isArray(plan.netWorthAccounts) ? plan.netWorthAccounts : [],
    ...plan,
  };
}

/**
 * Merge so partial saves can't wipe arrays.
 */
function mergePlan(existing: Plan, incoming: Partial<Plan>): Plan {
  const base = deepClone(existing);
  const inc = deepClone(incoming as any);

  const merged: any = { ...base, ...inc };

  // Protect arrays from being wiped by undefined / empty
  const protect = (key: keyof Plan) => {
    const ex = (base as any)[key];
    const i = (inc as any)[key];

    const exHas = Array.isArray(ex) && ex.length > 0;
    const iHas = Array.isArray(i) && i.length > 0;

    if (exHas && !iHas) merged[key] = ex;
    if (!Array.isArray(merged[key])) merged[key] = [];
  };

  protect('income');
  protect('expenses');
  protect('netWorthAccounts');

  return ensureArrays(merged);
}

export function loadPlan(): Plan {
  if (typeof window === 'undefined') return ensureArrays(null);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ensureArrays(null);
    return ensureArrays(JSON.parse(raw));
  } catch {
    return ensureArrays(null);
  }
}

export function savePlan(next: Plan) {
  if (typeof window === 'undefined') return;

  const existing = loadPlan();
  const merged = mergePlan(existing, next);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
}

/** Optional helpers used by Settings page (if present) */
export function exportPlanJSON(): string {
  return JSON.stringify(loadPlan(), null, 2);
}

export function importPlanJSON(json: string): { ok: boolean; error?: string } {
  try {
    const incoming = ensureArrays(JSON.parse(json));
    const existing = loadPlan();
    const merged = mergePlan(existing, incoming);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid JSON' };
  }
}