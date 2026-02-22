// app/components/AllocationPie.tsx
'use client';

type Slice = {
  label: string;
  value: number;
  color: string;
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

function moneyCompact(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency(currency),
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(n);
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

export function AllocationPie({
  title,
  currency,
  slices,
}: {
  title: string;
  currency: string;
  slices: Slice[];
}) {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const normalized =
    total > 0 ? slices.map((s) => ({ ...s, value: Math.max(0, s.value) })) : [];

  const radius = 76;
  const cx = 96;
  const cy = 96;

  let angle = -Math.PI / 2;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {title}
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Current net worth mix
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="mx-auto shrink-0">
          <svg
            width="192"
            height="192"
            viewBox="0 0 192 192"
            role="img"
            aria-label="Allocation by type pie chart"
          >
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="24"
              opacity="0.08"
            />
            {normalized.map((slice, i) => {
              const ratio = total > 0 ? slice.value / total : 0;
              const sweep = ratio * Math.PI * 2;
              const x1 = cx + radius * Math.cos(angle);
              const y1 = cy + radius * Math.sin(angle);
              angle += sweep;
              const x2 = cx + radius * Math.cos(angle);
              const y2 = cy + radius * Math.sin(angle);
              const largeArc = sweep > Math.PI ? 1 : 0;
              const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
              return (
                <path
                  key={slice.label + i}
                  d={d}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="24"
                  strokeLinecap="butt"
                />
              );
            })}
            <circle
              cx={cx}
              cy={cy}
              r="56"
              fill="white"
              className="dark:fill-slate-900"
            />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] tracking-[0.14em] dark:fill-slate-400"
            >
              TOTAL
            </text>
            <text
              x={cx}
              y={cy + 16}
              textAnchor="middle"
              className="fill-slate-900 text-[18px] font-semibold tracking-tight dark:fill-slate-100"
            >
              {moneyCompact(total, currency)}
            </text>
          </svg>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {normalized.map((slice) => {
            const portion = total > 0 ? (slice.value / total) * 100 : 0;
            return (
              <div
                key={slice.label}
                className="rounded-xl border border-slate-200/80 px-3 py-2 dark:border-slate-700/80"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
                      {slice.label}
                    </span>
                  </div>
                  <div className="text-xs font-medium tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    {pct(portion)}
                  </div>
                </div>
                <div className="mt-1 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {moneyCompact(slice.value, currency)}
                </div>
              </div>
            );
          })}

          {normalized.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Add net worth balances to see allocation.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
