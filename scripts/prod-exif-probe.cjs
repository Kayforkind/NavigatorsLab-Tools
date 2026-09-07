/* Live production probe: feed a JPEG carrying Exif + XMP + IPTC + COM to the
 * deployed Photo Privacy Kit, strip it, download, verify all four are gone. */
const path = require('node:path');
const { chromium } = require(path.join(process.env.APPDATA + '/npm/node_modules/@playwright/test/node_modules', 'playwright'));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto('https://navigatorslab.com/tools/exif.html', { waitUntil: 'networkidle' });

  // build the hostile JPEG inside the page (Exif + XMP + IPTC + COM + JFIF)
  await p.evaluate(() => {
    function seg(m, payload) { const out = new Uint8Array(4 + payload.length); out[0] = 0xff; out[1] = m; const len = payload.length + 2; out[2] = (len >> 8) & 0xff; out[3] = len & 0xff; out.set(payload, 4); return out; }
    function cat(parts) { const n = parts.reduce((a, p) => a + p.length, 0); const o = new Uint8Array(n); let x = 0; for (const p of parts) { o.set(p, x); x += p.length; } return o; }
    function sb(s) { return new Uint8Array([...s].map((c) => c.charCodeAt(0))); }
    const SOI = new Uint8Array([0xff, 0xd8]); const EOI = new Uint8Array([0xff, 0xd9]);
    const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0, 0, 0, 0, 0]);
    const jpeg = cat([SOI,
      seg(0xe0, cat([sb('JFIF\0'), new Uint8Array([1, 2, 0, 0, 1, 0, 1, 0, 0])])),
      seg(0xe1, cat([sb('Exif\0\0'), tiff])),
      seg(0xe1, sb('http://ns.adobe.com/xap/1.0/\0<X/>')),
      seg(0xed, sb('8BIM-secret')),
      seg(0xfe, sb('hidden comment')),
      EOI]);
    const f = new File([jpeg], 'multi.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer(); dt.items.add(f);
    document.getElementById('dz').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });

  await p.waitForTimeout(1500);
  const scan = await p.textContent('#stat');
  const dlPromise = p.waitForEvent('download', { timeout: 20000 });
  await p.click('#strip');
  await p.waitForTimeout(2000);
  const after = await p.textContent('#stat');
  console.log('scan :', (scan || '').trim().slice(0, 100));
  console.log('strip:', (after || '').trim().slice(0, 160));

  // grab the downloaded clean file and inspect the bytes
  const dl = await dlPromise.catch(() => null);
  let verdict = 'download not captured';
  if (dl) {
    const fp = await dl.path();
    const fs = require('node:fs');
    const u8 = fs.readFileSync(fp);
    let extra = [];
    for (let i = 0; i < u8.length - 1; i++) {
      if (u8[i] === 0xff && (u8[i + 1] === 0xe1 || u8[i + 1] === 0xed || u8[i + 1] === 0xfe)) extra.push('0x' + u8[i + 1].toString(16));
    }
    verdict = `clean file ${u8.length}B, SOI=${u8[0] === 0xff && u8[1] === 0xd8}, leftover metadata segments: ${extra.length ? extra.join(',') : 'NONE'}`;
  }
  console.log('bytes:', verdict);
  await b.close();
})().catch((e) => { console.error('PROBE FAILED:', e.message); process.exit(1); });
