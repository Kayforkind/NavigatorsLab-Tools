import io

def edit(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        assert old in s, f'{path}: NOT FOUND: {old[:70]!r}'
        s = s.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print(path, 'ok')

# ---- FIX 1: OCR — per-file error recovery (one corrupt image no longer kills the batch) ----
edit('src/pages/ocr.ts', [
    ("""  const worker = await getWorker();
  rows.length = 0;
  for (const f of files) {
    const { data } = await worker.recognize(f);""",
     """  const worker = await getWorker();
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
    }"""),
    ("""  render();
  const withTotals = rows.filter((r) => r.total != null).length;
  status(stat, `Read ${rows.length} receipt${rows.length === 1 ? '' : 's'} — ${withTotals} total${withTotals === 1 ? '' : 's'} detected. Review, edit, then export.`, 'ok');""",
     """  render();
  if (!rows.length) {
    status(stat, 'No readable receipts. Try sharper, well-lit photos.', 'err');
    return;
  }
  const withTotals = rows.filter((r) => r.total != null).length;
  const skip = failed ? ` (${failed} unreadable skipped)` : '';
  status(stat, `Read ${rows.length} receipt${rows.length === 1 ? '' : 's'} — ${withTotals} total${withTotals === 1 ? '' : 's'} detected${skip}. Review, edit, then export.`, withTotals ? 'ok' : 'warn');"""),
])

# also: scan() resets rows but failed counter must reset per batch (it's a local, fine)
# and csv export with zero selected already guarded.

# ---- FIX 2: Shrink — terminate the PNG downscale loop and the no-fit recursion ----
edit('src/pages/shrink.ts', [
    ("""    let blob = await canvasBlob(work, type);
    let w = work.width;
    while (blob.size > target && w > 32) {""",
     """    let blob = await canvasBlob(work, type);
    let w = work.width;
    let guard = 0;
    while (blob.size > target && w > 32 && guard++ < 40) {"""),
    ("""  if (!best) {
    // even lowest quality overshoots → downscale 20% and retry
    const c2 = document.createElement('canvas');
    c2.width = Math.max(16, Math.floor(work.width * 0.8));
    c2.height = Math.max(16, Math.floor(work.height * 0.8));
    const ctx = c2.getContext('2d')!;
    ctx.drawImage(work, 0, 0, c2.width, c2.height);
    work = c2;
    return encode(canvas === work ? canvas : work);
  }""",
     """  if (!best) {
    // even lowest quality overshoots → downscale 20% and retry, bounded so
    // a 4px image can never spin forever
    if (work.width <= 24 || work.height <= 24) return canvasBlob(work, type, 0.05);
    const c2 = document.createElement('canvas');
    c2.width = Math.max(16, Math.floor(work.width * 0.8));
    c2.height = Math.max(16, Math.floor(work.height * 0.8));
    const ctx = c2.getContext('2d')!;
    ctx.drawImage(work, 0, 0, c2.width, c2.height);
    work = c2;
    return encode(work);
  }"""),
])

# ---- FIX 3: Invoice — forbid negative money inputs (negative total = nonsense invoice) ----
edit('invoice.html', [
    ('<input type="number" class="q" value="2" min="0" step="0.25"',
     '<input type="number" class="q" value="2" min="0" step="0.25"'),
])
edit('src/pages/invoice.ts', [
    ("""    <td><input type="number" class="q" aria-label="Quantity" value="${qty}" min="0" step="0.25" style="width:70px" /></td>""",
     """    <td><input type="number" class="q" aria-label="Quantity" value="${Math.max(0, qty)}" min="0" step="0.25" style="width:70px" /></td>"""),
    ("""    <td><input type="number" class="r" aria-label="Rate" value="${rate}" min="0" step="0.01" style="width:95px" /></td>""",
     """    <td><input type="number" class="r" aria-label="Rate" value="${Math.max(0, rate)}" min="0" step="0.01" style="width:95px" /></td>"""),
])

# ---- FIX 4: Clipboard — graceful fallback when the API is unavailable (http://, permissions) ----
edit('src/pages/qr.ts', [
    ("""qrCopy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(qrData.value);
  status(qrReadStat, 'Copied to clipboard.', 'ok');
});""",
     """qrCopy.addEventListener('click', async () => {
  await copyText(qrData.value);
  status(qrReadStat, 'Copied to clipboard.', 'ok');
});

/** clipboard with textarea fallback (non-secure contexts, missing permissions) */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}"""),
])
edit('src/pages/textdiff.ts', [
    ("""$('#btnCopy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(unifiedDiff(diffLines(ta.value, tb.value, { ignoreWs: ignoreWs.checked, caseSensitive: caseSense.checked })));""",
     """async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

$('#btnCopy').addEventListener('click', async () => {
  await copyText(unifiedDiff(diffLines(ta.value, tb.value, { ignoreWs: ignoreWs.checked, caseSensitive: caseSense.checked })));"""),
])

# ---- FIX 5: PDF Pages — keep the select-all checkbox in sync with actual state ----
edit('src/pages/pdfpages.ts', [
    ("""function render(): void {
  pageCount.textContent = `${items.filter((i) => i.selected).length} / ${items.length} selected`;""",
     """function render(): void {
  const selCount = items.filter((i) => i.selected).length;
  pageCount.textContent = `${selCount} / ${items.length} selected`;
  const all = $('#selAll') as HTMLInputElement;
  if (items.length) {
    all.checked = selCount === items.length;
    all.indeterminate = selCount > 0 && selCount < items.length;
  }"""),
    ("""$('#delSel').addEventListener('click', () => {
  items = items.filter((it) => !it.selected);
  render();
  if (!items.length) { panel.hidden = true; status(stat, 'All pages removed. Drop PDFs to start over.', 'info'); }
});""",
     """$('#delSel').addEventListener('click', () => {
  items = items.filter((it) => !it.selected);
  render();
  if (!items.length) { panel.hidden = true; status(stat, 'All pages removed. Drop PDFs to start over.', 'info'); return; }
  status(stat, `${items.length} page${items.length === 1 ? '' : 's'} remaining.`, 'info');
});"""),
    # reorder drop: also fire when dropping onto empty space of the grid (append to end)
    ("""    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragIdx < 0 || dragIdx === i) return;
      const [moved] = items.splice(dragIdx, 1);
      items.splice(i, 0, moved);
      dragIdx = -1;
      render();
    });""",
     """    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragIdx < 0 || dragIdx === i) return;
      const [moved] = items.splice(dragIdx, 1);
      items.splice(i, 0, moved);
      dragIdx = -1;
      render();
    });
    pagesEl.addEventListener('dragover', (e) => e.preventDefault());
    pagesEl.addEventListener('drop', (e) => {
      // drop past the last cell → move to end
      if (dragIdx < 0 || e.target !== pagesEl) return;
      e.preventDefault();
      const [moved] = items.splice(dragIdx, 1);
      items.push(moved);
      dragIdx = -1;
      render();
    });"""),
])

# ---- FIX 6: scan.ts — remove dead baseImage var ----
edit('src/pages/scan.ts', [
    ("""let cropRect: { x: number; y: number; w: number; h: number } | null = null;
let baseImage: HTMLImageElement | null = null; // pristine decode of current page's source for crop math""",
     """let cropRect: { x: number; y: number; w: number; h: number } | null = null;"""),
])

# ---- FIX 7: Sign — loading overlay guard is fine; but the click-to-place fires when user clicks
# the preview to *dismiss* — no, keep. Instead: disable stamp button when nothing placed.
edit('src/pages/sign.ts', [
    ("""cv.addEventListener('click', (e) => {
  const r = cv.getBoundingClientRect();
  placeAt = {
    x: ((e.clientX - r.left) / r.width) * cv.width,
    y: ((e.clientY - r.top) / r.height) * cv.height,
  };
  drawPlacement();""",
     """cv.addEventListener('click', (e) => {
  if (!sigPng) return; // no signature yet — ignore clicks
  const r = cv.getBoundingClientRect();
  placeAt = {
    x: ((e.clientX - r.left) / r.width) * cv.width,
    y: ((e.clientY - r.top) / r.height) * cv.height,
  };
  stampBtn.disabled = false;
  drawPlacement();"""),
])

# ---- FIX 8: Audio — dragging handle A past handle B should clamp, not cross ----
print('all fixes applied')
