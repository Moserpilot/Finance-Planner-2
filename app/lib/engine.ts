// app/lib/engine.ts

import type { Plan, IncomeExpenseItem, NetWorthAccount } from './store';

/** ---------- Month utilities ---------- */

export function isMonthISO(m: string) {
  return typeof m === 'string' && /^\d{4}-\d{2}$/.test(m);
}

export function clampMonthISO(m: string, fallback = '2026-01') {
  return isMonthISO(m) ? m : fallback;
}

export function monthToIndex(monthISO: string) {
  const m = clampMonthISO(monthISO);
  const y = Number(m.slice(0, 4));
  const mo = Number(m.slice(5, 7)) - 1;
  return y * 12 + mo;
}

export function indexToMonth(idx: number) {
  const y = Math.floor(idx / 12);
  const m = idx % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function addMonthsISO(startISO: string, add: number) {
  return indexToMonth(monthToIndex(clampMonthISO(startISO)) + add);
}

/** ---------- Money / numeric hygiene ---------- */

function num(v: any): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[$, ]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** ---------- Balances hardening (fixes "object is not iterable") ---------- */

type AnyBalance = { monthISO?: string; balance?: any; amount?: any };

function balancesArray(acct: any): AnyBalance[] {
  const raw = acct?.balances;

  // already an array
  if (Array.isArray(raw)) return raw as AnyBalance[];

  // null/undefined
  if (raw == null) return [];

  // object cases
  if (typeof raw === 'object') {
    // single balance object like { monthISO: "2026-01", balance: 123 }
    if ('monthISO' in raw) return [raw as AnyBalance];

    // dictionary like { "2026-01": 123, "2026-02": 130 }
    return Object.entries(raw).map(([k, v]) => {
      if (v && typeof v === 'object') {
        const vv: any = v;
        return { monthISO: vv.monthISO ?? k, balance: vv.balance ?? vv.amount ?? vv.value ?? vv };
      }
      return { monthISO: k, balance: v };
    });
  }

  // scalar fallback
  return [{ monthISO: undefined, balance: raw }];
}

function balanceValue(b: AnyBalance): number {
  const bal =
    Number.isFinite(Number((b as any)?.balance)) ? Number((b as any).balance) :
    Number.isFinite(Number((b as any)?.amount)) ? Number((b as any).amount) :
    NaN;
  return Number.isFinite(bal) ? bal : NaN;
}

function accountBalanceAtOrBefore(acct: NetWorthAccount, monthISO: string): number | null {
  const target = monthToIndex(monthISO);
  let bestIdx = -Infinity;
  let bestVal: number | null = null;

  for (const b of balancesArray(acct)) {
    const m = b?.monthISO;
    if (!isMonthISO(String(m))) continue;
    const idx = monthToIndex(String(m));
    const v = balanceValue(b);
    if (!Number.isFinite(v)) continue;

    if (idx <= target && idx > bestIdx) {
      bestIdx = idx;
      bestVal = v;
    }
  }

  return bestVal;
}

function accountBalanceExact(acct: NetWorthAccount, monthISO: string): number | null {
  const target = clampMonthISO(monthISO);
  for (const b of balancesArray(acct)) {
    const m = b?.monthISO;
    if (String(m) !== target) continue;
    const v = balanceValue(b);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

export function snapshotMonthAtOrBefore(plan: Plan, monthISO: string): string | null {
  const target = monthToIndex(monthISO);
  let best: number | null = null;

  for (const acct of plan.netWorthAccounts || []) {
    for (const b of balancesArray(acct)) {
      const m = b?.monthISO;
      if (!isMonthISO(String(m))) continue;
      const idx = monthToIndex(String(m));
      const v = balanceValue(b);
      if (!Number.isFinite(v)) continue;

      if (idx <= target && (best == null || idx > best)) best = idx;
    }
  }

  return best == null ? null : indexToMonth(best);
}

export function latestNetWorthSnapshotMonth(plan: Plan): string | null {
  let best: number | null = null;
  for (const acct of plan.netWorthAccounts || []) {
    for (const b of balancesArray(acct)) {
      const m = b?.monthISO;
      if (!isMonthISO(String(m))) continue;
      const idx = monthToIndex(String(m));
      const v = balanceValue(b);
      if (!Number.isFinite(v)) continue;

      if (best == null || idx > best) best = idx;
    }
  }
  return best == null ? null : indexToMonth(best);
}

export function hasNetWorthSnapshot(plan: Plan, monthISO: string): boolean {
  const m = clampMonthISO(monthISO);
  for (const acct of plan.netWorthAccounts || []) {
    const v = accountBalanceExact(acct, m);
    if (v != null) return true;
  }
  return false;
}

export function netWorthForMonth(plan: Plan, monthISO: string): number {
  const m = clampMonthISO(monthISO);
  let sum = 0;

  for (const acct of plan.netWorthAccounts || []) {
    // carry-forward within engine so missing months still produce a number
    const v = accountBalanceAtOrBefore(acct, m);
    if (v != null && Number.isFinite(v)) sum += v;
  }

  return sum;
}

/** ---------- Income / expense logic ---------- */

function activeInRange(item: IncomeExpenseItem, monthISO: string): boolean {
  const m = monthToIndex(monthISO);
  const start = item.startMonthISO ? monthToIndex(clampMonthISO(item.startMonthISO)) : -Infinity;
  const end = item.endMonthISO ? monthToIndex(clampMonthISO(item.endMonthISO)) : Infinity;
  return m >= start && m <= end;
}

function cadenceHit(item: IncomeExpenseItem, monthISO: string): boolean {
  const cadence = item.cadence || 'monthly';

  const startISO = clampMonthISO(item.startMonthISO || monthISO);
  const startIdx = monthToIndex(startISO);
  const idx = monthToIndex(monthISO);

  const delta = idx - startIdx;
  if (delta < 0) return false;

  if (cadence === 'monthly') return true;
  if (cadence === 'quarterly') return delta % 3 === 0;
  if (cadence === 'yearly') return delta % 12 === 0;
  if (cadence === 'one-time') return delta === 0;

  return true;
}

export function amountForMonth(item: IncomeExpenseItem, monthISO: string): number {
  if (!activeInRange(item, monthISO)) return 0;
  if (!cadenceHit(item, monthISO)) return 0;
  return num(item.amount);
}

/** ---------- Cash flow series ---------- */

export function buildCashFlowSeries(plan: Plan, months: number) {
  const startISO = clampMonthISO(plan.startMonthISO || '2026-01');
  const out: Array<{ monthISO: string; income: number; expenses: number; net: number }> = [];

  for (let i = 0; i < months; i++) {
    const m = addMonthsISO(startISO, i);
    const income = (plan.income || []).reduce((s, it) => s + amountForMonth(it, m), 0);
    const expenses = (plan.expenses || []).reduce((s, it) => s + amountForMonth(it, m), 0);
    out.push({ monthISO: m, income, expenses, net: income - expenses });
  }

  return out;
}

/** ---------- Net worth as-of + projections ---------- */

export function netWorthAsOf(plan: Plan, monthISO: string): { monthISO: string; netWorth: number } | null {
  const startISO = clampMonthISO(monthISO, clampMonthISO(plan.startMonthISO || '2026-01'));
  const mode = plan.netWorthMode || 'hybrid';

  if (mode === 'projection') {
    // baseline = startingNetWorth if present, otherwise sum of accounts (as-of start)
    const baseline =
      Number.isFinite(Number(plan.startingNetWorth)) && Number(plan.startingNetWorth) !== 0
        ? num(plan.startingNetWorth)
        : netWorthForMonth(plan, startISO);

    return { monthISO: startISO, netWorth: baseline };
  }

  // snapshot / hybrid: anchor to latest snapshot at-or-before requested month; fallback to start month
  const snap = snapshotMonthAtOrBefore(plan, startISO) ?? startISO;
  return { monthISO: snap, netWorth: netWorthForMonth(plan, snap) };
}

export function buildNetWorthSeries(plan: Plan, horizonMonths = 12 * 30) {
  const startISO = clampMonthISO(plan.startMonthISO || '2026-01');
  const mode = plan.netWorthMode || 'hybrid';

  const expectedReturnPct = num(plan.expectedReturnPct ?? 0); // e.g. 7 = 7%
  const rMonthly = expectedReturnPct / 100 / 12;

  // anchor
  const anchor = netWorthAsOf(plan, startISO);
  let nw = anchor?.netWorth ?? 0;

  const out: Array<{ monthIndex: number; monthISO: string; netWorth: number }> = [];

  for (let i = 0; i <= horizonMonths; i++) {
    const m = addMonthsISO(startISO, i);

    if (mode === 'snapshot') {
      // step series from actuals (carry-forward)
      nw = netWorthForMonth(plan, m);
    } else {
      // projection/hybrid: apply cash flow + growth
      const income = (plan.income || []).reduce((s, it) => s + amountForMonth(it, m), 0);
      const expenses = (plan.expenses || []).reduce((s, it) => s + amountForMonth(it, m), 0);
      const net = income - expenses;

      // In hybrid, if an actual snapshot exists at this month, snap to it (re-anchor)
      if (mode === 'hybrid' && hasNetWorthSnapshot(plan, m)) {
        nw = netWorthForMonth(plan, m);
      } else {
        nw = (nw + net) * (1 + rMonthly);
      }
    }

    out.push({ monthIndex: i, monthISO: m, netWorth: nw });
  }

  return out;
}

/** ---------- Risk bands (simple Monte Carlo) ---------- */

export function buildNetWorthBands(plan: Plan, horizonMonths = 12 * 30, trials = 750) {
  // If snapshot-only, bands don't make sense
  if ((plan.netWorthMode || 'hybrid') === 'snapshot') return null;

  const startISO = clampMonthISO(plan.startMonthISO || '2026-01');
  const anchor = netWorthAsOf(plan, startISO);
  const startNW = anchor?.netWorth ?? 0;

  const expectedReturnPct = num(plan.expectedReturnPct ?? 0);
  const mu = expectedReturnPct / 100 / 12;

  // fixed vol assumption (keeps UI useful without extra inputs)
  const sigma = 0.12 / Math.sqrt(12); // ~12% annual vol

  // Precompute deterministic net cash flow per month (based on items)
  const netCF = Array.from({ length: horizonMonths + 1 }, (_, i) => {
    const m = addMonthsISO(startISO, i);
    const inc = (plan.income || []).reduce((s, it) => s + amountForMonth(it, m), 0);
    const exp = (plan.expenses || []).reduce((s, it) => s + amountForMonth(it, m), 0);
    return inc - exp;
  });

  // quick PRNG
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const randn = () => {
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const paths: number[][] = Array.from({ length: trials }, () => new Array(horizonMonths + 1).fill(0));

  for (let t = 0; t < trials; t++) {
    let nw = startNW;
    paths[t][0] = nw;

    for (let i = 1; i <= horizonMonths; i++) {
      const shock = randn();
      const r = mu + sigma * shock;
      nw = (nw + netCF[i]) * (1 + r);
      paths[t][i] = nw;
    }
  }

  const pct = (arr: number[], p: number) => {
    const a = [...arr].sort((x, y) => x - y);
    const idx = Math.max(0, Math.min(a.length - 1, Math.floor((a.length - 1) * p)));
    return a[idx];
  };

  const out: Array<{ monthIndex: number; p10: number; p50: number; p90: number }> = [];

  for (let i = 0; i <= horizonMonths; i++) {
    const slice = paths.map((p) => p[i]);
    out.push({
      monthIndex: i,
      p10: pct(slice, 0.10),
      p50: pct(slice, 0.50),
      p90: pct(slice, 0.90),
    });
  }

  return out;
}