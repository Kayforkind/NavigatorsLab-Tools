/* Per-tool Open Graph images (1200×630) + refreshed suite banner.
 * Rendered with headless Chromium so text/layout are pixel-exact. */
const path = require('node:path');
const fs = require('node:fs');
function resolvePlaywright() {
  const candidates = [
    process.env.PW_MODULES,
    'C:/Users/kazim/AppData/Roaming/npm/node_modules/@playwright/test/node_modules',
    path.resolve(__dirname, '..', 'node_modules'),
  ].filter(Boolean);
  for (const c of candidates) { try { return require(path.join(c, 'playwright')); } catch { /* next */ } }
  throw new Error('playwright not found; set PW_MODULES or npm i -D playwright');
}
const { chromium } = resolvePlaywright();

const ROOT = path.resolve(__dirname, '..');
const tools = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'tools.json'), 'utf8'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

  const agents = { id: 'agents', icon: '🤖', name: 'Agent Mode', tagline: 'An MCP endpoint + deep links for AI agents — same privacy, zero uploads.', url: 'https://navigatorslab.com/tools/agents.html' };
  for (const t of [agents, ...tools]) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!doctype html><html><head><style>
      body { margin:0; width:1200px; height:630px; background:linear-gradient(135deg,#0b0f17 0%,#101a2b 60%,#0b2620 100%);
             font-family:Segoe UI, system-ui, sans-serif; color:#e8eef7; display:flex; flex-direction:column;
             justify-content:space-between; padding:56px 64px; box-sizing:border-box; }
      .brand { font-size:22px; letter-spacing:.4px; color:#9fb0c8; }
      .brand b { color:#e8eef7; }
      .mid { display:flex; align-items:center; gap:44px; }
      .ico { font-size:150px; line-height:1; filter:drop-shadow(0 12px 30px rgba(0,0,0,.5)); }
      h1 { font-size:64px; margin:0 0 18px; line-height:1.05; }
      .tag { font-size:28px; color:#9fb0c8; margin:0; max-width:760px; line-height:1.35; }
      .foot { display:flex; justify-content:space-between; align-items:center; color:#6d7f99; font-size:20px; }
      .pill { border:1px solid #2a3b55; border-radius:999px; padding:8px 18px; font-size:18px; color:#7ce0ae; }
    </style></head><body>
      <div class="brand">🧭 NavigatorsLab <b>Tools</b> · free · open source · in-browser</div>
      <div class="mid">
        <div class="ico">${t.icon}</div>
        <div>
          <h1>${esc(t.name)}</h1>
          <p class="tag">${esc(t.tagline)}.</p>
        </div>
      </div>
      <div class="foot"><span>navigatorslab.com/tools/${t.id}</span><span class="pill">✓ no uploads — runs on your device</span></div>
    </body></html>`;
    await page.setContent(html);
    await page.screenshot({ path: path.join(ROOT, 'public', `og-${t.id}.png`) });
    console.log(`og-${t.id}.png`);
  }

  /* refreshed banner: same design, suite-level message */
  const banner = `<!doctype html><html><head><style>
    body { margin:0; width:1200px; height:630px; background:linear-gradient(135deg,#0b0f17 0%,#101a2b 60%,#0b2620 100%);
           font-family:Segoe UI, system-ui, sans-serif; color:#e8eef7; display:flex; flex-direction:column;
           justify-content:space-between; padding:56px 64px; box-sizing:border-box; }
    .brand { font-size:24px; letter-spacing:.4px; color:#9fb0c8; }
    .brand b { color:#e8eef7; }
    h1 { font-size:72px; margin:0; line-height:1.03; }
    h1 span { color:#7ce0ae; }
    .sub { font-size:26px; color:#9fb0c8; margin:18px 0 0; max-width:900px; line-height:1.4; }
    .icons { font-size:36px; letter-spacing:10px; margin-top:8px; }
    .foot { display:flex; justify-content:space-between; color:#6d7f99; font-size:20px; }
    .pill { border:1px solid #2a3b55; border-radius:999px; padding:8px 18px; font-size:18px; color:#7ce0ae; }
  </style></head><body>
    <div class="brand">🧭 NavigatorsLab <b>Tools</b> · free · open source</div>
    <div>
      <h1>Fifteen tools that<br /><span>never phone home.</span></h1>
      <p class="sub">Strip GPS · shrink images · clean scans · sign PDFs · organize PDF pages · OCR receipts · QR codes · diff texts · text stats · trim audio · invoices · rename · print prep — all inside your browser tab, plus an MCP endpoint for AI agents.</p>
      <div class="icons">🛡️🔍🗜️📄✍️🧾🔢🔳📑🔬📊🎧🧮🗂️🖨️🤖</div>
    </div>
    <div class="foot"><span>navigatorslab.com/tools</span><span class="pill">✓ no uploads · no accounts · nothing retained</span></div>
  </body></html>`;
  await page.setContent(banner);
  await page.screenshot({ path: path.join(ROOT, 'public', 'og-image.png') });
  await page.close();
  await browser.close();
  console.log('og-image.png (banner)');
})();
