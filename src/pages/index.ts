/* Hub: Netflix-style browse surface rendered from public/tools.json.
 *
 *  - Billboard: a rotating featured spotlight (art, kicker, open/more/repo)
 *    that cycles through every tool; dots to jump, auto-advance, pauses on
 *    hover/focus, and stands still under prefers-reduced-motion.
 *  - Rails: one horizontal scroller per category (Privacy, Documents, …),
 *    poster cards with the tool's og art + hover scale and an info cap.
 *  - Search / category chips switch to a flat grid of matches (like search
 *    results), same cards.
 *  - PWA install button, EN/TR/DE switcher, "recently used" pill, and the
 *    "what's new" toast all survive. No network beyond tools.json.
 */
import { registerSW } from 'virtual:pwa-register';
import { LANGS, getLang, setLang, t, toolTagline, type Lang } from '../lib/i18n';
import { whatsNew, markSeen } from '../lib/changelog';

registerSW({ immediate: true });

interface Tool {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  detail: string;
  category: string;
  keywords: string;
  /** standalone GitHub funnel repo (links back to the hub) */
  repo?: string;
  /** external URL for tools served outside the hub (e.g. the Reimagine playground) */
  url?: string;
  /** hub-native page for tools that also live outside (e.g. reimagine.html) */
  page?: string;
}

const CATS: [string, string][] = [
  ['all', 'cat.all'],
  ['privacy', 'cat.privacy'],
  ['documents', 'cat.documents'],
  ['money', 'cat.money'],
  ['images', 'cat.images'],
  ['media', 'cat.media'],
  ['files', 'cat.files'],
  ['design', 'cat.design'],
];

/** rail order for the Netflix-style rows (category id → i18n key) */
const RAILS: [string, string][] = CATS.slice(1);

const grid = document.getElementById('grid')!;
const chips = document.getElementById('chips')!;
const search = document.getElementById('search') as HTMLInputElement;
const noResults = document.getElementById('noResults')!;
let lang: Lang = getLang();

let tools: Tool[] = [];
let cat = 'all';

const RECENTS_KEY = 'nl-tools-recents';

function recents(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); } catch { return []; }
}

function markUsed(id: string): void {
  const r = recents().filter((x) => x !== id);
  r.unshift(id);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(r.slice(0, 3)));
}

/** primary destination for a tool card: hub page > external url > tool page */
function toolHref(t: Tool): string {
  if (t.page) return `./${t.page}`;
  return t.url ?? `./${t.id}.html`;
}

/* ---------- billboard ---------- */
const bbArt = document.getElementById('bbArt') as HTMLImageElement;
const bbKicker = document.getElementById('bbKicker')!;
const bbTitle = document.getElementById('bbTitle')!;
const bbTagline = document.getElementById('bbTagline')!;
const bbOpen = document.getElementById('bbOpen') as HTMLAnchorElement;
const bbMore = document.getElementById('bbMore') as HTMLAnchorElement;
const bbRepo = document.getElementById('bbRepo') as HTMLAnchorElement;
const bbDots = document.getElementById('bbDots')!;

let bbIdx = 0;
let bbTimer: number | null = null;
let bbPaused = false;
// window.matchMedia is Chrome/Edge; fall back to no auto-advance concerns elsewhere
let bbReduced = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

function showBillboard(i: number): void {
  if (!tools.length) return;
  bbIdx = ((i % tools.length) + tools.length) % tools.length;
  const tool = tools[bbIdx];
  bbArt.classList.remove('ready');
  bbArt.onload = () => bbArt.classList.add('ready');
  bbArt.src = `./og-${tool.id}.png`;
  bbArt.alt = `${tool.name} — ${tool.tagline}`;
  bbKicker.textContent = `${t('bb.kicker', lang)} · ${t(`cat.${tool.category}`, lang)}`;
  bbTitle.textContent = `${tool.icon} ${tool.name}`;
  bbTagline.textContent = toolTagline(tool.id, tool.tagline, lang);
  bbOpen.href = toolHref(tool);
  bbMore.href = tool.url ?? `./${tool.id}.html`;
  bbRepo.href = tool.repo ?? 'https://github.com/Kayforkind/NavigatorsLab-Tools';
  const dots = bbDots.querySelectorAll<HTMLButtonElement>('button');
  dots.forEach((d, j) => {
    d.classList.toggle('on', j === bbIdx);
    d.setAttribute('aria-current', j === bbIdx ? 'true' : 'false');
  });
}

