import { $, pickFiles, onDrop, download, status, fmtBytes, fileToCanvas, canvasBlob, toast } from '../lib/dom';

interface Row { file: File; out?: Blob; w?: number; h?: number; }

const rows: Row[] = [];
const dz = $('#dz');
const list = $('#list');
const stat = $('#stat');
const btnGo = $('#go') as HTMLButtonElement;
const mode = $('#mode') as HTMLSelectElement;
const targetWrap = $('#targetWrap');
const qualityWrap = $('#qualityWrap');
const targetKB = $('#targetKB') as HTMLInputElement;
const quality = $('#quality') as HTMLInputElement;
const qVal = $('#qVal');
const maxW = $('#maxW') as HTMLInputElement;
const fmt = $('#fmt') as HTMLSelectElement;

dz.addEventListener('click', () => void pickAndAdd());
onDrop(dz, (files) => void add(files));
mode.addEventListener('change', () => {
  targetWrap.hidden = mode.value !== 'target';
  qualityWrap.hidden = mode.value !== 'quality';
});
quality.addEventListener('input', () => { qVal.textContent = `${quality.value}%`; });
btnGo.addEventListener('click', () => void run());

async function pickAndAdd(): Promise<void> {
  const files = await pickFiles('image/*');
  if (files.length) await add(files);
}

async function add(files: File[]): Promise<void> {
  for (const f of files) {
    if (!f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)) continue;
    rows.push({ file: f });
  }
  render();
  btnGo.disabled = rows.length === 0;
  if (rows.length) status(stat, `${rows.length} image${rows.length === 1 ? '' : 's'} queued. Choose a mode and hit Shrink.`, 'info');
}

function render(): void {
  list.innerHTML = '';
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'frow';
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = URL.createObjectURL(r.out ?? r.file);
    div.appendChild(img);
    const info = document.createElement('div');
    info.className = 'grow';
    const base = `<div class="nm">${escapeHtml(r.file.name)} <span class="meta">${fmtBytes(r.file.size)}</span></div>`;
    if (r.out) {
      const pct = Math.round((1 - r.out.size / r.file.size) * 100);
      info.innerHTML = `${base}<div class="meta">→ <b>${fmtBytes(r.out.size)}</b> (${pct >= 0 ? '-' : '+'}${Math.abs(pct)}%) ${r.w}×${r.h}</div>`;
    } else info.innerHTML = base;
    div.appendChild(info);
    if (r.out) {
      const b = document.createElement('button');
      b.textContent = '⬇️';
      b.title = 'Download this one';
      b.addEventListener('click', () => download(r.out!, outName(r)));
      div.appendChild(b);
    }
    list.appendChild(div);
  }
}

function outName(r: Row): string {
  const base = r.file.name.replace(/\.[^.]+$/, '');
  const ext = fmt.value === 'image/jpeg' ? 'jpg' : fmt.value === 'image/webp' ? 'webp' : 'png';
  return `${base}-shrunk.${ext}`;
}

async function run(): Promise<void> {
  status(stat, 'Processing…', 'info');
  let totalIn = 0, totalOut = 0;
  for (const r of rows) {
    try {
      const canvas = await fileToCanvas(r.file, 8000, 8000);
      const out = await encode(canvas);
      r.out = out;
      r.w = canvas.width; r.h = canvas.height;
      totalIn += r.file.size; totalOut += out.size;
    } catch (e) {
      status(stat, `Failed on ${r.file.name}: ${(e as Error).message}`, 'err');
      return;
    }
  }
  render();
  const saved = Math.round((1 - totalOut / totalIn) * 100);
  status(stat, `Done — ${fmtBytes(totalIn)} → ${fmtBytes(totalOut)} (${saved}% smaller). Downloading…`, 'ok');
  for (const r of rows) if (r.out) download(r.out, outName(r));
  toast('Shrunk 🗜️');
}

async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const mW = parseInt(maxW.value, 10);
  let work = canvas;
  if (mW && canvas.width > mW) {
    const scale = mW / canvas.width;
    const c2 = document.createElement('canvas');
    c2.width = mW;
    c2.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = c2.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, c2.width, c2.height);
    work = c2;
  }
  const type = fmt.value;
  if (mode.value === 'quality') {
    return canvasBlob(work, type, parseInt(quality.value, 10) / 100);
  }
  // target size: binary-search quality (skip for PNG → fall back to downscaling)
  const target = parseInt(targetKB.value, 10) * 1024;
  if (type === 'image/png') {
    let blob = await canvasBlob(work, type);
    let w = work.width;
    while (blob.size > target && w > 32) {
      w = Math.floor(w * 0.8);
      const c2 = document.createElement('canvas');
      c2.width = w;
      c2.height = Math.max(1, Math.round(work.height * (w / work.width)));
      const ctx = c2.getContext('2d')!;
      ctx.drawImage(work, 0, 0, c2.width, c2.height);
      work = c2;
      blob = await canvasBlob(work, type);
    }
    return blob;
  }
  let lo = 0.05, hi = 0.95;
  let best: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    const q = (lo + hi) / 2;
    const blob = await canvasBlob(work, type, q);
    if (blob.size <= target) { best = blob; lo = q; } else { hi = q; }
  }
  if (!best) {
    // even lowest quality overshoots → downscale 20% and retry
    const c2 = document.createElement('canvas');
    c2.width = Math.max(16, Math.floor(work.width * 0.8));
    c2.height = Math.max(16, Math.floor(work.height * 0.8));
    const ctx = c2.getContext('2d')!;
    ctx.drawImage(work, 0, 0, c2.width, c2.height);
    work = c2;
    return encode(canvas === work ? canvas : work);
  }
  return best;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}
