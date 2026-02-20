// app/components/NetWorthChart.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export type Point = { monthIndex: number; netWorth: number; monthISO?: string };
export type Marker = { monthIndex: number; value: number };

export type Band = {
  monthIndex: number;
  p10: number;
  p50: number;
  p90: number;
  monthISO?: string;
};

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
  const ok = /^\d{4}-\d{2}$/.test(startISO);
  const y0 = ok ? Number(startISO.slice(0, 4)) : 2026;
  const m0 = ok ? Number(startISO.slice(5, 7)) - 1 : 0;
  const t = y0 * 12 + m0 + add;
  const y = Math.floor(t / 12);
  const m = t % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function monthLabel(startISO: string, add: number) {
  const iso = addMonthsISO(startISO, add);
  const [y, m] = iso.split('-').map((x) => Number(x));
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleString('en-US', { month: 'short' });
}

export function NetWorthChart({
  currency,
  startMonthISO,
  planSeries,
  actualSeries,
  actualMarkers,
  bands,
  heightPx = 520,
  fixedWidthPx,
}: {
  currency: string;
  startMonthISO: string;
  planSeries: Point[];
  actualSeries?: Point[];
  actualMarkers?: Marker[];
  bands?: Band[];
  heightPx?: number;
  fixedWidthPx?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);

  // Measure container width (ResizeObserver if available; otherwise window resize)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof window === 'undefined') return;

    const update = () => setW(el.clientWidth || 0);
    update();

    let ro: ResizeObserver | null = null;
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

  const chart = useMemo(() => {
    const width =
      typeof fixedWidthPx === 'number' && fixedWidthPx > 0
        ? fixedWidthPx
        : Math.max(720, Math.min(1200, Math.max(720, w || 0)));

    const height = Math.max(320, heightPx);
    const padL = 56;
    const padR = 18;
    const padT = 18;
    const padB = 56;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const allVals: number[] = [];
    for (const p of planSeries || []) allVals.push(p.netWorth);
    for (const p of actualSeries || []) allVals.push(p.netWorth);
    for (const b of bands || []) allVals.push(b.p10, b.p50, b.p90);
    for (const m of actualMarkers || []) allVals.push(m.value);

    const minV = allVals.length ? Math.min(...allVals) : 0;
    const maxV = allVals.length ? Math.max(...allVals) : 1;
    const span = Math.max(1, maxV - minV);
    const yMin = minV - span * 0.08;
    const yMax = maxV + span * 0.08;

    function xScale(i: number) {
      const n = Math.max(1, (planSeries || []).length - 1);
      return padL + (i / n) * innerW;
    }

    function yScale(v: number) {
      return padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
    }

    return { width, height, padL, padR, padT, padB, innerW, innerH, xScale, yScale };
  }, [w, fixedWidthPx, heightPx, planSeries, actualSeries, actualMarkers, bands]);

  const planPath = useMemo(() => {
    if (!planSeries?.length) return '';
    return planSeries
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${chart.xScale(i)} ${chart.yScale(p.netWorth)}`)
      .join(' ');
  }, [planSeries, chart]);

  const actualPath = useMemo(() => {
    if (!actualSeries?.length) return '';
    return actualSeries
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${chart.xScale(i)} ${chart.yScale(p.netWorth)}`)
      .join(' ');
  }, [actualSeries, chart]);

  const bandAreaPath = useMemo(() => {
    if (!bands?.length) return '';
    const top = bands.map((b, i) => `L ${chart.xScale(i)} ${chart.yScale(b.p90)}`).join(' ');
    const bot = bands
      .slice()
      .reverse()
      .map((b, ri) => {
        const i = bands.length - 1 - ri;
        return `L ${chart.xScale(i)} ${chart.yScale(b.p10)}`;
      })
      .join(' ');
    const start = `M ${chart.xScale(0)} ${chart.yScale(bands[0].p90)}`;
    return `${start} ${top} ${bot} Z`;
  }, [bands, chart]);

  // Hover state
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hover = useMemo(() => {
    const i = hoverIdx;
    if (i == null) return null;
    const p = planSeries?.[i];
    if (!p) return null;
    const a = actualSeries?.[i];
    const b = bands?.[i];
    return { i, p, a, b };
  }, [hoverIdx, planSeries, actualSeries, bands]);

  function onMove(e: React.MouseEvent<SVGSVGElement, MouseEvent>) {
    if (!planSeries?.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clamped = Math.max(chart.padL, Math.min(chart.width - chart.padR, x));
    const t = (clamped - chart.padL) / chart.innerW;
    const idx = Math.round(t * Math.max(1, planSeries.length - 1));
    setHoverIdx(Math.max(0, Math.min(planSeries.length - 1, idx)));
  }

  function onLeave() {
    setHoverIdx(null);
  }

  return (
    <div ref={wrapRef} className="w-full overflow-x-auto">
      <svg
        width={chart.width}
        height={chart.height}
        className="block"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {/* horizontal grid */}
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

        {/* bands (p10–p90) */}
        {bands?.length ? <path d={bandAreaPath} fill="rgba(59,130,246,0.10)" stroke="none" /> : null}

        {/* plan line */}
        {planSeries?.length ? (
          <path d={planPath} fill="none" stroke="rgba(59,130,246,0.95)" strokeWidth={2.5} />
        ) : null}

        {/* actual line */}
        {actualSeries?.length ? (
          <path d={actualPath} fill="none" stroke="rgba(34,197,94,0.90)" strokeWidth={2.25} />
        ) : null}

        {/* actual markers (snapshot dots) */}
        {actualMarkers?.length
          ? actualMarkers.map((m, k) => {
              const x = chart.xScale(m.monthIndex);
              const y = chart.yScale(m.value);
              return (
                <circle
                  key={k}
                  cx={x}
                  cy={y}
                  r={4.5}
                  fill="rgba(34,197,94,0.95)"
                  stroke="rgba(15,23,42,0.35)"
                  strokeWidth={1}
                />
              );
            })
          : null}

        {/* x-axis labels */}
        {planSeries?.length
          ? planSeries.map((p, i) => {
              const show = planSeries.length <= 12 ? true : i % 2 === 0;
              if (!show) return null;
              const x = chart.xScale(i);
              const y = chart.padT + chart.innerH + 30;
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  fontSize={11}
                  fill="rgba(100,116,139,0.95)"
                >
                  {monthLabel(startMonthISO, p.monthIndex ?? i)}
                </text>
              );
            })
          : null}

        {/* hover vertical line + tooltip */}
        {hover ? (
          <>
            <line
              x1={chart.xScale(hover.i)}
              x2={chart.xScale(hover.i)}
              y1={chart.padT}
              y2={chart.padT + chart.innerH}
              stroke="rgba(148,163,184,0.55)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <circle
              cx={chart.xScale(hover.i)}
              cy={chart.yScale(hover.p.netWorth)}
              r={4.5}
              fill="rgba(59,130,246,0.95)"
            />

            {(() => {
              const x = chart.xScale(hover.i);
              const y = chart.padT + 8;
              const boxW = 232;
              const boxH = bands?.length ? 86 : 66;
              const bx = Math.min(chart.width - chart.padR - boxW, Math.max(chart.padL, x + 10));
              const by = y;

              const monthISO = hover.p.monthISO || addMonthsISO(startMonthISO, hover.p.monthIndex ?? hover.i);

              return (
                <g>
                  <rect
                    x={bx}
                    y={by}
                    width={boxW}
                    height={boxH}
                    rx={12}
                    fill="rgba(15,23,42,0.92)"
                    stroke="rgba(148,163,184,0.25)"
                    strokeWidth={1}
                  />
                  <text x={bx + 12} y={by + 22} fontSize={12} fill="rgba(226,232,240,0.95)">
                    {monthISO}
                  </text>
                  <text x={bx + 12} y={by + 42} fontSize={12} fill="rgba(226,232,240,0.95)">
                    Plan: {money0(hover.p.netWorth, currency)}
                  </text>
                  {hover.a ? (
                    <text x={bx + 12} y={by + 60} fontSize={12} fill="rgba(226,232,240,0.95)">
                      Actual: {money0(hover.a.netWorth, currency)}
                    </text>
                  ) : null}
                  {hover.b ? (
                    <text x={bx + 12} y={by + 78} fontSize={12} fill="rgba(226,232,240,0.95)">
                      P10–P90: {money0(hover.b.p10, currency)} – {money0(hover.b.p90, currency)}
                    </text>
                  ) : null}
                </g>
              );
            })()}
          </>
        ) : null}
      </svg>
    </div>
  );
}
