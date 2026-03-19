"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarAssumptions } from "./SidebarAssumptions";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        "flex items-center rounded-xl px-3 py-2 text-sm font-medium transition " +
        (active
          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10")
      }
    >
      {label}
    </Link>
  );
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
        <div className="px-4 py-5">
          <div className="mb-6 rounded-2xl bg-blue-50 p-4 dark:bg-blue-500/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Finance Planner
            </div>
          </div>
          <nav className="space-y-1">
            <NavLink href="/" label="Dashboard" active={pathname === "/"} />
            <NavLink href="/income" label="Income" active={pathname.startsWith("/income")} />
            <NavLink href="/expenses" label="Expenses" active={pathname.startsWith("/expenses")} />
            <NavLink href="/net-worth" label="Net Worth" active={pathname.startsWith("/net-worth")} />
            <NavLink href="/assumptions" label="Assumptions" active={pathname.startsWith("/assumptions")} />
            <NavLink href="/cashflow" label="Cashflow" active={pathname.startsWith("/cashflow")} />
            <NavLink href="/settings" label="Settings" active={pathname.startsWith("/settings")} />
          </nav>
          <SidebarAssumptions />
        </div>
      </aside>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
