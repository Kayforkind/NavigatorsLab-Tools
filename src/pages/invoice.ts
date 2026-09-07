import { $, download, status, toast } from '../lib/dom';

interface Item { desc: string; qty: number; rate: number; }

const tbody = document.querySelector('#items tbody') as HTMLTableCellElement;
const cv = $('#cv') as HTMLCanvasElement;
const stat = $('#stat');
const totalPill = $('#total');

function items(): Item[] {
  return Array.from(tbody.querySelectorAll('tr')).map((tr) => ({
    desc: (tr.querySelector('.d') as HTMLInputElement).value,
    qty: Math.max(0, parseFloat((tr.querySelector('.q') as HTMLInputElement).value) || 0),
    rate: Math.max(0, parseFloat((tr.querySelector('.r') as HTMLInputElement).value) || 0),
  }));
}

function totals() {
  const sub = items().reduce((s, it) => s + it.qty * it.rate, 0);
  const taxPct = Math.min(100, Math.max(0, parseFloat(($('#tax') as HTMLInputElement).value) || 0));
  const discPct = Math.min(100, Math.max(0, parseFloat(($('#disc') as HTMLInputElement).value) || 0));
  // discount first, then tax on the discounted amount — the common convention
  // (tax on what was actually charged). Label in the PDF states the order.
  const disc = sub * (discPct / 100);
  const net = sub - disc;
  const tax = net * (taxPct / 100);
  return { sub, tax, disc, net, total: net + tax };
}

function money(v: number): string {
  const cur = ($('#cur') as HTMLSelectElement).value;
  return `${cur}${v.toFixed(2)}`;
}

