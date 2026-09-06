/* Hub: renders the grid from public/tools.json (single source of truth),
 * powers search + category chips + "recently used" (localStorage only),
 * the PWA install button, an EN/TR/DE language switcher, and a
 * "what's new" toast for returning users. No network beyond tools.json. */
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
}

const CATS: [string, string][] = [
  ['all', 'cat.all'],
  ['privacy', 'cat.privacy'],
  ['documents', 'cat.documents'],
  ['money', 'cat.money'],
  ['images', 'cat.images'],
  ['media', 'cat.media'],
  ['files', 'cat.files'],
];

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

/* ---------- i18n: translate static chrome ---------- */
function applyI18n(): void {
  document.documentElement.lang = lang;
  const bind = (id: string, key: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key, lang);
  };
  bind('tagline', 'brand.tagline');
  bind('heroKicker', 'hero.kicker');
  bind('heroT1', 'hero.title1');
  bind('heroT2', 'hero.title2');
  bind('ctaBrowse', 'hero.cta.browse');
  bind('ctaGithub', 'hero.cta.github');
  bind('installBtn', 'hero.cta.install');
  bind('proofOffline', 'hero.proof.offline');
  bind('proofTests', 'hero.proof.tests');
  bind('proofSecurity', 'hero.proof.security');
  bind('toolsHead', 'tools.head');
  bind('noResults', 'search.none');
  search.placeholder = t('tools.search', lang);
  const vis = document.querySelector('.verify-wrap');
  if (vis) {
    vis.querySelector('h2')!.textContent = t('verify.title', lang);
    (vis.querySelector('.sub') as HTMLElement).textContent = t('verify.sub', lang);
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
}

/* ---------- grid ---------- */
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
  const sorted = [...visible].sort((a, b) => {
    if (q || cat !== 'all') return 0;
    return (used.has(b.id) ? 1 : 0) - (used.has(a.id) ? 1 : 0);
  });
  for (const tool of sorted) {
    const a = document.createElement('a');
    a.className = 'cards';
    a.href = `./${tool.id}.html`;
    a.addEventListener('click', () => markUsed(tool.id));
    a.innerHTML = `
      <div class="card-top"><span class="ico">${tool.icon}</span>${used.has(tool.id) ? `<span class="pill">${t('card.recent', lang)}</span>` : ''}</div>
      <h3>${tool.name}</h3>
      <p class="tag">${toolTagline(tool.id, tool.tagline, lang)}</p>
      <p class="detail">${tool.detail}</p>
      <span class="open">${t('card.open', lang)}</span>`;
    grid.appendChild(a);
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
    applyI18n();
    search.addEventListener('input', render);
    setTimeout(showWhatsNew, 900);
  });
