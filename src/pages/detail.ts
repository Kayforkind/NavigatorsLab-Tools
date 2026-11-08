/* Dedicated per-tool detail page (detail.html?id=<tool>) — renders the tool's
 * full story from public/tools.json: billboard-style header, 16:9 demo video,
 * concrete Input -> Engine -> Output breakdown, what-it-does, features, how-to
 * steps, verification, agent deep link, related tools, and the full library grid. */
import { toolTagline, getLang, t } from '../lib/i18n';

interface GuideStep {
  title: string;
  ui: string;
  narration: string;
  guide: string;
  result: string;
}

interface GuideControl {
  name: string;
  desc: string;
}

interface Tool {
  id: string; icon: string; name: string; tagline: string; detail: string;
  category: string; keywords: string; repo?: string; url?: string;
  about?: string; features?: string[]; howto?: string[]; tech?: string;
  goodFor?: string; catLabel?: string; engine?: string; verified?: string;
  pretty?: string; shot?: string; kind?: string;
  exampleInput?: string;
  exampleInputDetail?: string;
  exampleEngine?: string;
  exampleOutput?: string;
  exampleOutputDetail?: string;
  sampleOutputCode?: string;
  video?: string;
  poster?: string;
  videoDuration?: string;
  guideSteps?: GuideStep[];
  guideControls?: GuideControl[];
  guideProTips?: string[];
  guideSpecs?: string;
}

/** hero/poster art: in-action screenshot for browser tools, og poster otherwise */
function artSrc(tool: Tool): string {
  return tool.shot === 'og' ? `./og-${tool.id}.png` : `./shots/${tool.id}.jpg`;
}

let tools: Tool[] = [];
const lang = getLang();

function toolHref(tool: Tool): string {
  return tool.url ?? `./${tool.id}.html`;
}