function advanceBillboard(): void {
  if (!bbPaused && !bbReduced) showBillboard(bbIdx + 1);
}

function startBillboard(): void {
  if (bbTimer !== null) return;
  if (bbReduced) return; // reduced motion: no auto-advance, dots still work
  bbTimer = setInterval(advanceBillboard, 8000);
}

/* ---------- i18n: translate static chrome ---------- */
function applyI18n(): void {
  document.documentElement.lang = lang;
  const bind = (id: string, key: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key, lang);
  };
  bind('tagline', 'brand.tagline');
  bind('installBtn', 'hero.cta.install');
  bind('toolsHead', 'tools.head');
  bind('agentsHead', 'agents.head');
  bind('agentsSub', 'agents.sub');
  bind('ctaAgents', 'hero.cta.agents');
  bind('noResults', 'search.none');
  const mirrors = document.getElementById('mirrorsLine');
  if (mirrors) {
    mirrors.innerHTML = t('mirrors.line', lang)
      .replace('one repo per tool', '<a href="https://github.com/Kayforkind/NavigatorsLab-Tools#one-repo-per-tool">one repo per tool</a>');
  }
  bind('vsTitle', 'vs.title');
  bind('vsSub', 'vs.sub');
  search.placeholder = t('tools.search', lang);
  const agentsPill = document.querySelector('.pill-agents');
  if (agentsPill) agentsPill.textContent = t('agents.pill', lang);
  const brag = document.querySelector('.brag');
  if (brag) {
    brag.querySelector('h2')!.textContent = t('brag.title', lang);
    (brag.querySelector('.sub') as HTMLElement).textContent = t('brag.sub', lang);
  }
  const strip = document.querySelector('.privacy-strip');
  if (strip) {
    strip.querySelector('h2')!.textContent = t('privacy.title', lang);
    (strip.querySelector('p') as HTMLElement).textContent = t('privacy.body', lang);
  }
  const foot = document.querySelector('.nl-foot');
  if (foot) {
    const spans = foot.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = t('footer.privacy', lang);
    const links = foot.querySelectorAll('a');
    if (links[0]) links[0].textContent = t('footer.github', lang);
    if (links[1]) links[1].textContent = t('footer.sitemap', lang);
  }
  // language selector state
  for (const b of document.querySelectorAll<HTMLButtonElement>('.lang-btn')) {
    b.classList.toggle('on', b.dataset.lang === lang);
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
  renderChips();
  render();
  showBillboard(bbIdx);
}

/* ---------- cards ---------- */
function makeCard(tool: Tool, used: Set<string>): HTMLElement {
  const card = document.createElement('article');
  card.className = 'cards poster';
  card.dataset.id = tool.id;
  const open = document.createElement('a');
  open.className = 'poster-link';
  open.href = toolHref(tool);
  open.addEventListener('click', () => markUsed(tool.id));
  open.innerHTML = `
    <img class="poster-art" src="./og-${tool.id}.png" alt="" loading="lazy" />
    <span class="poster-cap">
      <span class="ico">${tool.icon}</span>
      <b>${tool.name}</b>
      ${used.has(tool.id) ? `<span class="pill">${t('card.recent', lang)}</span>` : ''}
    </span>`;
  card.appendChild(open);
  if (tool.repo) {
    const repo = document.createElement('a');
    repo.className = 'repo';
    repo.href = tool.repo;
    repo.target = '_blank';
    repo.rel = 'noopener noreferrer';
    repo.title = 'Standalone GitHub repository — the tool itself runs on NavigatorsLab';
    repo.setAttribute('aria-label', `${tool.name} — GitHub repository`);
    repo.textContent = t('card.repo', lang);
    card.appendChild(repo);
  }
  return card;
}

