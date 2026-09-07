import { $, pickFiles, onDrop, download, status, toast } from '../lib/dom';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/* ---------- signature pad ---------- */
const mode = $('#mode') as HTMLSelectElement;
const typeWrap = $('#typeWrap');
const typed = $('#typed') as HTMLInputElement;
const font = $('#font') as HTMLSelectElement;
const fontSize = $('#fontSize') as HTMLInputElement;
const pad = $('#pad') as HTMLCanvasElement;
const ink = $('#ink') as HTMLInputElement;
const thick = $('#thick') as HTMLInputElement;
const useSig = $('#useSig') as HTMLButtonElement;

let drawing = false;
let hasInk = false;

function clearPad(): void {
  const ctx = pad.getContext('2d')!;
  ctx.clearRect(0, 0, pad.width, pad.height);
  hasInk = false;
  useSig.disabled = true;
}
$('#clear').addEventListener('click', clearPad);

function padPoint(e: PointerEvent): { x: number; y: number } {
  const r = pad.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * pad.width,
    y: ((e.clientY - r.top) / r.height) * pad.height,
  };
}

pad.addEventListener('pointerdown', (e) => {
  if (mode.value !== 'draw') return;
  drawing = true;
  pad.setPointerCapture(e.pointerId);
  const ctx = pad.getContext('2d')!;
  const p = padPoint(e);
  ctx.strokeStyle = ink.value;
  ctx.lineWidth = parseInt(thick.value, 10) * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
});
pad.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const ctx = pad.getContext('2d')!;
  const p = padPoint(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  hasInk = true;
  useSig.disabled = false;
});
addEventListener('pointerup', () => { drawing = false; });

function renderTyped(): void {
  if (mode.value !== 'type') return;
  const ctx = pad.getContext('2d')!;
  ctx.clearRect(0, 0, pad.width, pad.height);
  const s = typed.value.trim();
  hasInk = !!s;
  useSig.disabled = !s;
  if (!s) return;
  const size = parseInt(fontSize.value, 10);
  ctx.font = `${font.value === 'cursive' ? 'italic ' : ''}${size}px ${font.value === 'cursive' ? '"Segoe Script", "Comic Sans MS", cursive' : 'Georgia, serif'}`;
  ctx.fillStyle = ink.value;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, 16, pad.height / 2);
}
mode.addEventListener('change', () => {
  typeWrap.hidden = mode.value !== 'type';
  clearPad();
  if (mode.value === 'type') renderTyped();
});
typed.addEventListener('input', renderTyped);
font.addEventListener('change', renderTyped);
fontSize.addEventListener('input', renderTyped);
ink.addEventListener('input', () => { if (mode.value === 'type') renderTyped(); });

/* ---------- PDF placement ---------- */
const dz = $('#dz');
const cv = $('#cv') as HTMLCanvasElement;
const stat = $('#stat');
const pagesRow = $('#pagesRow');
const pageSel = $('#pageSel') as HTMLSelectElement;
const sigW = $('#sigW') as HTMLInputElement;
const stampBtn = $('#stamp') as HTMLButtonElement;

let pdfBytes: Uint8Array | null = null;
let doc: import('pdf-lib').PDFDocument | null = null;
let pageCanvases: HTMLCanvasElement[] = [];
let sigPng: Blob | null = null;
let sigAspect = 1;
let placeAt: { x: number; y: number } | null = null; // canvas px