function currentId(): string {
  return new URLSearchParams(location.search).get('id')?.trim() ?? '';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function metaCard(tool: Tool): string {
  const chips: string[] = [];
  if (tool.catLabel) chips.push(`<a href="./index.html" class="pill">${esc(tool.catLabel)}</a>`);
  chips.push(tool.kind === 'local'
    ? '<span class="pill">💻 runs on your machine</span>'
    : '<span class="pill">🔒 runs in your browser</span>');
  chips.push('<span class="pill">🆓 free · open source (MIT)</span>');
  if (tool.engine) chips.push(`<span class="pill">⚙️ ${esc(tool.engine)}</span>`);
  return chips.join('');
}

function hero(tool: Tool): string {
  const href = toolHref(tool);
  return `
  <section class="nl-billboard detail-bb">
    <div class="bb-bg" style="background-image:url('${artSrc(tool)}')" aria-hidden="true"></div>
    <div class="bb-shade" aria-hidden="true"></div>
    <div class="bb-body">
      <div class="bb-now">🧭 NavigatorsLab Library · ${esc(tool.catLabel ?? '')} · tool details</div>
      <div class="bb-title"><span class="bb-ico">${tool.icon}</span><h1>${esc(tool.name)}</h1></div>
      <p class="bb-tag">${esc(toolTagline(tool.id, tool.tagline, lang))}</p>
      ${metaCard(tool)}
      <div class="bb-cta">
        <a class="btn-hero primary" href="${href}" data-tool="${tool.id}">▶ Open ${esc(tool.name)}</a>
        ${tool.repo ? `<a class="btn-hero" href="${esc(tool.repo)}" target="_blank" rel="noopener noreferrer">GitHub repo ↗</a>` : ''}
        ${tool.pretty ? `<a class="btn-hero" href="https://navigatorslab.com/${esc(tool.pretty)}">navigatorslab.com/${esc(tool.pretty)}</a>` : ''}
      </div>
    </div>
  </section>`;
}

function sections(tool: Tool): string {
  const feats = tool.features ?? [];
  const steps = tool.howto ?? [];
  const pretty = tool.pretty
    ? `<p class="d-meta">Short link: <a href="https://navigatorslab.com/${esc(tool.pretty)}">navigatorslab.com/${esc(tool.pretty)}</a></p>`
    : '';
  return `
  <div class="wrap detail-grid">
    <div class="d-main">
      <section class="d-sec">
        <h2>What it does</h2>
        <p class="d-about">${tool.about ?? esc(tool.detail)}</p>
        ${tool.goodFor ? `<p class="d-goodfor"><b>Good for:</b> ${esc(tool.goodFor)}</p>` : ''}
      </section>
      <section class="d-sec">
        <h2>Features</h2>
        <ul class="d-feats">${feats.map((f) => `<li>${f}</li>`).join('')}</ul>
      </section>
      <section class="d-sec">
        <h2>How it works</h2>
        <ol class="d-steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
      </section>
    </div>
    <aside class="d-side">
      <section class="panel d-verify">
        <h3>✅ Verified, not promised</h3>
        <p>${esc(tool.verified ?? 'Covered by the automated E2E suite.')}</p>
        <p class="d-meta">Every release drops real files into this tool and checks the downloaded bytes.
        <a href="./status.html">Live status →</a></p>
      </section>
      ${tool.kind === 'local'
        ? `<section class="panel">
        <h3>🧱 Run it yourself</h3>
        <p>This is a standalone project — not a hosted web app. Clone the repo and run it locally:</p>
        <p class="mono dim"><code>git clone ${esc(tool.repo ?? '')}</code></p>
        <p class="d-meta">MIT licensed — fork it, self-host it, ship it. Full instructions in the README.</p>
      </section>`
        : `<section class="panel">
        <h3>🤖 For AI agents</h3>
        <p>Drive this tool without clicks:</p>
        <p class="mono dim"><code>${toolHref(tool)}?url=&hellip;</code></p>
        <p class="d-meta">Strict allow-listed params, same-origin only. Full guide in
        <a href="./agents.html">Agent Mode</a>; the suite also speaks <b>MCP</b> at <code>POST /tools/mcp</code>.</p>
      </section>`}
      <section class="panel">
        <h3>🔒 Private by architecture</h3>
        <p>Static page, no upload endpoint, no accounts, no analytics. We keep <b>no attachments and no user information</b>. The security suite watches every network request on every release and asserts nothing leaves the site.</p>
      </section>
    </aside>
  </div>
  ${pretty}`;
}

function poster(tool: Tool): string {
  const isOg = tool.shot === 'og';
  const vidSrc = tool.video ?? `./videos/${tool.id}.mp4`;
  const postSrc = tool.poster ?? `./shots/${tool.id}.jpg`;
  const ioHtml = tool.exampleInput ? `
    <div class="panel" style="margin-bottom:22px;border-color:rgba(45,212,191,.35);background:linear-gradient(180deg,#0f172a,#0b1120)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <h2 style="margin:0;font-size:18px">⚡ Concrete Example: Input → On-Device Engine → Output</h2>
        <span class="pill ok">Verified in CI</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:12px">
        <div style="background:#080c15;border:1px solid rgba(251,113,133,.35);border-radius:10px;padding:12px">
          <div style="font-size:11px;font-weight:700;color:#fda4af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">1 · Raw Input</div>
          <b style="display:block;color:#f8fafc;font-size:14px;margin-bottom:4px">${esc(tool.exampleInput)}</b>
          <div style="color:#94a3b8;font-size:12.5px;line-height:1.45">${esc(tool.exampleInputDetail ?? '')}</div>
        </div>
        <div style="background:#080c15;border:1px solid rgba(45,212,191,.35);border-radius:10px;padding:12px">
          <div style="font-size:11px;font-weight:700;color:#2dd4bf;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">2 · On-Device Engine</div>
          <b style="display:block;color:#f8fafc;font-size:14px;margin-bottom:4px">${esc(tool.engine ?? 'Local Engine')}</b>
          <div style="color:#94a3b8;font-size:12.5px;line-height:1.45">${esc(tool.exampleEngine ?? '')}</div>
        </div>
        <div style="background:#080c15;border:1px solid rgba(52,211,153,.45);border-radius:10px;padding:12px">
          <div style="font-size:11px;font-weight:700;color:#6ee7b7;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">3 · Verified Output</div>
          <b style="display:block;color:#ecfdf5;font-size:14px;margin-bottom:4px">${esc(tool.exampleOutput ?? '')}</b>
          <div style="color:#a7f3d0;font-size:12.5px;line-height:1.45">${esc(tool.exampleOutputDetail ?? '')}</div>
        </div>
      </div>
      <div style="background:#050810;border:1px solid #1e293b;border-radius:8px;padding:10px 14px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:#2dd4bf;overflow-x:auto">
        <b style="color:#94a3b8">SAMPLE OUTPUT PROOF:</b> ${esc(tool.sampleOutputCode ?? tool.verified ?? '')}
      </div>
    </div>
  ` : '';

  const guideHtml = (tool.guideSteps && tool.guideSteps.length > 0) ? `
    <div class="panel" style="margin-bottom:22px;border-color:rgba(56,189,248,.4);background:linear-gradient(180deg,#0c1324,#080d18)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <div>
          <span class="pill" style="background:rgba(45,212,191,.15);color:#2dd4bf;border-color:rgba(45,212,191,.4)">📖 COMPLETE USER MANUAL &amp; STEP-BY-STEP GUIDE</span>
          <h2 style="margin:8px 0 2px;font-size:20px">How to Use ${esc(tool.name)} — Step by Step</h2>
          <p style="margin:0;color:#94a3b8;font-size:13.5px">Follow these exact UI controls, keyboard shortcuts, and verification steps in your browser.</p>
        </div>
        ${tool.guideSpecs ? `<span class="pill">${esc(tool.guideSpecs.split('·')[0].trim())}</span>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:18px">
        ${tool.guideSteps.map((gs, i) => `
          <div style="background:#060a12;border:1px solid #1e293b;border-top:3px solid ${i === 0 ? '#38bdf8' : i === 1 ? '#818cf8' : i === 2 ? '#2dd4bf' : '#34d399'};border-radius:12px;padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px">
              <span style="font-size:11px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em">STEP 0${i + 1}</span>
              <code style="font-size:11px;background:rgba(56,189,248,.12);color:#7dd3fc;padding:2px 7px;border-radius:6px;border:1px solid rgba(56,189,248,.25)">${esc(gs.ui)}</code>
            </div>
            <b style="display:block;color:#f8fafc;font-size:14.5px;margin-bottom:6px">${esc(gs.title.replace(/^Step \d+:\s*/i, ''))}</b>
            <p style="margin:0 0 10px;color:#cbd5e1;font-size:13px;line-height:1.5">${esc(gs.guide)}</p>
            <div style="font-size:12px;color:#6ee7b7;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.25);padding:6px 9px;border-radius:7px">
              <b>✓ Expected result:</b> ${esc(gs.result)}
            </div>
          </div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        ${tool.guideControls && tool.guideControls.length ? `
          <div style="background:#060a12;border:1px solid #1e293b;border-radius:10px;padding:14px">
            <h3 style="margin:0 0 10px;font-size:14px;color:#38bdf8;text-transform:uppercase;letter-spacing:.04em">🎛️ UI Controls &amp; Shortcuts Reference</h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${tool.guideControls.map((c) => `
                <div style="font-size:12.5px;line-height:1.45;padding-bottom:8px;border-bottom:1px dashed rgba(148,163,184,.15)">
                  <code style="color:#2dd4bf;font-weight:700">${esc(c.name)}</code>
                  <div style="color:#94a3b8;margin-top:2px">${esc(c.desc)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${tool.guideProTips && tool.guideProTips.length ? `
          <div style="background:#060a12;border:1px solid #1e293b;border-radius:10px;padding:14px">
            <h3 style="margin:0 0 10px;font-size:14px;color:#fbbf24;text-transform:uppercase;letter-spacing:.04em">💡 Pro Tips &amp; Real-World Workflows</h3>
            <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:12.5px;line-height:1.55;display:flex;flex-direction:column;gap:8px">
              ${tool.guideProTips.map((tip) => `<li>${esc(tip)}</li>`).join('')}
            </ul>
            ${tool.guideSpecs ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #1e293b;font-size:11.5px;color:#94a3b8;font-family:ui-monospace,Consolas,monospace">${esc(tool.guideSpecs)}</div>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  return `
  <div class="wrap">
    <div class="panel" style="padding:16px;margin-bottom:22px;border-color:rgba(45,212,191,.45);background:linear-gradient(180deg,#0f172a,#090e1a)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <div>
          <span class="pill ok" style="margin-right:8px">🔊 NARRATED LIVE USAGE TUTORIAL (${esc(tool.videoDuration ?? '30s')})</span>
          <b style="font-size:15px;color:#f8fafc">Watch How to Use ${esc(tool.name)} Step-by-Step (With Voiceover &amp; Captions)</b>
        </div>
        <a href="${vidSrc}" download style="font-size:12.5px;color:#38bdf8;font-weight:600">⬇ Download Tutorial MP4</a>
      </div>
      <div style="width:100%;aspect-ratio:16/9;background:#05070d;border-radius:12px;overflow:hidden;border:1px solid rgba(45,212,191,.35)">
        <video src="${vidSrc}" poster="${postSrc}" controls playsinline preload="metadata" data-aspect="horizontal" style="width:100%;height:100%;object-fit:contain;display:block"></video>
      </div>
    </div>
    ${guideHtml}
    ${ioHtml}
    <figure class="d-shot">
      <img src="${artSrc(tool)}" alt="${esc(tool.name)} — ${esc(tool.tagline)}" loading="lazy" />
      <figcaption>${isOg
        ? `${esc(tool.name)} — official poster. ${esc(tool.tagline)}.`
        : `${esc(tool.name)} mid-task — captured by the automated verification run.`}</figcaption>
    </figure>
  </div>`;
}

function miniCard(tool: Tool, href: string): string {
  return `<a class="mini" href="${href}" ${href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>
    <span class="mini-ico">${tool.icon}</span>
    <span class="mini-name">${esc(tool.name)}</span>
    <span class="mini-tag">${esc(tool.tagline)}</span>
  </a>`;
}

function related(tool: Tool): string {
  const same = tools.filter((x) => x.id !== tool.id && x.category === tool.category);
  const others = tools.filter((x) => x.id !== tool.id && x.category !== tool.category);
  const picks = [...same, ...others].slice(0, 6);
  const rest = tools.filter((x) => !picks.includes(x) && x.id !== tool.id);
  const gridFor = (list: Tool[]) => list.map((x) => miniCard(x, `./detail.html?id=${x.id}`)).join('');
  return `
  <div class="wrap">
    <section class="d-sec"><h2>Related tools</h2><div class="mini-grid">${gridFor(picks)}</div></section>
  </div>
  <div class="wrap">
    <section class="d-sec"><h2>Explore the library</h2><div class="mini-grid">${gridFor(rest)}</div></section>
  </div>`;
}

function notFound(id: string): string {
  return `
  <div class="wrap narrow">
    <section class="d-sec">
      <h2>Tool “${esc(id)}” isn't in the library</h2>
      <p class="sub">Pick one of the ${tools.length} real tools instead — everything below runs entirely in your browser:</p>
      <div class="mini-grid">${tools.map((x) => miniCard(x, `./detail.html?id=${x.id}`)).join('')}</div>
    </section>
  </div>`;
}

function render(): void {
  const id = currentId();
  const root = document.getElementById('detailRoot')!;
  const tool = tools.find((x) => x.id === id);
  document.title = tool ? `${tool.name} — in-depth — NavigatorsLab Tools` : 'Tool details — NavigatorsLab Tools';
  if (tool) {
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', `${tool.tagline} — free, private, in-browser. ${tool.detail}`);
    const og = document.querySelector('meta[property="og:image"]');
    if (og) og.setAttribute('content', `https://navigatorslab.com/tools/shots/${tool.id}.jpg`);
  }
  root.innerHTML = tool
    ? hero(tool) + poster(tool) + sections(tool) + related(tool)
    : notFound(id);
  window.scrollTo({ top: 0 });
}

async function boot(): Promise<void> {
  try {
    const r = await fetch('./tools.json');
    tools = (await r.json()) as Tool[];
  } catch { return; }
  render();
  /* back/forward navigation between detail pages re-renders in place */
  addEventListener('popstate', render);
  /* hublib tags its primary links with data-tool: open their detail page instead */
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[data-tool]') as HTMLAnchorElement | null;
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    history.pushState({}, '', `./detail.html?id=${a.dataset.tool}`);
    render();
  });
  void t('brand.tagline', lang); // keep i18n import meaningful for localized chrome
}

void boot();
