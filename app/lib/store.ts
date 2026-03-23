export type DatedAmount = { monthISO: string; amount: number };

export const EXPENSE_CATEGORIES = ['Housing','Food & Dining','Transport','Healthcare','Entertainment','Shopping','Other'] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export type RecurringItem = {
  id: string;
  kind: 'income' | 'expense';
  name: string;
  defaultAmount: number;
  behavior: 'carryForward' | 'monthOnly';
  changes: DatedAmount[];
  overrides: DatedAmount[];
  endMonthISO?: string | null;
  category?: ExpenseCategory;
};

export type OneTimeItem = {
  id: string;
  kind: 'income' | 'expense';
  name: string;
  monthISO: string;
  amount: number;
  category?: ExpenseCategory;
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
  netWorthViewMonthISO: string;
  startingNetWorth?: number;
  goalNetWorth: number;
  expectedReturnPct: number;
  income: RecurringItem[];
  expenses: RecurringItem[];
  oneTimeIncome: OneTimeItem[];
  oneTimeExpenses: OneTimeItem[];
  netWorthAccounts: NetWorthAccount[];
  netWorthMode: NetWorthMode;
  budgets: Partial<Record<ExpenseCategory, number>>;
};

const STORAGE_KEY = 'finance_planner_plan_v2';

export function createDefaultPlan(): Plan {
  return {
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
      { id: 'acct_brokerage', name: 'Brokerage', type: 'taxable', balances: [] },
      { id: 'acct_roth', name: 'Roth IRA', type: 'retirement', balances: [] },
    ],
    netWorthMode: 'hybrid',
    budgets: {},
  };
}

function uid(): string {
  try {
    const c = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch { }
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normalizeAccountType(v: unknown): NetWorthAccountType {
  return v === 'cash' || v === 'taxable' || v === 'retirement' || v === 'other' ? v : 'taxable';
}

function ensureArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function normalizeAccounts(v: unknown): NetWorthAccount[] {
  return ensureArray<Record<string, unknown>>(v).map((a) => ({
    id: String(a?.id ?? uid()),
    name: String(a?.name ?? 'Account'),
    type: normalizeAccountType(a?.type),
    balances: ensureArray<DatedAmount>(a?.balances).map((b) => ({
      monthISO: String((b as any)?.monthISO ?? (b as any)?.month ?? ''),
      amount: Number((b as any)?.amount ?? (b as any)?.balance ?? 0),
    })).filter((b) => /^\d{4}-\d{2}$/.test(b.monthISO) && Number.isFinite(b.amount)),
  }));
}

function normalizeMode(v: unknown): NetWorthMode {
  return v === 'snapshot' || v === 'projection' || v === 'hybrid' ? v : 'hybrid';
}

function ensureString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function ensureNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function loadPlan(): Plan {
  const defaults = createDefaultPlan();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) ?? {};
    const startMonthISO = ensureString(p.startMonthISO, defaults.startMonthISO);
    return {
      currency: ensureString(p.currency, defaults.currency),
      startMonthISO,
      netWorthViewMonthISO:
        typeof p.netWorthViewMonthISO === 'string' && /^\d{4}-\d{2}$/.test(p.netWorthViewMonthISO)
          ? p.netWorthViewMonthISO
          : startMonthISO,
      startingNetWorth: ensureNumber(p.startingNetWorth, 0),
      goalNetWorth: ensureNumber(p.goalNetWorth, 0),
      expectedReturnPct: ensureNumber(p.expectedReturnPct, 5),
      income: ensureArray(p.income),
      expenses: ensureArray(p.expenses),
      oneTimeIncome: ensureArray(p.oneTimeIncome),
      oneTimeExpenses: ensureArray(p.oneTimeExpenses),
      netWorthAccounts: normalizeAccounts(p.netWorthAccounts),
      netWorthMode: normalizeMode(p.netWorthMode),
      budgets: (typeof p.budgets === 'object' && p.budgets !== null && !Array.isArray(p.budgets))
        ? Object.fromEntries(EXPENSE_CATEGORIES.filter(c => Number.isFinite(Number((p.budgets as any)[c]))).map(c => [c, Number((p.budgets as any)[c])]))
        : {},
    };
  } catch {
    return defaults;
  }
}

export function savePlan(plan: Plan): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  window.dispatchEvent(new Event('finance_planner_plan_updated'));
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
  const m = /^\d{4}-\d{2}$/.test(monthISO) ? monthISO : '2026-01';
  return {
    id: uid(),
    kind,
    name: kind === 'income' ? 'One-time income' : 'One-time expense',
    monthISO: m,
    amount: 0,
  };
}
