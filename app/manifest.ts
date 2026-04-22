import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NetWorth Finance Planner',
    short_name: 'NetWorth',
    description: 'Track net worth, plan cash flow, project your financial future.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#1d4ed8',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
