import { $, pickFiles, onDrop, download, status, fmtBytes, fmtDate, toast } from '../lib/dom';
import { parseExif } from '../lib/exif';

interface Row { file: File; date: Date | null; newName?: string; }

const rows: Row[] = [];
const dz = $('#dz');
const list = $('#list');
const stat = $('#stat');
const btnZip = $('#zip') as HTMLButtonElement;
const btnEach = $('#each') as HTMLButtonElement;

dz.addEventListener('click', () => void pickAndAdd());
onDrop(dz, (files) => void add(files));
$('#slugSrc').addEventListener('change', () => {
  ($('#slugText') as HTMLInputElement).hidden = ($('#slugSrc') as HTMLSelectElement).value !== 'fixed';
});
$('#apply').addEventListener('click', () => { renameAll(); render(); });
btnZip.addEventListener('click', () => void exportZip());
btnEach.addEventListener('click', () => { for (const r of rows) if (r.newName) download(r.file, r.newName); });

async function pickAndAdd(): Promise<void> {
  const files = await pickFiles('*/*');
  if (files.length) await add(files);
}

async function add(files: File[]): Promise<void> {
  for (const f of files) {
    const row: Row = { file: f, date: new Date(f.lastModified) };
    if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(f.name)) {
      try {
        const exif = parseExif(await f.arrayBuffer());
        if (exif?.dateTime) row.date = exif.dateTime;
      } catch { /* keep file date */ }
    }
    rows.push(row);
  }
  renameAll();
  render();
  btnZip.disabled = rows.length === 0;
  btnEach.disabled = rows.length === 0;
  status(stat, `${rows.length} file${rows.length === 1 ? '' : 's'} — names generated below. Tweak the pattern, then download.`, 'info');
}

function slugify(s: string): string {
  return s
    .replace(/\.[^.]+$/, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function dateStr(d: Date | null): string {
  if (!d) return 'undated';
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const style = ($('#dateStyle') as HTMLSelectElement).value;
  if (style === 'compact') return iso.replace(/-/g, '');
  if (style === 'month') return iso.slice(0, 7);
  return iso;
}

function nameFor(r: Row, i: number): string {
  const pat = ($('#pat') as HTMLSelectElement).value;
  const ext = (r.file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  let slug: string;
  if (($('#slugSrc') as HTMLSelectElement).value === 'fixed') {
    slug = slugify(($('#slugText') as HTMLInputElement).value || 'file');
  } else {
    const orig = slugify(r.file.name);
    slug = orig || 'file';
  }
  const pre = ($('#preTxt') as HTMLInputElement).value;
  const suf = ($('#sufTxt') as HTMLInputElement).value;
  const start = parseInt(($('#startN') as HTMLInputElement).value, 10);
  let n = pat
    .replace('{prefix}', pre)
    .replace('{suffix}', suf)
    .replace('{date}', dateStr(r.date))
    .replace('{slug}', slug)
    .replace('{n}', String(i + (Number.isFinite(start) ? start : 1)).padStart(2, '0'));
  if (($('#lower') as HTMLInputElement).checked) n = n.toLowerCase();
  return n + ext;
}

function renameAll(): void {
  rows.forEach((r, i) => { r.newName = nameFor(r, i); });
}

function render(): void {
  list.innerHTML = '';
  rows.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'frow';
    const info = document.createElement('div');
    info.className = 'grow';
    const changed = r.newName && r.newName !== r.file.name;
    info.innerHTML = `<div class="nm">${escapeHtml(r.file.name)} <span class="meta">${fmtBytes(r.file.size)} · 📅 ${fmtDate(r.date)}</span></div>
      <div class="mono" style="color:${changed ? '#7ce0ae' : 'var(--mut)'}">→ ${escapeHtml(r.newName || '')}</div>`;
    div.appendChild(info);
    list.appendChild(div);
  });
}

async function exportZip(): Promise<void> {
  if (!rows.length) return;
  status(stat, 'Zipping…', 'info');
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Map<string, number>();
  for (const r of rows) {
    let n = r.newName || r.file.name;
    // dedupe (same second photos etc.)
    const k = n.toLowerCase();
    if (used.has(k)) {
      const c = used.get(k)! + 1;
      used.set(k, c);
      n = n.replace(/(\.[^.]+)$/, `-${c}$1`);
    } else used.set(k, 0);
    zip.file(n, await r.file.arrayBuffer());
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, 'renamed-files.zip');
  status(stat, `Zip ready (${fmtBytes(blob.size)}) — ${rows.length} files renamed.`, 'ok');
  toast('Zip ready 🗂️');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}

/* ---- agent mode: ?url=&prefix=&suffix=&start=N — see agents.html ---- */
import { agentInit, bindText, bindNumber, fetchFileParam, agentBanner, type QuerySpec } from '../lib/agent';
{
  const spec: QuerySpec = {
    prefix: bindText(document.getElementById('preTxt') as HTMLInputElement),
    suffix: bindText(document.getElementById('sufTxt') as HTMLInputElement),
    start: bindNumber(document.getElementById('startN') as HTMLInputElement, 0, 99999),
  };
  const applied = agentInit(spec, (k) => `applied ${k.join(', ')}`);
  const u = new URLSearchParams(location.search).get('url');
  if (u) void fetchFileParam(u, 'photo.jpg').then((f) => { if (f) { agentBanner((applied.length ? `applied ${applied.join(', ')} · ` : '') + 'loaded file from <code>url</code> param'); add([f]); } });
}
