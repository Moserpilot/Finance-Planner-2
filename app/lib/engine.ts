// app/lib/engine.ts
import type {
  Plan,
  RecurringItem,
  OneTimeItem,
  NetWorthAccount,
} from './store';

export type SeriesPoint = { monthIndex: number; netWorth: number };

function compareISO(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function amountForMonth(it: RecurringItem, monthISO: string): number {
  if (
    it.endMonthISO &&
    it.endMonthISO.length === 7 &&
    monthISO > it.endMonthISO
  ) {
    return 0;
  }

  const base = Number.isFinite(it.defaultAmount) ? it.defaultAmount : 0;

  if (it.behavior === 'monthOnly') {
    const hit = (it.overrides || []).find((x) => x.monthISO === monthISO);
    // Return 0 for months with no explicit override — "this month only" means
    // the item does not exist in months where the user hasn't set a value.
    return hit && Number.isFinite(hit.amount) ? hit.amount : 0;
  }

  const changes = [...(it.changes || [])].sort((a, b) =>
    compareISO(a.monthISO, b.monthISO)
  );

  let best = base;
  for (const ch of changes) {
    if (ch.monthISO <= monthISO) {
      if (Number.isFinite(ch.amount)) best = ch.amount;
    } else {
      break;
    }
  }
  return best;
}

export function accountBalanceForMonth(
  acct: NetWorthAccount,
  monthISO: string
): number {
  const rows = (acct.balances || [])
    .filter(
      (x) =>
        x && typeof x.monthISO === 'string' && /^\d{4}-\d{2}$/.test(x.monthISO)
    )
    .sort((a, b) => compareISO(a.monthISO, b.monthISO));

  let latest = 0;
  for (const row of rows) {
    if (row.monthISO > monthISO) break;
    if (Number.isFinite(row.amount)) latest = row.amount;
  }
  return latest;
}

/**
 * Computed balance for a single account:
 * raw snapshot carry-forward + linked one-time income − linked one-time expenses.
 * This is the single source of truth for what an account is worth at a given month.
 */
export function computedAccountBalance(plan: Plan, accountId: string, monthISO: string): number {
  const acct = (plan.netWorthAccounts || []).find(a => a.id === accountId);
  if (!acct) return 0;
  const raw = accountBalanceForMonth(acct, monthISO);
  if (plan.netWorthMode === 'snapshot') return raw;
  const startMonth = plan.startMonthISO || '2026-01';
  const inc = (plan.oneTimeIncome || [])
    .filter(x => x.accountId === accountId && x.monthISO >= startMonth && x.monthISO <= monthISO && Number.isFinite(x.amount))
    .reduce((s, x) => s + x.amount, 0);
  const exp = (plan.oneTimeExpenses || [])
    .filter(x => x.accountId === accountId && x.monthISO >= startMonth && x.monthISO <= monthISO && Number.isFinite(x.amount))
    .reduce((s, x) => s + x.amount, 0);
  return raw + inc - exp;
}

/**
 * Total net worth = sum of all computed account balances + any one-time items
 * not linked to a specific account. Single source of truth used everywhere.
 */
export function totalNetWorth(plan: Plan, monthISO: string): number {
  const accountsSum = (plan.netWorthAccounts || []).reduce(
    (s, a) => s + computedAccountBalance(plan, a.id, monthISO), 0
  );
  if (plan.netWorthMode === 'snapshot') return accountsSum;
  const startMonth = plan.startMonthISO || '2026-01';
  const unlinkedInc = (plan.oneTimeIncome || [])
    .filter(x => !x.accountId && x.monthISO >= startMonth && x.monthISO <= monthISO && Number.isFinite(x.amount))
    .reduce((s, x) => s + x.amount, 0);
  const unlinkedExp = (plan.oneTimeExpenses || [])
    .filter(x => !x.accountId && x.monthISO >= startMonth && x.monthISO <= monthISO && Number.isFinite(x.amount))
    .reduce((s, x) => s + x.amount, 0);
  return accountsSum + unlinkedInc - unlinkedExp;
}

function netWorthForMonth(plan: Plan, monthISO: string): number {
  const accounts = plan.netWorthAccounts || [];
  const sum = accounts.reduce(
    (s, a) => s + accountBalanceForMonth(a, monthISO),
    0
  );

  // If no accounts exist at all, allow legacy startingNetWorth fallback.
  if (!accounts.length && Number.isFinite(plan.startingNetWorth)) {
    return plan.startingNetWorth as number;
  }

  return sum;
}

export function hasNetWorthSnapshot(plan: Plan, monthISO: string): boolean {
  return (plan.netWorthAccounts || []).some((a) =>
    (a.balances || []).some((b) => b.monthISO === monthISO)
  );
}

/**
 * Net worth for a month including projected cash flow.
 * - snapshot mode: same as totalNetWorth (static balances only)
 * - hybrid: uses actual snapshot if one exists, otherwise projects forward from last snapshot
 * - projection: always projects forward from start using recurring + one-time cash flow
 * Use this everywhere a net worth KPI is displayed.
 */
export function netWorthProjected(plan: Plan, targetMonthISO: string): number {
  const mode = plan.netWorthMode || 'snapshot';
  if (mode === 'snapshot') return totalNetWorth(plan, targetMonthISO);

  const start = plan.startMonthISO || '2026-01';
  const sy = Number(start.slice(0, 4));
  const sm = Number(start.slice(5, 7)) - 1;
  const ty = Number(targetMonthISO.slice(0, 4));
  const tm = Number(targetMonthISO.slice(5, 7)) - 1;
  const maxI = (ty - sy) * 12 + (tm - sm);

  if (maxI < 0) return totalNetWorth(plan, targetMonthISO);

  const annualPct = Number.isFinite(plan.expectedReturnPct) ? plan.expectedReturnPct as number : 0;
  const monthlyR = annualPct === 0 ? 0 : Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  const legacyStart = Number.isFinite(plan.startingNetWorth) ? plan.startingNetWorth as number : 0;
  const startHasSnapshot = hasNetWorthSnapshot(plan, start);

  // Investment return only applies to FUTURE months (after today).
  // Past/current months: cash flow only — return is already embedded in real balances.
  const todayD = new Date();
  const todayISO = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}`;

  let nw =
    mode === 'hybrid'
      ? lastSnapshotAtOrBefore(plan, start) ?? legacyStart
      : startHasSnapshot
      ? netWorthForMonth(plan, start)
      : legacyStart;

  const recurringIncome = plan.income || [];
  const recurringExpenses = plan.expenses || [];
  const oneIncome = (plan.oneTimeIncome || []) as OneTimeItem[];
  const oneExpenses = (plan.oneTimeExpenses || []) as OneTimeItem[];

  for (let i = 0; i <= maxI; i++) {
    const t = sy * 12 + sm + i;
    const monthISO = `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`;

    if (mode === 'hybrid' && hasNetWorthSnapshot(plan, monthISO)) {
      nw = totalNetWorth(plan, monthISO);
      continue;
    }

    const inc = recurringIncome.reduce((s, it) => s + amountForMonth(it, monthISO), 0);
    const exp = recurringExpenses.reduce((s, it) => s + amountForMonth(it, monthISO), 0);
    const oneInc = oneIncome.filter(x => x.monthISO === monthISO).reduce((s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0);
    const oneExp = oneExpenses.filter(x => x.monthISO === monthISO).reduce((s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0);
    const netCashFlow = inc + oneInc - exp - oneExp;

    // Apply return only for future months; past/current months: cash flow only
    nw = monthISO > todayISO
      ? nw * (1 + monthlyR) + netCashFlow
      : nw + netCashFlow;
  }

  return nw;
}

/**
 * In snapshot mode we carry forward last known snapshot so the line doesn't drop to 0.
 * Also used as a baseline anchor finder for Hybrid.
 */
function lastSnapshotAtOrBefore(plan: Plan, monthISO: string): number | null {
  const allMonths: string[] = [];

  for (const acct of plan.netWorthAccounts || []) {
    for (const b of acct.balances || []) {
      if (b && typeof b.monthISO === 'string' && Number.isFinite(b.amount)) {
        allMonths.push(b.monthISO);
      }
    }
  }

  // If no snapshots at all, fallback to legacy startingNetWorth (if any)
  if (!allMonths.length) {
    const legacy = Number.isFinite(plan.startingNetWorth)
      ? (plan.startingNetWorth as number)
      : 0;
    return legacy !== 0 ? legacy : null;
  }

  // Find latest month <= monthISO
  const months = Array.from(new Set(allMonths)).sort(compareISO);
  let best: string | null = null;
  for (const m of months) {
    if (m <= monthISO) best = m;
    else break;
  }
  if (!best) return null;

  // Sum accounts at THAT month
  return netWorthForMonth(plan, best);
}

/**
 * Build a month-by-month net worth series.
 *
 * Modes (final rules):
 * - snapshot:
 *   Use entered balances as truth; carry forward last snapshot so the line stays continuous.
 *   No returns; no cash flow modeling.
 *
 * - projection:
 *   Start from a baseline (snapshot at start month if present, else startingNetWorth),
 *   then apply returns + cash flow for every month. Ignore later snapshots entirely.
 *
 * - hybrid (FIXED):
 *   Apply returns + cash flow normally, BUT:
 *   - If a snapshot exists for a month, that month is "actual" and becomes the anchor.
 *   - Do NOT apply returns/cash flow inside that snapshot month.
 *   - Projections resume starting the NEXT month.
 */
export function buildNetWorthSeries(plan: Plan): SeriesPoint[] {
  const months = 12 * 50; // 50-year horizon

  const annualPct = Number.isFinite(plan.expectedReturnPct)
    ? plan.expectedReturnPct
    : 0;

  // True compound monthly rate: (1 + annual)^(1/12) - 1
  const monthlyR = annualPct === 0 ? 0 : Math.pow(1 + annualPct / 100, 1 / 12) - 1;

  // Investment return only applies to future months (after today)
  const todayD = new Date();
  const todayISO = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}`;

  const start = plan.startMonthISO || '2026-01';
  const startY = Number(start.slice(0, 4));
  const startM = Number(start.slice(5, 7)) - 1;

  const recurringIncome = plan.income || [];
  const recurringExpenses = plan.expenses || [];
  const oneIncome = (plan.oneTimeIncome || []) as OneTimeItem[];
  const oneExpenses = (plan.oneTimeExpenses || []) as OneTimeItem[];

  const mode = plan.netWorthMode || 'snapshot';

  const legacyStart = Number.isFinite(plan.startingNetWorth)
    ? (plan.startingNetWorth as number)
    : 0;

  const startHasSnapshot = hasNetWorthSnapshot(plan, start);

  // Baseline selection (fixes “0” KPI / weird baseline behavior):
  // - snapshot: carry-forward snapshots
  // - hybrid: baseline is lastSnapshotAtOrBefore(start) else legacy
  // - projection: baseline is snapshot at start month if present else legacy
  let nw =
    mode === 'snapshot'
      ? lastSnapshotAtOrBefore(plan, start) ?? 0
      : mode === 'hybrid'
      ? lastSnapshotAtOrBefore(plan, start) ?? legacyStart
      : startHasSnapshot
      ? netWorthForMonth(plan, start)
      : legacyStart;

  const series: SeriesPoint[] = [];

  for (let i = 0; i <= months; i++) {
    const t = startY * 12 + startM + i;
    const y = Math.floor(t / 12);
    const m = t % 12;
    const monthISO = `${y}-${String(m + 1).padStart(2, '0')}`;

    if (mode === 'snapshot') {
      const snap = lastSnapshotAtOrBefore(plan, monthISO);
      if (snap !== null) nw = snap;
      series.push({ monthIndex: i, netWorth: nw });
      continue;
    }

    // HYBRID: If a snapshot exists for this month, use totalNetWorth as anchor.
    // This correctly includes linked one-time items per account without double-counting.
    if (mode === 'hybrid' && hasNetWorthSnapshot(plan, monthISO)) {
      nw = totalNetWorth(plan, monthISO);
      series.push({ monthIndex: i, netWorth: nw });
      continue;
    }

    const inc = recurringIncome.reduce(
      (s, it) => s + amountForMonth(it, monthISO),
      0
    );
    const exp = recurringExpenses.reduce(
      (s, it) => s + amountForMonth(it, monthISO),
      0
    );

    const oneInc = oneIncome
      .filter((x) => x.monthISO === monthISO)
      .reduce((s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0);

    const oneExp = oneExpenses
      .filter((x) => x.monthISO === monthISO)
      .reduce((s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0);

    const netCashFlow = inc + oneInc - (exp + oneExp);

    // Apply return only for future months; past/current months: cash flow only
    nw = monthISO > todayISO
      ? nw * (1 + monthlyR) + netCashFlow
      : nw + netCashFlow;

    series.push({ monthIndex: i, netWorth: nw });
  }

  return series;
}

// ------------------------------
// Snapshot helpers (exported for UI)
// ------------------------------

/**
 * Returns the latest monthISO for which ANY net worth snapshot exists across accounts.
 * If none exist, returns null.
 */
function latestNetWorthSnapshotMonth(plan: Plan): string | null {
  const months: string[] = [];
  for (const acct of plan.netWorthAccounts || []) {
    for (const b of acct.balances || []) {
      if (b && typeof b.monthISO === 'string' && Number.isFinite(b.amount)) {
        months.push(b.monthISO);
      }
    }
  }
  if (!months.length) return null;
  months.sort(compareISO);
  return months[months.length - 1];
}

/**
 * Returns the latest snapshot monthISO <= targetMonthISO across all accounts.
 * If none exist (at or before), returns null.
 */
function snapshotMonthAtOrBefore(
  plan: Plan,
  targetMonthISO: string
): string | null {
  const months: string[] = [];
  for (const acct of plan.netWorthAccounts || []) {
    for (const b of acct.balances || []) {
      if (b && typeof b.monthISO === 'string' && Number.isFinite(b.amount)) {
        months.push(b.monthISO);
      }
    }
  }
  if (!months.length) return null;

  const uniq = Array.from(new Set(months)).sort(compareISO);
  let best: string | null = null;
  for (const m of uniq) {
    if (m <= targetMonthISO) best = m;
    else break;
  }
  return best;
}

/**
 * Returns the net worth "as of" a month:
 * - Uses the last snapshot at or before targetMonthISO if one exists
 * - Otherwise falls back to legacy startingNetWorth if present
 * - Otherwise null
 */
function netWorthAsOf(
  plan: Plan,
  targetMonthISO: string
): {
  monthISO: string;
  netWorth: number;
  source: 'snapshot' | 'legacy';
} | null {
  const snapMonth = snapshotMonthAtOrBefore(plan, targetMonthISO);
  if (snapMonth) {
    return {
      monthISO: snapMonth,
      netWorth: netWorthForMonth(plan, snapMonth),
      source: 'snapshot',
    };
  }

  const legacy = Number.isFinite(plan.startingNetWorth)
    ? (plan.startingNetWorth as number)
    : 0;

  if (legacy !== 0) {
    return { monthISO: targetMonthISO, netWorth: legacy, source: 'legacy' };
  }

  return null;
}