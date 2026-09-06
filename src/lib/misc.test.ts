import { describe, it, expect } from 'vitest';

/* WAV RIFF header math test — verifies the exact byte layout the audio
 * trimmer's encoder produces (44-byte canonical PCM WAV). */

function encodeWav(chans: Float32Array[], sampleRate: number): ArrayBuffer {
  const nCh = chans.length;
  const n = chans[0].length;
  const bytesPerSample = 2;
  const dataSize = n * nCh * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  wstr(8, 'WAVE');
  wstr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, nCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * nCh * bytesPerSample, true);
  view.setUint16(32, nCh * bytesPerSample, true);
  view.setUint16(34, 16, true);
  wstr(36, 'data');
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return ab;
}

describe('wav encoder math', () => {
  it('produces a canonical 44-byte PCM WAV header', () => {
    const chans = [new Float32Array(1000).map(() => 0.5)];
    const ab = encodeWav(chans, 44100);
    const view = new DataView(ab);
    const str = (off: number, len: number) => String.fromCharCode(...new Uint8Array(ab, off, len));
    expect(str(0, 4)).toBe('RIFF');
    expect(str(8, 4)).toBe('WAVE');
    expect(str(12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);        // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1);         // PCM
    expect(view.getUint16(22, true)).toBe(1);         // mono
    expect(view.getUint32(24, true)).toBe(44100);     // sample rate
    expect(view.getUint32(28, true)).toBe(88200);     // byte rate
    expect(view.getUint16(34, true)).toBe(16);        // bits
    expect(str(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(2000);      // 1000 samples * 2 bytes
    expect(ab.byteLength).toBe(44 + 2000);
  });

  it('clamps out-of-range samples', () => {
    const chans = [Float32Array.from([2, -2, 0.25])];
    const ab = encodeWav(chans, 8000);
    const view = new DataView(ab);
    expect(view.getInt16(44, true)).toBe(32767);   // clamp high
    expect(view.getInt16(46, true)).toBe(-32768);  // clamp low
    expect(view.getInt16(48, true)).toBe(8191);    // 0.25 truncated
  });
});
