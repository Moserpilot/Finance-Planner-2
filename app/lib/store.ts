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

export type MilestoneKind = 'oneTimeIncome' | 'oneTimeExpense' | 'note';

export type Milestone = {
  id: string;
  monthISO: string;
  title: string;
  kind: MilestoneKind;
  amount?: number;
  note?: string;
};

export type Plan = {
  currency: string;
  startMonthISO: string;
  startingNetWorth?: number; // legacy
  goalNetWorth: number;
  expectedReturnPct: number;
  volatilityPct?: number; // optional, used only for Risk mode visuals

  income: RecurringItem[];
  expenses: RecurringItem[];
  oneTimeIncome: OneTimeItem[];
  oneTimeExpenses: OneTimeItem[];

  milestones?: Milestone[];

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
  volatilityPct: 12,
  income: [],
  expenses: [],
  oneTimeIncome: [],
  oneTimeExpenses: [],
  milestones: [],
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

function toNumber(v: any, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v ?? '').replace(/[$,%\s,]+/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function toMonthISO(v: any, fallback: string): string {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}$/.test(s) ? s : fallback;
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
    balances: ensureArray<any>(a?.balances)
      .map((b) => ({
        monthISO: toMonthISO(b?.monthISO, DEFAULT_PLAN.startMonthISO),
        amount: toNumber(b?.amount, 0),
      }))
      .filter((b) => /^\d{4}-\d{2}$/.test(b.monthISO)),
  }));
}

function normalizeMode(v: any): NetWorthMode {
  return v === 'snapshot' || v === 'projection' || v === 'hybrid'
    ? v
    : 'hybrid';
}

function ensureMilestones(v: any): Milestone[] {
  const arr = ensureArray<any>(v);
  return arr
    .map((m) => ({
      id: String(m?.id ?? uid()),
      monthISO: toMonthISO(m?.monthISO, DEFAULT_PLAN.startMonthISO),
      title: String(m?.title ?? 'Milestone'),
      kind:
        m?.kind === 'oneTimeIncome' ||
        m?.kind === 'oneTimeExpense' ||
        m?.kind === 'note'
          ? (m.kind as MilestoneKind)
          : ('note' as MilestoneKind),
      amount: m?.amount == null ? undefined : toNumber(m.amount, 0),
      note: m?.note == null ? undefined : String(m.note),
    }))
    .filter((m) => /^\d{4}-\d{2}$/.test(m.monthISO));
}

export function loadPlan(): Plan {
  if (typeof window === 'undefined') return DEFAULT_PLAN;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAN;

    const parsed = JSON.parse(raw) ?? {};

    // Normalize numeric fields to protect the engine (and chart) from older saved plans
    // where inputs were accidentally stored as strings.
    // Support legacy key names if they exist
    const rawIncome =
      parsed.income ?? parsed.recurringIncome ?? parsed.recurringIncomes ?? [];
    const rawExpenses =
      parsed.expenses ?? parsed.recurringExpenses ?? parsed.recurringExpense ?? [];
    const rawOneTimeIncome =
      parsed.oneTimeIncome ?? parsed.one_time_income ?? parsed.oneTimeIncomes ?? [];
    const rawOneTimeExpenses =
      parsed.oneTimeExpenses ?? parsed.one_time_expenses ?? parsed.oneTimeExpense ?? [];

    const income = ensureArray<any>(rawIncome).map((it) => ({
      id: String(it?.id ?? uid()),
      kind: 'income' as const,
      name: String(it?.name ?? 'Income'),
      defaultAmount: toNumber(it?.defaultAmount, 0),
      behavior: it?.behavior === 'monthOnly' ? 'monthOnly' : 'carryForward',
      changes: ensureArray<any>(it?.changes).map((c) => ({
        monthISO: toMonthISO(c?.monthISO, DEFAULT_PLAN.startMonthISO),
        amount: toNumber(c?.amount, 0),
      })),
      overrides: ensureArray<any>(it?.overrides).map((o) => ({
        monthISO: toMonthISO(o?.monthISO, DEFAULT_PLAN.startMonthISO),
        amount: toNumber(o?.amount, 0),
      })),
      endMonthISO: it?.endMonthISO ? toMonthISO(it?.endMonthISO, '') : null,
    }));

    const expenses = ensureArray<any>(rawExpenses).map((it) => ({
      id: String(it?.id ?? uid()),
      kind: 'expense' as const,
      name: String(it?.name ?? 'Expense'),
      defaultAmount: toNumber(it?.defaultAmount, 0),
      behavior: it?.behavior === 'monthOnly' ? 'monthOnly' : 'carryForward',
      changes: ensureArray<any>(it?.changes).map((c) => ({
        monthISO: toMonthISO(c?.monthISO, DEFAULT_PLAN.startMonthISO),
        amount: toNumber(c?.amount, 0),
      })),
      overrides: ensureArray<any>(it?.overrides).map((o) => ({
        monthISO: toMonthISO(o?.monthISO, DEFAULT_PLAN.startMonthISO),
        amount: toNumber(o?.amount, 0),
      })),
      endMonthISO: it?.endMonthISO ? toMonthISO(it?.endMonthISO, '') : null,
    }));

    const oneTimeIncome = ensureArray<any>(rawOneTimeIncome).map((it) => ({
      id: String(it?.id ?? uid()),
      kind: 'income' as const,
      name: String(it?.name ?? 'One-time income'),
      monthISO: toMonthISO(it?.monthISO, DEFAULT_PLAN.startMonthISO),
      amount: toNumber(it?.amount, 0),
    }));

    const oneTimeExpenses = ensureArray<any>(rawOneTimeExpenses).map((it) => ({
      id: String(it?.id ?? uid()),
      kind: 'expense' as const,
      name: String(it?.name ?? 'One-time expense'),
      monthISO: toMonthISO(it?.monthISO, DEFAULT_PLAN.startMonthISO),
      amount: toNumber(it?.amount, 0),
    }));

    const normalized: Plan = {
      ...DEFAULT_PLAN,
      ...parsed,
      currency: String(parsed.currency ?? DEFAULT_PLAN.currency),
      startMonthISO: toMonthISO(parsed.startMonthISO, DEFAULT_PLAN.startMonthISO),
      startingNetWorth:
        parsed.startingNetWorth == null ? DEFAULT_PLAN.startingNetWorth : toNumber(parsed.startingNetWorth, 0),
      goalNetWorth: toNumber(parsed.goalNetWorth, 0),
      expectedReturnPct: toNumber(parsed.expectedReturnPct, 0),
      volatilityPct:
        parsed.volatilityPct == null
          ? DEFAULT_PLAN.volatilityPct
          : toNumber(parsed.volatilityPct, 12),
      income,
      expenses,
      oneTimeIncome,
      oneTimeExpenses,
      milestones: ensureMilestones(parsed.milestones),
      netWorthAccounts: ensureNetWorthAccounts(parsed.netWorthAccounts),
      netWorthMode: normalizeMode(parsed.netWorthMode),
    };

    return normalized;
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
