'use client';

import { useEffect, useState } from 'react';

export type AllocationSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

interface Props {
  slices: AllocationSlice[];
  currency: string;
  title?: string;
}

function abbreviate(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function DonutChart({ slices }: { slices: AllocationSlice[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center" style={{ width: 160, height: 160 }}>
        <div className="rounded-full border-8 border-slate-100 dark:border-slate-800" style={{ width: 160, height: 160 }} />
      </div>
    );
  }

  if (total <= 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: 160, height: 160 }}>
        <svg viewBox="0 0 160 160" width={160} height={160}>
          <circle cx={80} cy={80} r={60} fill="none" stroke="#e2e8f0" strokeWidth={24} />
          <text x={80} y={85} textAnchor="middle" fontSize={13} fill="#94a3b8" fontFamily="inherit">No data</text>
        </svg>
      </div>
    );
  }

  const cx = 80, cy = 80, r = 60, strokeWidth = 24;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const segments = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = s.value / total;
      const dashArray = pct * circumference;
      const dashOffset = -(offset * circumference);
      offset += pct;
      return { ...s, dashArray, dashOffset };
    });

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      <svg viewBox="0 0 160 160" width={160} height={160} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} className="dark:stroke-slate-800" />
        {segments.map((seg, i) => (
          <circle
            key={seg.key + i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">{abbreviate(total)}</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">total</span>
      </div>
    </div>
  );
}

export function AllocationPie({ slices, currency, title }: Props) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {title && (
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
      )}
      <div className="flex flex-col items-center gap-4">
        <DonutChart slices={slices} />
        <div className="w-full space-y-1.5">
          {slices.map((s) => {
            const pct = total > 0 ? Math.round((Math.max(0, s.value) / total) * 100) : 0;
            return (
              <div key={s.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block rounded-full" style={{ width: 8, height: 8, backgroundColor: s.color, flexShrink: 0 }} />
                  <span className="text-slate-900 dark:text-slate-400">{s.label}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">{pct}%</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 min-w-[60px] text-right">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.max(0, s.value))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
