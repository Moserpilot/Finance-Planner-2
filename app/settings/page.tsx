'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { amountForMonth } from '../lib/engine';
import type { Plan } from '../lib/store';
import { createDefaultPlan, loadPlan, savePlan, savePlanFromSync } from '../lib/store';
import { addMonthsISO } from '../lib/utils';
import {
  syncPlan, forcePushToServer, forcePullFromServer, pingServer, getLastSynced, getPreSyncBackup, clearPreSyncBackup,
  relativeTime, LAST_SYNCED_KEY,
} from '../lib/sync';

// ─── Sync section ─────────────────────────────────────────────────────────────

type SyncState = 'idle' | 'syncing' | 'ok' | 'offline' | 'error';

function SyncSection({ plan, onPlanUpdated }: { plan: Plan; onPlanUpdated: (p: Plan) => void }) {
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState('');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [hostUrls, setHostUrls] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const backup = getPreSyncBackup();

  // Refresh "X min ago" every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Listen for sync updates from ClientShell
  useEffect(() => {
    function refresh() { setLastSynced(getLastSynced()); }
    refresh();
    window.addEventListener('fp_sync_updated', refresh);
    window.addEventListener(LAST_SYNCED_KEY, refresh);
    return () => {
      window.removeEventListener('fp_sync_updated', refresh);
      window.removeEventListener(LAST_SYNCED_KEY, refresh);
    };
  }, []);

  // Fetch host info + build QR code
  useEffect(() => {
    async function loadHostInfo() {
      try {
        const res = await fetch('/api/sync/host-info');
        if (!res.ok) return;
        const { ips, port }: { ips: string[]; port: string } = await res.json();
        const urls = ips.map(ip => `http://${ip}:${port}`);
        setHostUrls(urls);
        if (urls[0]) {
          const dataUrl = await QRCode.toDataURL(urls[0], { width: 180, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
          setQrDataUrl(dataUrl);
        }
      } catch { /* host info unavailable */ }
    }
    loadHostInfo();
  }, []);

  const handleSyncNow = useCallback(async () => {
    setState('syncing');
    setMessage('');
    const serverUrl = window.location.origin;
    const reachable = await pingServer(serverUrl);
    if (!reachable) {
      setState('offline');
      setMessage('Sync server not reachable.');
      return;
    }
    const result = await syncPlan(plan, serverUrl);
    if (result.status === 'pulled' && 'plan' in result) {
      savePlanFromSync(result.plan as Plan);
      onPlanUpdated(loadPlan());
    }
    setState(result.status === 'error' ? 'error' : 'ok');
    setMessage(result.message);
    setLastSynced(getLastSynced());
    setTimeout(() => { setState('idle'); setMessage(''); }, 4000);
  }, [plan, onPlanUpdated]);

  const handleForcePush = useCallback(async () => {
    setState('syncing');
    setMessage('');
    const serverUrl = window.location.origin;
    const result = await forcePushToServer(plan, serverUrl);
    setState(result.status === 'error' ? 'error' : 'ok');
    setMessage(result.message);
    setLastSynced(getLastSynced());
    setTimeout(() => { setState('idle'); setMessage(''); }, 5000);
  }, [plan]);

  const handleForcePull = useCallback(async () => {
    setState('syncing');
    setMessage('');
    const serverUrl = window.location.origin;
    const result = await forcePullFromServer(serverUrl);
    if (result.status === 'pulled' && 'plan' in result) {
      savePlanFromSync(result.plan as Plan);
      onPlanUpdated(loadPlan());
    }
    setState(result.status === 'error' ? 'error' : result.status === 'no_data' ? 'error' : 'ok');
    setMessage(result.message);
    setLastSynced(getLastSynced());
    setTimeout(() => { setState('idle'); setMessage(''); }, 5000);
  }, [onPlanUpdated]);

  const handleRestoreBackup = useCallback(() => {
    if (!backup) return;
    if (!confirm('Restore the pre-sync backup? This will overwrite your current plan.')) return;
    savePlan(backup.plan as Plan);
    onPlanUpdated(loadPlan());
    clearPreSyncBackup();
  }, [backup, onPlanUpdated]);

  const dotColor =
    state === 'syncing' ? 'bg-yellow-400 animate-pulse' :
    state === 'ok'      ? 'bg-emerald-500' :
    state === 'offline' || state === 'error' ? 'bg-rose-500' :
    'bg-slate-300 dark:bg-slate-600';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">WiFi Sync</div>
          <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-200">
            Same-network sync. No cloud. Data stays on your devices.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
          <span className="text-xs text-slate-500 dark:text-slate-200">
            {lastSynced ? relativeTime(lastSynced) : 'Not synced yet'}
          </span>
        </div>
      </div>

      {message && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${state === 'error' || state === 'offline' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
          {message}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {/* Normal auto sync */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleSyncNow} disabled={state === 'syncing'}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
            {state === 'syncing' ? 'Syncing…' : 'Sync Now'}
          </button>
          {backup && (
            <button type="button" onClick={handleRestoreBackup}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-500/10 dark:text-amber-300">
              Restore pre-sync backup
            </button>
          )}
        </div>
        {/* Manual override buttons */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Manual override</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleForcePush} disabled={state === 'syncing'}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
              ↑ Upload my data (desktop)
            </button>
            <button type="button" onClick={handleForcePull} disabled={state === 'syncing'}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              ↓ Download to this device (phone)
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">If sync is stuck: tap Upload on desktop first, then Download on phone.</div>
        </div>
      </div>

      {(qrDataUrl || hostUrls.length > 0) && (
        <div className="mt-5 flex flex-wrap items-start gap-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          {qrDataUrl && (
            <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-white">
              <img src={qrDataUrl} alt="Sync QR code" width={160} height={160} />
            </div>
          )}
          <div className="flex-1 min-w-[180px]">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Open on another device</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-200">
              Scan the QR code, or type one of these addresses into any browser on the same WiFi:
            </div>
            <div className="mt-2 space-y-1">
              {hostUrls.map(url => (
                <div key={url} className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">{url}</div>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-400 dark:text-slate-300">
              Sync is automatic — both devices stay up to date. Newer changes always win.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    const stored = localStorage.getItem('fp_dark_mode');
    if (stored === '1') setTheme('dark');
    else if (stored === '0') setTheme('light');
    else setTheme('system');
  }, []);
  function apply(t: ThemeMode) {
    setTheme(t);
    if (t === 'dark') {
      localStorage.setItem('fp_dark_mode', '1');
      document.documentElement.classList.add('dark');
    } else if (t === 'light') {
      localStorage.setItem('fp_dark_mode', '0');
      document.documentElement.classList.remove('dark');
    } else {
      localStorage.removeItem('fp_dark_mode');
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
    localStorage.removeItem('finance_planner_onboarded_v1');
    const fresh = createDefaultPlan();
    savePlan(fresh);
    window.location.href = '/';
  }

  if (!plan) {
    return <div className="text-sm text-slate-500 dark:text-slate-200">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</div>
        <div className="text-sm text-slate-500 dark:text-slate-200">Appearance, sync, and data management — everything stays on your device.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Appearance</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-200">Choose light, dark, or follow your device setting.</div>
        <div className="mt-4"><ThemeToggle /></div>
      </div>

      <SyncSection plan={plan} onPlanUpdated={setPlan} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Backup</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-200">
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
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-200">
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
            Income & Expenses
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Advanced</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-200">
          This app does not send data to any server. All data is stored locally in your browser.
        </div>
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-900 dark:text-slate-100">Current plan data (read-only)</div>
          <pre className="mt-2 max-h-[260px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100">
            {json}
          </pre>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <a href="/privacy" className="text-xs text-slate-400 dark:text-slate-300 hover:underline">Privacy Policy</a>
        <p className="text-xs text-slate-400 dark:text-slate-500">For informational purposes only. Not financial advice.</p>
      </div>
    </div>
  );
}