'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { amountForMonth } from '../lib/engine';
import type { Plan } from '../lib/store';
import { createDefaultPlan, loadPlan, savePlan } from '../lib/store';

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  // BOM so Excel opens with correct encoding
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function exportCashFlowCSV(plan: Plan) {
  const rows: (string | number)[][] = [
    ['Month', 'Recurring Income', 'One-time Income', 'Recurring Expenses', 'One-time Expenses', 'Net', 'Cumulative'],
  ];
  let cumulative = 0;
  for (let i = 0; i < 60; i++) {
    const monthISO = addMonthsISO(plan.startMonthISO || '2026-01', i);
    const recurringIncome = (plan.income || []).reduce((s, x) => s + amountForMonth(x, monthISO), 0);
    const recurringExpenses = (plan.expenses || []).reduce((s, x) => s + amountForMonth(x, monthISO), 0);
    const oneTimeIncome = (plan.oneTimeIncome || []).filter(x => x.monthISO === monthISO).reduce((s, x) => s + x.amount, 0);
    const oneTimeExpenses = (plan.oneTimeExpenses || []).filter(x => x.monthISO === monthISO).reduce((s, x) => s + x.amount, 0);
    const net = recurringIncome + oneTimeIncome - recurringExpenses - oneTimeExpenses;
    cumulative += net;
    rows.push([monthISO, recurringIncome, oneTimeIncome, recurringExpenses, oneTimeExpenses, net, cumulative]);
  }
  downloadCSV(`cashflow_${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportAccountsCSV(plan: Plan) {
  const rows: (string | number)[][] = [['Account', 'Type', 'Month', 'Balance']];
  for (const acct of plan.netWorthAccounts || []) {
    const sorted = [...(acct.balances || [])].sort((a, b) => a.monthISO.localeCompare(b.monthISO));
    for (const b of sorted) {
      rows.push([acct.name, acct.type, b.monthISO, b.amount]);
    }
  }
  if (rows.length === 1) rows.push(['No account balances entered yet', '', '', '']);
  downloadCSV(`accounts_${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportItemsCSV(plan: Plan) {
  const rows: (string | number)[][] = [['Type', 'Kind', 'Name', 'Default Amount', 'Category', 'Behavior', 'End Month']];
  for (const item of plan.income || []) {
    rows.push(['Recurring', 'Income', item.name, item.defaultAmount, '', item.behavior, item.endMonthISO || '']);
  }
  for (const item of plan.expenses || []) {
    rows.push(['Recurring', 'Expense', item.name, item.defaultAmount, item.category || '', item.behavior, item.endMonthISO || '']);
  }
  for (const item of plan.oneTimeIncome || []) {
    rows.push(['One-time', 'Income', item.name, item.amount, '', '', item.monthISO]);
  }
  for (const item of plan.oneTimeExpenses || []) {
    rows.push(['One-time', 'Expense', item.name, item.amount, item.category || '', '', item.monthISO]);
  }
  if (rows.length === 1) rows.push(['No income or expense items yet', '', '', '', '', '', '']);
  downloadCSV(`items_${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

type ThemeMode = 'system' | 'light' | 'dark';

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  useEffect(() => {
    const stored = localStorage.getItem('fp_theme');
    if (stored === 'light' || stored === 'dark') setTheme(stored);
    else setTheme('system');
  }, []);
  function apply(t: ThemeMode) {
    setTheme(t);
    if (t === 'dark') {
      localStorage.setItem('fp_theme', 'dark');
      document.documentElement.classList.add('dark');
    } else if (t === 'light') {
      localStorage.setItem('fp_theme', 'light');
      document.documentElement.classList.remove('dark');
    } else {
      localStorage.removeItem('fp_theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  }
  const options: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'system', label: 'System', icon: '💻' },
    { value: 'light',  label: 'Light',  icon: '☀️' },
    { value: 'dark',   label: 'Dark',   icon: '🌙' },
  ];
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
      {options.map(o => (
        <button key={o.value} onClick={() => apply(o.value)}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all ${theme === o.value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
          <span>{o.icon}</span>{o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    setPlan(loadPlan());
  }, []);

  const json = useMemo(() => {
    if (!plan) return '';
    return JSON.stringify(plan, null, 2);
  }, [plan]);

  function exportBackup() {
    if (!plan) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`finance-planner-backup_${ts}.json`, json);
    setStatus('Backup downloaded.');
    setTimeout(() => setStatus(''), 2500);
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
      if (!('income' in parsed) || !('expenses' in parsed)) throw new Error('Not a planner backup');
      savePlan(parsed as Plan);
      setPlan(loadPlan());
      setStatus('Import complete.');
      setTimeout(() => setStatus(''), 2500);
    } catch (e: any) {
      setStatus(`Import failed: ${e?.message || 'Unknown error'}`);
      setTimeout(() => setStatus(''), 4000);
    }
  }

  function resetAll() {
    if (!confirm('This will clear your local plan on this device/browser. Continue?')) return;
    const fresh = createDefaultPlan();
    savePlan(fresh);
    setPlan(fresh);
    setStatus('Local data cleared.');
    setTimeout(() => setStatus(''), 2500);
  }

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Backup, restore, and local-only storage</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Appearance</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose light, dark, or follow your device setting.</div>
        <div className="mt-4"><ThemeToggle /></div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Backup</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your plan is stored locally in your browser. Use backups to move between devices.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={exportBackup}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            Download backup (.json)
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/5">
            Import backup
          </button>
          <button type="button" onClick={resetAll}
            className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10">
            Clear local data
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importBackup(f);
            e.currentTarget.value = '';
          }}
        />
        {status ? <div className="mt-3 text-sm text-slate-900 dark:text-slate-100">{status}</div> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Export to CSV</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Download your data as spreadsheet files. Opens in Excel, Numbers, or Google Sheets.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => exportCashFlowCSV(plan)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/5">
            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m3 6v-3m3 3v-9M3 19h18" /></svg>
            Cash Flow (60 mo)
          </button>
          <button type="button" onClick={() => exportAccountsCSV(plan)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/5">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" /></svg>
            Account Balances
          </button>
          <button type="button" onClick={() => exportItemsCSV(plan)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/5">
            <svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            Income &amp; Expenses
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Advanced</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          This app does not send data to any server. All data is stored locally in your browser.
        </div>
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-900 dark:text-slate-400">Current plan JSON (read-only)</div>
          <pre className="mt-2 max-h-[260px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100">
            {json}
          </pre>
        </div>
      </div>
    </div>
  );
}