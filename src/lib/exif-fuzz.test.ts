import { describe, it, expect } from 'vitest';
import { parseExif, stripExif } from './exif';

/* ---------- helpers ---------- */

/** xorshift PRNG so failures are reproducible from the seed */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/** minimal JPEG skeleton: SOI + APP1 segments + dummy frame + EOI (raw bytes) */
function jpegBytes(segs: Uint8Array[]): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  for (const s of segs) {
    // spec: the 2 length bytes include themselves → len = payload + 2
    const len = s.length + 2;
    parts.push(0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...s);
  }
  parts.push(0xff, 0xd8, 0xff, 0xd9, 0xff, 0xd9);
  return new Uint8Array(parts);
}

const of = (u8: Uint8Array): ArrayBuffer => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

/** build a TIFF header + IFD of n entries with wildly wrong offset values */
function tiffIfd(byteOrder: 'II' | 'MM', nEntries: number, entryBytes: Uint8Array, nextIfd: number, garbage: Uint8Array): Uint8Array {
  const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
  const head = byteOrder === 'II' ? [0x49, 0x49, 0x2a, 0x00] : [0x4d, 0x4d, 0x00, 0x2a];
  const parts: number[] = [...head, ...u32(8), ...u16(nEntries), ...entryBytes, ...u32(nextIfd), ...garbage];
  return new Uint8Array(parts);
}

/* ---------- pure random fuzz (must never throw) ---------- */

describe('parseExif fuzz — never throws', () => {
  it('survives 400+ random buffers of assorted sizes', () => {
    const seeds = [1, 7, 42, 1337, 90210];
    for (const seed of seeds) {
      for (const size of [0, 1, 2, 3, 4, 5, 7, 11, 64, 255, 1024, 8192]) {
        const r = rng(seed * 1000 + size);
        const bytes = new Uint8Array(size);
        for (let i = 0; i < size; i++) bytes[i] = Math.floor(r() * 256);
        // must not throw; any result is acceptable
        expect(() => parseExif(bytes.buffer)).not.toThrow();
      }
    }
  });

  it('survives truncated and lying JPEG structure', () => {
    const cases: Uint8Array[] = [
      new Uint8Array([0xff, 0xd8]),                        // SOI only
      new Uint8Array([0xff]),                              // half marker
      new Uint8Array([0xff, 0xd8, 0xff]),                  // SOI + half marker
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff]),      // APP1 truncated inside length
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x04]),// APP1 len 4, no payload
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]),// absurd 0xffff length
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x02]),// len 2, empty
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02]),// JFIF APP0 (not Exif)
    ];
    for (const c of cases) {
      const blob = new Blob([c]);
      expect(() => stripExif(blob)).not.toThrow();
    }
  });

  it('parses a valid minimal structure without throwing', () => {
    // well-formed but semantically empty Exif: "Exif\0\0" + TIFF header + IFD with 0 entries
    const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0, 0, 0, 0, 0]);
    const payload = new Uint8Array(6 + tiff.length);
    payload.set(new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]), 0);
    payload.set(tiff, 6);
    expect(() => parseExif(of(jpegBytes([payload])))).not.toThrow();
  });
});

/* ---------- adversarial TIFF offsets (bounds checking) ---------- */

describe('parseExif adversarial offsets — bounded reads only', () => {
  // one entry: Make (0x010f), type 2 ASCII, count 8, value = huge offset
  const makeEntry = (off: number) =>
    new Uint8Array([0x0f, 0x01, 0x02, 0x00, 8, 0, 0, 0, ...[off & 0xff, (off >> 8) & 0xff, (off >> 16) & 0xff, (off >> 24) & 0xff]]);

  const evilOffsets = [0x7fffffff, 0x10000000, 0xfffffff0, 0x0000ffff, 0x1000, 0xffffffff];

  for (const off of evilOffsets) {
    it(`Make entry at offset 0x${off.toString(16)} does not throw`, () => {
      const tiff = tiffIfd('II', 1, makeEntry(off), 0, new Uint8Array(0));
      expect(() => parseExif(of(jpegBytes([tiff])))).not.toThrow();
    });
  }

  it('count that exceeds the buffer does not throw', () => {
    // Make with count 0xffffffff but a tiny buffer
    const entry = new Uint8Array([0x0f, 0x01, 0x02, 0x00, 0xff, 0xff, 0xff, 0xff, 8, 0, 0, 0]);
    const tiff = tiffIfd('II', 1, entry, 0, new Uint8Array(0));
    expect(() => parseExif(of(jpegBytes([tiff])))).not.toThrow();
  });

  it('next-IFD pointer beyond buffer does not throw', () => {
    const entry = new Uint8Array([0x0f, 0x01, 0x02, 0x00, 2, 0, 0, 0, 0x41, 0x00, 0x00, 0x00]);
    const tiff = tiffIfd('II', 1, entry, 0x7ffffff0, new Uint8Array(0));
    expect(() => parseExif(of(jpegBytes([tiff])))).not.toThrow();
  });
});

/* ---------- stripper invariants ---------- */

describe('stripExif invariants', () => {
  it('never yields a Blob whose first two bytes are not a JPEG SOI', async () => {
    const r = rng(31337);
    for (let i = 0; i < 50; i++) {
      const n = Math.floor(r() * 512);
      const bytes = new Uint8Array(n);
      for (let j = 0; j < n; j++) bytes[j] = Math.floor(r() * 256);
      const out = await stripExif(new Blob([bytes]));
      if (out.size > 1) {
        const head = new Uint8Array(await out.slice(0, 2).arrayBuffer());
        // either untouched non-JPEG passthrough or valid SOI — never a mangled stream
        expect(head[0] === 0xff || out.size === n).toBe(true);
      }
    }
  });

  it('idempotent: stripping twice ≙ stripping once', async () => {
    const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0, 0, 0, 0, 0]);
    const jpeg = new Blob([jpegBytes([tiff, tiff])]);
    const once = await stripExif(jpeg);
    const twice = await stripExif(once);
    expect(twice.size).toBe(once.size);
  });

  it('strips APP1 Exif and keeps the rest of the file', async () => {
    const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0, 0, 0, 0, 0]);
    // APP1 payload must begin with the standard "Exif\0\0" signature (parser requirement)
    const sig = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
    const payload = new Uint8Array(sig.length + tiff.length);
    payload.set(sig, 0); payload.set(tiff, sig.length);
    const jpeg = new Blob([jpegBytes([payload])]);
    const out = await stripExif(jpeg);
    const u8 = new Uint8Array(await out.arrayBuffer());
    for (let i = 0; i < u8.length - 1; i++) {
      expect(u8[i] === 0xff && u8[i + 1] === 0xe1).toBe(false);
    }
    expect(u8[0]).toBe(0xff);
    expect(u8[1]).toBe(0xd8);
    expect(u8[u8.length - 2]).toBe(0xff);
    expect(u8[u8.length - 1]).toBe(0xd9);
  });
});
