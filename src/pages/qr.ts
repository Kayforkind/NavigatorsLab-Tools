/* QR Studio — generate (qrcode-generator) + decode (jsQR), all local.
 * Generation renders to canvas at the requested pixel size (nearest-neighbor,
 * so modules stay perfectly square); decoding reuses the shared file→canvas
 * helpers and samples pixels for jsQR. Nothing leaves the tab. */
import { $, onDrop, download, status, canvasBlob, fileToCanvas } from '../lib/dom';
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';

/* ---------- tabs ---------- */
const tabMake = $('#tabMake');
const tabRead = $('#tabRead');
const makePanel = $('#makePanel');
const readPanel = $('#readPanel');

function showTab(which: 'make' | 'read'): void {
  const mk = which === 'make';
  tabMake.classList.toggle('on', mk);
  tabRead.classList.toggle('on', !mk);
  makePanel.hidden = !mk;
  readPanel.hidden = mk;
}
tabMake.addEventListener('click', () => showTab('make'));
tabRead.addEventListener('click', () => showTab('read'));

/* ================= generate ================= */
const qrText = $('#qrText') as HTMLTextAreaElement;
const qrSize = $('#qrSize') as HTMLSelectElement;
const qrFg = $('#qrFg') as HTMLInputElement;
const qrBg = $('#qrBg') as HTMLInputElement;
const qrQuiet = $('#qrQuiet') as HTMLInputElement;
const btnMake = $('#qrMake') as HTMLButtonElement;
const btnPng = $('#qrPng') as HTMLButtonElement;
const btnSvgDl = $('#qrSvgDl') as HTMLButtonElement;
const qrOut = $('#qrOut');
const qrCanvas = $('#qrCanvas') as HTMLCanvasElement;
const qrMeta = $('#qrMeta');
const qrStat = $('#qrStat');

let lastSvg = '';
let lastPngName = 'qr.png';

btnMake.addEventListener('click', () => {
  const text = qrText.value.trim();
  if (!text) return status(qrStat, 'Type some text or a URL first.', 'warn');
  try {
    // typeNumber 0 = auto; 'M' is the standard error-correction level
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const px = parseInt(qrSize.value, 10);
    const quiet = qrQuiet.checked ? 4 : 0; // 4-module quiet zone (spec default)
    const scale = px / (count + quiet * 2);
    const size = Math.round((count + quiet * 2) * scale);

    qrCanvas.width = size;
    qrCanvas.height = size;
    const ctx = qrCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false; // keep module edges crisp
    ctx.fillStyle = qrBg.value;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = qrFg.value;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          // round positions so every module is exactly `scale` px wide
          ctx.fillRect(
            Math.floor((col + quiet) * scale),
            Math.floor((row + quiet) * scale),
            Math.ceil(scale),
            Math.ceil(scale),
          );
        }
      }
    }

    // SVG string (crisp at any size — also used by the SVG download)
    let path = '';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
    lastSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${count + quiet * 2} ${count + quiet * 2}" shape-rendering="crispEdges">` +
      `<rect width="100%" height="100%" fill="${qrBg.value}"/>` +
      `<path d="${path}" fill="${qrFg.value}"/></svg>`;

    lastPngName = 'qr-' + slug(text) + '.png';
    qrOut.hidden = false;
    btnPng.disabled = false;
    btnSvgDl.disabled = false;
    qrMeta.textContent = `${count}×${count} modules · error correction M · ${size}px`;
    status(qrStat, `QR generated locally — ${text.length} characters encoded.`, 'ok');
  } catch (e) {
    status(qrStat, `Could not encode that content: ${(e as Error).message}`, 'err');
  }
});

btnPng.addEventListener('click', async () => {
  const blob = await canvasBlob(qrCanvas, 'image/png');
  download(blob, lastPngName);
});
btnSvgDl.addEventListener('click', () => {
  download(new Blob([lastSvg], { type: 'image/svg+xml' }), lastPngName.replace(/\.png$/, '.svg'));
});

function slug(s: string): string {
  return s.replace(/^[a-z]+:\/\//, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() || 'code';
}

/* ================= decode ================= */
const qrDz = $('#qrDz');
const qrResult = $('#qrResult');
const srcCanvas = $('#srcCanvas') as HTMLCanvasElement;
const qrData = $('#qrData') as HTMLTextAreaElement;
const qrCopy = $('#qrCopy') as HTMLButtonElement;
const qrOpen = $('#qrOpen') as HTMLButtonElement;
const qrReadMeta = $('#qrReadMeta');
const qrReadStat = $('#qrReadStat');

onDrop(qrDz, (files) => { if (files[0]) void decode(files[0]); });
qrDz.addEventListener('click', async () => {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = () => { if (inp.files?.[0]) void decode(inp.files[0]); };
  inp.click();
});

async function decode(file: File): Promise<void> {
  status(qrReadStat, 'Scanning image on-device…', 'info');
  qrResult.hidden = true;
  try {
    // cap decode size — jsQR works best on images ≤ ~2000px
    const canvas = await fileToCanvas(file, 2000, 2000);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    if (!code) {
      status(qrReadStat, 'No QR code found in that image. If the code is small, try a tighter crop.', 'warn');
      return;
    }
    // show the source (scaled into the preview box) + the payload
    const maxShow = 320;
    const r = Math.min(1, maxShow / Math.max(canvas.width, canvas.height));
    srcCanvas.width = Math.round(canvas.width * r);
    srcCanvas.height = Math.round(canvas.height * r);
    srcCanvas.getContext('2d')!.drawImage(canvas, 0, 0, srcCanvas.width, srcCanvas.height);
    qrData.value = code.data;
    qrResult.hidden = false;
    const isUrl = /^https?:\/\//i.test(code.data);
    qrOpen.hidden = !isUrl;
    if (isUrl) qrOpen.onclick = () => window.open(code.data, '_blank', 'noopener');
    qrReadMeta.textContent = `${file.name} · ${canvas.width}×${canvas.height}px decoded locally`;
    status(qrReadStat, 'Decoded — the image was processed on this device only.', 'ok');
  } catch (e) {
    status(qrReadStat, `Could not read that image: ${(e as Error).message}`, 'err');
  }
}

qrCopy.addEventListener('click', async () => {
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
}
