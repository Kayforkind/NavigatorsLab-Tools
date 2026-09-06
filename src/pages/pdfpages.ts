/* PDF Pages — load any PDF, render page thumbnails with pdf.js, reorder via
 * drag, rotate/delete per page, then rebuild the PDF with pdf-lib in the
 * chosen order. Extract = rebuild with only the selected pages. All local. */
import { $, onDrop, pickFiles, download, status, fmtBytes, toast } from '../lib/dom';

interface PageItem {
  docIdx: number;     // index into the dropped File[]
  srcIdxInDoc: number; // page index within that source doc
  rotation: number;   // 0/90/180/270
  canvas: HTMLCanvasElement;
  selected: boolean;
}

let items: PageItem[] = [];
let dragIdx = -1;

const dz = $('#dz');
const panel = $('#panel');
const pagesEl = $('#pages');
const stat = $('#stat');
const pageCount = $('#pageCount');

dz.addEventListener('click', async () => {
  const files = await pickFiles('application/pdf,.pdf', { multiple: true });
  if (files.length) await load(files);
});
onDrop(dz, (files) => { if (files.length) void load(files); });

async function load(files: File[]): Promise<void> {
  status(stat, 'Rendering pages…', 'info');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  const { PDFDocument } = await import('pdf-lib');

  items = [];
  for (let docIdx = 0; docIdx < files.length; docIdx++) {
    const f = files[docIdx];
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const task = pdfjs.getDocument({ data: bytes.slice(0) });
      const pdf = await task.promise;
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const vp = page.getViewport({ scale: 0.22 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(vp.width));
        canvas.height = Math.max(1, Math.round(vp.height));
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        items.push({ docIdx, srcIdxInDoc: i, rotation: 0, canvas, selected: true });
      }
    } catch (e) {
      status(stat, `Could not open ${f.name}: ${(e as Error).message}`, 'err');
      return;
    }
  }
  // keep the File[] for export (re-loaded lazily there)
  (items as unknown as { __files?: File[] }).__files = files;
  panel.hidden = false;
  render();
  status(stat, `${items.length} pages from ${files.length} document(s). Drag thumbnails to reorder.`, 'ok');
}

function render(): void {
  pageCount.textContent = `${items.filter((i) => i.selected).length} / ${items.length} selected`;
  pagesEl.innerHTML = '';
  items.forEach((it, i) => {
    const cell = document.createElement('div');
    cell.className = 'pp-cell' + (it.selected ? '' : ' off') + (dragIdx === i ? ' dragging' : '');
    cell.draggable = true;
    const wrap = document.createElement('div');
    wrap.className = 'pp-thumb';
    const c = document.createElement('canvas');
    const swap = it.rotation % 180 !== 0;
    c.width = swap ? it.canvas.height : it.canvas.width;
    c.height = swap ? it.canvas.width : it.canvas.height;
    const ctx = c.getContext('2d')!;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((it.rotation * Math.PI) / 180);
    ctx.drawImage(it.canvas, -it.canvas.width / 2, -it.canvas.height / 2);
    wrap.appendChild(c);
    const badge = document.createElement('span');
    badge.className = 'pp-num';
    badge.textContent = String(i + 1);
    wrap.appendChild(badge);
    const del = document.createElement('button');
    del.className = 'pp-x';
    del.textContent = '✕';
    del.setAttribute('aria-label', `Delete page ${i + 1}`);
    del.addEventListener('click', () => { items.splice(i, 1); render(); });
    wrap.appendChild(del);
    const rot = document.createElement('button');
    rot.className = 'pp-r';
    rot.textContent = '↻';
    rot.setAttribute('aria-label', `Rotate page ${i + 1}`);
    rot.addEventListener('click', () => { it.rotation = (it.rotation + 90) % 360; render(); });
    cell.appendChild(wrap);
    cell.appendChild(rot);
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = it.selected;
    chk.setAttribute('aria-label', `Select page ${i + 1}`);
    chk.addEventListener('change', () => { it.selected = chk.checked; render(); });
    cell.appendChild(chk);

    // drag to reorder (HTML5 DnD is enough for thumbnails)
    cell.addEventListener('dragstart', () => { dragIdx = i; });
    cell.addEventListener('dragover', (e) => e.preventDefault());
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragIdx < 0 || dragIdx === i) return;
      const [moved] = items.splice(dragIdx, 1);
      items.splice(i, 0, moved);
      dragIdx = -1;
      render();
    });
    pagesEl.appendChild(cell);
  });
}

$('#selAll').addEventListener('change', (e) => {
  const on = (e.target as HTMLInputElement).checked;
  for (const it of items) it.selected = on;
  render();
});

$('#rotSel').addEventListener('click', () => {
  for (const it of items) if (it.selected) it.rotation = (it.rotation + 90) % 360;
  render();
});

$('#delSel').addEventListener('click', () => {
  items = items.filter((it) => !it.selected);
  render();
  if (!items.length) { panel.hidden = true; status(stat, 'All pages removed. Drop PDFs to start over.', 'info'); }
});

$('#rebuild').addEventListener('click', () => void rebuild());

async function rebuild(): Promise<void> {
  const files = (items as unknown as { __files?: File[] }).__files || [];
  if (!items.length || !files.length) return;
  status(stat, 'Rebuilding PDF…', 'info');
  try {
    const { PDFDocument, degrees } = await import('pdf-lib');
    const out = await PDFDocument.create();
    const cache = new Map<number, import('pdf-lib').PDFDocument>();
    for (const it of items) {
      if (!it.selected) continue;
      let loaded = cache.get(it.docIdx);
      if (!loaded) {
        loaded = await PDFDocument.load(new Uint8Array(await files[it.docIdx].arrayBuffer()).slice(0), { ignoreEncryption: true });
        cache.set(it.docIdx, loaded);
      }
      const [copied] = await out.copyPages(loaded, [it.srcIdxInDoc]);
      copied.setRotation(degrees(it.rotation));
      out.addPage(copied);
    }
    const bytes = await out.save();
    download(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), 'reorganized.pdf');
    status(stat, `Rebuilt with ${items.filter((i) => i.selected).length} pages (${fmtBytes(bytes.length)}).`, 'ok');
    toast('PDF rebuilt 📑');
  } catch (e) {
    status(stat, `Rebuild failed: ${(e as Error).message}`, 'err');
  }
}
