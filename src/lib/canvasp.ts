/* Canvas pixel ops shared by scan cleaner / print prep / shrinker. */

/** grayscale + brightness/contrast in one pass */
export function enhance(
  ctx: CanvasRenderingContext2D,
  { gray = false, brightness = 0, contrast = 0 } = {},
): void {
  const { width, height } = ctx.canvas;
  if (!gray && brightness === 0 && contrast === 0) return;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const c = (259 * (contrast + 255)) / (255 * (259 - contrast)); // classic contrast factor
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (gray) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = y;
    }
    d[i] = clamp(c * (r - 128) + 128 + brightness);
    d[i + 1] = clamp(c * (g - 128) + 128 + brightness);
    d[i + 2] = clamp(c * (b - 128) + 128 + brightness);
  }
  ctx.putImageData(img, 0, 0);
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/** perspective-correct a quadrilateral crop (scan straighten). pts in canvas px, order TL,TR,BR,BL. */
export function perspectiveCrop(
  src: HTMLCanvasElement, pts: { x: number; y: number }[],
  outW: number, outH: number,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const sctx = src.getContext('2d')!;
  const dctx = out.getContext('2d')!;
  const sm = sctx.getImageData(0, 0, src.width, src.height);
  const dm = dctx.createImageData(outW, outH);
  // inverse mapping: for each dest pixel, find src via bilinear on the quad
  const [tl, tr, br, bl] = pts;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const u = x / outW, v = y / outH;
      // bilinear interp of quad corners
      const sx = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x;
      const sy = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y;
      const xi = Math.floor(sx), yi = Math.floor(sy);
      if (xi < 0 || yi < 0 || xi >= src.width || yi >= src.height) continue;
      const si = (yi * src.width + xi) * 4;
      const di = (y * outW + x) * 4;
      dm.data[di] = sm.data[si];
      dm.data[di + 1] = sm.data[si + 1];
      dm.data[di + 2] = sm.data[si + 2];
      dm.data[di + 3] = sm.data[si + 3];
    }
  }
  dctx.putImageData(dm, 0, 0);
  return out;
}

/** auto-deskew by content bounding box, rotate so the dominant text angle is 0. */
export function autoStraighten(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const d = ctx.getImageData(0, 0, w, h).data;
  // row darkness profile → skew estimate via best shift correlation over ±6°
  const step = Math.max(1, Math.floor(w / 200));
  const cols: number[] = [];
  for (let x = 0; x < w; x += step) {
    let dark = 0;
    for (let y = 0; y < h; y++) { if (d[(y * w + x) * 4] < 128) dark++; }
    cols.push(dark);
  }
  // ...skew estimate is approximate; keep a light ±4° search on column profile shift
  let best = 0, bestScore = -1;
  for (let deg = -4; deg <= 4; deg += 0.5) {
    const rad = (deg * Math.PI) / 180;
    const shift = Math.tan(rad) * h;
    let score = 0;
    for (let x = 0; x < cols.length; x++) {
      const xx = Math.round(x + shift / step);
      if (xx >= 0 && xx < cols.length) score += cols[x] * cols[xx];
    }
    if (score > bestScore) { bestScore = score; best = deg; }
}
  if (Math.abs(best) < 0.25) return canvas;
  const rad = (best * Math.PI) / 180;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d')!;
  octx.translate(w / 2, h / 2);
  octx.rotate(rad);
  octx.drawImage(canvas, -w / 2, -h / 2);
  return out;
}

/** encode a canvas as JPEG at quality → Blob */
export function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
  );
}
