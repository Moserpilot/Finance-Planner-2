"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarAssumptions } from "./SidebarAssumptions";
import { loadPlan, savePlanFromSync } from "../lib/store";
import { syncPlan, LAST_SYNCED_KEY } from "../lib/sync";

function IconDashboard({ active }: { active: boolean }) {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>);
}
function IconIncome({ active }: { active: boolean }) {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>);
}
function IconExpenses({ active }: { active: boolean }) {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>);
}
function IconNetWorth({ active }: { active: boolean }) {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>);
}
function IconMore({ active }: { active: boolean }) {
  return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.2:1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>);
}
function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
function IconEye({ hidden }: { hidden: boolean }) {
  if (hidden) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={"flex items-center rounded-xl px-3 py-2 text-sm font-medium transition "+(active?"bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300":"text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10")}>
      {label}
    </Link>
  );
}

function TabItem({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <Link href={href} className={"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors "+(active?"text-blue-600 dark:text-blue-400":"text-slate-500 dark:text-slate-400")}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MoreMenu({ isMore, onClose }: { isMore: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden" onClick={onClose}>
      <div className="mx-3 mb-20 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">More</div>
        <Link href="/budget" onClick={onClose} className="flex items-center px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800">Budget</Link>
        <Link href="/assumptions" onClick={onClose} className="flex items-center px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800">Assumptions</Link>
        <Link href="/cashflow" onClick={onClose} className="flex items-center px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800">Cash Flow</Link>
        <Link href="/settings" onClick={onClose} className="flex items-center px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">Settings</Link>
      </div>
    </div>
  );
}

// ─── background sync ─────────────────────────────────────────────────────────

let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function runSync() {
  try {
    const plan = loadPlan();
    const serverUrl = window.location.origin;
    const result = await syncPlan(plan, serverUrl);
    if (result.status === 'pulled' && 'plan' in result) {
      // Re-read local plan after the network call — user may have saved during the request.
      // Only overwrite if the server plan is genuinely newer than the current local plan,
      // and its timestamp is not in the future (guards against corrupted sync files).
      const currentPlan = loadPlan();
      const currentMs = currentPlan?.savedAt ? new Date(currentPlan.savedAt).getTime() : 0;
      const remoteMs = (result.plan as any)?.savedAt ? new Date((result.plan as any).savedAt).getTime() : 0;
      const nowMs = Date.now();
      if (remoteMs > currentMs && remoteMs <= nowMs + 60_000) {
        savePlanFromSync(result.plan as any);
      }
    }
    if (result.status !== 'error') {
      localStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
      window.dispatchEvent(new Event('fp_sync_updated'));
    }
  } catch {
    // sync is best-effort — never crash the app
  }
}

function schedulePush() {
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(runSync, 5000);
}

// ─── shell component ──────────────────────────────────────────────────────────

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [mounted, setMounted] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [balancesHidden, setBalancesHidden] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  function toggleBalances() {
    const next = !balancesHidden;
    setBalancesHidden(next);
    localStorage.setItem('fp_hide_balances', next ? '1' : '0');
    if (next) document.documentElement.classList.add('balances-hidden');
    else document.documentElement.classList.remove('balances-hidden');
  }

  function toggleDark() {
    const isDark = document.documentElement.classList.contains('dark');
    const next = !isDark;
    setDarkMode(next);
    localStorage.setItem('fp_dark_mode', next ? '1' : '0');
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }

  useEffect(() => {
    setMounted(true);
    // Restore balance visibility preference
    if (localStorage.getItem('fp_hide_balances') === '1') {
      setBalancesHidden(true);
      document.documentElement.classList.add('balances-hidden');
    }
    // Restore dark mode preference
    const darkPref = localStorage.getItem('fp_dark_mode');
    if (darkPref === '1') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else if (darkPref === null) {
      // No preference set — follow system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
      if (prefersDark) document.documentElement.classList.add('dark');
    }
    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* ignore */});
    }
    // Initial sync on load
    runSync();
    // Push to server whenever the user saves (but not when we pulled from sync)
    function onPlanUpdated(e: Event) {
      if ((e as CustomEvent).detail?.fromSync) return;
      schedulePush();
    }
    window.addEventListener('finance_planner_plan_updated', onPlanUpdated);
    return () => window.removeEventListener('finance_planner_plan_updated', onPlanUpdated);
  }, []);
  const isMore = pathname.startsWith("/assumptions") || pathname.startsWith("/cashflow") || pathname.startsWith("/settings") || pathname.startsWith("/budget");
  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
        <div className="px-4 py-5 flex-1 overflow-y-auto">
          <div className="mb-6 flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
            <div className="flex items-center gap-2">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="26" height="26" rx="7" fill="url(#logo-g)"/>
                <polyline points="5,18 10,12 14,15 21,7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="18,7 21,7 21,10" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <defs><linearGradient id="logo-g" x1="0" y1="0" x2="26" y2="26" gradientUnits="userSpaceOnUse"><stop stopColor="#1d4ed8"/><stop offset="1" stopColor="#059669"/></linearGradient></defs>
              </svg>
              <div>
                <div className="text-xs font-bold text-blue-700 dark:text-blue-300 leading-none">NetWorth</div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-none mt-0.5">Finance Planner</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleDark} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                className="rounded-lg p-1 text-slate-500 hover:bg-blue-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-blue-500/20 dark:hover:text-slate-100">
                {darkMode ? <IconSun /> : <IconMoon />}
              </button>
              <button onClick={toggleBalances} title={balancesHidden ? "Show balances" : "Hide balances"}
                className="rounded-lg p-1 text-slate-500 hover:bg-blue-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-blue-500/20 dark:hover:text-slate-100">
                <IconEye hidden={balancesHidden} />
              </button>
            </div>
          </div>
          <nav className="space-y-0.5">
            <NavLink href="/" label="Dashboard" active={mounted && pathname==="/"} />
            <NavLink href="/income" label="Income" active={mounted && pathname.startsWith("/income")} />
            <NavLink href="/expenses" label="Expenses" active={mounted && pathname.startsWith("/expenses")} />
            <NavLink href="/budget" label="Budget" active={mounted && pathname.startsWith("/budget")} />
            <NavLink href="/net-worth" label="Net Worth" active={mounted && pathname.startsWith("/net-worth")} />
            <NavLink href="/assumptions" label="Assumptions" active={mounted && pathname.startsWith("/assumptions")} />
            <NavLink href="/cashflow" label="Cash Flow" active={mounted && pathname.startsWith("/cashflow")} />
            <NavLink href="/settings" label="Settings" active={mounted && pathname.startsWith("/settings")} />
          </nav>
          <SidebarAssumptions />
        </div>
      </aside>
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <header className="flex lg:hidden items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-black/80">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="26" height="26" rx="7" fill="url(#logo-m)"/>
              <polyline points="5,18 10,12 14,15 21,7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="18,7 21,7 21,10" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="logo-m" x1="0" y1="0" x2="26" y2="26" gradientUnits="userSpaceOnUse"><stop stopColor="#1d4ed8"/><stop offset="1" stopColor="#059669"/></linearGradient></defs>
            </svg>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">NetWorth</div>
              <div className="text-[10px] font-medium text-slate-400 leading-none mt-0.5">Finance Planner</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleDark} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-slate-100">
              {darkMode ? <IconSun /> : <IconMoon />}
            </button>
            <button onClick={toggleBalances} title={balancesHidden ? "Show balances" : "Hide balances"}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-slate-100">
              <IconEye hidden={balancesHidden} />
            </button>
          </div>
        </header>
        <main className="balance-blur flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-6" style={{ WebkitOverflowScrolling: "touch" }}>{children}</main>
      </div>
      {mounted && (
        <>
          {showMore && <MoreMenu isMore={isMore} onClose={() => setShowMore(false)} />}
          <nav className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-black/90" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <TabItem href="/" label="Dashboard" active={!showMore && pathname==="/"} icon={<IconDashboard active={!showMore && pathname==="/"} />} />
            <TabItem href="/income" label="Income" active={!showMore && pathname.startsWith("/income")} icon={<IconIncome active={!showMore && pathname.startsWith("/income")} />} />
            <TabItem href="/expenses" label="Expenses" active={!showMore && pathname.startsWith("/expenses")} icon={<IconExpenses active={!showMore && pathname.startsWith("/expenses")} />} />
            <TabItem href="/net-worth" label="Net Worth" active={!showMore && pathname.startsWith("/net-worth")} icon={<IconNetWorth active={!showMore && pathname.startsWith("/net-worth")} />} />
            <button onClick={() => setShowMore(s => !s)} className={"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors "+(showMore||isMore?"text-blue-600 dark:text-blue-400":"text-slate-500 dark:text-slate-400")}>
              <IconMore active={showMore||isMore} />
              <span>More</span>
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
