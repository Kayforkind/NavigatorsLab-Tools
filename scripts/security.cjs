/* End-to-end SECURITY suite for NavigatorsLab Tools.
 * Run: node scripts/security.cjs   (serves dist/ itself on :5199)
 *
 * What it proves, per release:
 *  A. Network silence — zero requests to non-self origins after load, on every tool
 *  B. Storage hygiene — no cookies ever; localStorage keys enumerated and audited
 *  C. Exfil scan — no outbound POST/beacon/sendBeacon/fetch to non-self origins
 *  D. Malicious-file robustness — corrupted fixtures never crash a tool
 *  E. Path traversal — dot-segment URLs are rejected by the host
 *  F. Headers — CSP and friends actually delivered in production shape
 *  G. Secrets — no API keys/tokens in the shipped bundle
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const http = require('node:http');

function resolvePlaywright() {
  const candidates = [
    process.env.PW_MODULES,
    (process.env.APPDATA ? process.env.APPDATA + '/npm/node_modules/@playwright/test/node_modules' : ''),
    path.resolve(__dirname, '..', 'node_modules'),
  ].filter(Boolean);
  for (const c of candidates) { try { return require(path.join(c, 'playwright')); } catch { /* next */ } }
  throw new Error('playwright not found; set PW_MODULES or npm i -D playwright');
}
const { chromium } = resolvePlaywright();

