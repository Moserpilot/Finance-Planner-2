import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ClientShell } from './components/ClientShell';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1d4ed8',
};

export const metadata: Metadata = {
  title: 'NetWorth Finance Planner',
  description: 'Track net worth, plan cash flow, and project your financial future. 100% private — data never leaves your device.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NetWorth',
    startupImage: [],
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('fp_theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-white">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
