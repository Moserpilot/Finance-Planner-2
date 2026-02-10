// app/layout.tsx
'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        'flex items-center rounded-xl px-3 py-2 text-sm font-medium transition ' +
        (active
          ? 'bg-[hsl(var(--accent)/0.14)] text-slate-900 dark:bg-[hsl(var(--accent)/0.22)] dark:text-white'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10')
      }
    >
      {label}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/';

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-white">
        <div className="flex min-h-screen">
          <aside className="w-64 border-r border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-white/[0.04]">
            <div className="px-4 py-5">
              <div className="mb-6 rounded-2xl bg-[hsl(var(--accent)/0.10)] p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Finance Planner
                </div>
              </div>

              <nav className="space-y-1">
                <NavLink href="/" label="Dashboard" active={pathname === '/'} />
                <NavLink
                  href="/income"
                  label="Income"
                  active={pathname.startsWith('/income')}
                />
                <NavLink
                  href="/expenses"
                  label="Expenses"
                  active={pathname.startsWith('/expenses')}
                />
                <NavLink
                  href="/assumptions"
                  label="Assumptions"
                  active={pathname.startsWith('/assumptions')}
                />
              </nav>
            </div>
          </aside>

          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
