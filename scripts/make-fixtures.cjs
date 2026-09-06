/* Generate E2E fixtures with zero Python deps: Playwright renders the images,
 * EXIF is spliced in byte-level (same format the unit tests build), the WAV
 * tone and DOCX are written directly. Outputs to dev-assets/ and dist/fx/. */
const path = require('node:path');
const fs = require('node:fs');
const JSZip = require(path.join(__dirname, '..', 'node_modules', 'jszip'));
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

const DEV = path.resolve(__dirname, '..', 'dev-assets');
const FX = path.resolve(__dirname, '..', 'dist', 'fx');
fs.mkdirSync(DEV, { recursive: true });

function u16(v) { return [(v >> 8) & 0xff, v & 0xff]; }
function u16le(v) { return [v & 0xff, (v >> 8) & 0xff]; }
function u32le(v) { return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]; }
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

/** Insert an APP1 EXIF segment (GPS + camera + dates, big-endian TIFF=II) after JPEG SOI. */
function injectExif(jpegBuf) {
  // TIFF IFD0: Make, Model, DateTime + GPS IFD pointer (4 entries);
  // GPS IFD: LatRef, Lat, LonRef, Lon (4 entries); tail: gpsData, make, model, dt
  const ifd0Off = 8;
  const N0 = 4; // IFD0 entry count
  const gpsIfdOff = ifd0Off + 2 + N0 * 12 + 4;          // 62
  const NG = 4; // GPS entry count
  const gpsDataOff = gpsIfdOff + 2 + NG * 12 + 4;       // 116
  const latOff = gpsDataOff;                            // 3 rationals = 24B
  const lonOff = gpsDataOff + 24;                       // 24B
  const makeDataOff = lonOff + 24;
  const makeBytes = ascii('NavCam\0');
  const modelDataOff = makeDataOff + makeBytes.length;
  const modelBytes = ascii('Pixel 99\0');
  const dtDataOff = modelDataOff + modelBytes.length;
  const dtBytes = ascii('2026:09:05 14:30:00\0');

  const entry = (tag, type, count, off) => [...u16le(tag), ...u16le(type), ...u32le(count), ...u32le(off)];
  const rational = (n) => [...u32le(n), ...u32le(1)];

  const ifd0b = [
    ...u16le(4),
    ...entry(0x010f, 2, makeBytes.length, makeDataOff),
    ...entry(0x0110, 2, modelBytes.length, modelDataOff),
    ...entry(0x0132, 2, dtBytes.length, dtDataOff),
    ...entry(0x8825, 4, 1, gpsIfdOff), // GPS IFD pointer (inline LONG)
    ...u32le(0),
  ];
  // GPS IFD with refs as inline ASCII ("N\0" / "E\0" fit in the 4 value bytes)
  const gps = [
    ...u16le(4),
    ...entry(0x0001, 2, 2, 0x4e), // "N\0" inline
    ...entry(0x0002, 5, 3, latOff),
    ...entry(0x0003, 2, 2, 0x45), // "E\0" inline
    ...entry(0x0004, 5, 3, lonOff),
    ...u32le(0),
  ];
  // tail order must match the offsets above: gpsData @116, make @164, model @171, dt @180
  const gpsData = [...rational(41), ...rational(0), ...rational(0), ...rational(29), ...rational(0), ...rational(0)];
  const tail = [...gpsData, ...makeBytes, ...modelBytes, ...dtBytes];

  const tiff = [...ascii('II'), 0x2a, 0x00, ...u32le(ifd0Off), ...ifd0b, ...gps, ...tail];
  const app1Payload = [...ascii('Exif\0\0'), ...tiff];
  const seg = [0xff, 0xe1, ...u16(app1Payload.length + 2), ...app1Payload];

  const out = Buffer.alloc(jpegBuf.length + seg.length);
  jpegBuf.copy(out, 0, 0, 2); // SOI
  Buffer.from(seg).copy(out, 2);
  jpegBuf.copy(out, 2 + seg.length, 2);
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const render = async (w, h, draw, type, quality) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent('<body style="margin:0"><canvas id="c"></canvas></body>');
    // return base64 — stable serialization across playwright versions
    return page.evaluate(async ({ w, h, draw, type, quality }) => {
      const c = document.getElementById('c');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f5f1e6';
      ctx.fillRect(0, 0, w, h);
      // eslint-disable-next-line no-new-func
      await new Function('ctx', 'w', 'h', `return (async () => { ${draw} })()`)(ctx, w, h);
      const blob = await new Promise((res) => c.toBlob(res, type, quality));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      return btoa(s);
    }, { w, h, draw, type, quality }).then((b64) => Buffer.from(b64, 'base64'));
  };

  // 1. plain JPEG (EXIF injected below)
  const gpsJpeg = await render(1200, 800, `
    ctx.fillStyle='#1e293b'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#4f8cff';
    for (let x=0;x<w;x+=60) for (let y=0;y<h;y+=120) if ((x+y)%120===0) ctx.fillRect(x,y,30,30);
  `, 'image/jpeg', 0.9);
  fs.writeFileSync(path.join(DEV, 'gps-photo.jpg'), injectExif(Buffer.from(gpsJpeg)));

  // 2. receipt photos
  for (let i = 1; i <= 3; i++) {
    const buf = await render(800, 1200, `
      ctx.fillStyle='#f0f4eb'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='#3c3c3c'; ctx.lineWidth=3; ctx.strokeRect(40,40,w-80,100);
      ctx.fillStyle='#1e1e1e'; ctx.font='28px monospace';
      ctx.fillText('RECEIPT #${i} NAVIGATORSLAB STORE', 70, 100);
      ctx.font='22px monospace';
      for (let line=0;line<8;line++) ctx.fillText('Item '+(line+1)+' ................ '+((line+1)*3.5).toFixed(2), 70, 220+line*90);
    `, 'image/jpeg', 0.88);
    fs.writeFileSync(path.join(DEV, `receipt-${i}.jpg`), Buffer.from(buf));
  }

  // 3. large PNG for the shrinker: per-pixel noise => multi-MB PNG, far above the 300KB target
  const bigPng = await render(1600, 1200, `
    const img = ctx.createImageData(w, h);
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = rnd() * 255; img.data[i+1] = rnd() * 255; img.data[i+2] = rnd() * 255; img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle='#fff'; ctx.font='bold 90px sans-serif'; ctx.fillText('NAVIGATORSLAB', 100, h/2);
  `, 'image/png');
  fs.writeFileSync(path.join(DEV, 'big-photo.png'), Buffer.from(bigPng));

  // 4. audio trimmer tone: 3s 440Hz sine WAV
  const sr = 44100, n = sr * 3;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.round(20000 * Math.sin((2 * Math.PI * 440 * i) / sr) * (0.6 + 0.4 * Math.sin((2 * Math.PI * 0.5 * i) / sr)));
    data.writeInt16LE(v, i * 2);
  }
  const wav = Buffer.concat([
    Buffer.from('RIFF'), Buffer.from(u32le(36 + data.length)), Buffer.from('WAVEfmt '),
    Buffer.from(u32le(16)), Buffer.from(u16le(1)), Buffer.from(u16le(1)), Buffer.from(u32le(sr)), Buffer.from(u32le(sr * 2)), Buffer.from(u16le(2)), Buffer.from(u16le(16)),
    Buffer.from('data'), Buffer.from(u32le(data.length)), data,
  ]);
  fs.writeFileSync(path.join(DEV, 'tone.wav'), wav);

  // 5. PDF + DOCX fixtures
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file('docProps/core.xml', `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Secret Draft</dc:title><dc:creator>J. Hidden</dc:creator><cp:lastModifiedBy>Editor Person</cp:lastModifiedBy><cp:revision>14</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2025-01-01T09:00:00Z</dcterms:created></cp:coreProperties>`);
  zip.file('docProps/app.xml', `<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Company>Stealth Co</Company><TotalTime>240</TotalTime></Properties>`);
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello hidden-data test</w:t></w:r></w:p></w:body></w:document>`);
  fs.writeFileSync(path.join(DEV, 'secret.docx'), await zip.generateAsync({ type: 'nodebuffer' }));

  await browser.close();

  // stage into dist/fx for the static server
  if (fs.existsSync(path.resolve(__dirname, '..', 'dist'))) {
    fs.mkdirSync(FX, { recursive: true });
    for (const f of fs.readdirSync(DEV)) fs.copyFileSync(path.join(DEV, f), path.join(FX, f));
  }
  for (const f of fs.readdirSync(DEV)) console.log(f, Math.round(fs.statSync(path.join(DEV, f)).size / 1024) + 'KB');
})();
