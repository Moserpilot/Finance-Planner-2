// app/cashflow/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCashFlowSeries } from '../lib/engine';
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

function money0(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function addMonthsISO(startISO: string, add: number) {
  const [y, m] = startISO.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1 + add, 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function monthLabel(startISO: string, idx: number) {
  const iso = addMonthsISO(startISO, idx);
  const [y, m] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleString('en-US', { month: 'short' });
}

export default function CashFlowPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [months, setMonths] = useState(12);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    setPlan(loadPlan());
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    // SSR guard (should be client-only anyway, but prevents TS / build weirdness)
    if (typeof window === 'undefined') return;

    const update = () => setW(el.clientWidth || 0);
    update();

    let ro: ResizeObserver | null = null;

    // TS-safe feature detect
    const hasRO = typeof (window as any).ResizeObserver !== 'undefined';

    if (hasRO) {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, []);

  const cur = plan?.currency || 'USD';
  const startISO = plan?.startMonthISO || '2026-01';

  const series = useMemo(() => {
    if (!plan) return [];
    // months is the visible count, engine expects end index / count-1 in your current setup
    return buildCashFlowSeries(plan, months - 1);
  }, [plan, months]);

  const chart = useMemo(() => {
    const width = Math.max(720, Math.min(1200, Math.max(720, w || 0)));
    const height = 360;
    const padL = 52;
    const padR = 20;
    const padT = 18;
    const padB = 48;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const maxAbs = series.length
      ? Math.max(
          ...series.map((p) => Math.max(Math.abs(p.income), Math.abs(p.expenses), Math.abs(p.net)))
        )
      : 1;

    const yMax = maxAbs * 1.15;
    const yMin = -maxAbs * 1.15;

    function xScale(i: number) {
      const n = Math.max(1, series.length);
      return padL + (i / n) * innerW;
    }

    function yScale(v: number) {
      return padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
    }

    const zeroY = yScale(0);
    const groupW = innerW / Math.max(1, series.length);
    const barW = Math.max(6, Math.min(18, groupW / 4));
    const gap = Math.max(3, barW / 3);

    return {
      width,
      height,
      padL,
      padR,
      padT,
      padB,
      innerW,
      innerH,
      yScale,
      zeroY,
      barW,
      gap,
      xScale,
    };
  }, [series, w]);

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Cash Flow</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Income, expenses, and net by month</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
          {[12, 24, 36].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                months === m
                  ? 'bg-blue-600/10 text-slate-900 dark:bg-blue-500/20 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Start {startISO}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div ref={wrapRef} className="w-full overflow-x-auto">
          <svg width={chart.width} height={chart.height} className="block">
            {/* grid */}
            {Array.from({ length: 5 }).map((_, i) => {
              const y = chart.padT + (chart.innerH * i) / 4;
              return (
                <line
                  key={i}
                  x1={chart.padL}
                  x2={chart.width - chart.padR}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.22)"
                  strokeWidth={1}
                />
              );
            })}

            {/* zero line */}
            <line
              x1={chart.padL}
              x2={chart.width - chart.padR}
              y1={chart.zeroY}
              y2={chart.zeroY}
              stroke="rgba(148,163,184,0.45)"
              strokeWidth={1}
            />

            {/* bars */}
            {series.map((p, i) => {
              const x0 = chart.xScale(i) + chart.gap;
              const incX = x0;
              const expX = x0 + chart.barW + chart.gap;
              const netX = x0 + (chart.barW + chart.gap) * 2;

              function bar(x: number, v: number, fill: string) {
                const y = chart.yScale(v);
                const y0 = chart.zeroY;
                const h = Math.abs(y0 - y);
                const yy = v >= 0 ? y : y0;
                return <rect x={x} y={yy} width={chart.barW} height={h} rx={4} fill={fill} />;
              }

              return (
                <g key={p.monthISO}>
                  {bar(incX, p.income, 'rgba(34,197,94,0.85)')}
                  {bar(expX, -p.expenses, 'rgba(244,63,94,0.82)')}
                  {bar(
                    netX,
                    p.net,
                    p.net >= 0 ? 'rgba(59,130,246,0.85)' : 'rgba(245,158,11,0.88)'
                  )}

                  {/* x label */}
                  <text
                    x={incX + (chart.barW + chart.gap) * 1.5}
                    y={chart.padT + chart.innerH + 28}
                    textAnchor="middle"
                    fontSize={11}
                    fill="rgba(100,116,139,0.95)"
                  >
                    {monthLabel(startISO, i)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(34,197,94,0.85)' }} /> Income
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(244,63,94,0.82)' }} /> Expenses
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(59,130,246,0.85)' }} /> Net
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Monthly detail</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2">Income</th>
                <th className="px-3 py-2">Expenses</th>
                <th className="px-3 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.monthISO} className="border-t border-slate-200/70 dark:border-slate-800/70">
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{p.monthISO}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{money0(p.income, cur)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{money0(p.expenses, cur)}</td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      p.net >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {money0(p.net, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
