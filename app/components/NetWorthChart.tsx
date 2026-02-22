'use client';

import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

type Pt = { monthIndex: number; netWorth: number };
type Band = { monthIndex: number; p10: number; p90: number };

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

function money(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function addMonthsISO(startISO: string, add: number) {
  const ok = /^\d{4}-\d{2}$/.test(startISO);
  const y0 = ok ? Number(startISO.slice(0, 4)) : 2026;
  const m0 = ok ? Number(startISO.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  const y = Math.floor(t / 12);
  const m = t % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function NetWorthChart({
  currency,
  startMonthISO,
  planSeries,
  actualSeries,
  bands,
  heightPx = 660,
  fixedWidthPx,
}: {
  currency: string;
  startMonthISO: string;
  planSeries: Pt[];
  actualSeries?: Pt[];
  bands?: Band[];
  heightPx?: number;
  fixedWidthPx?: number;
}) {
  const [hover, setHover] = useState<{ monthISO: string; value: number } | null>(null);

  const data = useMemo(() => {
    const byIdx = new Map<number, any>();

    for (const p of planSeries || []) {
      byIdx.set(p.monthIndex, {
        monthIndex: p.monthIndex,
        monthISO: addMonthsISO(startMonthISO, p.monthIndex),
        plan: p.netWorth,
      });
    }

    for (const a of actualSeries || []) {
      const cur = byIdx.get(a.monthIndex) || {
        monthIndex: a.monthIndex,
        monthISO: addMonthsISO(startMonthISO, a.monthIndex),
      };
      cur.actual = a.netWorth;
      byIdx.set(a.monthIndex, cur);
    }

    for (const b of bands || []) {
      const cur = byIdx.get(b.monthIndex) || {
        monthIndex: b.monthIndex,
        monthISO: addMonthsISO(startMonthISO, b.monthIndex),
      };
      cur.p10 = b.p10;
      cur.p90 = b.p90;
      byIdx.set(b.monthIndex, cur);
    }

    return Array.from(byIdx.values()).sort((x, y) => x.monthIndex - y.monthIndex);
  }, [planSeries, actualSeries, bands, startMonthISO]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    const val = row?.actual ?? row?.plan;
    const monthISO = row?.monthISO;
    if (typeof val === 'number' && typeof monthISO === 'string') {
      setHover({ monthISO, value: val });
    }
    return null;
  };

  return (
    <div className="relative" style={{ width: fixedWidthPx ? `${fixedWidthPx}px` : '100%' }}>
      {/* big top-right hover readout */}
      <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Hover</div>
        <div className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">
          {hover?.monthISO ?? '—'}
        </div>
        <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {hover ? money(hover.value, currency) : '—'}
        </div>
      </div>

      <div style={{ height: `${heightPx}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
            <XAxis dataKey="monthISO" tick={{ fontSize: 12 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(v, currency)} width={84} />
            <Tooltip content={<CustomTooltip />} />

            <Line type="monotone" dataKey="plan" dot={false} strokeWidth={3} />
            {actualSeries ? <Line type="monotone" dataKey="actual" dot={false} strokeWidth={3} /> : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}