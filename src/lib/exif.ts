/* Minimal EXIF parser (JPEG APP1). Extracts GPS + dates + camera + orientation
 * and the raw APP1 segment so images can be rewritten *without* it.
 * Everything is synchronous over an ArrayBuffer; small enough to inline. */

export interface ExifData {
  hasExif: boolean;
  /** raw APP1 "Exif\0\0" segment including header, or null */
  app1: Uint8Array | null;
  tags: Record<string, string>;
  gps?: { lat: number; lon: number; alt?: number };
  dateTime?: Date | null;
  camera?: string;
  orientation?: number;
}

const TAGS: Record<number, string> = {
  0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x0132: 'DateTime',
  0x8298: 'Copyright', 0x829a: 'ExposureTime', 0x829d: 'FNumber',
  0x8827: 'ISO', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
  0x920a: 'FocalLength', 0x9286: 'UserComment', 0x013b: 'Artist',
  0xa430: 'CameraOwnerName', 0xa433: 'LensMake', 0xa434: 'LensModel', 0x0131: 'Software',
};

/** Parse a JPEG buffer; returns null for non-JPEG or no EXIF. */
export function parseExif(buf: ArrayBuffer): ExifData | null {
  const u8 = new Uint8Array(buf);
  if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) return null;
  let off = 2;
  while (off + 4 <= u8.length) {
    if (u8[off] !== 0xff) break;
    const marker = u8[off + 1];
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
    const len = (u8[off + 2] << 8) | u8[off + 3];
    const isExif = marker === 0xe1 &&
      u8[off + 4] === 0x45 && u8[off + 5] === 0x78 && u8[off + 6] === 0x69 &&
      u8[off + 7] === 0x66 && u8[off + 8] === 0x00 && u8[off + 9] === 0x00;
    if (isExif) {
      // segment data starts AFTER the 2-byte length field
      const app1 = u8.slice(off + 4, off + 2 + len);
      return decodeApp1(app1);
    }
    off += 2 + len;
  }
  return null;
}

function decodeApp1(app1: Uint8Array): ExifData {
  const tags: Record<string, string> = {};
  let gps: ExifData['gps'];
  let dateTime: Date | null = null;
  let camera: string | undefined;
  let orientation: number | undefined;
  const tiff = 6; // offset of TIFF header inside APP1 after "Exif\0\0"
  if (app1.length > tiff + 8) {
    const view = new DataView(app1.buffer, app1.byteOffset, app1.byteLength);
    const le = app1[tiff] === 0x49; // "II" = little endian
    const ifd0 = tiff + view.getUint32(tiff + 4, le);
    readIfd(app1, view, ifd0, le, tiff, (tag, _type, _count, valStr, valNum, nums) => {
      const name = TAGS[tag];
      if (name) tags[name] = valStr;
      if (tag === 0x0112) orientation = valNum;
      if (tag === 0x0132 || tag === 0x9003 || tag === 0x9004) {
        const d = parseExifDate(valStr);
        if (d && !dateTime) dateTime = d;
      }
    });
    const make = tags['Make'] || '';
    const model = tags['Model'] || '';
    camera = [make, model].filter(Boolean).join(' ') || tags['CameraOwnerName'] || undefined;
    // Exif sub-IFD (0x8769) holds DateTimeOriginal etc. on real cameras
    const exifIfd = findPointerTag(app1, view, ifd0, le, 0x8769);
    if (exifIfd != null) {
      readIfd(app1, view, tiff + exifIfd, le, tiff, (tag, _t, _c, valStr, _n, nums) => {
        const name = TAGS[tag];
        if (name && !tags[name]) tags[name] = valStr;
        if (tag === 0x9003 || tag === 0x9004) {
          const d = parseExifDate(valStr);
          if (d && !dateTime) dateTime = d;
        }
      });
    }
    // GPS IFD (0x8825) — pointer value stored inline (TIFF-relative)
    const gp = findPointerTag(app1, view, ifd0, le, 0x8825);
    if (gp != null) {
      const g: Record<number, string | number | number[]> = {};
      readIfd(app1, view, tiff + gp, le, tiff, (tag, _t, _c, s, n, nums) => {
        if (tag === 0x0002 || tag === 0x0004) g[tag] = nums ?? n; // DMS rationals
        else g[tag] = tag === 0x0006 ? n : s;
      });
      const lat = dmsToDeg(g[2], String(g[1] ?? 'N'));
      const lon = dmsToDeg(g[4], String(g[3] ?? 'E'));
      if (lat != null && lon != null) gps = { lat, lon, alt: typeof g[6] === 'number' ? (g[6] as number) : undefined };
    }
  }
  return { hasExif: true, app1, tags, gps, dateTime, camera, orientation };
}

type IfdCb = (tag: number, type: number, count: number, valStr: string, valNum: number, nums?: number[]) => void;

