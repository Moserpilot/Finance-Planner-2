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

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={"flex items-center rounded-xl px-3 py-2 text-sm font-medium transition "+(active?"bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300":"text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10")}>
      {label}
    </Link>
  );
}

function TabItem({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <Link href={href} className={"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors "+(active?"text-blue-600 dark:text-blue-400":"text-slate-500 dark:text-slate-500")}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MoreMenu({ isMore, onClose }: { isMore: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end md:hidden" onClick={onClose}>
      <div className="mx-3 mb-20 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">More</div>
        <Link href="/budget" onClick={onClose} className="flex items-center px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800">Budget</Link>
        <Link href="/assumptions" onClick={onClose} className="flex items-center px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800">Assumptions</Link>
        <Link href="/cashflow" onClick={onClose} className="flex items-center px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800">Cashflow</Link>
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
      savePlanFromSync(result.plan as any);
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

  useEffect(() => {
    setMounted(true);
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
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
        <div className="px-4 py-5 flex-1 overflow-y-auto">
          <div className="mb-6 rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Finance Planner</div>
          </div>
          <nav className="space-y-0.5">
            <NavLink href="/" label="Dashboard" active={mounted && pathname==="/"} />
            <NavLink href="/income" label="Income" active={mounted && pathname.startsWith("/income")} />
            <NavLink href="/expenses" label="Expenses" active={mounted && pathname.startsWith("/expenses")} />
            <NavLink href="/budget" label="Budget" active={mounted && pathname.startsWith("/budget")} />
            <NavLink href="/net-worth" label="Net Worth" active={mounted && pathname.startsWith("/net-worth")} />
            <NavLink href="/assumptions" label="Assumptions" active={mounted && pathname.startsWith("/assumptions")} />
            <NavLink href="/cashflow" label="Cashflow" active={mounted && pathname.startsWith("/cashflow")} />
            <NavLink href="/settings" label="Settings" active={mounted && pathname.startsWith("/settings")} />
          </nav>
          <SidebarAssumptions />
        </div>
      </aside>
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <header className="flex md:hidden items-center border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-black/80">
          <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Finance Planner</span>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-6" style={{ WebkitOverflowScrolling: "touch" }}>{children}</main>
      </div>
      {mounted && (
        <>
          {showMore && <MoreMenu isMore={isMore} onClose={() => setShowMore(false)} />}
          <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-black/90" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <TabItem href="/" label="Dashboard" active={!showMore && pathname==="/"} icon={<IconDashboard active={!showMore && pathname==="/"} />} />
            <TabItem href="/income" label="Income" active={!showMore && pathname.startsWith("/income")} icon={<IconIncome active={!showMore && pathname.startsWith("/income")} />} />
            <TabItem href="/expenses" label="Expenses" active={!showMore && pathname.startsWith("/expenses")} icon={<IconExpenses active={!showMore && pathname.startsWith("/expenses")} />} />
            <TabItem href="/net-worth" label="Net Worth" active={!showMore && pathname.startsWith("/net-worth")} icon={<IconNetWorth active={!showMore && pathname.startsWith("/net-worth")} />} />
            <button onClick={() => setShowMore(s => !s)} className={"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors "+(showMore||isMore?"text-blue-600 dark:text-blue-400":"text-slate-500 dark:text-slate-500")}>
              <IconMore active={showMore||isMore} />
              <span>More</span>
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
