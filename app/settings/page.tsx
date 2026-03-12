// app/settings/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan } from '../lib/store';
import { loadPlan, savePlan } from '../lib/store';

const STORAGE_KEY = 'cashflow_planner_plan_v1';

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

export default function SettingsPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    setPlan(loadPlan());
  }, []);

  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  const json = useMemo(() => {
    if (!plan) return '';
    return JSON.stringify(plan, null, 2);
  }, [plan]);

  function exportBackup() {
    if (!plan) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`cash-flow-net-worth-backup_${ts}.json`, json);
    setStatus('Backup downloaded.');
    setTimeout(() => setStatus(''), 2500);
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Minimal safety checks
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setPlan(loadPlan());
    setStatus('Local data cleared.');
    setTimeout(() => setStatus(''), 2500);
  }

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Backup, restore, and local-only storage</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Backup</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your plan is stored locally in your browser. Use backups to move between devices.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportBackup}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Download backup (.json)
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Import backup
          </button>

          <button
            type="button"
            onClick={resetAll}
            className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            Clear local data
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importBackup(f);
            e.currentTarget.value = '';
          }}
        />

        {status ? (
          <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">{status}</div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Advanced</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          If you use GitHub, commit backups there too. This app does not send data to any server.
        </div>
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Current plan JSON (read-only)</div>
          <pre className="mt-2 max-h-[260px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
            {json}
          </pre>
        </div>
      </div>
    </div>
  );
}
