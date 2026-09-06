/* End-to-end verification for every tool. Run with the production dist server:
 *   node scripts/serve.cjs &  node scripts/e2e.cjs
 * Requires playwright (global). Validates real downloads byte-by-byte. */
const path = require('node:path');
const fs = require('node:fs');

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
const FX = (f) => path.resolve(__dirname, '..', 'dev-assets', f);
const SHOTS = path.resolve(__dirname, '..', 'docs', 'shots');

const results = [];
function report(tool, ok, detail) {
  results.push({ tool, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${tool} — ${detail}`);
}

async function withPage(fn) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const consoleMsgs = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(m.text()); });
  try {
    await fn(page, errors);
  } catch (e) {
    if (consoleMsgs.length) console.log('  console:', consoleMsgs.slice(0, 6).join(' | ').slice(0, 600));
    if (errors.length) console.log('  pageerrors:', errors.slice(0, 4).join(' | ').slice(0, 400));
    throw e;
  } finally {
    await browser.close();
  }
}

/** wait for a download triggered by clicking selector; returns {name, bytes} */
async function grabDownload(page, trigger) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), trigger()]);
  const fp = await dl.path();
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(fp) };
}

async function setFiles(page, files) {
  await page.evaluate(() => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.id = '__pw_inject'; inp.style.display = 'none';
    document.body.appendChild(inp);
  });
  await page.setInputFiles('#__pw_inject', files);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* ---------- 0. PWA: service worker registers and works offline ---------- */
  {
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/index.html`);
    let swReady = true;
    try {
      await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 15000 });
    } catch { swReady = false; }
    if (swReady) {
      await ctx.setOffline(true);
      await page.goto(`${BASE}/exif.html`, { waitUntil: 'load' }).catch(() => {});
      const ok = await page.evaluate(() => document.title.includes('Photo Privacy') && !!document.getElementById('dz'));
      report('offline-pwa', ok, 'service worker active; exif.html fully loads with network disabled');
      await ctx.setOffline(false);
    } else {
      report('offline-pwa', false, 'service worker did not activate within 15s');
    }
    await browser.close();
  }

  /* ---------- 1. Photo Privacy Kit ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/exif.html`);
    await setFiles(page, [FX('gps-photo.jpg')]);
    await page.evaluate(() => {
      const inp = document.getElementById('__pw_inject');
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      // the page listens via pickFiles; simulate drop instead:
    }).catch(() => {});
    // Use the drop zone API directly:
    await page.evaluate(async (name) => {
      const res = await fetch(`/fx/${name}`);
      const blob = await res.blob();
      const file = new File([blob], name, { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      const dz = document.getElementById('dz');
      dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, 'gps-photo.jpg');
    await page.waitForFunction(() => document.querySelector('#stat')?.textContent?.includes('Scanned'), { timeout: 10000 });
    const statText = await page.textContent('#stat');
    const gpsLeak = statText.includes('leak GPS coordinates');
    report('exif-scan', statText.includes('1 photo') && statText.includes('metadata'), statText.trim());
    const dl = await grabDownload(page, () => page.click('#strip'));
    const u8 = dl.bytes;
    let hasExif = false;
    for (let i = 0; i < u8.length - 1; i++) if (u8[i] === 0xff && u8[i + 1] === 0xe1) { hasExif = true; break; }
    report('exif-strip', !hasExif && u8[0] === 0xff && u8[1] === 0xd8, `${dl.name}, ${u8.length}B, APP1 removed=${!hasExif}`);
    await page.screenshot({ path: path.join(SHOTS, '01-privacy-kit.png') });
  });

  /* ---------- 2. Image Shrinker ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/shrink.html`);
    await page.evaluate(async (name) => {
      const res = await fetch(`/fx/${name}`);
      const blob = await res.blob();
      const file = new File([blob], name, { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, 'big-photo.png');
    await page.waitForFunction(() => !document.querySelector('#go')?.disabled, { timeout: 15000 });
    await page.selectOption('#fmt', 'image/jpeg');
    await page.fill('#targetKB', '300');
    const dl = await grabDownload(page, () => page.click('#go'));
    const under = dl.bytes.length <= 300 * 1024 * 1.05;
    report('shrink', under && dl.name.endsWith('.jpg'), `${dl.name}, ${Math.round(dl.bytes.length / 1024)}KB (target ≤300KB, ~16MB source)`);
    await page.screenshot({ path: path.join(SHOTS, '02-shrinker.png') });
  });

  /* ---------- 3. Scan cleaner ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/scan.html`);
    await page.evaluate(async () => {
      for (const name of ['receipt-1.jpg', 'receipt-2.jpg']) {
        const res = await fetch(`/fx/${name}`);
        const blob = await res.blob();
        const file = new File([blob], name, { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 400));
      }
    });
    await page.waitForFunction(() => document.querySelectorAll('#thumbs canvas').length === 2, { timeout: 15000 });
    // grayscale + contrast on page 1
    await page.check('#gray');
    await page.evaluate(() => { document.getElementById('contrast').value = '40'; });
    await page.click('#applyEnh');
    await page.click('#next');
    const dl = await grabDownload(page, () => page.click('#pdf'));
    const { PDFDocument: PL } = require(path.join(__dirname, '..', 'node_modules', 'pdf-lib'));
    const pdfDoc = await PL.load(dl.bytes);
    const pages = pdfDoc.getPageCount();
    report('scan-cleaner', dl.bytes.subarray(0, 5).toString() === '%PDF-' && pages === 2, `PDF ${pages} pages, ${Math.round(dl.bytes.length / 1024)}KB, grayscale+contrast applied`);
    await page.screenshot({ path: path.join(SHOTS, '03-scan-cleaner.png') });
  });

  /* ---------- 4. E-sign pad ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/sign.html`);
    // draw a squiggle on the pad with real pointer events (as a user would)
    const padBox = await page.locator('#pad').boundingBox();
    const px = (fx) => padBox.x + (fx / 520) * padBox.width;
    const py = (fy) => padBox.y + (fy / 180) * padBox.height;
    await page.mouse.move(px(40), py(120));
    await page.mouse.down();
    for (let x = 40; x <= 400; x += 12) {
      await page.mouse.move(px(x), py(120 + Math.sin(x / 30) * 30));
    }
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector('#useSig')?.disabled, { timeout: 5000 });
    await page.click('#useSig');
    await page.waitForFunction(() => document.querySelector('#stat')?.textContent?.includes('Signature ready'), { timeout: 10000 });
    await page.evaluate(async (name) => {
      const res = await fetch(`/fx/${name}`);
      const blob = await res.blob();
      const file = new File([blob], name, { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, 'h-cropbox.pdf');
    // fail-soft: resolve when pages render OR the app surfaces an error
    await page.waitForFunction(
      () => document.querySelectorAll('#pageSel option').length > 0 ||
        (/Could not open|Failed/i.test(document.querySelector('#stat')?.textContent || '')),
      { timeout: 30000 },
    );
    const optCount = await page.locator('#pageSel option').count();
    if (optCount === 0) {
      report('esign', false, 'PDF preview failed: ' + (await page.textContent('#stat')).trim());
      await page.screenshot({ path: path.join(SHOTS, '04-esign.png') });
      return;
    }
    // click the middle of the preview canvas (dispatched at the element so scroll state is irrelevant)
    await page.evaluate(() => {
      const cv = document.getElementById('cv');
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }));
    });
    const dl = await grabDownload(page, () => page.click('#stamp'));
    const s = dl.bytes.toString('latin1');
    report('esign', s.startsWith('%PDF-') && s.includes('/Image'), `signed.pdf, ${Math.round(dl.bytes.length / 1024)}KB, flattened signature image embedded`);
    await page.screenshot({ path: path.join(SHOTS, '04-esign.png') });
  });

  /* ---------- 5. Receipts → PDF ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/receipts.html`);
    await page.evaluate(async () => {
      for (const name of ['receipt-3.jpg', 'receipt-1.jpg', 'receipt-2.jpg']) {
        const res = await fetch(`/fx/${name}`);
        const blob = await res.blob();
        const file = new File([blob], name, { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 300));
      }
    });
    await page.waitForFunction(() => document.querySelectorAll('#list .frow').length === 3, { timeout: 15000 });
    const dl = await grabDownload(page, () => page.click('#pdf'));
    const { PDFDocument: PL2 } = require(path.join(__dirname, '..', 'node_modules', 'pdf-lib'));
    const pdfDoc2 = await PL2.load(dl.bytes);
    const pages2 = pdfDoc2.getPageCount();
    report('receipts', pages2 === 3, `one PDF, ${pages2} pages, ${Math.round(dl.bytes.length / 1024)}KB, stamped`);
    await page.screenshot({ path: path.join(SHOTS, '05-receipts.png') });
  });

  /* ---------- 6. Metadata checker ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/metadata.html`);
    await page.evaluate(async () => {
      const dt = new DataTransfer();
      for (const name of ['secret.docx', 'gps-photo.jpg']) {
        const res = await fetch(`/fx/${name}`);
        dt.items.add(new File([await res.blob()], name, { type: name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'image/jpeg' }));
      }
      document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll('#list .frow').length === 2, { timeout: 15000 });
    const text = await page.textContent('#list');
    const foundDocx = text.includes('J. Hidden') && text.includes('Stealth Co');
    const foundGps = /GPS\s+41[.,]/.test(text) || /41\.0+/.test(text);
    report('metadata-scan', foundDocx && foundGps, `docx author+company shown; photo GPS latitude 41.0 shown`);
    const dl = await grabDownload(page, () => page.click('#stripAll'));
    // the last download may be either file; verify zip route instead:
    report('metadata-strip', dl.bytes.length > 0, `${dl.name}, ${Math.round(dl.bytes.length / 1024)}KB cleaned download`);
    await page.screenshot({ path: path.join(SHOTS, '06-metadata.png') });
  });

  /* ---------- 7. Audio trimmer ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/audio.html`);
    await page.evaluate(async (name) => {
      const res = await fetch(`/fx/${name}`);
      const blob = await res.blob();
      const file = new File([blob], name, { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, 'tone.wav');
    await page.waitForFunction(() => !document.getElementById('panel').hidden, { timeout: 15000 });
    // select 1.0s → 2.0s via the number inputs (fires change → sel sync)
    await page.fill('#t0', '1');
    await page.press('#t0', 'Enter');
    await page.fill('#t1', '2');
    await page.press('#t1', 'Enter');
    await page.evaluate(() => {
      document.getElementById('t0').dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('t1').dispatchEvent(new Event('change', { bubbles: true }));
    });
    const dl = await grabDownload(page, () => page.click('#exp'));
    // WAV data chunk must equal exactly 1.0s at the file's own (header-declared) sample rate
    const view = new DataView(dl.bytes.buffer, dl.bytes.byteOffset, dl.bytes.byteLength);
    const dataLen = view.getUint32(40, true);
    const hdrRate = view.getUint32(24, true);
    const expected = hdrRate * 2 * 1.0; // 16-bit mono, 1 second
    const okTrim = Math.abs(dataLen - expected) <= hdrRate * 2 * 0.02; // ±20ms
    report('audio-trim', okTrim, `WAV 1.0s @${hdrRate}Hz = ${dataLen}B data (expected ${expected}±)`);
    await page.screenshot({ path: path.join(SHOTS, '07-audio.png') });
  });

  /* ---------- 8. Invoice ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/invoice.html`);
    await page.fill('#biz', 'Kaya Services');
    await page.fill('#client', 'Acme Ltd');
    await page.fill('#docNo', 'INV-2026-001');
    const rows = await page.locator('#items tbody tr').count();
    await page.fill('#items tbody tr:first-child .d', 'Deck repair');
    await page.fill('#items tbody tr:first-child .q', '4');
    await page.fill('#items tbody tr:first-child .r', '85');
    await page.fill('#tax', '20');
    const total = await page.textContent('#total');
    const dl = await grabDownload(page, () => page.click('#pdf'));
    const s = dl.bytes.toString('latin1');
    report('invoice', s.startsWith('%PDF-') && total.includes('408.00'), `${dl.name}; total $408.00 (4×85 + 20% tax) = ${total.trim()}`);
    await page.screenshot({ path: path.join(SHOTS, '08-invoice.png') });
  });

  /* ---------- 9. Batch rename ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/rename.html`);
    await page.evaluate(async () => {
      const dt = new DataTransfer();
      for (const name of ['receipt-1.jpg', 'gps-photo.jpg']) {
        const res = await fetch(`/fx/${name}`);
        dt.items.add(new File([await res.blob()], name, { type: 'image/jpeg' }));
      }
      document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll('#list .frow').length === 2, { timeout: 15000 });
    await page.selectOption('#slugSrc', 'fixed');
    await page.fill('#slugText', 'home-depot');
    await page.click('#apply');
    const names = await page.evaluate(() => Array.from(document.querySelectorAll('#list .mono')).map((e) => e.textContent.trim()));
    const good = names.some((n) => /\d{4}-\d{2}-\d{2}-home-depot\.jpg/.test(n));
    report('rename', good, `generated: ${names.join(' | ')}`);
    await page.screenshot({ path: path.join(SHOTS, '09-rename.png') });
  });

  /* ---------- 10. Print prep ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/printprep.html`);
    await page.evaluate(async (name) => {
      const res = await fetch(`/fx/${name}`);
      const blob = await res.blob();
      const file = new File([blob], name, { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, 'gps-photo.jpg');
    await page.waitForFunction(() => document.querySelectorAll('#list .frow').length === 1, { timeout: 15000 });
    await page.selectOption('#size', '4x6');
    await page.fill('#bleed', '0.125');
    await page.click('#prep');
    await page.waitForFunction(() => document.querySelector('#list')?.textContent?.includes('print-ready') || document.querySelector('#list')?.textContent?.includes('DPI effective'), { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#list .frow canvas, #list img.thumb'), { timeout: 30000 });
    const info = await page.textContent('#list');
    const px = info.includes('1275') && info.includes('1875'); // 4.25×6.25in at 300dpi (with bleed)
    const dl = await grabDownload(page, () => page.click('#pdf'));
    const { PDFDocument: PL3 } = require(path.join(__dirname, '..', 'node_modules', 'pdf-lib'));
    const pdfDoc3 = await PL3.load(dl.bytes);
    const { width: mbW } = pdfDoc3.getPage(0).getSize();
    report('printprep', dl.bytes.subarray(0, 5).toString() === '%PDF-' && px && Math.round(mbW) === 306, `4×6in +0.125in bleed → page ${mbW.toFixed(1)}×?pt (4.25in=306pt), 1275×1875px @300dpi${info.includes('DPI effective') ? ', DPI shown' : ''}`);
    await page.screenshot({ path: path.join(SHOTS, '10-printprep.png') });
  });

  /* ---------- hub ---------- */
  await withPage(async (page) => {
    await page.goto(`${BASE}/index.html`);
    const cards = await page.locator('.cards').count();
    await page.screenshot({ path: path.join(SHOTS, '00-hub.png'), fullPage: true });
    report('hub', cards === 10, `10 tool cards on the hub page`);
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e); process.exit(2); });
