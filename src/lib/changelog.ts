/* In-app changelog: versions newest-first. Bump VERSION when shipping user-visible
 * changes; returning users get a "what's new" toast listing entries newer than
 * the last version they saw. localStorage only — no analytics, as always. */
export const VERSION = '1.2.0';

interface Entry {
  version: string;
  date: string;
  items: string[];
}

export const CHANGELOG: Entry[] = [
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
