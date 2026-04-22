/**
 * take-screenshots.js
 * Generates App Store + Google Play screenshots automatically.
 *
 * BEFORE RUNNING:
 *   1. Start the dev server:  npm run dev -- -p 3100
 *   2. Run this script:       npm run screenshots
 *
 * OUTPUT:
 *   screenshots/ios/slide-*.png      — 1290×2796  (iPhone 6.7", required)
 *   screenshots/android/slide-*.png  — 1080×1920  (Google Play phone)
 */

const puppeteer = require('puppeteer');
const sharp     = require('sharp');
const path      = require('path');
const fs        = require('fs');

// ── app URL ────────────────────────────────────────────────────────────────
const APP = 'http://localhost:3100';

// ── realistic demo data ────────────────────────────────────────────────────
const PLAN = JSON.stringify({
  currency: 'USD', startMonthISO: '2025-01', netWorthViewMonthISO: '2026-04',
  startingNetWorth: 0, goalNetWorth: 500000, expectedReturnPct: 7,
  income: [{ id:'i1', kind:'income', name:'Salary', defaultAmount:7500, behavior:'carryForward', changes:[], overrides:[] }],
  expenses: [
    { id:'e1', kind:'expense', name:'Rent',       defaultAmount:1800, behavior:'carryForward', changes:[], overrides:[], category:'Housing' },
    { id:'e2', kind:'expense', name:'Groceries',  defaultAmount:520,  behavior:'carryForward', changes:[], overrides:[], category:'Food & Dining' },
    { id:'e3', kind:'expense', name:'Gas',        defaultAmount:180,  behavior:'carryForward', changes:[], overrides:[], category:'Transport' },
    { id:'e4', kind:'expense', name:'Netflix',    defaultAmount:18,   behavior:'carryForward', changes:[], overrides:[], category:'Entertainment' },
    { id:'e5', kind:'expense', name:'Gym',        defaultAmount:45,   behavior:'carryForward', changes:[], overrides:[], category:'Healthcare' },
  ],
  oneTimeIncome: [], oneTimeExpenses: [],
  netWorthAccounts: [
    { id:'a1', name:'Checking',  type:'cash',       balances:[{monthISO:'2025-01',amount:8000},  {monthISO:'2026-04',amount:12400}] },
    { id:'a2', name:'Savings',   type:'cash',       balances:[{monthISO:'2025-01',amount:22000}, {monthISO:'2026-04',amount:38200}] },
    { id:'a3', name:'401(k)',    type:'retirement',  balances:[{monthISO:'2025-01',amount:45000}, {monthISO:'2026-04',amount:61800}] },
    { id:'a4', name:'Brokerage', type:'taxable',     balances:[{monthISO:'2025-01',amount:18000}, {monthISO:'2026-04',amount:24600}] },
  ],
  netWorthMode: 'hybrid',
  budgets: { Housing:2000, 'Food & Dining':600, Transport:220, Entertainment:50, Healthcare:80 },
  savedAt: new Date().toISOString(),
});

// ── slide definitions ──────────────────────────────────────────────────────
const SLIDES = [
  {
    id: '1-dashboard',
    url: '/', dark: true, scroll: 0,
    tagline: 'FINANCIAL CLARITY',
    line1: 'Your complete', line1Color: '#ffffff',
    line2: 'financial picture', line2Color: '#60a5fa',
    badge: '100% private  ·  stored on your device',
    bgFrom: '#0a1628', bgTo: '#1e3a8a',
  },
  {
    id: '2-networth',
    url: '/net-worth', dark: true, scroll: 0,
    tagline: 'ALL ACCOUNTS, ONE PLACE',
    line1: 'Track every dollar', line1Color: '#34d399',
    line2: 'you own', line2Color: '#ffffff',
    badge: 'Checking  ·  Savings  ·  401(k)  ·  Brokerage',
    bgFrom: '#0a1628', bgTo: '#064e3b',
  },
  {
    id: '3-budget',
    url: '/budget', dark: true, scroll: 0,
    tagline: 'SPEND SMARTER',
    line1: 'Know where every', line1Color: '#ffffff',
    line2: 'dollar is going', line2Color: '#a78bfa',
    badge: 'Visual spending categories with live progress',
    bgFrom: '#0a1628', bgTo: '#2e1065',
  },
  {
    id: '4-cashflow',
    url: '/cashflow', dark: false, scroll: 0,
    tagline: 'PLAN MONTHS AHEAD',
    line1: 'Project your', line1Color: '#ffffff',
    line2: 'financial future', line2Color: '#60a5fa',
    badge: '24-month cash flow · income · expenses · savings',
    bgFrom: '#0f172a', bgTo: '#1e293b',
  },
  {
    id: '5-projection',
    url: '/', dark: true, scroll: 480,
    tagline: 'SEE THE FINISH LINE',
    line1: 'Know exactly when', line1Color: '#ffffff',
    line2: "you'll hit your goal", line2Color: '#c084fc',
    badge: 'Net worth projection  ·  On Track ✓',
    bgFrom: '#0a1628', bgTo: '#3b0764',
  },
];