/* ---------- rails / grid ---------- */
function render(): void {
  const q = search.value.trim().toLowerCase();
  const used = new Set(recents());
  const visible = tools.filter((tool) => {
    if (cat !== 'all' && tool.category !== cat) return false;
    if (!q) return true;
    return (tool.name + ' ' + tool.tagline + ' ' + tool.detail + ' ' + tool.keywords).toLowerCase().includes(q);
  });
  noResults.hidden = visible.length > 0;
  grid.innerHTML = '';

  if (q || cat !== 'all') {
    // flat search/filter grid — same poster cards, one per tool
    for (const tool of visible) grid.appendChild(makeCard(tool, used));
    if (!visible.length) grid.classList.add('empty');
    else grid.classList.remove('empty');
    return;
  }

  // Netflix-style rails: one horizontal scroller per category
  grid.classList.remove('empty');
  for (const [cid, key] of RAILS) {
    const group = tools.filter((t) => t.category === cid);
    if (!group.length) continue;
    const rail = document.createElement('section');
    rail.className = 'rail';
    rail.setAttribute('aria-label', t(key, lang));
    const h = document.createElement('h3');
    h.className = 'rail-title';
    h.textContent = t(key, lang);
    rail.appendChild(h);
    const scroller = document.createElement('div');
    scroller.className = 'rail-scroll';
    scroller.setAttribute('role', 'list');
    for (const tool of group) {
      const wrap = document.createElement('div');
      wrap.className = 'rail-item';
      wrap.setAttribute('role', 'listitem');
      wrap.appendChild(makeCard(tool, used));
      scroller.appendChild(wrap);
    }
    rail.appendChild(scroller);
    grid.appendChild(rail);
  }
}

function renderChips(): void {
  chips.innerHTML = '';
  for (const [id, key] of CATS) {
    const b = document.createElement('button');
    b.className = 'chip' + (id === cat ? ' on' : '');
    b.textContent = t(key, lang);
    b.addEventListener('click', () => { cat = id; renderChips(); render(); });
    chips.appendChild(b);
  }
}

/* ---------- language switcher ---------- */
for (const [code, label] of LANGS) {
  const b = document.createElement('button');
  b.className = 'lang-btn';
  b.dataset.lang = code;
  b.textContent = label;
  b.setAttribute('aria-label', `${t('lang.label', lang)}: ${label}`);
  b.addEventListener('click', () => { lang = code; setLang(code); applyI18n(); });
  document.getElementById('langSel')!.appendChild(b);
}

/* ---------- PWA install button ---------- */
let deferredPrompt: { prompt: () => void } | null = null;
const installBtn = document.getElementById('installBtn') as HTMLButtonElement;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as unknown as { prompt: () => void };
  installBtn.hidden = false;
});
installBtn.addEventListener('click', () => { deferredPrompt?.prompt(); deferredPrompt = null; installBtn.hidden = true; });

/* ---------- what's new toast (returning users only) ---------- */
function showWhatsNew(): void {
  const fresh = whatsNew();
  markSeen(); // shown once per version
  if (!fresh.length) return;
  const toast = document.createElement('div');
  toast.className = 'whats-new';
  toast.setAttribute('role', 'status');
  const items = fresh.flatMap((e) => e.items).slice(0, 5);
  toast.innerHTML = `
    <div class="wn-head"><b>✨ What's new</b><button class="wn-x" aria-label="Dismiss">×</button></div>
    <ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>
    <div class="wn-foot"><a href="https://github.com/Kayforkind/NavigatorsLab-Tools/releases">release notes ↗</a></div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  toast.querySelector('.wn-x')!.addEventListener('click', () => toast.remove());
  setTimeout(() => toast.remove(), 12000);
}

fetch('./tools.json')
  .then((r) => r.json())
  .then((data: Tool[]) => {
    tools = data;
    // billboard dots: one per tool, in catalog order
    bbDots.innerHTML = '';
    for (let i = 0; i < tools.length; i++) {
      const d = document.createElement('button');
      d.className = 'bb-dot';
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', `${t('bb.spotlight', lang)}: ${tools[i].name}`);
      d.addEventListener('click', () => { showBillboard(i); startBillboard(); });
      bbDots.appendChild(d);
    }
    // billboard hover/focus pauses the auto-advance (Netflix behavior)
    const bb = document.getElementById('billboard')!;
    bb.addEventListener('mouseenter', () => { bbPaused = true; });
    bb.addEventListener('mouseleave', () => { bbPaused = false; });
    bb.addEventListener('focusin', () => { bbPaused = true; });
    bb.addEventListener('focusout', () => { bbPaused = false; });
    applyI18n();
    showBillboard(0);
    startBillboard();
    search.addEventListener('input', render);
    setTimeout(showWhatsNew, 900);
  });