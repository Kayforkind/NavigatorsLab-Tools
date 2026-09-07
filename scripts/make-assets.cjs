/* OG social image 1200x630 + PWA icons 192/512, rendered to match the suite's look. */
const path = require('node:path');
const fs = require('node:fs');
const NODE_PATH = (process.env.APPDATA ? process.env.APPDATA + '/npm/node_modules/@playwright/test/node_modules' : '');
const { chromium } = require(path.join(NODE_PATH, 'playwright'));

const OUT = path.resolve(__dirname, '..', 'public');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // --- OG image 1200x630 ---
  const og = `<!doctype html><html><head><style>
    body { margin:0; width:1200px; height:630px; background:linear-gradient(135deg,#0b0f17,#101828); color:#e7ecf5;
           font-family:'Segoe UI',system-ui,sans-serif; display:flex; flex-direction:column; justify-content:center; padding:0 90px; }
    .brand { font-size:30px; color:#9aa7bd; letter-spacing:.4px; }
    .brand b { color:#4f8cff; }
    h1 { font-size:76px; margin:18px 0 10px; }
    .sub { font-size:27px; color:#9aa7bd; max-width:900px; line-height:1.45; }
    .sub b { color:#7ce0ae; }
    .tools { display:flex; gap:14px; margin-top:42px; flex-wrap:wrap; max-width:1000px; }
    .tools span { border:1px solid #24304a; border-radius:999px; padding:9px 20px; font-size:19px; color:#c9d4e8; }
    .url { position:absolute; bottom:44px; left:90px; font-size:23px; color:#4f8cff; font-weight:600; }
    .mit { position:absolute; bottom:44px; right:90px; font-size:20px; color:#9aa7bd; }
  </style></head><body>
    <div class="brand">🧭 NavigatorsLab <b>Tools</b></div>
    <h1>Ten tools. Zero uploads.</h1>
    <div class="sub">Strip GPS, shrink images, clean scans, sign PDFs, trim audio, make invoices — everything runs <b>in your browser</b>. No accounts. Nothing retained.</div>
    <div class="tools"><span>🛡️ Privacy</span><span>🗜️ Shrink</span><span>📄 Scan</span><span>✍️ Sign</span><span>🔍 Metadata</span><span>🎧 Audio</span><span>🧮 Invoice</span><span>🗂️ Rename</span><span>🖨️ Print</span></div>
    <div class="url">navigatorslab.com/tools</div>
    <div class="mit">free · open source (MIT)</div>
  </body></html>`;
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(og);
  await page.screenshot({ path: path.join(OUT, 'og-image.png') });

  // --- PWA icons 192/512 (compass glyph on dark tile) ---
  for (const size of [192, 512]) {
    const icon = `<!doctype html><html><head><style>
      body { margin:0; width:${size}px; height:${size}px; background:#0b0f17; display:flex; align-items:center; justify-content:center; }
      .tile { width:${Math.round(size * 0.82)}px; height:${Math.round(size * 0.82)}px; border-radius:${Math.round(size * 0.18)}px;
              background:linear-gradient(135deg,#101828,#0d1320); border:${Math.max(2, Math.round(size / 96))}px solid #4f8cff;
              display:flex; align-items:center; justify-content:center; font-size:${Math.round(size * 0.5)}px; }
    </style></head><body><div class="tile">🧭</div></body></html>`;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(icon);
    await page.screenshot({ path: path.join(OUT, `pwa-${size}.png`) });
  }
  await browser.close();
  for (const f of ['og-image.png', 'pwa-192.png', 'pwa-512.png']) {
    const kb = Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
    console.log(`${f}: ${kb}KB`);
  }
})();
