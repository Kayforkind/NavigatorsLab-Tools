/* In-app changelog: versions newest-first. Bump VERSION when shipping user-visible
 * changes; returning users get a "what's new" toast listing entries newer than
 * the last version they saw. localStorage only — no analytics, as always. */
export const VERSION = '1.6.0';

interface Entry {
  version: string;
  date: string;
  items: string[];
}

export const CHANGELOG: Entry[] = [
  {
    version: '1.6.0',
    date: 'September 2026',
    items: [
      '🎬 New: the hub is now a streaming-style library — billboard spotlight, category rows with poster art, hover previews',
      '📖 New: a dedicated detail page for every tool (with /p/<id> deep links): what it does, features, how it works, verification, related tools',
      '🖼️ New: real in-action screenshots as poster art for all 16 tools',
      '🩺 Fixed: grid cards stayed invisible past the first scroll on the old hub (lost scroll-reveal observer)',
      '🩺 Fixed: deep links with query params (qr.html?text=…, detail.html?id=…) were hijacked by the offline service worker on repeat visits',
      '🎬 New: the hub is now a streaming-style library — billboard spotlight, category rows with poster art, hover previews',
      '📖 New: a dedicated detail page for every tool (with /p/<id> deep links): what it does, features, how it works, verification, related tools',
      '🖼️ New: real in-action screenshots as poster art for all 16 tools',
      '🩺 Fixed: grid cards stayed invisible past the first scroll on the old hub (lost scroll-reveal observer)',
      '🩺 Fixed: deep links with query params (qr.html?text=…, detail.html?id=…) were hijacked by the offline service worker on repeat visits',],
  },
  {
    version: '1.5.0',
    date: 'September 2026',
    items: [
      '🧰 New: every tool has its own full product repo — the real tool runs free on each repo\'s GitHub Pages (demo.html), with in-depth READMEs and in-task screenshots',
      '🩺 New: live Pages-deployment + "live check" badges on every per-tool repo README, refreshed by the weekly production watch',
      '🤖 Automation: per-tool repos regenerate and push from CI on every catalog change, with a job summary',
      '🎨 New: Reimagine — redesign any HTML page in 17 directions from its own content (lives at /reimagine/)',
      '🎨 New: Design category chip on the hub',
    ],
  },
  {
    version: '1.4.3',
    date: 'September 2026',
    items: [
      '🔗 New: pretty short links — navigatorslab.com/QR-Studio and 14 more',
      '🩺 New: live status page — every tool verified against production, weekly',
      '🎵 Audio: MP3 export now byte-verified in end-to-end tests',
    ],
  },
  {
    version: '1.4.0',
    date: 'September 2026',
    items: [
      '🤖 New: Agent Mode — MCP endpoint (POST /tools/mcp) for AI agents',
      '🔗 New: deep-link parameters on every tool (?text=, ?url=, ?format=…)',
      '📚 New: llms.txt + llms-full.txt + a full Agent Mode reference page',
      '🎨 Visual: aurora hero, glowing tool cards, scroll-reveal animations',
    ],
  },
  {
    version: '1.2.0',
    date: 'September 2026',
    items: [
      '📑 New: PDF Pages — reorder, rotate, delete, extract & merge PDF pages',
      '🔬 New: Text Diff — word-level comparison for contracts and drafts',
      '📊 New: Text Stats — words, reading time, readability, keywords',
      '✂️ Fixed: crop dragging in Scan Cleaner now works on touch and never fights page scroll',
      '⚡ Faster first paint on the PDF tools',
      '🌍 The hub now speaks English, Türkçe, and Deutsch (selector in the header)',
    ],
  },
  {
    version: '1.1.0',
    date: 'September 2026',
    items: [
      '🔢 New: Receipt OCR → CSV — on-device Tesseract, editable totals',
      '🖼️ Each tool got its own social preview image',
    ],
  },
];

const KEY = 'nl-seen-version';

/** entries newer than the last version this browser saw */
export function whatsNew(): Entry[] {
  try {
    const seen = localStorage.getItem(KEY);
    if (!seen) return []; // first visit: no toast, they'll discover the hub
    return CHANGELOG.filter((e) => compare(e.version, seen) > 0);
  } catch {
    return [];
  }
}

export function markSeen(version: string = VERSION): void {
  try { localStorage.setItem(KEY, version); } catch { /* private mode */ }
}

/** semantic-ish comparison: "1.2.0" vs "1.1.0" → >0 */
function compare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
