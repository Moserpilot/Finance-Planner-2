// app/components/NetWorthChart.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeriesPoint } from '../lib/engine';

function safeCurrency(code: string) {
  const c = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return 'USD';
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(
      0
    );
    return c;
  } catch {
    return 'USD';
  }
}

function fmtMoney0(n: number, currency: string) {
  const cur = safeCurrency(currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtMoneyCompact(n: number, currency: string) {
  const cur = safeCurrency(currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(n);
}

function parseStartMonthISO(iso: string): { y: number; m: number } {
  const s = (iso || '').trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return { y: 2026, m: 0 };
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(5, 7)) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 0 || mo > 11) {
    return { y: 2026, m: 0 };
  }
  return { y, m: mo };
}

const MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function addMonths(startY: number, startM: number, add: number) {
  const total = startY * 12 + startM + add;
  const y = Math.floor(total / 12);
  const m = total % 12;
  return { y, m };
}

function labelForMonthIndex(startISO: string, monthIndex: number) {
  const { y: sy, m: sm } = parseStartMonthISO(startISO);
  const { y, m } = addMonths(sy, sm, monthIndex);
  const yy = String(y).slice(-2);
  return `${MON[m]}${yy}`; // J26, F26...
}

function niceStep(range: number) {
  const r = Math.max(1, range);
  const exp = Math.floor(Math.log10(r));
  const base = Math.pow(10, exp);
  const frac = r / base;

  let step = base;
  if (frac <= 2) step = base / 5;
  else if (frac <= 5) step = base / 2;
  else step = base;

  step = Math.max(5000, step);
  return step;
}

export function NetWorthChart({
  currency,
  series,
  startMonthISO,
  heightPx = 700,
  fixedWidthPx = 1500,
}: {
  currency: string;
  series: SeriesPoint[];
  startMonthISO: string;
  heightPx?: number;
  fixedWidthPx?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [wrapWidth, setWrapWidth] = useState<number>(0);

  // Measure available width so the chart can render nicely on phones (no forced horizontal scroll).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth || 0;
      setWrapWidth(w);
    };

    update();

    // Prefer ResizeObserver when available; fall back to window resize.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
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
    // If the wrapper is narrow (phone), render at wrapper width instead of forcing a 1500px canvas.
    // On desktop, keep the wide canvas for nicer detail (and horizontal scroll if desired).
    const w = Math.max(
      320,
      Math.min(fixedWidthPx, Math.max(wrapWidth || 0, 320))
    );
    const h = Math.max(360, heightPx - 48);

    // Pad tuned to preserve your current look; slightly tighter on narrow widths.
    const isNarrow = w < 520;
    const pad = {
      l: isNarrow ? 88 : 140,
      r: isNarrow ? 18 : 40,
      t: 22,
      b: isNarrow ? 74 : 86,
    };

    const values = series.map((p) => p.netWorth);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;

    const rangeRaw = Math.max(1, max - min);
    const minA = min - rangeRaw * 0.08;
    const maxA = max + rangeRaw * 0.1;

    const desiredTicks = isNarrow ? 6 : 7;
    const roughStep = (maxA - minA) / (desiredTicks - 1);
    const step = niceStep(roughStep);

    const yMin = Math.floor(minA / step) * step;
    const yMax = Math.ceil(maxA / step) * step;

    const yTickVals: number[] = [];
    for (let v = yMin; v <= yMax + step * 0.5; v += step) yTickVals.push(v);

    const x0 = pad.l;
    const x1 = w - pad.r;
    const y0 = pad.t;
    const y1 = h - pad.b;

    const toX = (i: number) => {
      if (series.length <= 1) return x0;
      return x0 + (i / (series.length - 1)) * (x1 - x0);
    };

    const toY = (v: number) => {
      const t = (v - yMin) / (yMax - yMin || 1);
      return y1 - t * (y1 - y0);
    };

    const pts = series.map((p, i) => ({
      x: toX(i),
      y: toY(p.netWorth),
      monthIndex: p.monthIndex,
      value: p.netWorth,
    }));

    const buildSmooth = () => {
      if (pts.length === 0) return '';
      if (pts.length < 3) {
        return pts
          .map(
            (p, i) =>
              `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
          )
          .join(' ');
      }
      let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        d += ` Q ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ${mx.toFixed(
          2
        )} ${my.toFixed(2)}`;
      }
      const last = pts[pts.length - 1];
      d += ` T ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
      return d;
    };

    const lineD = buildSmooth();
    const bottomY = h - pad.b;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const areaD =
      pts.length > 0
        ? `${lineD} L ${last.x.toFixed(2)} ${bottomY.toFixed(
            2
          )} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`
        : '';

    // Pixel-aware X tick density:
    // Keep labels readable by ensuring a minimum spacing (in px) between labels.
    const lastMonth = series.length ? series[series.length - 1].monthIndex : 0;
    const count = Math.max(1, lastMonth + 1);

    const plotW = Math.max(1, x1 - x0);
    const pxPerPoint = count <= 1 ? plotW : plotW / (count - 1);

    const minLabelSpacing = isNarrow ? 44 : 56;
    const everyByPx = Math.max(
      1,
      Math.ceil(minLabelSpacing / Math.max(1, pxPerPoint))
    );

    // Also apply a month-count cap so very long series doesn’t overload labels.
    const everyByMonths =
      lastMonth <= 6 ? 1 : lastMonth <= 12 ? 1 : lastMonth <= 24 ? 2 : 3;

    const every = Math.max(everyByPx, everyByMonths);

    const xTicks: { m: number; x: number }[] = [];
    for (let m = 0; m <= lastMonth; m += every) xTicks.push({ m, x: toX(m) });

    // Ensure last month label is included if it would otherwise be skipped.
    if (lastMonth > 0 && xTicks.length) {
      const lastTick = xTicks[xTicks.length - 1];
      if (lastTick.m !== lastMonth)
        xTicks.push({ m: lastMonth, x: toX(lastMonth) });
    } else if (lastMonth === 0) {
      xTicks.push({ m: 0, x: toX(0) });
    }

    const yTicks = yTickVals.map((v) => ({ v, y: toY(v) }));
    const yFmt =
      Math.max(Math.abs(yMin), Math.abs(yMax)) >= 50_000_000
        ? fmtMoneyCompact
        : fmtMoney0;

    return { w, h, pad, pts, lineD, areaD, xTicks, yTicks, yFmt, x0, x1 };
  }, [series, fixedWidthPx, heightPx, wrapWidth]);

  function updateHoverFromClientX(clientX: number) {
    if (!wrapRef.current || chart.pts.length === 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clientX - rect.left;

    const x0 = chart.pad.l;
    const x1 = chart.w - chart.pad.r;
    const clamped = Math.min(x1, Math.max(x0, x));
    const t = (clamped - x0) / (x1 - x0 || 1);
    const i = Math.round(t * (chart.pts.length - 1));
    setHoverIdx(i);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    updateHoverFromClientX(e.clientX);
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // On mobile: tap/drag should show value immediately.
    updateHoverFromClientX(e.clientX);
  }

  const hover = hoverIdx != null ? chart.pts[hoverIdx] : null;
  const endValue = series[series.length - 1]?.netWorth ?? 0;
  const lastPoint = chart.pts.length ? chart.pts[chart.pts.length - 1] : null;

  // Axis label colors:
  // Light: slate-900 (black-ish). Dark: slate-200.
  const axisFill = '#0f172a';
  const axisFillDark = '#e2e8f0';

  return (
    <div className="w-full" style={{ height: heightPx }}>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div>
          End value:{' '}
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {fmtMoney0(endValue, currency)}
          </span>
        </div>
        {hover ? (
          <div>
            {labelForMonthIndex(startMonthISO, hover.monthIndex)} •{' '}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {fmtMoney0(hover.value, currency)}
            </span>
          </div>
        ) : (
          <div>Hover (or tap) for exact month + value</div>
        )}
      </div>

      <div
        ref={wrapRef}
        className="h-[calc(100%-28px)] w-full overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200/60 dark:border-slate-800/60"
      >
        <svg
          width={chart.w}
          height={chart.h}
          className="block"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerLeave={() => setHoverIdx(null)}
          role="img"
          aria-label="Net worth projection chart"
          style={{ touchAction: 'none' }}
        >
          <defs>
            <linearGradient id="nwFillApple" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>

            <filter id="nwGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2.2"
                floodColor="currentColor"
                floodOpacity="0.18"
              />
              <feDropShadow
                dx="0"
                dy="6"
                stdDeviation="6.0"
                floodColor="currentColor"
                floodOpacity="0.10"
              />
            </filter>
          </defs>

          {chart.yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={chart.pad.l}
                x2={chart.w - chart.pad.r}
                y1={t.y}
                y2={t.y}
                stroke="currentColor"
                opacity={0.08}
              />
              <text
                x={chart.pad.l - 16}
                y={t.y + 6}
                textAnchor="end"
                fontSize="14"
                fill={axisFill}
                className="dark:hidden"
                opacity={0.95}
              >
                {chart.yFmt(t.v, currency)}
              </text>
              <text
                x={chart.pad.l - 16}
                y={t.y + 6}
                textAnchor="end"
                fontSize="14"
                fill={axisFillDark}
                className="hidden dark:block"
                opacity={0.92}
              >
                {chart.yFmt(t.v, currency)}
              </text>
            </g>
          ))}

          {chart.xTicks.map((t, idx) => (
            <g key={idx}>
              <text
                x={t.x}
                y={chart.h - chart.pad.b + 44}
                textAnchor="middle"
                fontSize="14"
                fill={axisFill}
                className="dark:hidden"
                opacity={t.m % 12 === 0 ? 0.95 : 0.85}
              >
                {labelForMonthIndex(startMonthISO, t.m)}
              </text>
              <text
                x={t.x}
                y={chart.h - chart.pad.b + 44}
                textAnchor="middle"
                fontSize="14"
                fill={axisFillDark}
                className="hidden dark:block"
                opacity={t.m % 12 === 0 ? 0.92 : 0.75}
              >
                {labelForMonthIndex(startMonthISO, t.m)}
              </text>
            </g>
          ))}

          <path d={chart.areaD} fill="url(#nwFillApple)" />

          <path
            d={chart.lineD}
            fill="none"
            stroke="currentColor"
            opacity={0.65}
            strokeWidth={6}
            strokeLinecap="round"
            filter="url(#nwGlow)"
          />

          <path
            d={chart.lineD}
            fill="none"
            stroke="currentColor"
            opacity={0.96}
            strokeWidth={3.8}
            strokeLinecap="round"
          />

          {lastPoint ? (
            <g>
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={8}
                fill="currentColor"
                opacity={0.96}
              />
              <text
                x={lastPoint.x - 16}
                y={lastPoint.y - 18}
                textAnchor="end"
                fontSize="14"
                fill={axisFill}
                className="dark:hidden"
                opacity={0.92}
              >
                {fmtMoneyCompact(lastPoint.value, currency)}
              </text>
              <text
                x={lastPoint.x - 16}
                y={lastPoint.y - 18}
                textAnchor="end"
                fontSize="14"
                fill={axisFillDark}
                className="hidden dark:block"
                opacity={0.92}
              >
                {fmtMoneyCompact(lastPoint.value, currency)}
              </text>
            </g>
          ) : null}

          {hover ? (
            <g>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={chart.pad.t}
                y2={chart.h - chart.pad.b}
                stroke="currentColor"
                opacity={0.12}
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={8.5}
                fill="currentColor"
                opacity={0.98}
              />
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
