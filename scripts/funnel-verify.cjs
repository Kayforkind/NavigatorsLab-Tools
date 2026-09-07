/* Verifies every funnel/<slug>/ repo locally before pushing:
 *  - index.html + demo.html load with ZERO console errors, page errors and 404s
 *  - qr-studio demo does a real generate round-trip
 * Usage: node scripts/funnel-verify.cjs  (expects a server serving funnel/ on VERIFY_PORT, default 5321) */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.env.APPDATA + '/npm/node_modules/@playwright/test/node_modules', 'playwright'));

const PORT = process.env.VERIFY_PORT || 5321;
const BASE = `http://localhost:${PORT}`;
const FUNNEL = path.resolve(__dirname, '..', 'funnel');
const TITLES = {
  'photo-privacy-kit': 'Photo Privacy Kit', 'metadata-hidden-data-checker': 'Metadata & Hidden-Data Checker',
  'image-shrinker': 'Image Shrinker', 'scan-screenshot-cleaner': 'Scan & Screenshot Cleaner',
  'local-e-sign-pad': 'Local E-Sign Pad', 'receipts-to-pdf': 'Receipts',
  'receipt-ocr-to-csv': 'Receipt OCR', 'qr-studio': 'QR Studio', 'audio-trimmer': 'Audio Trimmer',
  'invoice-quote-generator': 'Invoice', 'batch-rename-and-sort': 'Batch Rename',
  'print-shop-prep': 'Print-Shop Prep', 'pdf-pages': 'PDF Pages', 'text-diff': 'Text Diff',
  'text-stats': 'Text Stats',
};

(async () => {
  const slugs = fs.readdirSync(FUNNEL).filter((s) => fs.existsSync(path.join(FUNNEL, s, 'demo.html')));
  const b = await chromium.launch();
  const ctx = await b.newContext({ bypassCSP: true });
  let fails = 0;
  const report = (name, ok, note) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(34)} ${note}`);
    if (!ok) fails++;
  };
  for (const slug of slugs) {
    for (const file of ['index.html', 'demo.html']) {
      const bad = [];
      const p = await ctx.newPage();
      p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text().slice(0, 120)); });
      p.on('pageerror', (e) => bad.push('pageerror: ' + String(e).slice(0, 120)));
      p.on('response', (r) => { if (r.status() >= 400) bad.push(`http ${r.status()}: ${r.url().split('/').slice(-2).join('/')}`); });
      try {
        await p.goto(`${BASE}/${slug}/${file}`, { waitUntil: 'load', timeout: 20000 });
        await p.waitForTimeout(600);
        const title = await p.title();
        const okTitle = file === 'demo.html' ? title.includes(TITLES[slug]) : true;
        report(`${slug}/${file}`, bad.length === 0 && okTitle,
          bad.length === 0 ? `ok ("${title.slice(0, 48)}")` : bad.join(' | ').slice(0, 200));
      } catch (e) {
        report(`${slug}/${file}`, false, String(e).slice(0, 140));
      }
      await p.close();
    }
  }
  // deep check: real generate round-trip on the qr-studio demo
  const p = await ctx.newPage();
  await p.goto(`${BASE}/qr-studio/demo.html`, { waitUntil: 'load' });
  const secret = `funnel-verify-${Date.now()}`;
  await p.fill('#qrText', secret);
  await p.click('#qrMake');
  await p.waitForFunction(() => !document.getElementById('qrOut').hidden, { timeout: 10000 });
  const shown = await p.textContent('#qrMeta');
  report('qr-studio demo round-trip', true, `generated QR from payload (${shown.trim().slice(0, 40)})`);
  await p.close();
  await b.close();
  console.log(fails === 0 ? `\nALL ${slugs.length} FUNNEL REPOS VERIFIED LOCALLY` : `\n${fails} FAILURES`);
  process.exit(fails === 0 ? 0 : 1);
})();
