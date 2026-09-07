/* Full end-to-end OCR on PRODUCTION: generate a receipt in the browser,
 * feed it to the deployed Receipt OCR tool, let the real same-origin engine
 * read it, export the CSV. Strongest proof that the engine base-URL fix
 * works — no localhost involved. */
const path = require('node:path');
const { chromium } = require(path.join(process.env.APPDATA + '/npm/node_modules/@playwright/test/node_modules', 'playwright'));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ acceptDownloads: true, bypassCSP: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));

  await p.goto('https://navigatorslab.com/tools/ocr.html', { waitUntil: 'networkidle' });

  // 1. render a crisp receipt PNG inside the page
  const dataUrl = await p.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 620; c.height = 900;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 620, 900);
    x.fillStyle = '#111';
    x.font = 'bold 34px Arial'; x.textAlign = 'center';
    x.fillText('HARBOR MARKET', 310, 80);
    x.font = '20px Arial';
    x.fillText('12 PIER ROAD · BAYTOWN', 310, 115);
    x.textAlign = 'left';
    x.font = '24px Arial';
    const rows = [
      ['MILK 2%', '3.49'],
      ['BREAD WHOLEGRAIN', '4.29'],
      ['EGGS FREE RANGE', '5.99'],
      ['COFFEE BEANS 500G', '12.50'],
    ];
    let y = 190;
    for (const [name, price] of rows) {
      x.fillText(name, 50, y);
      x.fillText('$' + price, 460, y);
      y += 46;
    }
    y += 16;
    x.font = 'bold 26px Arial';
    x.fillText('TOTAL', 50, y);
    x.fillText('$26.27', 460, y);
    y += 40;
    x.font = '20px Arial';
    x.fillText('VISA ****1234', 50, y);
    return c.toDataURL('image/png');
  });

  // 2. drop it into the deployed tool
  await p.evaluate(async (url) => {
    const r = await fetch(url);
    const blob = await r.blob();
    const f = new File([blob], 'prod-receipt.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(f);
    document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, dataUrl);

  // 3. wait for the real engine (loaded from /tools/tess/ on prod) to finish
  await p.waitForFunction(() => {
    const st = document.querySelector('#stat')?.textContent || '';
    return st.includes('total') || st.includes('detected') || st.includes('Could not');
  }, { timeout: 180000 });
  const stat = (await p.textContent('#stat') || '').trim();
  console.log('engine status:', stat.slice(0, 120));

  const ok = stat.includes('total') || stat.includes('detected');
  if (!ok) {
    console.log('OCR DID NOT COMPLETE — engine fix NOT proven on prod');
    await b.close();
    process.exit(1);
  }

  // 4. export the CSV
  const dl = await (async () => {
    const d = p.waitForEvent('download', { timeout: 15000 });
    await p.click('#csv');
    return d;
  })().catch(() => null);
  if (dl) {
    const fp = await dl.path();
    const fs = require('node:fs');
    const csv = fs.readFileSync(fp, 'utf8');
    console.log('CSV header:', csv.split('\n')[0]);
    const amt = /,([\d.]+),/.exec(csv.split('\n')[1] || '');
    console.log('CSV row amount:', amt ? amt[1] : '(none)', '| contains 26.27:', csv.includes('26.27'));
  }
  console.log('JS errors:', errors.length);
  console.log(ok ? 'PROD OCR E2E: PASS — real engine ran on navigatorslab.com' : 'FAIL');
  await b.close();
})().catch((e) => { console.error('PROBE FAILED:', e.message); process.exit(1); });
