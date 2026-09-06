import { $, pickFiles, onDrop, download, status, fmtBytes, toast } from '../lib/dom';
import { parseExif, stripExif, exifSummary, type ExifData } from '../lib/exif';

interface Row { file: File; exif: ExifData | null; clean?: Blob; }

const rows: Row[] = [];
const dz = $('#dz');
const list = $('#list');
const stat = $('#stat');
const btnStrip = $('#strip') as HTMLButtonElement;
const btnZip = $('#rezip') as HTMLButtonElement;
const countEl = $('#count');

dz.addEventListener('click', () => void pickAndScan());
$('#strip').addEventListener('click', () => { void stripAll(false); });
$('#rezip').addEventListener('click', () => { void stripAll(true); });

onDrop(dz, (files) => void scan(files));

async function pickAndScan(): Promise<void> {
  const files = await pickFiles('image/*');
  if (files.length) await scan(files);
}

async function scan(files: File[]): Promise<void> {
  rows.length = 0;
  list.innerHTML = '';
  status(stat, 'Scanning…', 'info');
  for (const f of files) {
    const row: Row = { file: f, exif: null };
    if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) {
      try { row.exif = parseExif(await f.arrayBuffer()); } catch { /* ignore */ }
    }
    rows.push(row);
  }
  render();
  const leaked = rows.filter((r) => r.exif?.gps).length;
  const withMeta = rows.filter((r) => r.exif?.hasExif).length;
  status(
    stat,
    `Scanned ${rows.length} photo${rows.length === 1 ? '' : 's'} — ${withMeta} carry metadata, ${leaked} leak GPS coordinates.`,
    leaked ? 'err' : withMeta ? 'warn' : 'ok',
  );
}

function render(): void {
  countEl.textContent = `${rows.length} files`;
  btnStrip.disabled = rows.length === 0;
  btnZip.disabled = rows.length === 0;
  list.innerHTML = '';
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'frow ' + (r.exif?.gps ? 'found' : r.exif?.hasExif ? 'found' : 'clean');
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = URL.createObjectURL(r.file);
    div.appendChild(img);
    const info = document.createElement('div');
    info.className = 'grow';
    const leak = r.exif?.gps ? ' — <b style="color:#ff9a9d">GPS LEAK</b>' : '';
    info.innerHTML = `<div class="nm">${escapeHtml(r.file.name)} <span class="meta">${fmtBytes(r.file.size)}${leak}</span></div>`;
    if (r.exif) {
      const ul = document.createElement('div');
      ul.className = 'meta mono';
      ul.style.fontSize = '12px';
      ul.textContent = exifSummary(r.exif).slice(0, 6).join(' · ') || 'no meaningful tags';
      info.appendChild(ul);
    } else {
      const none = document.createElement('div');
      none.className = 'meta';
      none.textContent = r.file.type === 'image/jpeg' ? 'No EXIF found' : 'No EXIF layer (format carries none or browser strips it)';
      info.appendChild(none);
    }
    div.appendChild(info);
    list.appendChild(div);
  }
}

async function stripAll(asZip: boolean): Promise<void> {
  status(stat, 'Stripping…', 'info');
  const out: { name: string; blob: Blob }[] = [];
  let gps = 0;
  for (const r of rows) {
    const blob = await stripExif(r.file);
    if (r.exif?.gps) gps++;
    const base = r.file.name.replace(/\.[^.]+$/, '');
    const ext = (blob === r.file ? r.file.name.split('.').pop() : 'jpg') || 'jpg';
    out.push({ name: `clean-${base}.${ext}`, blob });
    r.clean = blob;
  }
  render();
  if (asZip && out.length > 1) {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const o of out) zip.file(o.name, o.blob);
    const zblob = await zip.generateAsync({ type: 'blob' });
    download(zblob, 'clean-photos.zip');
    status(stat, `Done — ${out.length} clean photos zipped (${fmtBytes(zblob.size)}), ${gps} had GPS removed.`, 'ok');
  } else {
    for (const o of out) download(o.blob, o.name);
    status(stat, `Done — ${out.length} clean photo${out.length === 1 ? '' : 's'} downloaded, ${gps} had GPS removed.`, 'ok');
  }
  toast('Metadata stripped 🔒');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}