function addItem(desc = '', qty = 1, rate = 0): void {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="d" value="${desc.replace(/"/g, '&quot;')}" placeholder="What did you do?" style="width:100%" /></td>
    <td><input type="number" class="q" aria-label="Quantity" value="${Math.max(0, qty)}" min="0" step="0.25" style="width:70px" /></td>
    <td><input type="number" class="r" aria-label="Rate" value="${Math.max(0, rate)}" min="0" step="0.01" style="width:95px" /></td>
    <td><button class="danger" title="remove">✕</button></td>`;
  tr.querySelector('button')!.addEventListener('click', () => { tr.remove(); render(); });
  tr.querySelectorAll('input').forEach((i) => i.addEventListener('input', render));
  tbody.appendChild(tr);
}
$('#addItem').addEventListener('click', () => addItem());
$('#pdf').addEventListener('click', () => void exportPdf());

/* ---------- shared doc model ---------- */
function model() {
  const t = totals();
  return {
    type: ($('#docType') as HTMLSelectElement).value,
    tpl: ($('#tpl') as HTMLSelectElement).value,
    biz: ($('#biz') as HTMLInputElement).value || 'Your Business',
    bizSub: ($('#bizSub') as HTMLInputElement).value,
    client: ($('#client') as HTMLInputElement).value || 'Client',
    clientSub: ($('#clientSub') as HTMLInputElement).value,
    no: ($('#docNo') as HTMLInputElement).value || 'INV-001',
    date: ($('#date') as HTMLInputElement).value,
    due: ($('#due') as HTMLInputElement).value,
    cur: ($('#cur') as HTMLSelectElement).value,
    items: items(),
    taxPct: parseFloat(($('#tax') as HTMLInputElement).value) || 0,
    discPct: parseFloat(($('#disc') as HTMLInputElement).value) || 0,
    notes: ($('#notes') as HTMLInputElement).value,
    ...t,
  };
}

/* ---------- canvas preview (mirrors the PDF layout) ---------- */
function render(): void {
  const m = model();
  totalPill.textContent = `${money(m.total)} total`;
  drawPreview(m);
}

function drawPreview(m: ReturnType<typeof model>): void {
  const W = 612, H = 792; // US Letter at 72dpi-ish
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const acc = m.tpl === 'classic' ? '#1a5276' : '#24304a';
  const mut = '#6b7280';

  // header band
  if (m.tpl === 'classic') {
    ctx.fillStyle = acc;
    ctx.fillRect(0, 0, W, 8);
  }
  ctx.fillStyle = acc;
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText(m.type, 48, m.tpl === 'classic' ? 76 : 72);
  ctx.font = '12px Arial';
  ctx.fillStyle = mut;
  ctx.textAlign = 'right';
  ctx.fillText(`#${m.no}`, W - 48, m.tpl === 'classic' ? 70 : 66);
  ctx.fillText(m.date ? `Date: ${m.date}` : '', W - 48, 88);
  if (m.due) ctx.fillText(`Due: ${m.due}`, W - 48, 104);
  ctx.textAlign = 'left';

  // from / to
  ctx.fillStyle = acc;
  ctx.font = 'bold 13px Arial';
  ctx.fillText(m.biz, 48, 140);
  ctx.fillStyle = mut;
  ctx.font = '11px Arial';
  wrapText(ctx, m.bizSub, 48, 156, 220, 14);
  ctx.fillStyle = acc;
  ctx.font = 'bold 13px Arial';
  ctx.fillText('Billed to', W - 270, 140);
  ctx.fillStyle = '#111';
  ctx.font = '12px Arial';
  ctx.fillText(m.client, W - 270, 156);
  ctx.fillStyle = mut;
  ctx.font = '11px Arial';
  wrapText(ctx, m.clientSub, W - 270, 172, 220, 14);

  // items table
  let y = 230;
  ctx.fillStyle = acc;
  ctx.font = 'bold 11px Arial';
  ctx.fillText('DESCRIPTION', 48, y);
  ctx.textAlign = 'right';
  ctx.fillText('QTY', 430, y);
  ctx.fillText('RATE', 505, y);
  ctx.fillText('AMOUNT', W - 48, y);
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#d7dbe0';
  ctx.beginPath(); ctx.moveTo(48, y + 6); ctx.lineTo(W - 48, y + 6); ctx.stroke();
  y += 26;
  ctx.font = '12px Arial';
  for (const it of m.items) {
    ctx.fillStyle = '#111';
    ctx.fillText(it.desc || '—', 48, y, 300);
    ctx.fillStyle = mut;
    ctx.textAlign = 'right';
    ctx.fillText(String(it.qty), 430, y);
    ctx.fillText(money(it.rate), 505, y);
    ctx.fillStyle = '#111';
    ctx.fillText(money(it.qty * it.rate), W - 48, y);
    ctx.textAlign = 'left';
    y += 20;
  }

  // totals
  y += 10;
  const rows: [string, string][] = [['Subtotal', money(m.sub)]];
  if (m.discPct) rows.push([`Discount (${m.discPct}%)`, '-' + money(m.disc)]);
  if (m.taxPct) rows.push([`Tax (${m.taxPct}%${m.discPct ? ' after discount' : ''})`, money(m.tax)]);
  ctx.textAlign = 'right';
  for (const [k, v] of rows) {
    ctx.fillStyle = mut; ctx.font = '11px Arial';
    ctx.fillText(k, 505 - 90, y);
    ctx.fillStyle = '#111';
    ctx.fillText(v, W - 48, y);
    y += 17;
  }
  ctx.fillStyle = acc; ctx.font = 'bold 15px Arial';
  ctx.fillText(money(m.total), W - 48, y + 8);
  ctx.strokeStyle = acc;
  ctx.beginPath(); ctx.moveTo(W - 190, y + 14); ctx.lineTo(W - 48, y + 14); ctx.stroke();
  ctx.textAlign = 'left';

  // notes
  if (m.notes) {
    ctx.fillStyle = mut; ctx.font = '10.5px Arial';
    wrapText(ctx, m.notes, 48, H - 90, W - 96, 13);
  }
  ctx.fillStyle = '#9ca3af'; ctx.font = '9px Arial';
  ctx.fillText('Created with NavigatorsLab Tools — free, private, in-browser', 48, H - 28);
}

function wrapText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, lh: number): void {
  if (!s) return;
  const words = s.split(/\s+/);
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxW) line = test;
    else { ctx.fillText(line, x, y); line = w; y += lh; }
  }
  if (line) ctx.fillText(line, x, y);
}