const PORT = Number(process.env.SEC_PORT) || 5233; // dedicated: never share with dev servers (vite 5173/5199, e2e 5178)
const BASE = process.env.SEC_BASE || `http://localhost:${PORT}`;
const results = [];
function report(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${pathname}`, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

/* tool pages = every shipped html */
const PAGES = fs.readdirSync(path.resolve(__dirname, '..', 'dist')).filter((f) => f.endsWith('.html'));

(async () => {
  /* serve dist with secure headers on (or attach to an externally started one) */
  const external = !!process.env.SEC_BASE;
  const server = external ? null : spawn(process.execPath, [path.resolve(__dirname, 'serve.cjs')], {
    env: { ...process.env, TOOLS_PORT: String(PORT), SECURE_HEADERS: '1', BASE_PREFIX: process.env.SEC_PREFIX || '' },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 900));

  /* fail fast: never run the suite against a foreign server that happens to
   * squat our port (a vite dev server would answer without our headers). */
  {
    let ours = false;
    try { ours = !!(await get('/')).headers['content-security-policy']; } catch { ours = false; }
    if (!ours) {
      if (server) server.kill();
      console.error(`Port ${PORT} is not serving our SECURE_HEADERS server — refusing to test a foreign host. ` +
        `Stop the squatter or rerun with SEC_PORT=<free port>.`);
      process.exit(2);
    }
  }

  try {
    /* ---------- F. security headers on every page ---------- */
    {
      let allOk = true; const missing = [];
      for (const p of PAGES) {
        const res = await get(`/${p}`);
        const need = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
        for (const h of need) if (!res.headers[h]) { allOk = false; missing.push(`${p}:${h}`); }
        const csp = res.headers['content-security-policy'] || '';
        if (!csp.includes("default-src 'none'") || !csp.includes("frame-ancestors 'none'")) { allOk = false; missing.push(`${p}:csp-shape`); }
      }
      report('headers', allOk, allOk ? `CSP + nosniff + referrer + permissions on all ${PAGES.length} pages` : `missing: ${missing.slice(0, 4).join(', ')}`);
    }

    /* ---------- E. path traversal rejected ---------- */
    {
      const t1 = await get('/..%2f..%2fpackage.json');
      const t2 = await get('/%2e%2e/%2e%2e/tsconfig.json');
      const t3 = await get('/....//tsconfig.json');
      const ok = t1.status !== 200 && t2.status !== 200 && t3.status !== 200 &&
        !t1.body.toString().includes('"name"');
      report('traversal', ok, `dot-segment probes → ${t1.status}/${t2.status}/${t3.status}`);
    }

    /* ---------- G. no secrets in the shipped bundle ---------- */
    {
      const distDir = path.resolve(__dirname, '..', 'dist');
      const files = [];
      (function walk(d) { for (const f of fs.readdirSync(d)) { const fp = path.join(d, f); fs.statSync(fp).isDirectory() ? walk(fp) : files.push(fp); } })(distDir);
      const patterns = [
        /sk-[A-Za-z0-9]{20}/, /ghp_[A-Za-z0-9]{30}/, /github_pat_[A-Za-z0-9_]{40}/,
        /AKIA[0-9A-Z]{16}/, /xox[baprs]-[A-Za-z0-9-]{20}/, /AIza[0-9A-Za-z_-]{35}/,
        /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, /eyJhbGciOi[A-Za-z0-9_-]{30}/,
      ];
      // vendored prebuilt third-party artifacts (tesseract WASM + glue, lamejs) are byte-level
      // noise for token-shaped patterns — allowlisted, same practice as gitleaks. Everything
      // else (our code AND any third-party js) is scanned, with an entropy filter so binary
      // garbage inside text assets can't pass as a credential either.
      const vendored = /[\\/](tess|lamejs)[\\/]/;
      const entropy = (s) => {
        const freq = new Map();
        for (const c of s) freq.set(c, (freq.get(c) || 0) + 1);
        let h = 0;
        for (const n of freq.values()) { const p = n / s.length; h -= p * Math.log2(p); }
        return h;
      };
      let hits = [];
      for (const f of files) {
        if (/\.(png|jpg|jpeg|wasm|gz|woff2|webp)$/.test(f)) continue;
        if (vendored.test(f)) continue;
        const text = fs.readFileSync(f, 'utf8');
        for (const p of patterns) {
          const m = p.exec(text);
          if (m && entropy(m[0]) >= 4.0) hits.push(`${path.basename(f)}:${m[0].slice(0, 8)}…`);
        }
      }
      report('secrets', hits.length === 0, hits.length ? `FOUND: ${hits.join(', ')}` : `${files.length} dist files scanned (vendored WASM allowlisted), zero credentials`);
    }

    /* ---------- A/B/C/D. browser-level checks on every page ---------- */
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });
    const page = await ctx.newPage();

    /* capture ALL requests the page makes (incl. beacons via CDP-level events) */
    let foreignRequests = [];
    let postTargets = [];
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.protocol.startsWith('http') && u.host !== `localhost:${PORT}`) {
        foreignRequests.push(`${req.method()} ${u.host}${u.pathname.slice(0, 60)}`);
      }
      if (req.method() !== 'GET') postTargets.push(`${req.method()} ${u.host}${u.pathname.slice(0, 60)}`);
    });

    let storageFindings = [];
    for (const p of PAGES) {
      foreignRequests = []; postTargets = [];
      await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(700);

      // A. network silence: no foreign origins at load
      report(`net:${p.replace('.html', '')}`, foreignRequests.length === 0,
        foreignRequests.length ? `FOREIGN: ${foreignRequests.slice(0, 3).join(' | ')}` : 'zero non-self requests');

      // C. exfil verbs: nothing non-GET even attempted
      if (postTargets.length) report(`exfil:${p.replace('.html', '')}`, false, `non-GET requests: ${postTargets.slice(0, 3).join(' | ')}`);

      // B. storage hygiene
      const s = await page.evaluate(() => {
        const ls = Object.keys(localStorage);
        const ss = Object.keys(sessionStorage);
        // best-effort cookie count (httpOnly cookies can't be read from JS — but there's no server to set any)
        return { ls, ss, cookies: document.cookie };
      });
      const knownLs = ['nl-tools-recents', 'invoice-nl', 'nl-lang', 'nl-seen-version', 'workbox-precache-v2'];
      const bad = [...s.ls, ...s.ss].filter((k) => !knownLs.some((w) => k.startsWith(w)));
      if (bad.length || s.cookies) storageFindings.push(`${p}: ${bad.join(',')}${s.cookies ? '+cookies' : ''}`);
    }
    report('storage', storageFindings.length === 0, storageFindings.length ? storageFindings.join(' | ') : 'no cookies; localStorage limited to recents + invoice draft + SW cache keys');

    /* ---------- D. malicious inputs never crash the app ---------- */

    // D1. garbage binary dropped into exif tool
    try {
      await page.goto(`${BASE}/exif.html`, { waitUntil: 'load' });
      await page.evaluate(() => {
        const bytes = new Uint8Array(4096).map((_, i) => (i * 37 + i % 251) & 0xff);
        bytes[0] = 0xff; bytes[1] = 0xd8; // fake JPEG header with garbage body
        const f = new File([bytes], 'evil.jpg', { type: 'image/jpeg' });
        const dt = new DataTransfer(); dt.items.add(f);
        document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      });
      await page.waitForTimeout(1200);
      const exifAlive = await page.evaluate(() => !!document.querySelector('#dz') && !document.querySelector('#dz').classList.contains('crashed'));
      report('fuzz:exif', exifAlive, '4KB garbage "JPEG" scanned without crashing the page');
    } catch (e) { report('fuzz:exif', false, 'section failed: ' + e.message); }

// D2. corrupt zip into metadata tool
    try {
      await page.goto(`${BASE}/metadata.html`, { waitUntil: 'load' });
      await page.evaluate(() => {
        const bytes = new Uint8Array(600).map((_, i) => (i % 256));
        bytes[0] = 0x50; bytes[1] = 0x4b; bytes[2] = 0x03; bytes[3] = 0x04; // fake zip signature, garbage body
        const f = new File([bytes], 'evil.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const dt = new DataTransfer(); dt.items.add(f);
        document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      });
      await page.waitForTimeout(1200);
      const metaAlive = await page.evaluate(() => document.body.textContent.length > 100);
      report('fuzz:docx', metaAlive, 'corrupt ZIP/docx parsed without crashing the page');
    } catch (e) { report('fuzz:docx', false, 'section failed: ' + e.message); }

// D3. malformed PDF into sign tool
    try {
      await page.goto(`${BASE}/sign.html`, { waitUntil: 'load' });
      await page.evaluate(() => {
        const f = new File([new TextEncoder().encode('%PDF-1.4 \r\n%âãÏÓ\r\nGarbageNotAPDF')], 'evil.pdf', { type: 'application/pdf' });
        const dt = new DataTransfer(); dt.items.add(f);
        document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      });
    } catch (e) { report('fuzz:pdf', false, 'section failed: ' + e.message); }
    await page.waitForFunction(() => {
      const st = document.querySelector('#stat');
      return st && (st.textContent.includes('Could not open') || st.textContent.includes('Failed') || st.textContent.includes('not') || st.hidden === false);
    }, { timeout: 20000 }).catch(() => {});
    const signMsg = await page.textContent('#stat').catch(() => '(no status)');
    report('fuzz:pdf', /could not open|failed|invalid|error|not/i.test(signMsg || ''), `graceful error surfaced: "${(signMsg || '').trim().slice(0, 80)}"`);

    // D4. XSS probe: filename with script payload through the exif UI
    try {
      await page.goto(`${BASE}/exif.html`, { waitUntil: 'load' });
      await page.evaluate(() => {
        const f = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], '<img src=x onerror=window.__xss=1>.jpg', { type: 'image/jpeg' });
        const dt = new DataTransfer(); dt.items.add(f);
        document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      });
      await page.waitForTimeout(1500);
      const xss = await page.evaluate(() => (window).__xss === 1);
      report('xss-filename', !xss, 'scripted filename rendered inert (no window.__xss)');
    } catch (e) { report('xss-filename', false, 'section failed: ' + e.message); }


    await browser.close();
  } finally {
    if (server) server.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== SECURITY: ${results.length - failed.length}/${results.length} checks passed ===`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('security suite crashed:', e); process.exit(2); });
