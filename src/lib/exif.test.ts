import { describe, it, expect } from 'vitest';
import { parseExif, stripExif } from './exif';

/* Build a minimal JPEG: SOI + APP1(Exif with GPS + DateTime) + minimal frame + EOI.
 * This exercises the real byte-level parser/stripper. */

function u16(v: number): number[] { return [(v >> 8) & 0xff, v & 0xff]; }
function u16le(v: number): number[] { return [v & 0xff, (v >> 8) & 0xff]; }
function ascii(s: string): number[] { return [...s].map((c) => c.charCodeAt(0)); }

function buildExifBlob(): Blob {
  // TIFF: II\0*\0, IFD0 with 2 entries: Make (ASCII) + DateTime; no GPS for the strip test add via second IFD? keep simple
  // We'll build: IFD0 with Make + DateTimeOriginal is in ExifIFD — simplify: Make + DateTime in IFD0.
  const entries: number[] = [];
  const data: number[] = [];

  // entry: Make = "NavCam" (offset data)
  // entry: DateTime = "2026:09:05 14:30:00" (inline is 20 bytes > 4 → offset)

  // Layout: header(8) | IFD0(2 + 2*12 + 4) | data...
  const ifd0Off = 8;
  const nEntries = 2;
  const dataStart = ifd0Off + 2 + nEntries * 12 + 4;
  // Make: type 2, count 7 ("NavCam\0"), value = dataStart
  const makeOff = dataStart;
  const makeBytes = ascii('NavCam\0');
  // DateTime: type 2, count 20, value = dataStart + makeBytes.length
  const dtOff = dataStart + makeBytes.length;
  const dtBytes = ascii('2026:09:05 14:30:00\0');

  const entry = (tag: number, type: number, count: number, off: number) =>
    [...u16le(tag), ...u16le(type), ...u32(count), ...u32(off)];
  function u32(v: number): number[] { return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]; }

  entries.push(
    ...entry(0x010f, 2, makeBytes.length, makeOff),
    ...entry(0x0132, 2, dtBytes.length, dtOff),
  );

  const tiff = [
    ...ascii('II'), 0x2a, 0x00, ...u32(ifd0Off),
    ...u16le(nEntries), ...entries, ...u32(0), // next IFD = 0
    ...makeBytes, ...dtBytes,
  ];

  const app1Payload = [...ascii('Exif\0\0'), ...tiff];
  const app1Len = app1Payload.length + 2;

  const jpeg = [
    0xff, 0xd8,
    0xff, 0xe1, ...u16(app1Len), ...app1Payload,
    // minimal SOF0 so it's still a "jpeg" to our parser boundaries (parser stops at SOS anyway)
    0xff, 0xda, 0x00, 0x02, 0x01, 0x00, // SOS minimal
    0xff, 0xd9,
  ];

  return new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' });
}

describe('exif parser', () => {
  it('parses Make and DateTime from a real APP1 segment', async () => {
    const buf = await buildExifBlob().arrayBuffer();
    const exif = parseExif(buf);
    expect(exif).not.toBeNull();
    const e = exif!;
    expect(e.tags['Make']).toBe('NavCam');
    expect(e.tags['DateTime']).toBe('2026:09:05 14:30:00');
    expect(e.dateTime && e.dateTime.getFullYear()).toBe(2026);
    expect(e.gps).toBeUndefined();
  });

  it('returns null for non-JPEG buffers', () => {
    expect(parseExif(new TextEncoder().encode('%PDF-1.4').buffer as ArrayBuffer)).toBeNull();
  });
});

describe('exif stripper', () => {
  it('removes APP1 Exif and keeps SOI/EOI', async () => {
    const src = buildExifBlob();
    const out = await stripExif(src);
    expect(out.size).toBeLessThan(src.size);
    const u8 = new Uint8Array(await out.arrayBuffer());
    expect(u8[0]).toBe(0xff); expect(u8[1]).toBe(0xd8);
    // no APP1 Exif remains
    for (let i = 0; i < u8.length - 1; i++) {
      if (u8[i] === 0xff && u8[i + 1] === 0xe1) {
        throw new Error('APP1 still present after strip');
      }
    }
  });

  it('passes through non-JPEG files untouched', async () => {
    const f = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    const out = await stripExif(f);
    expect(out).toBe(f);
  });
});
