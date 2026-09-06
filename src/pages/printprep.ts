import { $, pickFiles, onDrop, download, status, fmtBytes, canvasBlob, toast } from '../lib/dom';

interface Item {
  file: File;
  canvas?: HTMLCanvasElement;   // final print pixels incl. bleed
  wIn: number; hIn: number;     // requested inches incl. bleed
  dpi?: number;                 // effective dpi of source in final size
  warn?: string;
}

const rows: Item[] = [];
const dz = $('#dz');
const list = $('#list');
const stat = $('#stat');
const btnPdf = $('#pdf') as HTMLButtonElement;
const btnPngs = $('#pngs') as HTMLButtonElement;

const SIZES: Record<string, [number, number]> = {
  '4x6': [4, 6], '5x7': [5, 7], A4: [8.27, 11.69], LETTER: [8.5, 11], SQUARE8: [8, 8],
};

dz.addEventListener('click', () => void pickAndAdd());
onDrop(dz, (files) => void add(files));
btnPdf.addEventListener('click', () => void exportPdf());
btnPngs.addEventListener('click', () => { for (const r of rows) if (r.canvas) void savePng(r); });
$('#prep').addEventListener('click', () => void prep());

async function pickAndAdd(): Promise<void> {
  const files = await pickFiles('image/*');
  if (files.length) { await add(files); await prep(); }
}

async function add(files: File[]): Promise<void> {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    rows.push({ file: f, wIn: 0, hIn: 0 });
  }
  render();
}

function targetInches(): [number, number] {
  const [a, b] = SIZES[($('#size') as HTMLSelectElement).value];
  const bleed = parseFloat(($('#bleed') as HTMLInputElement).value) || 0;
  let w = a + bleed * 2, h = b + bleed * 2;
  const o = ($('#orient') as HTMLSelectElement).value;
  if (o === 'portrait' && w > h) [w, h] = [h, w];
  if (o === 'landscape' && h > w) [w, h] = [h, w];
  return [w, h];
}

async function prep(): Promise<void> {
  const [wIn, hIn] = targetInches();
  const crop = ($('#fitCrop') as HTMLInputElement).checked;
  status(stat, 'Rendering at 300 DPI…', 'info');
  for (const r of rows) {
    r.wIn = wIn; r.hIn = hIn;
    const outPxW = Math.round(wIn * 300);
    const outPxH = Math.round(hIn * 300);
    const img = new Image();
    img.src = URL.createObjectURL(r.file);
    await new Promise((res) => { img.onload = res; img.onerror = res; });
    if (!img.naturalWidth) { r.warn = 'could not decode'; continue; }
    r.dpi = img.naturalWidth / wIn; // effective DPI across the final width
    r.warn = r.dpi < 200 ? `low resolution: ${Math.round(r.dpi)} DPI at this size (print shops want 300)` : undefined;
    const c = document.createElement('canvas');
    c.width = outPxW; c.height = outPxH;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outPxW, outPxH);
    if (crop) {
      // cover: scale to fill, center-crop
      const scale = Math.max(outPxW / img.naturalWidth, outPxH / img.naturalHeight);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      ctx.drawImage(img, (outPxW - w) / 2, (outPxH - h) / 2, w, h);
    } else {
      // contain: fit inside, white bars
      const scale = Math.min(outPxW / img.naturalWidth, outPxH / img.naturalHeight);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (outPxW - w) / 2, (outPxH - h) / 2, w, h);
    }
    r.canvas = c;
  }
  render();
  const ok = rows.filter((r) => r.canvas).length;
  const warns = rows.filter((r) => r.warn).length;
  status(stat,
    `${ok} image${ok === 1 ? '' : 's'} prepped at ${wIn.toFixed(2)}×${hIn.toFixed(2)} in (300 DPI)${warns ? ` — ⚠️ ${warns} below 200 DPI` : ' — all sharp enough'}.`,
    warns ? 'warn' : 'ok');
}

function render(): void {
  btnPdf.disabled = !rows.some((r) => r.canvas);
  btnPngs.disabled = !rows.some((r) => r.canvas);
  list.innerHTML = '';
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'frow';
    if (r.canvas) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = r.canvas.toDataURL('image/png');
      div.appendChild(img);
    }
    const info = document.createElement('div');
    info.className = 'grow';
    const sizeTxt = r.canvas ? `${r.wIn.toFixed(2)}×${r.hIn.toFixed(2)} in @300dpi (${r.canvas.width}×${r.canvas.height}px)` : 'not prepped';
    info.innerHTML = `<div class="nm">${escapeHtml(r.file.name)} <span class="meta">${fmtBytes(r.file.size)}</span></div>
      <div class="meta">${sizeTxt}${r.dpi ? ` · ${Math.round(r.dpi)} DPI effective` : ''}</div>
      ${r.warn ? `<div style="color:#ffd479">⚠️ ${r.warn}</div>` : '<div style="color:#7ce0ae">✓ print-ready</div>'}`;
    div.appendChild(info);
    list.appendChild(div);
  }
}

async function savePng(r: Item): Promise<void> {
  if (!r.canvas) return;
  const blob = await canvasBlob(r.canvas, 'image/png');
  download(blob, `${r.file.name.replace(/\.[^.]+$/, '')}-print.png`);
}

async function exportPdf(): Promise<void> {
  const withCanvas = rows.filter((r) => r.canvas);
  if (!withCanvas.length) return;
  status(stat, 'Building print PDF…', 'info');
  const { PDFDocument } = await import('pdf-lib'); // lazy
  const doc = await PDFDocument.create();
  for (const r of withCanvas) {
    const png = await canvasBlob(r.canvas!, 'image/png');
    const emb = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    // PDF points: 72 per inch; page exactly the requested size incl. bleed
    const page = doc.addPage([r.wIn * 72, r.hIn * 72]);
    page.drawImage(emb, { x: 0, y: 0, width: r.wIn * 72, height: r.hIn * 72 });
  }
  const bytes = await doc.save();
  download(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), `print-${withCanvas.length}.pdf`);
  status(stat, `Print PDF ready — ${withCanvas.length} page(s), exact physical size. Tell the printer "actual size / 100%".`, 'ok');
  toast('Print PDF 🖨️');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}
