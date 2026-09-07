import { $, pickFiles, onDrop, download, status, fmtBytes, fileToImage, canvasBlob, toast } from '../lib/dom';
import { enhance, autoStraighten, canvasJpeg } from '../lib/canvasp';
import { thresholdData, autoLevelsData } from '../lib/enhance';

const pages: HTMLCanvasElement[] = [];
let idx = 0;

const dz = $('#dz');
const editor = $('#editor');
const cv = $('#cv') as HTMLCanvasElement;
const stat = $('#stat');
const editStat = $('#editStat');
const btnPdf = $('#pdf') as HTMLButtonElement;
const btnPng = $('#png') as HTMLButtonElement;
const thumbs = $('#thumbs');

let cropMode = false;
let dragStart: { x: number; y: number } | null = null;
let cropRect: { x: number; y: number; w: number; h: number } | null = null;

dz.addEventListener('click', () => void pickAndAdd());
onDrop(dz, (files) => void add(files));
$('#prev').addEventListener('click', () => { if (pages.length) { idx = (idx - 1 + pages.length) % pages.length; show(); } });
$('#next').addEventListener('click', () => { if (pages.length) { idx = (idx + 1) % pages.length; show(); } });
$('#remove').addEventListener('click', () => {
  if (!pages.length) return;
  pages.splice(idx, 1);
  idx = Math.max(0, Math.min(idx, pages.length - 1));
  refresh();
});
$('#rotL').addEventListener('click', () => rotate(-90));
$('#rotR').addEventListener('click', () => rotate(90));
$('#straighten').addEventListener('click', () => {
  if (!pages.length) return;
  pages[idx] = autoStraighten(pages[idx]);
  show();
  status(editStat, 'Auto-straightened (content-aware ±4° search).', 'ok');
});
$('#applyEnh').addEventListener('click', () => {
  if (!pages.length) return;
  const ctx = pages[idx].getContext('2d')!;
  enhance(ctx, {
    gray: ($('#gray') as HTMLInputElement).checked,
    brightness: parseInt(($('#bright') as HTMLInputElement).value, 10),
    contrast: parseInt(($('#contrast') as HTMLInputElement).value, 10),
  });
  show();
  status(editStat, 'Enhancement applied (destructive, per page).', 'ok');
});
$('#autoLev').addEventListener('click', () => {
  if (!pages.length) return;
  const ctx = pages[idx].getContext('2d')!;
  const img = ctx.getImageData(0, 0, pages[idx].width, pages[idx].height);
  const r = autoLevelsData(img);
  if (!r) { status(editStat, 'Image is too flat for levels stretching.', 'warn'); return; }
  ctx.putImageData(img, 0, 0);
  show();
  status(editStat, `Auto-levels applied — black point ${r.black}, white point ${r.white}.`, 'ok');
});
$('#thresh').addEventListener('click', () => {
  if (!pages.length) return;
  const ctx = pages[idx].getContext('2d')!;
  const img = ctx.getImageData(0, 0, pages[idx].width, pages[idx].height);
  thresholdData(img, 160);
  ctx.putImageData(img, 0, 0);
  show();
  status(editStat, 'Threshold applied — pure black-on-white photocopy look.', 'ok');
});
$('#cropMode').addEventListener('click', () => {
  cropMode = !cropMode;
  cropRect = null;
  ($('#cropMode') as HTMLButtonElement).textContent = cropMode ? '✂️ Crop mode: ON — drag on image' : '✂️ Crop mode';
  status(editStat, cropMode ? 'Drag a rectangle on the image, then click Apply crop.' : 'Crop mode off.', 'info');
});
$('#cropMode').addEventListener('cropApply' as never, () => applyCrop());

// crop interactions on the preview canvas.
// the canvas is CSS-scaled to fit (max-width/max-height), so toCanvasPx() maps
// pointer coords through getBoundingClientRect — drags work at any zoom.
// touch-action:none stops the browser from hijacking touch drags to scroll.
cv.addEventListener('pointerdown', (e) => {
  if (!cropMode) return;
  e.preventDefault();
  const p = toCanvasPx(e);
  dragStart = p;
  cropRect = null;
  try { cv.setPointerCapture(e.pointerId); } catch { /* released already */ }
});
cv.addEventListener('pointermove', (e) => {
  if (!cropMode || !dragStart) return;
  const p = toCanvasPx(e);
  cropRect = norm(dragStart, p);
  draw();
});
cv.addEventListener('pointercancel', () => {
  // browser took the gesture (scroll/selection) — abandon the stroke cleanly
  dragStart = null;
  cropRect = null;
  draw();
});
cv.addEventListener('pointerup', () => {
  if (!cropMode) return;
  dragStart = null;
  if (cropRect && cropRect.w > 8 && cropRect.h > 8) {
    if (!document.getElementById('applyCropBtn')) {
      const b = document.createElement('button');
      b.id = 'applyCropBtn';
      b.className = 'primary';
      b.textContent = '✔ Apply crop';
      b.addEventListener('click', applyCrop);
      $('#cropMode').parentElement!.appendChild(b);
    }
  } else {
    cropRect = null;
    draw();
  }
});

