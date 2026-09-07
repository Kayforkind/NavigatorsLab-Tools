/* PWA file handling: when the OS opens images with NavigatorsLab Tools
 * (installed app -> right-click a photo -> open with), consume them via launchQueue.
 * Everything stays local, same as drag & drop. */
if ('launchQueue' in window) {
  (window as unknown as { launchQueue: { setConsumer: (cb: (params: { files: FileSystemFileHandle[] }) => void) => void } }).launchQueue.setConsumer(async ({ files }) => {
    if (!files?.length) return;
    const picked: File[] = [];
    for (const h of files) {
      try { picked.push(await h.getFile()); } catch { /* skip unreadable handle */ }
    }
    if (!picked.length) return;
    const dt = new DataTransfer();
    for (const f of picked) dt.items.add(f);
    document.getElementById('dz')?.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
  });
}

import { $, pickFiles, onDrop, download, status, fmtBytes, toast, sha256Hex, fileToCanvas } from '../lib/dom';
import { parseExif, stripExif, exifSummary, type ExifData } from '../lib/exif';

interface Row { file: File; exif: ExifData | null; clean?: Blob; origHash?: string; cleanHash?: string; hashes?: string; }

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
const btnHash = $('#hashbtn') as HTMLButtonElement;
btnHash.addEventListener('click', async () => {
  status(stat, 'Hashing…', 'info');
  for (const r of rows) {
    const parts = [`original  SHA-256: ${r.origHash ?? (await sha256Hex(r.file))}`];
    if (r.clean) parts.push(`cleaned   SHA-256: ${r.cleanHash ?? (await sha256Hex(r.clean))}`);
    r.origHash = parts[0].split(': ')[1];
    r.cleanHash = parts[1]?.split(': ')[1];
    r.hashes = parts.join('\n');
  }
  render();
  status(stat, 'Fingerprints shown — attach these when you send the files so the recipient can verify them.', 'ok');
});

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
  // fingerprints: let the user prove in/out are the same picture, minus metadata
  for (const r of rows) { try { r.origHash = await sha256Hex(r.file); } catch { /* skip */ } }
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
  btnHash.disabled = rows.length === 0;
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
    if (r.hashes) {
      const h = document.createElement('div');
      h.className = 'mono';
      h.style.cssText = 'font-size:11px;color:#7ce0ae;word-break:break-all;white-space:pre-wrap;';
      h.textContent = r.hashes;
      info.appendChild(h);
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
  // verify pixels: decode both versions and compare every rendered pixel
  let verified = 0;
  for (const r of rows) {
    if (!r.clean) continue;
    try {
      const a = await fileToCanvas(r.file), b = await fileToCanvas(r.clean);
      if (a.width === b.width && a.height === b.height && a.toDataURL() === b.toDataURL()) verified++;
      r.cleanHash = await sha256Hex(r.clean);
    } catch { /* skip */ }
  }
  const proof = verified === out.length ? ` Pixel data verified identical on ${verified}/${out.length}.` : '';
  if (asZip && out.length > 1) {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const o of out) zip.file(o.name, o.blob);
    const zblob = await zip.generateAsync({ type: 'blob' });
    download(zblob, 'clean-photos.zip');
    status(stat, `Done — ${out.length} clean photos zipped (${fmtBytes(zblob.size)}), ${gps} had GPS removed.${proof}`, 'ok');
  } else {
    for (const o of out) download(o.blob, o.name);
    status(stat, `Done — ${out.length} clean photo${out.length === 1 ? '' : 's'} downloaded, ${gps} had GPS removed.${proof}`, 'ok');
  }
  toast('Metadata stripped 🔒');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}
