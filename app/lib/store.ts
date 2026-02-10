// app/lib/store.ts

export type DatedAmount = { monthISO: string; amount: number };

export type RecurringItem = {
  id: string;
  kind: 'income' | 'expense';
  name: string;
  defaultAmount: number;
  behavior: 'carryForward' | 'monthOnly';
  changes: DatedAmount[];
  overrides: DatedAmount[];
  endMonthISO?: string | null;
};

export type OneTimeItem = {
  id: string;
  kind: 'income' | 'expense';
  name: string;
  monthISO: string;
  amount: number;
};

export type NetWorthAccount = {
  id: string;
  name: string;
  balances: DatedAmount[];
};

export type NetWorthMode = 'snapshot' | 'projection' | 'hybrid';

export type Plan = {
  currency: string;
  startMonthISO: string;
  startingNetWorth?: number; // legacy
  goalNetWorth: number;
  expectedReturnPct: number;

  income: RecurringItem[];
  expenses: RecurringItem[];
  oneTimeIncome: OneTimeItem[];
  oneTimeExpenses: OneTimeItem[];

  netWorthAccounts: NetWorthAccount[];
  netWorthMode: NetWorthMode;
};

const STORAGE_KEY = 'finance_planner_plan_v2';

const DEFAULT_PLAN: Plan = {
  currency: 'USD',
  startMonthISO: '2026-01',
  startingNetWorth: 0,
  goalNetWorth: 0,
  expectedReturnPct: 0,
  income: [],
  expenses: [],
  oneTimeIncome: [],
  oneTimeExpenses: [],
  netWorthAccounts: [
    { id: 'acct_checking', name: 'Checking', balances: [] },
    { id: 'acct_savings', name: 'Savings', balances: [] },
    { id: 'acct_brokerage', name: 'Brokerage', balances: [] },
    { id: 'acct_roth', name: 'Roth IRA', balances: [] },
  ],
  netWorthMode: 'hybrid',
};

function ensureArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function uid() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {}
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function ensureNetWorthAccounts(v: any): NetWorthAccount[] {
  const arr = ensureArray<any>(v);
  return arr.map((a) => ({
    id: String(a?.id ?? uid()),
    name: String(a?.name ?? 'Account'),
    balances: ensureArray<DatedAmount>(a?.balances),
  }));
}

function normalizeMode(v: any): NetWorthMode {
  return v === 'snapshot' || v === 'projection' || v === 'hybrid'
    ? v
    : 'hybrid';
}

export function loadPlan(): Plan {
  if (typeof window === 'undefined') return DEFAULT_PLAN;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAN;

    const parsed = JSON.parse(raw) ?? {};
    return {
      ...DEFAULT_PLAN,
      ...parsed,
      income: ensureArray(parsed.income),
      expenses: ensureArray(parsed.expenses),
      oneTimeIncome: ensureArray(parsed.oneTimeIncome),
      oneTimeExpenses: ensureArray(parsed.oneTimeExpenses),
      netWorthAccounts: ensureNetWorthAccounts(parsed.netWorthAccounts),
      netWorthMode: normalizeMode(parsed.netWorthMode),
    };
  } catch {
    return DEFAULT_PLAN;
  }
}

export function savePlan(plan: Plan) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export function newNetWorthAccount(name = 'New account'): NetWorthAccount {
  return { id: uid(), name, balances: [] };
}

export function newRecurringItem(kind: 'income' | 'expense'): RecurringItem {
  return {
    id: uid(),
    kind,
    name: kind === 'income' ? 'New income' : 'New expense',
    defaultAmount: 0,
    behavior: 'carryForward',
    changes: [],
    overrides: [],
    endMonthISO: null,
  };
}

export function newOneTimeItem(
  kind: 'income' | 'expense',
  monthISO: string
): OneTimeItem {
  const m = /^\d{4}-\d{2}$/.test(monthISO)
    ? monthISO
    : DEFAULT_PLAN.startMonthISO;
  return {
    id: uid(),
    kind,
    name: kind === 'income' ? 'One-time income' : 'One-time expense',
    monthISO: m,
    amount: 0,
  };
}
