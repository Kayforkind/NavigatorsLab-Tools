import { $, pickFiles, onDrop, download, status, fmtBytes, fmtDate, toast } from '../lib/dom';
import { parseExif, stripExif, exifSummary } from '../lib/exif';
import { readOoxml, stripOoxml } from '../lib/ooxml';

interface Findings {
  file: File;
  lines: string[];
  kind: 'image-exif' | 'pdf' | 'ooxml' | 'none' | 'unknown';
  clean?: Blob;
  cleanName?: string;
}

const rows: Findings[] = [];
const dz = $('#dz');
const list = $('#list');
const stat = $('#stat');
const btnStrip = $('#stripAll') as HTMLButtonElement;
const btnZip = $('#rezip') as HTMLButtonElement;

dz.addEventListener('click', () => void pickAndScan());
onDrop(dz, (files) => void scan(files));
btnStrip.addEventListener('click', () => void stripAll(false));
btnZip.addEventListener('click', () => void stripAll(true));

async function pickAndScan(): Promise<void> {
  const files = await pickFiles('*/*');
  if (files.length) await scan(files);
}

async function scan(files: File[]): Promise<void> {
  rows.length = 0;
  list.innerHTML = '';
  status(stat, 'Inspecting…', 'info');
  for (const f of files) {
    const row: Findings = { file: f, lines: [], kind: 'unknown' };
    if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(f.name)) {
      row.kind = 'image-exif';
      if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) {
        try {
          const exif = parseExif(await f.arrayBuffer());
          if (exif) {
            row.lines = exifSummary(exif);
          } else row.lines = ['No EXIF segment found — already clean.'];
        } catch { row.lines = ['Could not parse EXIF.']; }
      } else {
        row.lines = ['This format has no EXIF layer (metadata lives elsewhere or not at all).'];
      }
    } else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      row.kind = 'pdf';
      try {
        const { PDFDocument } = await import('pdf-lib'); // lazy
        const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
        const t = doc.getTitle(), a = doc.getAuthor(), s = doc.getSubject();
        const cr = doc.getCreator(), pr = doc.getProducer();
        const cd = doc.getCreationDate(), md = doc.getModificationDate();
        const kw = doc.getKeywords();
        const lines: string[] = [];
        if (t) lines.push(`Title: ${t}`);
        if (a) lines.push(`Author: ${a}`);
        if (s) lines.push(`Subject: ${s}`);
        if (kw) lines.push(`Keywords: ${kw}`);
        if (cr) lines.push(`Creator app: ${cr}`);
        if (pr) lines.push(`Producer: ${pr}`);
        if (cd) lines.push(`Created: ${fmtDate(cd)}`);
        if (md) lines.push(`Modified: ${fmtDate(md)}`);
        row.lines = lines.length ? lines : ['No metadata fields set.'];
      } catch (e) {
        row.lines = [`Could not parse: ${(e as Error).message}`];
      }
    } else {
      const ox = await readOoxml(f);
      if (ox) {
        row.kind = 'ooxml';
        row.lines = ox.fields.map(([k, v]) => `${k}: ${v}`);
      } else {
        row.kind = 'none';
        row.lines = ['No known metadata layer found for this file type.'];
      }
    }
    rows.push(row);
  }
  render();
  const dirty = rows.filter((r) => r.kind !== 'none' && !r.lines[0]?.includes('already clean') && !r.lines[0]?.includes('No '));
  status(stat, `${rows.length} file${rows.length === 1 ? '' : 's'} inspected — ${dirty.length} carry metadata.`, dirty.length ? 'warn' : 'ok');
}

function render(): void {
  btnStrip.disabled = rows.length === 0;
  btnZip.disabled = rows.length === 0;
  list.innerHTML = '';
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'frow';
    const info = document.createElement('div');
    info.className = 'grow';
    const kindPill = `<span class="pill">${r.kind}</span>`;
    info.innerHTML = `<div class="nm">${escapeHtml(r.file.name)} <span class="meta">${fmtBytes(r.file.size)}</span> ${kindPill}</div>`;
    const ul = document.createElement('div');
    ul.className = 'mono';
    ul.style.cssText = 'font-size:12px; color:var(--mut); white-space:pre-wrap;';
    ul.textContent = r.lines.join('\n') || '—';
    info.appendChild(ul);
    if (r.clean) {
      const done = document.createElement('div');
      done.innerHTML = `<span class="pill ok">cleaned → ${escapeHtml(r.cleanName || '')} (${fmtBytes(r.clean.size)})</span>`;
      info.appendChild(done);
    }
    div.appendChild(info);
    list.appendChild(div);
  }
}

async function clean(r: Findings): Promise<Blob> {
  if (r.kind === 'image-exif') return stripExif(r.file);
  if (r.kind === 'pdf') {
    const { PDFDocument } = await import('pdf-lib'); // lazy
    const doc = await PDFDocument.load(await r.file.arrayBuffer(), { ignoreEncryption: true });
    doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]);
    doc.setProducer(''); doc.setCreator('');
    const bytes = await doc.save();
    return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  }
  if (r.kind === 'ooxml') return stripOoxml(r.file);
  return r.file;
}

function base(n: string): string {
  return n.replace(/\.[^.]+$/, '');
}

function cleanNameFor(r: Findings): string {
  return `clean-${base(r.file.name)}.${(r.file.name.split('.').pop() || 'bin')}`;
}

async function stripAll(asZip: boolean): Promise<void> {
  status(stat, 'Stripping…', 'info');
  const out: { name: string; blob: Blob }[] = [];
  for (const r of rows) {
    const blob = await clean(r);
    r.clean = blob;
    r.cleanName = cleanNameFor(r);
    out.push({ name: r.cleanName, blob });
  }
  render();
  if (asZip && out.length > 1) {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const o of out) zip.file(o.name, o.blob);
    const zb = await zip.generateAsync({ type: 'blob' });
    download(zb, 'cleaned-files.zip');
  } else {
    for (const o of out) download(o.blob, o.name);
  }
  status(stat, `Stripped ${out.length} file${out.length === 1 ? '' : 's'}. Downloads started.`, 'ok');
  toast('Metadata stripped 🔒');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}
