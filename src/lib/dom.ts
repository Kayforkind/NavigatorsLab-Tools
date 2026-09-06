/* ---------- shared helpers ---------- */

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

/** Wire a drop zone element; returns a cleanup fn. */
export function onDrop(el: HTMLElement, cb: (files: File[]) => void): () => void {
  const over = (e: DragEvent) => { e.preventDefault(); el.classList.add('dz-over'); };
  const leave = () => el.classList.remove('dz-over');
  const drop = (e: DragEvent) => {
    e.preventDefault();
    el.classList.remove('dz-over');
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length) cb(files);
  };
  el.addEventListener('dragover', over);
  el.addEventListener('dragleave', leave);
  el.addEventListener('drop', drop);
  return () => {
    el.removeEventListener('dragover', over);
    el.removeEventListener('dragleave', leave);
    el.removeEventListener('drop', drop);
  };
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

/** status line helper: el(id).status('msg') */
export function status(el: HTMLElement | null, msg: string, kind: 'info' | 'ok' | 'err' | 'warn' = 'info'): void {
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
  el.hidden = !msg;
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
}
