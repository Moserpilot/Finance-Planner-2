import './globals.css';
import { ClientShell } from './components/ClientShell';

export const metadata = {
  title: 'Finance Planner',
  description: 'Personal financial planning tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-white">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