/* ---------- PDF export (same layout, real text) ---------- */
async function exportPdf(): Promise<void> {
  try {
    const m = model();
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib'); // lazy: keeps first paint fast
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([612, 792]);
    const W = 612;
    const acc = m.tpl === 'classic' ? rgb(0.1, 0.32, 0.46) : rgb(0.14, 0.19, 0.29);
    const mut = rgb(0.42, 0.45, 0.5);
    const dark = rgb(0.07, 0.07, 0.07);

    if (m.tpl === 'classic') page.drawRectangle({ x: 0, y: 784, width: W, height: 8, color: acc });
    page.drawText(m.type, { x: 48, y: m.tpl === 'classic' ? 62 : 58, size: 26, font: bold, color: acc });
    const right = (s: string, y: number, size = 11, f = font, c = mut) => {
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: W - 48 - w, y, size, font: f, color: c });
    };
    right(`#${m.no}`, m.tpl === 'classic' ? 78 : 74, 11, font, mut);
    if (m.date) right(`Date: ${m.date}`, 62);
    if (m.due) right(`Due: ${m.due}`, 48);

    page.drawText(m.biz, { x: 48, y: 652, size: 13, font: bold, color: acc });
    drawLines(page, font, m.bizSub, 48, 638, 220, 10, mut);
    page.drawText('Billed to', { x: W - 270, y: 652, size: 13, font: bold, color: acc });
    page.drawText(m.client, { x: W - 270, y: 636, size: 12, font, color: dark });
    drawLines(page, font, m.clientSub, W - 270, 620, 220, 10, mut);

    let y = 562;
    page.drawText('DESCRIPTION', { x: 48, y, size: 10, font: bold, color: acc });
    const rtext = (s: string, rx: number, yy: number, size = 10, f = font, c = mut) => {
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: rx - w, y: yy, size, font: f, color: c });
    };
    rtext('QTY', 430, y); rtext('RATE', 505, y); rtext('AMOUNT', W - 48, y);
    page.drawLine({ start: { x: 48, y: y - 6 }, end: { x: W - 48, y: y - 6 }, thickness: 0.7, color: rgb(0.84, 0.86, 0.88) });
    y -= 26;
    for (const it of m.items) {
      page.drawText((it.desc || '—').slice(0, 52), { x: 48, y, size: 11, font, color: dark });
      rtext(String(it.qty), 430, y, 11, font, mut);
      rtext(money(it.rate), 505, y, 11, font, mut);
      rtext(money(it.qty * it.rate), W - 48, y, 11, font, dark);
      y -= 20;
    }
    y -= 6;
    const rowsP: [string, string][] = [['Subtotal', money(m.sub)]];
    if (m.discPct) rowsP.push([`Discount (${m.discPct}%)`, '-' + money(m.disc)]);
    if (m.taxPct) rowsP.push([`Tax (${m.taxPct}%${m.discPct ? ' after discount' : ''})`, money(m.tax)]);
    for (const [k, v] of rowsP) {
      rtext(k, 415, y, 10, font, mut);
      rtext(v, W - 48, y, 10, font, dark);
      y -= 17;
    }
    rtext(money(m.total), W - 48, y - 2, 15, bold, acc);
    page.drawLine({ start: { x: W - 190, y: y - 10 }, end: { x: W - 48, y: y - 10 }, thickness: 1, color: acc });
    if (m.notes) drawLines(page, font, m.notes, 48, 90, W - 96, 10, mut);
    page.drawText('Created with NavigatorsLab Tools - free, private, in-browser', { x: 48, y: 28, size: 8, font, color: rgb(0.6, 0.63, 0.67) });

    const bytes = await doc.save();
    download(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), `${m.no || 'invoice'}.pdf`);
    status(stat, `PDF exported (${m.items.length} items, total ${money(m.total)}).`, 'ok');
    toast('Invoice PDF ⬇️');
  } catch (e) {
    status(stat, `Export failed: ${(e as Error).message}`, 'err');
  }
}

function drawLines(
  page: import('pdf-lib').PDFPage, font: import('pdf-lib').PDFFont,
  s: string, x: number, y: number, maxW: number, size: number, color: import('pdf-lib').RGB,
): void {
  if (!s) return;
  const words = s.split(/\s+/);
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
    else { page.drawText(line, { x, y: yy, size, font, color }); line = w; yy -= 12; }
  }
  if (line) page.drawText(line, { x, y: yy, size, font, color });
}

// seed rows + defaults
addItem('Example service', 2, 50);
($('#date') as HTMLInputElement).value = new Date().toISOString().slice(0, 10);
render();
// delegate: any input/select change anywhere re-renders (item rows render twice; harmless)
document.addEventListener('input', (e) => {
  if ((e.target as HTMLElement).matches?.('input, select')) render();
});
document.addEventListener('change', (e) => {
  if ((e.target as HTMLElement).matches?.('input, select')) render();
});
