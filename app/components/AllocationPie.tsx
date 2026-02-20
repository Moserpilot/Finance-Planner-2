// app/components/AllocationPie.tsx
'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

export type AllocationSlice = {
  label: string;
  value: number; // absolute dollars (can be negative but we’ll typically send assets)
};

function fmtMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(n) ? n : 0);
  }
}

const COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#64748b', // slate
];

export function AllocationPie({
  data,
  currency,
  height = 220,
}: {
  data: AllocationSlice[];
  currency: string;
  height?: number;
}) {
  const cleaned = (data || [])
    .map((d) => ({ ...d, value: Number.isFinite(d.value) ? d.value : 0 }))
    .filter((d) => d.value > 0);

  const total = cleaned.reduce((s, d) => s + d.value, 0);

  if (!cleaned.length || total <= 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
        No allocation data yet.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={cleaned}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {cleaned.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip
            formatter={(value: any, name: any) => {
              const v = Number(value) || 0;
              const pct = total > 0 ? (v / total) * 100 : 0;
              return [`${fmtMoney(v, currency)} (${pct.toFixed(1)}%)`, String(name)];
            }}
          />
          <Legend verticalAlign="bottom" height={28} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