function applyCrop(): void {
  if (!pages.length || !cropRect) return;
  const src = pages[idx];
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cropRect.w));
  out.height = Math.max(1, Math.round(cropRect.h));
  out.getContext('2d')!.drawImage(src, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, out.width, out.height);
  pages[idx] = out;
  cropRect = null;
  cropMode = false;
  ($('#cropMode') as HTMLButtonElement).textContent = '✂️ Crop mode';
  document.getElementById('applyCropBtn')?.remove();
  show();
  status(editStat, `Cropped to ${out.width}×${out.height}px.`, 'ok');
}

function norm(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

function toCanvasPx(e: PointerEvent): { x: number; y: number } {
  const r = cv.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * cv.width,
    y: ((e.clientY - r.top) / r.height) * cv.height,
  };
}

function rotate(deg: number): void {
  if (!pages.length) return;
  const src = pages[idx];
  const out = document.createElement('canvas');
  const swap = Math.abs(deg) === 90 || Math.abs(deg) === 270;
  out.width = swap ? src.height : src.width;
  out.height = swap ? src.width : src.height;
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  pages[idx] = out;
  show();
}

function draw(): void {
  if (!pages.length) { cv.width = 0; cv.height = 0; return; }
  const p = pages[idx];
  cv.width = p.width; cv.height = p.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(p, 0, 0);
  // whole image visible at once (CSS scales it down); drags map through the rect
  cv.style.touchAction = 'none';
  cv.style.cursor = cropMode ? 'crosshair' : '';
  cv.style.maxHeight = '62vh';
  if (cropMode && cropRect) {
    ctx.strokeStyle = '#4f8cff';
    ctx.lineWidth = Math.max(2, p.width / 300);
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.fillStyle = 'rgba(79,140,255,0.15)';
    ctx.fillRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  }
}

function show(): void {
  editor.hidden = pages.length === 0;
  $('#pageIdx').textContent = `${idx + 1} / ${pages.length}`;
  btnPdf.disabled = pages.length === 0;
  btnPng.disabled = pages.length === 0;
  draw();
  renderThumbs();
}

function renderThumbs(): void {
  thumbs.innerHTML = '';
  pages.forEach((p, i) => {
    const fig = document.createElement('figure');
    const t = document.createElement('canvas');
    const scale = 110 / Math.max(p.width, p.height);
    t.width = Math.max(1, Math.round(p.width * scale));
    t.height = Math.max(1, Math.round(p.height * scale));
    t.getContext('2d')!.drawImage(p, 0, 0, t.width, t.height);
    t.style.cssText = `border:2px solid ${i === idx ? '#4f8cff' : '#24304a'};border-radius:6px;cursor:pointer;max-width:110px`;
    t.addEventListener('click', () => { idx = i; show(); });
    const cap = document.createElement('figcaption');
    cap.textContent = `p${i + 1}`;
    fig.appendChild(t); fig.appendChild(cap);
    thumbs.appendChild(fig);
  });
}

function refresh(): void {
  idx = Math.min(idx, Math.max(0, pages.length - 1));
  show();
  status(stat, pages.length ? `${pages.length} page${pages.length === 1 ? '' : 's'} queued.` : 'No pages. Drop photos to start.', 'info');
}

async function pickAndAdd(): Promise<void> {
  const files = await pickFiles('image/*');
  if (files.length) await add(files);
}

async function add(files: File[]): Promise<void> {
  for (const f of files) {
    try {
      const img = await fileToImage(f);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      pages.push(c);
    } catch {
      status(stat, `Skipped ${f.name} (not a decodable image).`, 'err');
    }
  }
  refresh();
}

$('#pdf').addEventListener('click', () => void exportPdf());
$('#png').addEventListener('click', async () => {
  if (!pages.length) return;
  const blob = await canvasBlob(pages[idx], 'image/png');
  download(blob, `page-${idx + 1}.png`);
});

async function exportPdf(): Promise<void> {
  if (!pages.length) return;
  status(stat, 'Building PDF…', 'info');
  const { PDFDocument } = await import('pdf-lib'); // lazy
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    const jpg = await canvasJpeg(pages[i], 0.92); // keep text crisp at 300 DPI
    const emb = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
    // page size follows the image at ~150 dpi (A4-ish for typical phone scans)
    const wpt = (emb.width * 72) / 150;
    const hpt = (emb.height * 72) / 150;
    const page = doc.addPage([wpt, hpt]);
    page.drawImage(emb, { x: 0, y: 0, width: wpt, height: hpt });
  }
  const bytes = await doc.save();
  download(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), `scanned-${pages.length}p.pdf`);
  status(stat, `PDF with ${pages.length} page${pages.length === 1 ? '' : 's'} exported at print resolution (${fmtBytes(bytes.length)}).`, 'ok');
  toast('PDF exported 📄');
}
