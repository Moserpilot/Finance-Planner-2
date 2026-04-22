/** @type {import('next').NextConfig} */
const isMobileBuild = process.env.CAPACITOR === 'true';

const nextConfig = {
  // Static export for Capacitor mobile builds only.
  // Desktop dev server (npm run dev) is unaffected.
  ...(isMobileBuild && { output: 'export' }),

  // Required for static export — disables Next.js image optimisation
  // (the app uses SVGs / plain <img> so this has no visible effect)
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
