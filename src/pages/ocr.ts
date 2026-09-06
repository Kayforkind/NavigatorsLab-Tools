import { $, pickFiles, onDrop, download, status, fmtBytes, fmtDate, toast } from '../lib/dom';
import { parseExif } from '../lib/exif';
import { pickTotal, firstMerchantLine } from '../lib/receipts';

interface Row {
  file: File;
  date: Date | null;
  merchant: string;
  total: number | null;
  confidence: number;
  lines: string[];
  include: boolean;
}

const rows: Row[] = [];
const dz = $('#dz');
const list = $('#list');
const stat = $('#stat');
const resultsPanel = $('#resultsPanel');
const enginePanel = $('#enginePanel');
const engineStat = $('#engineStat');
const tbody = document.querySelector('#tbl tbody') as HTMLElement;
const rowCount = $('#rowCount');
const btnCsv = $('#csv') as HTMLButtonElement;

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

/** Fully local tesseract: engine files + english model are served from this origin. */
async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    enginePanel.hidden = false;
    const Tesseract = await import('tesseract.js');
    workerPromise = Tesseract.createWorker('eng', 1, {
      workerPath: new URL('/tess/worker.min.js', import.meta.url).toString(),
      corePath: new URL('/tess/', import.meta.url).toString(),
      langPath: new URL('/tessdata/', import.meta.url).toString(),
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'loading tesseract core') engineStat.textContent = 'Loading OCR engine…';
        else if (m.status === 'initializing tesseract') engineStat.textContent = 'Initializing…';
        else if (m.status === 'loading language traineddata') engineStat.textContent = 'Loading English model…';
        else if (m.status === 'recognizing text') engineStat.textContent = `Reading… ${Math.round(m.progress * 100)}%`;
      },
    }).then((w) => { engineStat.textContent = 'Engine ready ✓'; return w; });
  }
  return workerPromise;
}

/* ---------- flow ---------- */

dz.addEventListener('click', () => void pickAndRun());
onDrop(dz, (files) => void run(files));
btnCsv.addEventListener('click', exportCsv);

async function pickAndRun(): Promise<void> {
  const files = await pickFiles('image/*');
  if (files.length) await run(files);
}

async function run(files: File[]): Promise<void> {
  resultsPanel.hidden = true;
  list.innerHTML = '';
  status(stat, `Reading ${files.length} receipt${files.length === 1 ? '' : 's'} on-device…`, 'info');
  const worker = await getWorker();
  rows.length = 0;
  let failed = 0;
  for (const f of files) {
    let data: import('tesseract.js').RecognizeResult['data'];
    try {
      ({ data } = await worker.recognize(f));
    } catch {
      failed++;
      status(stat, `Skipping ${f.name} (unreadable image)…`, 'warn');
      continue;
    }
    const lines = (data.text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const { total } = pickTotal(lines);
    let date: Date | null = new Date(f.lastModified);
    if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) {
      try {
        const exif = parseExif(await f.arrayBuffer());
        if (exif?.dateTime) date = exif.dateTime;
      } catch { /* file date fallback */ }
    }
    rows.push({
      file: f,
      date,
      merchant: firstMerchantLine(lines),
      total,
      confidence: Math.round(data.confidence ?? 0),
      lines,
      include: true,
    });
    status(stat, `${rows.length}/${files.length} read (${f.name})`, 'info');
  }
  render();
  if (!rows.length) {
    status(stat, 'No readable receipts. Try sharper, well-lit photos.', 'err');
    return;
  }
  const withTotals = rows.filter((r) => r.total != null).length;
  const skip = failed ? ` (${failed} unreadable skipped)` : '';
  status(stat, `Read ${rows.length} receipt${rows.length === 1 ? '' : 's'} — ${withTotals} total${withTotals === 1 ? '' : 's'} detected${skip}. Review, edit, then export.`, withTotals ? 'ok' : 'warn');
  toast('OCR done 🔢');
}

function render(): void {
  resultsPanel.hidden = rows.length === 0;
  rowCount.textContent = `${rows.filter((r) => r.include).length} selected`;
  tbody.innerHTML = '';
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = r.include;
    check.addEventListener('change', () => { r.include = check.checked; rowCount.textContent = `${rows.filter((x) => x.include).length} selected`; });
    const td0 = document.createElement('td');
    td0.appendChild(check);
    const tdFile = document.createElement('td');
    tdFile.innerHTML = `<div class="nm">${escapeHtml(r.file.name)}</div><div class="meta">${fmtBytes(r.file.size)}</div>`;
    const tdDate = document.createElement('td');
    tdDate.textContent = fmtDate(r.date);
    const tdMer = document.createElement('td');
    tdMer.textContent = r.merchant;
    const tdTotal = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = '0.01';
    inp.min = '0';
    inp.style.width = '110px';
    inp.value = r.total != null ? String(r.total) : '';
    inp.placeholder = '—';
    inp.addEventListener('input', () => { r.total = parseFloat(inp.value) || null; });
    tdTotal.appendChild(inp);
    const tdConf = document.createElement('td');
    const conf = r.confidence;
    tdConf.innerHTML = `<span class="pill ${conf >= 80 ? 'ok' : conf >= 55 ? 'warn' : 'err'}">${conf}%</span>`;
    tr.append(td0, tdFile, tdDate, tdMer, tdTotal, tdConf);
    tbody.appendChild(tr);
  });
}

function exportCsv(): void {
  const sel = rows.filter((r) => r.include);
  if (!sel.length) return;
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ['date,merchant,amount,file,ocr_confidence'];
  for (const r of sel) {
    const d = r.date ? r.date.toISOString().slice(0, 10) : '';
    lines.push([d, esc(r.merchant), r.total != null ? r.total.toFixed(2) : '', esc(r.file.name), String(r.confidence)].join(','));
  }
  download(new Blob([lines.join('\n')], { type: 'text/csv' }), 'expenses.csv');
  status(stat, `Exported ${sel.length} expense${sel.length === 1 ? '' : 's'} to expenses.csv.`, 'ok');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}
