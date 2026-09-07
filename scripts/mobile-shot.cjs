/* Mobile viewport check: no horizontal overflow, usable layout + screenshots. */
const path = require('node:path');
function resolvePlaywright() {
  const candidates = [
    process.env.PW_MODULES,
    'C:/Users/kazim/AppData/Roaming/npm/node_modules/@playwright/test/node_modules',
    path.resolve(__dirname, '..', 'node_modules'),
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(path.join(c, 'playwright')); } catch { /* next */ }
  }
  throw new Error('playwright not found; set PW_MODULES or npm i -D playwright');
}
const { chromium } = resolvePlaywright();

const BASE = 'http://localhost:5178';
const SHOTS = path.resolve(__dirname, '..', 'docs', 'shots');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pages = ['index.html', 'invoice.html', 'audio.html', 'qr.html', 'ocr.html', 'agents.html'];
  let allOk = true;
  for (const p of pages) {
    await page.goto(`${BASE}/${p}`);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const ok = overflow <= 2;
    if (!ok) allOk = false;
    console.log(`${ok ? 'OK  ' : 'OVERFLOW'} ${p}: ${overflow}px horizontal overflow`);
    await page.screenshot({ path: path.join(SHOTS, p === 'index.html' ? '11-mobile-hub.png' : `12-mobile-${p.replace('.html', '')}.png`), fullPage: p === 'index.html' });
  }
  await browser.close();
  process.exit(allOk ? 0 : 1);
})();
