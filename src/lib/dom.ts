/* ---------- shared helpers ---------- */

/* ---------- announcements: one polite live region per page ----------
 * Every tool reports its result through status(); routing that through an
 * aria-live region means screen readers finally hear the outcome of async
 * work (WCAG 2.2 4.1.3 Status Messages). One region per page, created on
 * first use, reused for the session. */
let liveRegion: HTMLElement | null = null;
function liveEl(): HTMLElement {
  if (liveRegion && liveRegion.isConnected) return liveRegion;
  liveRegion = document.createElement('div');
  liveRegion.id = 'nl-live';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('role', 'status');
  liveRegion.className = 'nl-sr-only';
  // Inline so it works even before styles.css loads.
  liveRegion.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
  document.body.appendChild(liveRegion);
  return liveRegion;
}
export function announce(msg: string): void {
  if (!msg) return;
  const el = liveEl();
  // Swap through empty so repeated identical messages re-announce.
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 30);
}

/* ---------- keyboard: dropzones + global shortcuts ----------
 * Dropzones are divs: invisible to Enter/Space and to assistive tech unless
 * we make them interactive. onDrop() now wires role/tabindex/activation and
 * reads the tool's own intent from data-accept / data-multiple attributes.
 * A global driver adds the "?" cheat-sheet, Escape, and g-then-key navigation
 * between hub surfaces — all optional per page, zero per-tool code. */

/** Activates the platform file picker inside a user-gesture handler. */
function pickNow(el: HTMLElement): void {
  const inp = document.createElement('input');
  inp.type = 'file';
  if (el.dataset.accept) inp.accept = el.dataset.accept;
  inp.multiple = el.dataset.multiple !== 'false';
  inp.style.display = 'none';
  // Attached to the DOM before click(): some engines (Safari) ignore
  // click() on detached file inputs, and automation tooling only
  // intercepts choosers for in-document inputs.
  inp.onchange = () => {
    if (inp.files?.length) el.dispatchEvent(new CustomEvent('nl-pick', { detail: Array.from(inp.files) }));
    inp.remove();
  };
  document.body.appendChild(inp);
  inp.click();
}

function makeDropzoneKeyboardAccessible(el: HTMLElement): void {
  // Native form controls (textarea, input, button, …) are already focusable
  // and keyboard-activatable — adding role=button would clobber their
  // semantics. Their drop/paste path needs no extra wiring.
  const tag = el.tagName;
  const native = tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || (tag === 'A' && el.hasAttribute('href'));
  if (native || el.getAttribute('role')) return;
  el.setAttribute('role', 'button');
  if (!el.getAttribute('aria-label')) {
    el.setAttribute('aria-label', 'Add files: press Enter to open the file picker, or drop files here');
  }
  el.setAttribute('tabindex', '0');
  el.addEventListener('keydown', (e) => {
    const on = e.target === el; // ignore keydowns bubbling from inner controls
    if (on && (e.key === 'Enter' || (e.key === ' ' && !e.repeat))) {
      e.preventDefault();
      pickNow(el);
    }
  });
  el.addEventListener('nl-pick', (e) => {
    const files = (e as CustomEvent<File[]>).detail;
    if (files.length) el.dispatchEvent(new CustomEvent('nl-files', { detail: files }));
  });
}

let shortcutDriverInstalled = false;
type ShortcutSpec = { keys: string; label: string; run: () => void };
const pageShortcuts: ShortcutSpec[] = [];

/** Register a page-level shortcut, shown in the "?" cheat-sheet. */
export function onKey(keys: string, label: string, run: () => void): void {
  pageShortcuts.push({ keys, label, run });
  installShortcutDriver();
}

function keyMatches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+');
  const wantKey = parts[parts.length - 1];
  const wantMod = (name: 'mod' | 'shift' | 'alt') =>
    name === 'mod' ? (e.ctrlKey || e.metaKey) : name === 'shift' ? e.shiftKey : e.altKey;
  const mods = parts.slice(0, -1) as ('mod' | 'shift' | 'alt')[];
  const key = e.key.toLowerCase();
  if (key !== wantKey && !(wantKey === 'esc' && key === 'escape')) return false;
  return (['mod', 'shift', 'alt'] as const).every((m) => mods.includes(m) === wantMod(m));
}

