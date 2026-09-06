/* PDF building blocks shared by receipts / scan / print prep / invoice /
 * sign pages. All on top of pdf-lib; fonts are Standard so no embedding. */

import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

export { PDFDocument, StandardFonts, rgb, degrees };

export const PAGE = {
  A4: { w: 595.28, h: 841.89 },
  LETTER: { w: 612, h: 792 },
  IN4x6: { w: 432, h: 288 },   // 4in tall x 6in wide? — no: 4x6 landscape = 6in wide (432pt) x 4in tall (288pt)
  IN5x7: { w: 504, h: 360 },   // 5x7 landscape: 7in wide x 5in tall
  IN6x4: { w: 288, h: 432 },   // portrait 4x6: 4in wide x 6in tall
  A3: { w: 841.89, h: 1190.55 },
} as const;

/** create an empty doc with a page of the given size (pt) */
export function newDoc(pageW: number, pageH: number): Promise<{ doc: PDFDocument; page: import('pdf-lib').PDFPage }> {
  return PDFDocument.create().then((doc) => {
    const page = doc.addPage([pageW, pageH]);
    return { doc, page };
  });
}

/** draw an image canvas centered & scaled to fit inside margins (pt), return rect used */
export function fitImage(
  page: import('pdf-lib').PDFPage,
  img: import('pdf-lib').PDFImage,
  pageW: number, pageH: number,
  margin = 24,
): { x: number; y: number; w: number; h: number } {
  const iw = img.width, ih = img.height;
  const availW = pageW - margin * 2, availH = pageH - margin * 2;
  const r = Math.min(availW / iw, availH / ih);
  const w = iw * r, h = ih * r;
  const x = (pageW - w) / 2, y = (pageH - h) / 2;
  page.drawImage(img, { x, y, width: w, height: h });
  return { x, y, w, h };
}

/** text helper: single line, returns width used */
export function text(
  page: import('pdf-lib').PDFPage,
  font: import('pdf-lib').PDFFont,
  s: string, x: number, y: number, size = 10, color = rgb(0.1, 0.1, 0.1),
): number {
  const width = font.widthOfTextAtSize(s, size);
  page.drawText(s, { x, y, size, font, color });
  return width;
}

/** right-aligned text */
export function textRight(
  page: import('pdf-lib').PDFPage,
  font: import('pdf-lib').PDFFont,
  s: string, rightX: number, y: number, size = 10, color = rgb(0.1, 0.1, 0.1),
): number {
  const width = font.widthOfTextAtSize(s, size);
  page.drawText(s, { x: rightX - width, y, size, font, color });
  return width;
}

/** centered text */
export function textCenter(
  page: import('pdf-lib').PDFPage,
  font: import('pdf-lib').PDFFont,
  s: string, cx: number, y: number, size = 10, color = rgb(0.1, 0.1, 0.1),
): number {
  const width = font.widthOfTextAtSize(s, size);
  page.drawText(s, { x: cx - width / 2, y, size, font, color });
  return width;
}

/** horizontal rule */
export function hline(
  page: import('pdf-lib').PDFPage,
  x0: number, x1: number, y: number, thickness = 0.7, color = rgb(0.75, 0.75, 0.75),
): void {
  page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness, color });
}

/** wrap text to maxWidth pt; returns lines */
export function wrap(
  font: import('pdf-lib').PDFFont, s: string, maxWidth: number, size: number,
): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const wd of words) {
    const test = cur ? cur + ' ' + wd : wd;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) cur = test;
    else { if (cur) lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** sanitize text for StandardFonts (WinAnsi) — replace unsupported chars */
export function winansi(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[^\x00-\xFF]/g, '?');
}
