/* Dedicated per-tool detail page (detail.html?id=<tool>) — renders the tool's
 * full story from public/tools.json: billboard-style header, what-it-does,
 * features, how-to steps, verification, agent deep link, related tools, and
 * the full library grid. Everything renders locally; the only network call is
 * the tools.json fetch, same-origin. */
import { toolTagline, getLang, t } from '../lib/i18n';

interface Tool {
  id: string; icon: string; name: string; tagline: string; detail: string;
  category: string; keywords: string; repo?: string; url?: string;
  about?: string; features?: string[]; howto?: string[]; tech?: string;
  goodFor?: string; catLabel?: string; engine?: string; verified?: string;
  pretty?: string;
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
  chips.push('<span class="pill">🔒 runs in your browser</span>');
  chips.push('<span class="pill">🆓 free · open source (MIT)</span>');
  if (tool.engine) chips.push(`<span class="pill">⚙️ ${esc(tool.engine)}</span>`);
  return chips.join('');
}

function hero(tool: Tool): string {
  const href = toolHref(tool);
  return `
  <section class="nl-billboard detail-bb">
    <div class="bb-bg" style="background-image:url('./shots/${tool.id}.jpg')" aria-hidden="true"></div>
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
      <section class="panel">
        <h3>🤖 For AI agents</h3>
        <p>Drive this tool without clicks:</p>
        <p class="mono dim"><code>${toolHref(tool)}?url=&hellip;</code></p>
        <p class="d-meta">Strict allow-listed params, same-origin only. Full guide in
        <a href="./agents.html">Agent Mode</a>; the suite also speaks <b>MCP</b> at <code>POST /tools/mcp</code>.</p>
      </section>
      <section class="panel">
        <h3>🔒 Private by architecture</h3>
        <p>Static page, no upload endpoint, no accounts, no analytics. We keep <b>no attachments and no user information</b>. The security suite watches every network request on every release and asserts nothing leaves the site.</p>
      </section>
    </aside>
  </div>
  ${pretty}`;
}

function poster(tool: Tool): string {
  return `
  <div class="wrap">
    <figure class="d-shot">
      <img src="./shots/${tool.id}.jpg" alt="${esc(tool.name)} in action" loading="lazy" />
      <figcaption>${esc(tool.name)} mid-task — captured by the automated verification run.</figcaption>
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
