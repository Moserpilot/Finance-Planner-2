'use client';

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type Slice = { name: string; value: number };

function pct(a: number, total: number) {
  if (!total) return '0.0%';
  return `${((a / total) * 100).toFixed(1)}%`;
}

export function AllocationPie({
  title = 'Allocation by type',
  data,
  heightPx = 260,
}: {
  title?: string;
  data: Slice[];
  heightPx?: number;
}) {
  const total = useMemo(() => (data || []).reduce((s, x) => s + (Number.isFinite(x.value) ? x.value : 0), 0), [data]);

  const tooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0].payload || {};
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{name}</div>
        <div className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">{pct(value, total)}</div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div style={{ height: heightPx }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={tooltip} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                labelLine={false}
                label={false}   // ✅ kill cartoony slice labels
              >
                {(data || []).map((_, i) => (
                  <Cell key={i} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {(data || []).map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.name}</div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{pct(s.value, total)}</div>
            </div>
          ))}
          <div className="text-xs text-slate-500 dark:text-slate-400">Total: {total.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}