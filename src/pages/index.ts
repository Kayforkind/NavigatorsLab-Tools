/* Hub: renders the grid from public/tools.json (single source of truth),
 * powers search + category chips + "recently used" (localStorage only),
 * and the PWA install button. No network calls beyond fetching this site's own tools.json. */
import { registerSW } from 'virtual:pwa-register';

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
  ['all', 'All 11'],
  ['privacy', '🛡️ Privacy'],
  ['documents', '📄 Documents'],
  ['money', '🧾 Money'],
  ['images', '🖼️ Images'],
  ['media', '🎧 Media'],
  ['files', '🗂️ Files'],
];

const grid = document.getElementById('grid')!;
const chips = document.getElementById('chips')!;
const search = document.getElementById('search') as HTMLInputElement;
const noResults = document.getElementById('noResults')!;

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

function render(): void {
  const q = search.value.trim().toLowerCase();
  const used = new Set(recents());
  const visible = tools.filter((t) => {
    if (cat !== 'all' && t.category !== cat) return false;
    if (!q) return true;
    return (t.name + ' ' + t.tagline + ' ' + t.detail + ' ' + t.keywords).toLowerCase().includes(q);
  });
  noResults.hidden = visible.length > 0;
  grid.innerHTML = '';
  // recents first when no filter is active
  const sorted = [...visible].sort((a, b) => {
    if (q || cat !== 'all') return 0;
    return (used.has(b.id) ? 1 : 0) - (used.has(a.id) ? 1 : 0);
  });
  for (const t of sorted) {
    const a = document.createElement('a');
    a.className = 'cards';
    a.href = `./${t.id}.html`;
    a.addEventListener('click', () => markUsed(t.id));
    a.innerHTML = `
      <div class="card-top"><span class="ico">${t.icon}</span>${used.has(t.id) ? '<span class="pill">recent</span>' : ''}</div>
      <h3>${t.name}</h3>
      <p class="tag">${t.tagline}</p>
      <p class="detail">${t.detail}</p>
      <span class="open">Open →</span>`;
    grid.appendChild(a);
  }
}

function renderChips(): void {
  chips.innerHTML = '';
  for (const [id, label] of CATS) {
    const b = document.createElement('button');
    b.className = 'chip' + (id === cat ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => { cat = id; renderChips(); render(); });
    chips.appendChild(b);
  }
}

/* PWA install button */
let deferredPrompt: { prompt: () => void } | null = null;
const installBtn = document.getElementById('installBtn') as HTMLButtonElement;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as unknown as { prompt: () => void };
  installBtn.hidden = false;
});
installBtn.addEventListener('click', () => { deferredPrompt?.prompt(); deferredPrompt = null; installBtn.hidden = true; });

fetch('./tools.json')
  .then((r) => r.json())
  .then((data: Tool[]) => {
    tools = data;
    renderChips();
    render();
    search.addEventListener('input', render);
  });