function readIfd(arr: Uint8Array, view: DataView, ifdOff: number, le: boolean, tiff: number, cb: IfdCb): void {
  if (ifdOff + 2 > arr.length) return;
  const n = view.getUint16(ifdOff, le);
  for (let i = 0; i < n; i++) {
    const e = ifdOff + 2 + i * 12;
    if (e + 12 > arr.length) return;
    const tag = view.getUint16(e, le);
    const type = view.getUint16(e + 2, le);
    const count = view.getUint32(e + 4, le);
    const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const sz = sizes[type] ?? 1;
    const byteLen = sz * count;
    let dataOff = e + 8;
    if (byteLen > 4) dataOff = tiff + view.getUint32(e + 8, le);
    if (dataOff + byteLen > arr.length) continue;
    if (type === 2) { // ASCII
      cb(tag, type, count, ascii(arr, dataOff, Math.min(count, 256)), 0);
    } else if (type === 5 || type === 10) { // rationals
      const nums: number[] = [];
      for (let k = 0; k < count; k++) {
        const nu = view.getUint32(dataOff + k * 8, le);
        const de = view.getUint32(dataOff + k * 8 + 4, le);
        nums.push(de ? nu / de : 0);
      }
      cb(tag, type, count, nums.join(', '), nums[0] ?? 0, nums);
    } else {
      let v: number;
      if (type === 3) v = view.getUint16(dataOff, le);
      else v = view.getUint32(dataOff, le);
      cb(tag, type, count, String(v), v);
    }
  }
}

/** Offset stored *inline* in the entry (pointer tags 0x8769 / 0x8825 are LONG, byteLen==4). Returns TIFF-relative offset. */
function findPointerTag(arr: Uint8Array, view: DataView, ifdOff: number, le: boolean, tag: number): number | null {
  if (ifdOff + 2 > arr.length) return null;
  const n = view.getUint16(ifdOff, le);
  for (let i = 0; i < n; i++) {
    const e = ifdOff + 2 + i * 12;
    if (e + 12 > arr.length) return null;
    if (view.getUint16(e, le) === tag) return view.getUint32(e + 8, le);
  }
  return null;
}

function ascii(arr: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const b = arr[off + i];
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s.trim();
}

function parseExifDate(s: string): Date | null {
  // "YYYY:MM:DD HH:MM:SS"
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d;
}

function dmsToDeg(v: unknown, ref: string): number | null {
  let n: number;
  if (Array.isArray(v)) {
    const [d = 0, m = 0, s = 0] = v as number[];
    n = d + m / 60 + s / 3600;
  } else if (typeof v === 'string') n = parseFloat(v);
  else if (typeof v === 'number') n = v;
  else return null;
  if (!isFinite(n)) return null;
  const sign = /^[SsWw]/.test(ref) ? -1 : 1;
  return sign * n;
}

/** Remove EXIF (all APP1 Exif segments) from a JPEG buffer → new Blob. Non-JPEG passes through unchanged. */
export async function stripExif(file: File | Blob): Promise<Blob> {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) return file; // not jpeg → untouched
  const parts: BlobPart[] = [];
  const push = (a: Uint8Array, b: number, e: number) => parts.push(a.slice(b, e));
  const head = u8.slice(0, 2);
  parts.push(head);
  let off = 2;
  let stripped = false;
  while (off + 4 <= u8.length) {
    if (u8[off] !== 0xff) break;
    const marker = u8[off + 1];
    if (marker === 0xda) {
      // start of scan: entropy-coded data follows, copy everything verbatim
      push(u8, off, u8.length);
      off = u8.length;
      break;
    }
    if (marker === 0xd9) { push(u8, off, u8.length); off = u8.length; break; }
    const len = (u8[off + 2] << 8) | u8[off + 3];
    const isExif = marker === 0xe1 && off + 10 <= u8.length &&
      u8[off + 4] === 0x45 && u8[off + 5] === 0x78 && u8[off + 6] === 0x69 && u8[off + 7] === 0x66;
    if (isExif) { stripped = true; off += 2 + len; continue; }
    push(u8, off, off + 2 + len);
    off += 2 + len;
  }
  if (!stripped) return file;
  return new Blob(parts, { type: 'image/jpeg' });
}

/** Human summary of what was found (for the checker UI). */
export function exifSummary(e: ExifData): string[] {
  const lines: string[] = [];
  if (e.gps) lines.push(`GPS ${e.gps.lat.toFixed(6)}, ${e.gps.lon.toFixed(6)}`);
  if (e.camera) lines.push(`Camera: ${e.camera}`);
  if (e.dateTime) lines.push(`Taken: ${e.dateTime.toLocaleString()}`);
  for (const [k, v] of Object.entries(e.tags)) {
    if (['Make', 'Model', 'DateTime', 'DateTimeOriginal', 'DateTimeDigitized'].includes(k)) continue;
    lines.push(`${k}: ${v}`);
  }
  return lines;
}