function installShortcutDriver(): void {
  if (shortcutDriverInstalled || typeof document === 'undefined') return;
  shortcutDriverInstalled = true;
  let gPending = false;
  let gTimer = 0;
  let overlay: HTMLElement | null = null;

  const hideOverlay = () => { overlay?.remove(); overlay = null; };
  const showOverlay = () => {
    if (overlay) { hideOverlay(); return; }
    overlay = document.createElement('div');
    overlay.className = 'nl-shortcuts';
    const rows: string[] = [];
    const all = [
      ...pageShortcuts,
      { keys: '?', label: 'Toggle this cheat-sheet', run: () => {} },
      { keys: 'g h', label: 'Go to the hub', run: () => {} },
      { keys: 'g a', label: 'Go to agent mode docs', run: () => {} },
    ];
    for (const s of all) rows.push(`<div class="nl-sc-row"><kbd>${s.keys}</kbd><span>${s.label}</span></div>`);
    overlay.innerHTML =
      '<div class="nl-sc-panel" role="dialog" aria-label="Keyboard shortcuts">' +
      '<h2>Keyboard shortcuts</h2>' + rows.join('') +
      '<p class="nl-sc-foot">Press ? to close · Esc always closes</p></div>';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideOverlay(); });
    document.body.appendChild(overlay);
    announce('Keyboard shortcuts overlay open. Escape closes it.');
  };

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    // Escape closes the overlay even from inside fields.
    if (e.key === 'Escape') { hideOverlay(); return; }
    if (typing || e.defaultPrevented) return;
    if (gPending) {
      gPending = false;
      clearTimeout(gTimer);
      if (e.key === 'h') { location.href = './index.html'; return; }
      if (e.key === 'a') { location.href = './agents.html'; return; }
      if (e.key === 's') { location.href = './status.html'; return; }
      if (e.key === '?') { showOverlay(); return; }
      return;
    }
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      gPending = true;
      gTimer = window.setTimeout(() => { gPending = false; }, 1200);
      return;
    }
    if (e.key === '?') { e.preventDefault(); showOverlay(); return; }
    for (const s of pageShortcuts) {
      if (keyMatches(e, s.keys)) {
        e.preventDefault();
        s.run();
        return;
      }
    }
  });
}

/** await an <input type=file> (or drop) → File[] */
export function pickFiles(accept: string, { multiple = true }: { multiple?: boolean } = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.multiple = multiple;
    inp.onchange = () => resolve(inp.files ? Array.from(inp.files) : []);
    inp.click();
  });
}

/** Wire a drop zone element; returns a cleanup fn.
 *  The element becomes keyboard-activatable (Enter/Space open the picker).
 *  Pass { accept, multiple } (or set data-accept / data-multiple in markup)
 *  so the picker matches the tool's own constraints; the tool's drop callback
 *  then handles those files exactly like a drop. */
export function onDrop(
  el: HTMLElement,
  cb: (files: File[]) => void,
  opts: { accept?: string; multiple?: boolean } = {},
): () => void {
  if (opts.accept) el.dataset.accept = opts.accept;
  if (opts.multiple === false) el.dataset.multiple = 'false';
  makeDropzoneKeyboardAccessible(el);
  const onFiles = (files: File[]) => {
    if (files.length) cb(files);
  };
  el.addEventListener('nl-files', (e) => onFiles((e as CustomEvent<File[]>).detail));
  const over = (e: DragEvent) => { e.preventDefault(); el.classList.add('dz-over'); };
  const leave = () => el.classList.remove('dz-over');
  const drop = (e: DragEvent) => {
    e.preventDefault();
    el.classList.remove('dz-over');
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    onFiles(files);
  };
  el.addEventListener('dragover', over);
  el.addEventListener('dragleave', leave);
  el.addEventListener('drop', drop);
  // Paste support: Ctrl/Cmd+V an image (screenshot!) or copied files anywhere
  // on the page — goes to the page's drop zone. Snipping tool → share in 2s.
  const paste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.files;
    if (!items?.length) return;
    const files = Array.from(items);
    e.preventDefault();
    onFiles(files);
    el.classList.remove('dz-over');
  };
  document.addEventListener('paste', paste);
  return () => {
    el.removeEventListener('dragover', over);
    el.removeEventListener('dragleave', leave);
    el.removeEventListener('drop', drop);
    document.removeEventListener('paste', paste);
  };
}

/** SHA-256 of a blob, hex-encoded — lets tools prove "same bytes, minus the metadata". */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Trigger a browser download of a blob. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** status line helper: el(id).status('msg') — announces politely for SRs. */
export function status(el: HTMLElement | null, msg: string, kind: 'info' | 'ok' | 'err' | 'warn' = 'info'): void {
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
  el.hidden = !msg;
  if (msg) announce(msg);
}

export const $ = (sel: string): HTMLElement => {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`missing element ${sel}`);
  return el as HTMLElement;
};

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function fmtDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** canvas → blob */
export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality),
  );
}

/** draw an image file to a canvas at (at most) maxW/maxH */
export async function fileToCanvas(file: File | Blob, maxW?: number, maxH?: number): Promise<HTMLCanvasElement> {
  const img = await fileToImage(file);
  return imageToCanvas(img, maxW, maxH);
}

export function fileToImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not a decodable image')); };
    img.src = url;
  });
}

export function imageToCanvas(img: HTMLImageElement | ImageBitmap, maxW?: number, maxH?: number): HTMLCanvasElement {
  const w = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height;
  let sw = w, sh = h;
  if (maxW && maxH && (w > maxW || h > maxH)) {
    const r = Math.min(maxW / w, maxH / h);
    sw = Math.max(1, Math.round(w * r));
    sh = Math.max(1, Math.round(h * r));
  }
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img as CanvasImageSource, 0, 0, sw, sh);
  return c;
}

/** minimum viable toast — some flows want a transient confirmation */
export function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'nl-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
  announce(msg);
}

/* Pages import dom.ts unconditionally, so every page gets the base layer:
 * "?" cheat-sheet, Esc, and g-then-key navigation. Pages opt into extras
 * with onKey(). Modules run after DOM parse (type=module), so wiring the
 * document listener here is safe. */
installShortcutDriver();
