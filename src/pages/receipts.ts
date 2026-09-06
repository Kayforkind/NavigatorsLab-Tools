import { $, pickFiles, onDrop, download, status, fmtBytes, fmtDate, toast } from '../lib/dom';
import { parseExif } from '../lib/exif';
import { fileToImage } from '../lib/dom';

interface Row {
  file: File;
  date: Date | null;
  src: 'EXIF' | 'file' | 'none';
}

const rows: Row[] = [];
const dz = $('#dz');
const list = $('#list');
const stat = $('#stat');
const btnSort = $('#sort') as HTMLButtonElement;
const btnPdf = $('#pdf') as HTMLButtonElement;

dz.addEventListener('click', () => void pickAndAdd());
onDrop(dz, (files) => void add(files));
btnSort.addEventListener('click', () => {
  rows.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
  render();
  status(stat, 'Sorted oldest → newest by date taken.', 'ok');
});
btnPdf.addEventListener('click', () => void build());

async function pickAndAdd(): Promise<void> {
  const files = await pickFiles('image/*');
  if (files.length) await add(files);
}

async function add(files: File[]): Promise<void> {
  for (const f of files) {
    const row: Row = { file: f, date: new Date(f.lastModified), src: 'file' };
    if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) {
      try {
        const exif = parseExif(await f.arrayBuffer());
        if (exif?.dateTime) { row.date = exif.dateTime; row.src = 'EXIF'; }
      } catch { /* fall back to file date */ }
    }
    rows.push(row);
  }
  rows.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
  render();
  btnSort.disabled = rows.length < 2;
  btnPdf.disabled = rows.length === 0;
  const exifCount = rows.filter((r) => r.src === 'EXIF').length;
  status(stat, `${rows.length} receipt${rows.length === 1 ? '' : 's'} queued — ${exifCount} dated from EXIF, ${rows.length - exifCount} from file date.`, 'info');
}

function render(): void {
  list.innerHTML = '';
  rows.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'frow';
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = URL.createObjectURL(r.file);
    div.appendChild(img);
    const info = document.createElement('div');
    info.className = 'grow';
    info.innerHTML = `<div class="nm">${i + 1}. ${escapeHtml(r.file.name)} <span class="meta">${fmtBytes(r.file.size)}</span></div>
      <div class="meta">📅 ${fmtDate(r.date)} <span class="pill">${r.src}</span></div>`;
    div.appendChild(info);
    const up = document.createElement('button');
    up.textContent = '↑'; up.disabled = i === 0;
    up.addEventListener('click', () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; render(); });
    const down = document.createElement('button');
    down.textContent = '↓'; down.disabled = i === rows.length - 1;
    down.addEventListener('click', () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; render(); });
    div.appendChild(up); div.appendChild(down);
    list.appendChild(div);
  });
}

async function build(): Promise<void> {
  if (!rows.length) return;
  status(stat, 'Building PDF…', 'info');
  try {
    const { PDFDocument, rgb } = await import('pdf-lib'); // lazy: keeps first paint fast
    const doc = await PDFDocument.create();
    const font = await doc.embedFont('Helvetica');
    const bold = await doc.embedFont('Helvetica-Bold');
    const doStamp = ($('#stamp') as HTMLInputElement).checked;
    const fit = ($('#fit') as HTMLInputElement).checked;
    const A4 = { w: 595.28, h: 841.89 };
    const LETTER = { w: 612, h: 792 };
    const size = (($('#size') as HTMLSelectElement).value === 'A4') ? A4 : LETTER;
    const margin = 28;

    for (const r of rows) {
      const imgBytes = new Uint8Array(await r.file.arrayBuffer());
      let emb;
      if (r.file.type === 'image/png') emb = await doc.embedPng(imgBytes);
      else {
        try { emb = await doc.embedJpg(imgBytes); }
        catch {
          // re-encode via canvas for HEIC/other formats
          const img = await fileToImage(r.file);
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d')!.drawImage(img, 0, 0);
          const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.9));
          emb = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        }
      }
      const page = doc.addPage([size.w, size.h]);
      const availW = size.w - margin * 2;
      const availH = size.h - margin * 2 - (doStamp ? 22 : 0);
      const scale = fit ? Math.min(availW / emb.width, availH / emb.height) : availW / emb.width;
      const w = emb.width * scale, h = emb.height * scale;
      page.drawImage(emb, { x: (size.w - w) / 2, y: margin + (doStamp ? 18 : 0) + (availH - h) / 2, width: w, height: h });
      if (doStamp) {
        const label = `${r.date ? r.date.toLocaleDateString() : 'undated'}  ·  ${r.file.name}`;
        page.drawText(label, { x: margin, y: 14, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) });
        page.drawLine({ start: { x: margin, y: 26 }, end: { x: size.w - margin, y: 26 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
      }
      void bold;
    }
    const bytes = await doc.save();
    const d = new Date();
    const name = `receipts-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.pdf`;
    download(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), name);
    status(stat, `Done — ${rows.length} receipts, sorted, one PDF (${fmtBytes(bytes.length)}).`, 'ok');
    toast('PDF built 🧾');
  } catch (e) {
    status(stat, `Build failed: ${(e as Error).message}`, 'err');
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}