useSig.addEventListener('click', async () => {
  // trim transparent margins from the pad
  const src = pad;
  const ctx = src.getContext('2d')!;
  const img = ctx.getImageData(0, 0, src.width, src.height);
  let minX = src.width, minY = src.height, maxX = 0, maxY = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (img.data[(y * src.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX) { status(stat, 'Signature is empty.', 'err'); return; }
  const w = maxX - minX + 8, h = maxY - minY + 8;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d')!.drawImage(src, minX - 4, minY - 4, w, h, 0, 0, w, h);
  sigPng = await new Promise<Blob>((res) => out.toBlob((b) => res(b!), 'image/png'));
  sigAspect = w / h;
  status(stat, 'Signature ready. Now drop a PDF and click where it goes.', 'ok');
  if (doc) stampBtn.disabled = false;
});

dz.addEventListener('click', () => void pickPdf());
onDrop(dz, (files) => { const f = files[0]; if (f) void loadPdf(f); });

async function pickPdf(): Promise<void> {
  const [f] = await pickFiles('application/pdf,.pdf', { multiple: false });
  if (f) await loadPdf(f);
}

async function loadPdf(f: File): Promise<void> {
  try {
    pdfBytes = new Uint8Array(await f.arrayBuffer());
    const { PDFDocument } = await import('pdf-lib'); // lazy
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pageCanvases = [];
    pageSel.innerHTML = '';
    status(stat, `Loaded ${f.name} — ${doc.getPageCount()} page(s). Rendering preview…` +
      (doc.isEncrypted ? ' ⚠ encrypted PDF: the stamped copy is decrypted (password removed).' : ''), 'info');
    await renderPages();
    pagesRow.hidden = false;
    stampBtn.disabled = !sigPng;
  } catch (e) {
    status(stat, `Could not open PDF: ${(e as Error).message}`, 'err');
  }
}

async function renderPages(): Promise<void> {
  if (!pdfBytes) return;
  // legacy build: works in more environments (headless CI, older browsers)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: pdfBytes.slice(0) });
  const pdf = await task.promise;
  pageCanvases = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const vp = page.getViewport({ scale: 1.6 });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    await page.render({ canvasContext: c.getContext('2d')!, viewport: vp } as never).promise;
    pageCanvases.push(c);
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Page ${i + 1}`;
    pageSel.appendChild(opt);
  }
  showPage();
}

function showPage(): void {
  const i = parseInt(pageSel.value || '0', 10);
  const src = pageCanvases[i];
  if (!src) return;
  cv.width = src.width; cv.height = src.height;
  cv.getContext('2d')!.drawImage(src, 0, 0);
  if (placeAt) drawPlacement();
}

function drawPlacement(): void {
  if (!placeAt || !sigPng) return;
  const i = parseInt(pageSel.value || '0', 10);
  const page = pageCanvases[i];
  if (!page) return;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(page, 0, 0);
  const SCALE = 1.6; // px per pt used when rendering previews
  const wPx = parseInt(sigW.value, 10) * SCALE;
  const hPx = wPx / sigAspect;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, placeAt!.x - wPx / 2, placeAt!.y - hPx / 2, wPx, hPx);
    ctx.strokeStyle = '#4f8cff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(placeAt!.x - 8, placeAt!.y); ctx.lineTo(placeAt!.x + 8, placeAt!.y);
    ctx.moveTo(placeAt!.x, placeAt!.y - 8); ctx.lineTo(placeAt!.x, placeAt!.y + 8);
    ctx.stroke();
  };
  img.src = URL.createObjectURL(sigPng);
}

cv.addEventListener('click', (e) => {
  if (!sigPng) return; // no signature yet — clicks on the preview mean nothing
  const r = cv.getBoundingClientRect();
  placeAt = {
    x: ((e.clientX - r.left) / r.width) * cv.width,
    y: ((e.clientY - r.top) / r.height) * cv.height,
  };
  stampBtn.disabled = false;
  drawPlacement();
  status(stat, `Placed at ${Math.round(placeAt.x)}, ${Math.round(placeAt.y)} — click again to move, then Flatten.`, 'info');
});
pageSel.addEventListener('change', () => { placeAt = null; showPage(); });
sigW.addEventListener('input', () => { if (placeAt) drawPlacement(); });

stampBtn.addEventListener('click', () => void doStamp());

async function doStamp(): Promise<void> {
  if (!doc || !pdfBytes || !sigPng || !placeAt) {
    status(stat, 'Make a signature, load a PDF, and click a spot first.', 'err');
    return;
  }
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib'); // lazy
    const fresh = await PDFDocument.load(pdfBytes.slice(0), { ignoreEncryption: true });
    const png = await fresh.embedPng(new Uint8Array(await sigPng.arrayBuffer()));
    const pageIdx = parseInt(pageSel.value || '0', 10);
    const page = fresh.getPage(pageIdx);
    const { width: ptW, height: ptH } = page.getSize();
    const SCALE = 1.6; // px per pt used when rendering previews
    const pxPerPt = (pageCanvases[pageIdx].width / ptW) || SCALE;
    const wPt = parseInt(sigW.value, 10);
    const hPt = wPt / sigAspect;
    const xPt = placeAt.x / pxPerPt - wPt / 2;
    const yPt = ptH - placeAt.y / pxPerPt - hPt / 2;
    page.drawImage(png, { x: xPt, y: yPt, width: wPt, height: hPt });
    let dateStamped = false;
    if (($('#addDate') as HTMLInputElement).checked) {
      try {
        const helv = await fresh.embedFont(StandardFonts.Helvetica);
        const txt = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        page.drawText(txt, { x: xPt, y: Math.max(4, yPt - 13), size: 9, font: helv, color: rgb(0.25, 0.28, 0.35) });
        dateStamped = true;
      } catch { /* date is optional — the ink is the important part */ }
    }
    const bytes = await fresh.save();
    download(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), 'signed.pdf');
    status(stat, `Signed & flattened — downloading signed.pdf.${dateStamped ? ' Date stamped.' : ''}`, 'ok');
    toast('Signed ✍️');
  } catch (e) {
    status(stat, `Flatten failed: ${(e as Error).message}`, 'err');
  }
}

/* ---- agent mode: ?url=<same-origin pdf URL>&date=1 — see agents.html ---- */
import { agentInit, bindCheck, fetchFileParam, agentBanner, type QuerySpec } from '../lib/agent';
{
  const spec: QuerySpec = { date: bindCheck(document.getElementById('addDate') as HTMLInputElement) };
  const applied = agentInit(spec, (k) => `applied ${k.join(', ')}`);
  const u = new URLSearchParams(location.search).get('url');
  if (u) void fetchFileParam(u, 'document.pdf').then((f) => { if (f) { agentBanner((applied.length ? `applied ${applied.join(', ')} · ` : '') + 'loaded PDF from <code>url</code> param'); loadPdf(f); } });
}
