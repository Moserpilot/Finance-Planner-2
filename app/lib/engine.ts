// app/lib/engine.ts
import type {
  Plan,
  RecurringItem,
  OneTimeItem,
  NetWorthAccount,
} from './store';

export type SeriesPoint = { monthIndex: number; netWorth: number };

export type CashFlowPoint = {
  monthIndex: number;
  monthISO: string;
  income: number;
  expenses: number;
  net: number;
};

export type BandPoint = {
  monthIndex: number;
  p10: number;
  p50: number;
  p90: number;
};

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
    return hit && Number.isFinite(hit.amount) ? hit.amount : base;
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
  const hit = (acct.balances || []).find((x) => x.monthISO === monthISO);
  return hit && Number.isFinite(hit.amount) ? hit.amount : 0;
}

export function netWorthForMonth(plan: Plan, monthISO: string): number {
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

  // Keep original behavior (simple annual/12) to avoid surprising changes.
  const monthlyR = annualPct / 100 / 12;

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

    // HYBRID FIX:
    // If a snapshot exists for this month, that month is actual + anchor.
    // Do NOT apply modeled return/cashflow inside this month.
    if (mode === 'hybrid' && hasNetWorthSnapshot(plan, monthISO)) {
      nw = netWorthForMonth(plan, monthISO);
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

    nw = nw * (1 + monthlyR) + netCashFlow;

    series.push({ monthIndex: i, netWorth: nw });
  }

  return series;
}

// ------------------------------
// Cash flow series (income/expense/net per month)
// ------------------------------

export function buildCashFlowSeries(plan: Plan, horizonMonths = 12 * 10): CashFlowPoint[] {
  const start = plan.startMonthISO || '2026-01';
  const startY = Number(start.slice(0, 4));
  const startM = Number(start.slice(5, 7)) - 1;

  const recurringIncome = plan.income || [];
  const recurringExpenses = plan.expenses || [];
  const oneIncome = (plan.oneTimeIncome || []) as OneTimeItem[];
  const oneExpenses = (plan.oneTimeExpenses || []) as OneTimeItem[];

  const out: CashFlowPoint[] = [];
  for (let i = 0; i <= horizonMonths; i++) {
    const t = startY * 12 + startM + i;
    const y = Math.floor(t / 12);
    const m = t % 12;
    const monthISO = `${y}-${String(m + 1).padStart(2, '0')}`;

    const incRecurring = recurringIncome.reduce(
      (s, it) => s + amountForMonth(it, monthISO),
      0
    );
    const expRecurring = recurringExpenses.reduce(
      (s, it) => s + amountForMonth(it, monthISO),
      0
    );
    const incOne = oneIncome
      .filter((x) => x.monthISO === monthISO)
      .reduce((s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0);
    const expOne = oneExpenses
      .filter((x) => x.monthISO === monthISO)
      .reduce((s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0);

    const income = incRecurring + incOne;
    const expenses = expRecurring + expOne;
    const net = income - expenses;

    out.push({ monthIndex: i, monthISO, income, expenses, net });
  }
  return out;
}

// ------------------------------
// Lightweight Monte Carlo bands (optional UI feature)
// ------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller transform for standard normal
function randn(rng: () => number) {
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

/**
 * Produces p10/p50/p90 net worth bands for the current plan.
 * - Uses the plan's projection logic (returns + cash flow).
 * - In hybrid mode, snapshots act as anchors (like buildNetWorthSeries).
 *
 * NOTE: This is intentionally lightweight: normal monthly returns with
 * user-supplied annual volatility.
 */
export function buildNetWorthBands(
  plan: Plan,
  horizonMonths = 12 * 30,
  simulations = 750,
  seed = 1337
): BandPoint[] {
  const annualPct = Number.isFinite(plan.expectedReturnPct)
    ? plan.expectedReturnPct
    : 0;
  const monthlyMean = annualPct / 100 / 12;

  const volAnnual = Number.isFinite((plan as any).volatilityPct)
    ? (plan as any).volatilityPct
    : 12;
  const monthlyVol = (volAnnual / 100) / Math.sqrt(12);

  const start = plan.startMonthISO || '2026-01';
  const startY = Number(start.slice(0, 4));
  const startM = Number(start.slice(5, 7)) - 1;

  const recurringIncome = plan.income || [];
  const recurringExpenses = plan.expenses || [];
  const oneIncome = (plan.oneTimeIncome || []) as OneTimeItem[];
  const oneExpenses = (plan.oneTimeExpenses || []) as OneTimeItem[];

  const mode = plan.netWorthMode || 'snapshot';

  // For bands, snapshot-only mode isn't meaningful (no modeled returns).
  if (mode === 'snapshot') {
    const s = buildNetWorthSeries({ ...plan, netWorthMode: 'snapshot' });
    return s.slice(0, horizonMonths + 1).map((pt) => ({
      monthIndex: pt.monthIndex,
      p10: pt.netWorth,
      p50: pt.netWorth,
      p90: pt.netWorth,
    }));
  }

  const startHasSnapshot = hasNetWorthSnapshot(plan, start);
  const legacyStart = Number.isFinite(plan.startingNetWorth)
    ? (plan.startingNetWorth as number)
    : 0;

  const baseline =
    mode === 'hybrid'
      ? lastSnapshotAtOrBefore(plan, start) ?? legacyStart
      : startHasSnapshot
      ? netWorthForMonth(plan, start)
      : legacyStart;

  // Precompute cashflow per monthISO for speed
  const monthISOs: string[] = [];
  const cashFlows: number[] = [];
  for (let i = 0; i <= horizonMonths; i++) {
    const t = startY * 12 + startM + i;
    const y = Math.floor(t / 12);
    const m = t % 12;
    const monthISO = `${y}-${String(m + 1).padStart(2, '0')}`;
    monthISOs.push(monthISO);

    if (mode === 'hybrid' && hasNetWorthSnapshot(plan, monthISO)) {
      // cash flow ignored in snapshot anchor month
      cashFlows.push(0);
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
    cashFlows.push(inc + oneInc - (exp + oneExp));
  }

  // Storage per month: array of simulated net worth values
  const buckets: number[][] = Array.from({ length: horizonMonths + 1 }, () => []);

  for (let s = 0; s < simulations; s++) {
    const rng = mulberry32(seed + s * 9973);
    let nw = baseline;

    for (let i = 0; i <= horizonMonths; i++) {
      const monthISO = monthISOs[i];

      if (mode === 'hybrid' && hasNetWorthSnapshot(plan, monthISO)) {
        // Anchor to actual snapshot value
        nw = netWorthForMonth(plan, monthISO);
        buckets[i].push(nw);
        continue;
      }

      const shock = randn(rng);
      const r = monthlyMean + monthlyVol * shock;
      nw = nw * (1 + r) + cashFlows[i];
      buckets[i].push(nw);
    }
  }

  const bands: BandPoint[] = [];
  for (let i = 0; i <= horizonMonths; i++) {
    const arr = buckets[i].slice().sort((a, b) => a - b);
    bands.push({
      monthIndex: i,
      p10: percentile(arr, 0.1),
      p50: percentile(arr, 0.5),
      p90: percentile(arr, 0.9),
    });
  }
  return bands;
}

// ------------------------------
// Snapshot helpers (exported for UI)
// ------------------------------

/**
 * Returns the latest monthISO for which ANY net worth snapshot exists across accounts.
 * If none exist, returns null.
 */
export function latestNetWorthSnapshotMonth(plan: Plan): string | null {
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
export function snapshotMonthAtOrBefore(
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
export function netWorthAsOf(
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