// ── output formats ─────────────────────────────────────────────────────────
const FORMATS = [
  { name: 'ios',     w: 1290, h: 2796 },
  { name: 'android', w: 1080, h: 1920 },
];

// ── find system Chrome or Edge on Windows ─────────────────────────────────
function findChrome() {
  const roots = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.LOCALAPPDATA,
  ];
  // Try Chrome first, then Edge (Edge is Chromium-based and works with puppeteer)
  const candidates = [
    ['Google', 'Chrome',    'Application', 'chrome.exe'],
    ['Microsoft', 'Edge',   'Application', 'msedge.exe'],
  ];
  for (const r of roots) {
    if (!r) continue;
    for (const parts of candidates) {
      const p = path.join(r, ...parts);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── capture one app page ───────────────────────────────────────────────────
async function captureApp(page, slide) {
  await page.goto(APP + slide.url, { waitUntil: 'networkidle2', timeout: 15000 });

  // Inject demo data
  await page.evaluate(plan => {
    localStorage.setItem('finance_planner_onboarded_v1', 'done');
    localStorage.setItem('finance_planner_plan_v2', plan);
  }, PLAN);

  // Reload so the app picks up the data
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1200);

  if (slide.dark) {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sleep(150);
  }

  if (slide.scroll) {
    await page.evaluate(y => window.scrollTo(0, y), slide.scroll);
    await sleep(600);
  }

  return page.screenshot({ type: 'png' });
}

// ── SVG helpers ────────────────────────────────────────────────────────────
function svgBg(w, h, slide) {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="${slide.bgFrom}"/>
      <stop offset="100%" stop-color="${slide.bgTo}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
</svg>`;
}

function svgText(w, h, slide, phoneTopY) {
  const cx       = w / 2;
  const midY     = phoneTopY * 0.46;
  const tagSize  = Math.round(w * 0.022);
  const h1Size   = Math.round(w * 0.072);
  const lineGap  = Math.round(h1Size * 1.18);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${cx}" y="${midY - lineGap * 1.3}"
    font-family="Arial,Helvetica,sans-serif" font-size="${tagSize}" font-weight="700"
    fill="rgba(255,255,255,0.40)" text-anchor="middle" letter-spacing="3.5">${slide.tagline}</text>

  <text x="${cx}" y="${midY - lineGap * 0.12}"
    font-family="Arial Black,Arial,sans-serif" font-size="${h1Size}" font-weight="900"
    fill="${slide.line1Color}" text-anchor="middle">${slide.line1}</text>

  <text x="${cx}" y="${midY + lineGap * 1.0}"
    font-family="Arial Black,Arial,sans-serif" font-size="${h1Size}" font-weight="900"
    fill="${slide.line2Color}" text-anchor="middle">${slide.line2}</text>
</svg>`;
}

function svgPhone(pw, ph) {
  const rx      = Math.round(pw * 0.088);
  const border  = Math.round(pw * 0.022);
  const half    = border / 2;
  const niW     = Math.round(pw * 0.32);
  const niH     = Math.round(ph * 0.030);
  const niY     = Math.round(ph * 0.012);
  const btnW    = Math.round(pw * 0.022);
  const btn1Y   = Math.round(ph * 0.20);
  const btn2Y   = Math.round(ph * 0.29);
  const btn3Y   = Math.round(ph * 0.25);
  const btnH    = Math.round(ph * 0.07);
  const btn3H   = Math.round(ph * 0.11);

  return `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg">
  <!-- outer border -->
  <rect x="${half}" y="${half}" width="${pw - border}" height="${ph - border}"
    rx="${rx}" fill="none"
    stroke="rgba(255,255,255,0.22)" stroke-width="${border}"/>

  <!-- dynamic island notch -->
  <rect x="${(pw - niW) / 2}" y="${niY}" width="${niW}" height="${niH}"
    rx="${niH / 2}" fill="rgba(0,0,0,0.85)"/>

  <!-- left buttons (volume) -->
  <rect x="${-btnW * 0.6}" y="${btn1Y}" width="${btnW * 0.6}" height="${btnH}"
    rx="2" fill="rgba(255,255,255,0.14)"/>
  <rect x="${-btnW * 0.6}" y="${btn2Y}" width="${btnW * 0.6}" height="${btnH}"
    rx="2" fill="rgba(255,255,255,0.14)"/>

  <!-- right button (power) -->
  <rect x="${pw}" y="${btn3Y}" width="${btnW * 0.6}" height="${btn3H}"
    rx="2" fill="rgba(255,255,255,0.14)"/>
</svg>`;
}

function svgBadge(w, h, slide, cy) {
  const fs  = Math.round(w * 0.023);
  const px  = Math.round(w * 0.055);
  const py  = Math.round(fs * 0.6);
  const est = slide.badge.length * fs * 0.52;
  const bw  = Math.min(Math.round(est + px * 2), w - 80);
  const bh  = fs + py * 2;

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${(w - bw) / 2}" y="${cy - bh / 2}" width="${bw}" height="${bh}"
    rx="${bh / 2}"
    fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
  <text x="${w / 2}" y="${cy + fs * 0.36}"
    font-family="Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="500"
    fill="rgba(255,255,255,0.78)" text-anchor="middle">${slide.badge}</text>
</svg>`;
}

// ── composite one store image ──────────────────────────────────────────────
async function buildStoreImage(appPng, slide, fmt) {
  const { w, h, name } = fmt;

  // Phone sizing — takes up ~56% of canvas width
  const phoneW = Math.round(w * 0.56);
  const phoneH = Math.round(phoneW * (19.5 / 9));
  const phoneX = Math.round((w - phoneW) / 2);

  // Vertical layout
  const marketingH = Math.round(h * 0.275);  // top 27.5% = headlines
  const phoneY     = Math.round(marketingH + h * 0.005);

  // Display area inside the phone (inside bezels)
  const bezel   = Math.round(phoneW * 0.028);
  const statusH = Math.round(phoneH * 0.065);
  const homeH   = Math.round(phoneH * 0.025);
  const dispX   = phoneX + bezel;
  const dispY   = phoneY + statusH;
  const dispW   = phoneW - bezel * 2;
  const dispH   = phoneH - statusH - homeH;

  // Badge position — centred between phone bottom and canvas bottom
  const phoneBotY = phoneY + phoneH;
  const badgeCY   = Math.round(phoneBotY + (h - phoneBotY) / 2);

  // ── render layers ──────────────────────────────────────────────────────
  const [bgBuf, textBuf, frameBuf, badgeBuf, scaledApp] = await Promise.all([
    sharp(Buffer.from(svgBg(w, h, slide))).png().toBuffer(),
    sharp(Buffer.from(svgText(w, h, slide, phoneY))).png().toBuffer(),
    sharp(Buffer.from(svgPhone(phoneW, phoneH))).png().toBuffer(),
    sharp(Buffer.from(svgBadge(w, h, slide, badgeCY))).png().toBuffer(),
    sharp(appPng)
      .resize(dispW, dispH, { fit: 'cover', position: 'top' })
      .png()
      .toBuffer(),
  ]);

  // Clip app screenshot to rounded corners so it stays inside the phone frame curves
  const innerRx = Math.max(2, Math.round(phoneW * 0.088) - Math.round(phoneW * 0.028));
  const clipMaskSvg = `<svg width="${dispW}" height="${dispH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${dispW}" height="${dispH}" rx="${innerRx}" ry="${innerRx}" fill="white"/>
  </svg>`;
  const clipMask = await sharp(Buffer.from(clipMaskSvg)).png().toBuffer();
  const clippedApp = await sharp(scaledApp)
    .composite([{ input: clipMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // ── composite ──────────────────────────────────────────────────────────
  const outFile = path.join(__dirname, '..', 'screenshots', name, `slide-${slide.id}.png`);

  await sharp(bgBuf)
    .composite([
      { input: clippedApp, left: dispX,   top: dispY   },  // app content (clipped)
      { input: frameBuf,   left: phoneX,  top: phoneY  },  // phone border on top
      { input: textBuf,    left: 0,       top: 0       },  // marketing headlines
      { input: badgeBuf,   left: 0,       top: 0       },  // bottom badge
    ])
    .png()
    .toFile(outFile);

  console.log(`    ✓ ${name}/slide-${slide.id}.png`);
}

// ── expanded chart capture ─────────────────────────────────────────────────
// Loads dashboard at LANDSCAPE viewport so isLandscape = true and the chart
// renders in fullscreen (not the "Rotate your phone" prompt).
async function captureExpandedChartModal(page) {
  // width > height → isLandscape = true in the app
  await page.setViewport({ width: 812, height: 375, deviceScaleFactor: 2 });

  await page.goto(APP + '/', { waitUntil: 'networkidle2', timeout: 15000 });

  await page.evaluate(plan => {
    localStorage.setItem('finance_planner_onboarded_v1', 'done');
    localStorage.setItem('finance_planner_plan_v2', plan);
  }, PLAN);

  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1200);

  // Dark mode
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await sleep(150);

  // In landscape the chart is already visible — no scroll needed
  // Click the expand button
  const expandBtn = await page.$('[aria-label="Expand chart"]');
  if (expandBtn) {
    await expandBtn.click();
    await sleep(700);
  }

  return page.screenshot({ type: 'png' });
}

// SVG for a phone lying on its side (landscape orientation)
function svgPhoneLandscape(pw, ph) {
  // pw = wide dimension, ph = narrow dimension
  const rx     = Math.round(ph * 0.088);
  const border = Math.round(ph * 0.022);
  const half   = border / 2;
  // Dynamic island on the LEFT short edge
  const niH = Math.round(ph * 0.32);
  const niW = Math.round(pw * 0.030);
  const niX = Math.round(pw * 0.012);
  // Power button on top long edge
  const btnH  = Math.round(ph * 0.022);
  const btn1X = Math.round(pw * 0.60);
  const btnW  = Math.round(pw * 0.07);

  return `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${half}" y="${half}" width="${pw-border}" height="${ph-border}"
    rx="${rx}" fill="none"
    stroke="rgba(255,255,255,0.22)" stroke-width="${border}"/>
  <!-- dynamic island (left side) -->
  <rect x="${niX}" y="${(ph-niH)/2}" width="${niW}" height="${niH}"
    rx="${niW/2}" fill="rgba(0,0,0,0.85)"/>
  <!-- power button (top edge) -->
  <rect x="${btn1X}" y="${-btnH*0.6}" width="${btnW}" height="${btnH*0.6}"
    rx="2" fill="rgba(255,255,255,0.14)"/>
</svg>`;
}

// Landscape canvas, landscape phone on the right showing the expanded chart.
// appPng was captured at 812×375 (landscape) so isLandscape was true in the app.
async function buildExpandedStoreImage(appPng, fmt) {
  const { w, h, name } = fmt;

  // Landscape canvas (swap store dims)
  const lw = h;   // 2796 iOS / 1920 Android
  const lh = w;   // 1290 iOS / 1080 Android

  // Landscape phone — phoneW = long side, phoneH = narrow side
  const phoneW  = Math.round(lw * 0.58);
  const phoneH  = Math.round(phoneW * (9 / 19.5));
  const margin  = Math.round(lw * 0.035);
  const phoneX  = lw - phoneW - margin;
  const phoneY  = Math.round((lh - phoneH) / 2);

  // Display area inside landscape phone bezels.
  // svgPhoneLandscape: dynamic island on LEFT short edge, power button on TOP long edge.
  const border  = Math.round(phoneH * 0.028);   // top / bottom bezel
  const statusW = Math.round(phoneW * 0.052);   // left side (dynamic island area)
  const homeW   = Math.round(phoneW * 0.018);   // right side
  const dispX   = phoneX + statusW;
  const dispY   = phoneY + border;
  const dispW   = phoneW - statusW - homeW;
  const dispH   = phoneH - border * 2;

  // Scale landscape screenshot into the phone display area
  const scaledRaw = await sharp(appPng)
    .resize(dispW, dispH, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();

  // Clip to rounded corners (inner rx = outer rx - border)
  const innerRx = Math.max(2, Math.round(phoneH * 0.088) - border);
  const clipMaskSvg = `<svg width="${dispW}" height="${dispH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${dispW}" height="${dispH}" rx="${innerRx}" ry="${innerRx}" fill="white"/>
  </svg>`;
  const clipMask   = await sharp(Buffer.from(clipMaskSvg)).png().toBuffer();
  const clippedApp = await sharp(scaledRaw)
    .composite([{ input: clipMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Marketing text — left panel
  const cx       = Math.round(phoneX / 2);
  const textPad  = Math.round(lw * 0.03);
  const maxTextW = phoneX - textPad * 2;
  const h1Size   = Math.min(Math.round(maxTextW / 11), Math.round(lh * 0.075));
  const tagSize  = Math.round(h1Size * 0.37);
  const lineGap  = Math.round(h1Size * 1.22);
  const midY     = Math.round(lh * 0.42);

  const bfs      = Math.round(lh * 0.026);
  const bpx      = Math.round(lh * 0.04);
  const bpy      = Math.round(bfs * 0.55);
  const badge    = 'Net worth projection  ·  On Track ✓';
  const estBw    = badge.length * bfs * 0.52;
  const bw       = Math.min(Math.round(estBw + bpx * 2), phoneX - 40);
  const bh       = bfs + bpy * 2;
  const badgeCY  = Math.round(lh * 0.76);

  const bgSvg = `<svg width="${lw}" height="${lh}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#0a1628"/>
      <stop offset="100%" stop-color="#3b0764"/>
    </linearGradient>
  </defs>
  <rect width="${lw}" height="${lh}" fill="url(#g)"/>
</svg>`;

  const textSvg = `<svg width="${lw}" height="${lh}" xmlns="http://www.w3.org/2000/svg">
  <text x="${cx}" y="${midY - lineGap*1.35}"
    font-family="Arial,Helvetica,sans-serif" font-size="${tagSize}" font-weight="700"
    fill="rgba(255,255,255,0.40)" text-anchor="middle" letter-spacing="3">SEE THE FINISH LINE</text>
  <text x="${cx}" y="${midY - lineGap*0.15}"
    font-family="Arial Black,Arial,sans-serif" font-size="${h1Size}" font-weight="900"
    fill="#ffffff" text-anchor="middle">Know exactly when</text>
  <text x="${cx}" y="${midY + lineGap*1.0}"
    font-family="Arial Black,Arial,sans-serif" font-size="${h1Size}" font-weight="900"
    fill="#c084fc" text-anchor="middle">you'll reach your goal</text>
  <rect x="${(phoneX - bw)/2}" y="${badgeCY - bh/2}" width="${bw}" height="${bh}"
    rx="${bh/2}" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
  <text x="${cx}" y="${badgeCY + bfs*0.36}"
    font-family="Arial,Helvetica,sans-serif" font-size="${bfs}" font-weight="500"
    fill="rgba(255,255,255,0.78)" text-anchor="middle">${badge}</text>
</svg>`;

  const [bgBuf, textBuf, frameBuf] = await Promise.all([
    sharp(Buffer.from(bgSvg)).png().toBuffer(),
    sharp(Buffer.from(textSvg)).png().toBuffer(),
    sharp(Buffer.from(svgPhoneLandscape(phoneW, phoneH))).png().toBuffer(),
  ]);

  const outFile = path.join(__dirname, '..', 'screenshots', name, 'slide-6-chart-expanded.png');
  await sharp(bgBuf)
    .composite([
      { input: clippedApp, left: dispX,  top: dispY  },
      { input: frameBuf,   left: phoneX, top: phoneY },
      { input: textBuf,    left: 0,      top: 0      },
    ])
    .png()
    .toFile(outFile);

  console.log(`    ✓ ${name}/slide-6-chart-expanded.png  (${lw}×${lh} landscape)`);
}

// ── landscape composite ────────────────────────────────────────────────────
// Layout: gradient bg · headline text left · portrait phone right
async function buildLandscapeImage(appPng, slide, fmt) {
  const { w, h, name } = fmt;

  // Phone (portrait) on right side — height fills 90% of canvas height
  const phoneH  = Math.round(h * 0.90);
  const phoneW  = Math.round(phoneH * (9 / 19.5));
  const margin  = Math.round(w * 0.05);
  const phoneX  = w - phoneW - margin;
  const phoneY  = Math.round((h - phoneH) / 2);

  // Display area inside phone bezels
  const bezel   = Math.round(phoneW * 0.028);
  const statusH = Math.round(phoneH * 0.065);
  const homeH   = Math.round(phoneH * 0.025);
  const dispX   = phoneX + bezel;
  const dispY   = phoneY + statusH;
  const dispW   = phoneW - bezel * 2;
  const dispH   = phoneH - statusH - homeH;

  // Text area — left half of canvas
  const textAreaW = phoneX - margin;
  const cx        = Math.round(textAreaW / 2);
  const tagSize   = Math.round(h * 0.030);
  const h1Size    = Math.round(h * 0.095);
  const lineGap   = Math.round(h1Size * 1.22);
  const midY      = Math.round(h * 0.42);

  // Badge centred under text
  const badgeCY = Math.round(h * 0.76);
  const bfs     = Math.round(h * 0.026);
  const bpx     = Math.round(h * 0.045);
  const bpy     = Math.round(bfs * 0.55);
  const estBw   = slide.badge.length * bfs * 0.52;
  const bw      = Math.min(Math.round(estBw + bpx * 2), textAreaW - 40);
  const bh      = bfs + bpy * 2;

  const bgSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="${slide.bgFrom}"/>
      <stop offset="100%" stop-color="${slide.bgTo}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
</svg>`;

  const textSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${cx}" y="${midY - lineGap * 1.35}"
    font-family="Arial,Helvetica,sans-serif" font-size="${tagSize}" font-weight="700"
    fill="rgba(255,255,255,0.40)" text-anchor="middle" letter-spacing="3">${slide.tagline}</text>
  <text x="${cx}" y="${midY - lineGap * 0.15}"
    font-family="Arial Black,Arial,sans-serif" font-size="${h1Size}" font-weight="900"
    fill="${slide.line1Color}" text-anchor="middle">${slide.line1}</text>
  <text x="${cx}" y="${midY + lineGap * 1.0}"
    font-family="Arial Black,Arial,sans-serif" font-size="${h1Size}" font-weight="900"
    fill="${slide.line2Color}" text-anchor="middle">${slide.line2}</text>
  <!-- badge pill -->
  <rect x="${(textAreaW - bw) / 2}" y="${badgeCY - bh / 2}" width="${bw}" height="${bh}"
    rx="${bh / 2}" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
  <text x="${cx}" y="${badgeCY + bfs * 0.36}"
    font-family="Arial,Helvetica,sans-serif" font-size="${bfs}" font-weight="500"
    fill="rgba(255,255,255,0.78)" text-anchor="middle">${slide.badge}</text>
</svg>`;

  const [bgBuf, textBuf, frameBuf, scaledApp] = await Promise.all([
    sharp(Buffer.from(bgSvg)).png().toBuffer(),
    sharp(Buffer.from(textSvg)).png().toBuffer(),
    sharp(Buffer.from(svgPhone(phoneW, phoneH))).png().toBuffer(),
    sharp(appPng)
      .resize(dispW, dispH, { fit: 'cover', position: 'top' })
      .png()
      .toBuffer(),
  ]);

  const outFile = path.join(__dirname, '..', 'screenshots', name, `slide-${slide.id}.png`);

  await sharp(bgBuf)
    .composite([
      { input: scaledApp, left: dispX,  top: dispY  },
      { input: frameBuf,  left: phoneX, top: phoneY },
      { input: textBuf,   left: 0,      top: 0      },
    ])
    .png()
    .toFile(outFile);

  console.log(`    ✓ ${name}/slide-${slide.id}.png`);
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  // Create output folders
  for (const fmt of FORMATS) {
    fs.mkdirSync(path.join(__dirname, '..', 'screenshots', fmt.name), { recursive: true });
  }

  console.log('Launching browser...');

  // Check dev server
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
    // Simple check — if it throws, server isn't running
  } catch (_) {}

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    // Portrait slides
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
    for (const slide of SLIDES) {
      console.log(`\n→ ${slide.id}`);
      const appPng = await captureApp(page, slide);
      for (const fmt of FORMATS) {
        await buildStoreImage(appPng, slide, fmt);
      }
    }

    // Slide 6 — expanded chart modal (portrait phone on landscape canvas)
    console.log('\n→ 6-chart-expanded');
    const expandedPng = await captureExpandedChartModal(page);
    for (const fmt of FORMATS) {
      await buildExpandedStoreImage(expandedPng, fmt);
    }

  } finally {
    await browser.close();
  }

  console.log('\n✅  Done!');
  console.log('   screenshots/ios/      — upload to App Store Connect');
  console.log('   screenshots/android/  — upload to Google Play Console\n');
}

main().catch(err => {
  console.error('\n❌  Error:', err.message);
  if (err.message.includes('ERR_CONNECTION_REFUSED')) {
    console.error('    Dev server is not running. Start it first:  npm run dev -- -p 3100\n');
  }
  process.exit(1);
});
