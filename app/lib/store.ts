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

export type NetWorthAccountType = 'cash' | 'taxable' | 'retirement' | 'other';

export type NetWorthAccount = {
  id: string;
  name: string;
  type: NetWorthAccountType;
  balances: DatedAmount[];
};

export type NetWorthMode = 'snapshot' | 'projection' | 'hybrid';

export type Plan = {
  currency: string;
  startMonthISO: string;
  netWorthViewMonthISO?: string;
  startingNetWorth?: number;
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
  netWorthViewMonthISO: '2026-01',
  startingNetWorth: 0,
  goalNetWorth: 0,
  expectedReturnPct: 5,
  income: [],
  expenses: [],
  oneTimeIncome: [],
  oneTimeExpenses: [],
  netWorthAccounts: [
    { id: 'acct_checking', name: 'Checking', type: 'cash', balances: [] },
    { id: 'acct_taxable', name: 'Brokerage', type: 'taxable', balances: [] },
    { id: 'acct_roth', name: 'Roth IRA', type: 'retirement', balances: [] },
  ],
  netWorthMode: 'hybrid',
};

function ensureArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function uid() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    // fall through to random id
  }
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normalizeAccountType(v: unknown): NetWorthAccountType {
  return v === 'cash' || v === 'taxable' || v === 'retirement' || v === 'other'
    ? v
    : 'taxable';
}

function ensureNetWorthAccounts(v: unknown): NetWorthAccount[] {
  const arr = ensureArray<Record<string, unknown>>(v);
  return arr.map((a) => ({
    id: String(a?.id ?? uid()),
    name: String(a?.name ?? 'Account'),
    type: normalizeAccountType(a?.type),
    balances: ensureArray<DatedAmount>(a?.balances),
  }));
}

function normalizeMode(v: unknown): NetWorthMode {
  return v === 'snapshot' || v === 'projection' || v === 'hybrid' ? v : 'hybrid';
}

export function loadPlan(): Plan {
  if (typeof window === 'undefined') return DEFAULT_PLAN;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAN;

    const parsed = (JSON.parse(raw) ?? {}) as Partial<Plan>;
    return {
      ...DEFAULT_PLAN,
      ...parsed,
      netWorthViewMonthISO:
        typeof parsed.netWorthViewMonthISO === 'string' && /^\d{4}-\d{2}$/.test(parsed.netWorthViewMonthISO)
          ? parsed.netWorthViewMonthISO
          : (parsed.startMonthISO || DEFAULT_PLAN.startMonthISO),
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
  return { id: uid(), name, type: 'taxable', balances: [] };
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

export function newOneTimeItem(kind: 'income' | 'expense', monthISO: string): OneTimeItem {
  const m = /^\d{4}-\d{2}$/.test(monthISO) ? monthISO : DEFAULT_PLAN.startMonthISO;
  return {
    id: uid(),
    kind,
    name: kind === 'income' ? 'One-time income' : 'One-time expense',
    monthISO: m,
    amount: 0,
  };
}