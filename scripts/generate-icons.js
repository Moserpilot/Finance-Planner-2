/**
 * generate-icons.js
 * Generates app icons for the NetWorth Finance Planner.
 * Run: npm run icons
 *
 * Produces:
 *   public/icon-192.png           — PWA manifest icon (192×192)
 *   public/icon-512.png           — PWA manifest icon (512×512)
 *   public/apple-touch-icon.png   — iOS home screen icon (180×180)
 *   resources/icon.png            — Capacitor App Store / Play Store (1024×1024)
 *   resources/icon-foreground.png — Android adaptive icon foreground (1024×1024)
 *   resources/splash.png          — Capacitor splash screen (2732×2732)
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const PUBLIC = path.join(__dirname, '..', 'public');
const RES    = path.join(__dirname, '..', 'resources');

fs.mkdirSync(PUBLIC, { recursive: true });
fs.mkdirSync(RES,    { recursive: true });

// ── NetWorth icon SVG ──────────────────────────────────────────────────────
// Blue→green gradient background, rounded square, rising chart line + arrow tick.
// Matches the logo used in the sidebar and mobile header.
function netWorthIconSvg(size, { rounded = true } = {}) {
  const s  = size;
  // Corner radius: 25% of size (matches rx="7" on 28px original)
  const rx = rounded ? Math.round(s * 0.25) : 0;

  // Scale factor from the 28×28 original logo
  const sc = s / 28;

  // Chart line points (scaled from: 5,20 10,14 15,16 23,8)
  const line = [
    [5, 20], [10, 14], [15, 16], [23, 8],
  ].map(([x, y]) => `${(x * sc).toFixed(1)},${(y * sc).toFixed(1)}`).join(' ');

  // Arrow tick (scaled from: 19,8 23,8 23,12)
  const arrow = [
    [19, 8], [23, 8], [23, 12],
  ].map(([x, y]) => `${(x * sc).toFixed(1)},${(y * sc).toFixed(1)}`).join(' ');

  // Stroke width scaled from 2.2
  const sw = Math.max(1, (2.2 * sc).toFixed(1));

  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="${s}" y2="${s}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <!-- Subtle inner glow on the chart line area -->
    <linearGradient id="glow" x1="0" y1="0" x2="${s}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.0)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.15)"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${s}" height="${s}" rx="${rx}" fill="url(#grad)"/>

  <!-- Subtle bottom-right highlight -->
  <rect width="${s}" height="${s}" rx="${rx}" fill="url(#glow)"/>

  <!-- Chart line -->
  <polyline points="${line}"
    fill="none" stroke="white" stroke-width="${sw}"
    stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Arrow tick at end of line -->
  <polyline points="${arrow}"
    fill="none" stroke="white" stroke-width="${sw}"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// ── Capacitor splash SVG ───────────────────────────────────────────────────
function splashSvg(size) {
  const s    = size;
  const icon = Math.round(s * 0.18);   // icon size
  const ix   = Math.round((s - icon) / 2);
  const iy   = Math.round(s * 0.38);
  const fs1  = Math.round(s * 0.042);  // app name font size
  const fs2  = Math.round(s * 0.018);  // tagline font size
  const ty   = Math.round(iy + icon + s * 0.07);

  return `<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${s}" height="${s}" fill="#0f172a"/>

  <!-- App icon centred -->
  <image href="data:image/svg+xml;base64,${Buffer.from(netWorthIconSvg(icon)).toString('base64')}"
    x="${ix}" y="${iy}" width="${icon}" height="${icon}"/>

  <!-- App name -->
  <text x="50%" y="${ty}"
    font-family="Arial Black, Arial, sans-serif"
    font-size="${fs1}" font-weight="900"
    fill="#ffffff" text-anchor="middle">NetWorth</text>

  <!-- Tagline -->
  <text x="50%" y="${ty + fs1 + Math.round(s * 0.018)}"
    font-family="Arial, sans-serif"
    font-size="${fs2}" font-weight="400"
    fill="#94a3b8" text-anchor="middle">Finance Planner</text>
</svg>`;
}

// ── generate ───────────────────────────────────────────────────────────────
async function run() {
  console.log('Generating NetWorth icons…\n');

  // PWA manifest icons (rounded corners visible in browser / Android)
  await sharp(Buffer.from(netWorthIconSvg(512)))
    .resize(192, 192)
    .png()
    .toFile(path.join(PUBLIC, 'icon-192.png'));
  console.log('  ✓ public/icon-192.png  (192×192)');

  await sharp(Buffer.from(netWorthIconSvg(512)))
    .png()
    .toFile(path.join(PUBLIC, 'icon-512.png'));
  console.log('  ✓ public/icon-512.png  (512×512)');

  // iOS PWA home screen icon (no rounded corners — iOS clips automatically)
  await sharp(Buffer.from(netWorthIconSvg(180, { rounded: false })))
    .png()
    .toFile(path.join(PUBLIC, 'apple-touch-icon.png'));
  console.log('  ✓ public/apple-touch-icon.png  (180×180)');

  // Capacitor app store icon (no rounded corners — stores add their own)
  await sharp(Buffer.from(netWorthIconSvg(1024, { rounded: false })))
    .png()
    .toFile(path.join(RES, 'icon.png'));
  console.log('  ✓ resources/icon.png  (1024×1024)');

  await sharp(Buffer.from(netWorthIconSvg(1024, { rounded: false })))
    .png()
    .toFile(path.join(RES, 'icon-foreground.png'));
  console.log('  ✓ resources/icon-foreground.png  (Android adaptive foreground)');

  // Capacitor splash screen
  await sharp(Buffer.from(splashSvg(2732)))
    .png()
    .toFile(path.join(RES, 'splash.png'));
  console.log('  ✓ resources/splash.png  (2732×2732)');

  console.log('\nDone! Run "npx @capacitor/assets generate" to auto-size for all devices.');
}

run().catch(err => { console.error(err); process.exit(1); });
