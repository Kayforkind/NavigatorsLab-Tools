import { describe, it, expect } from 'vitest';
import { thresholdData, autoLevelsData, normalizeGain, similarityPercent } from './enhance';

/** build an ImageData-like object without a DOM */
function fakeImageData(pixels: [number, number, number, number][]): ImageData {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((p, i) => { data.set(p, i * 4); });
  return { data, width: pixels.length, height: 1 } as unknown as ImageData;
}

describe('thresholdData', () => {
  it('forces bright pixels to pure white and dark ones to black', () => {
    const img = fakeImageData([[100, 100, 100, 255], [200, 200, 200, 255], [160, 160, 160, 255]]);
    thresholdData(img, 150);
    expect([...img.data.slice(0, 4)]).toEqual([0, 0, 0, 255]);       // 100 ≤ 150 → black
    expect([...img.data.slice(4, 8)]).toEqual([255, 255, 255, 255]); // 200 > 150 → white
    expect([...img.data.slice(8, 12)]).toEqual([255, 255, 255, 255]);// 160 > 150 → white
  });
  it('uses luminance, not a single channel', () => {
    // r=200 but g=b=0 → luminance ≈ 60 → dark under t=150
    const img = fakeImageData([[200, 0, 0, 255]]);
    thresholdData(img, 150);
    expect([...img.data.slice(0, 4)]).toEqual([0, 0, 0, 255]);
  });
  it('clamps out-of-range thresholds safely', () => {
    const img = fakeImageData([[250, 250, 250, 255]]);
    thresholdData(img, 999);
    expect(img.data[0]).toBe(0); // hi clamped to 254, so 250 stays dark
  });
});

describe('autoLevelsData', () => {
  it('stretches the darkest pixel to 0 and brightest to 255', () => {
    const img = fakeImageData([[51, 51, 51, 255], [102, 102, 102, 255], [204, 204, 204, 255]]);
    const r = autoLevelsData(img)!;
    expect(r.black).toBe(51);
    expect(r.white).toBe(204);
    expect(img.data[0]).toBe(0);          // 51 → 0
    const last = img.data[8];             // 204 → 255
    expect(last).toBe(255);
    const mid = img.data[4];              // 102 → (102-51)*255/153 = 85
    expect(mid).toBe(85);
  });
  it('returns null for a flat image instead of amplifying noise', () => {
    const img = fakeImageData([[128, 128, 128, 255], [128, 128, 128, 255]]);
    expect(autoLevelsData(img)).toBeNull();
  });
});

describe('normalizeGain', () => {
  it('scales the peak to full scale', () => {
    expect(normalizeGain([new Float32Array([0.25, -0.5, 0.1])])).toBeCloseTo(2);
  });
  it('is a no-op for silent or already-peaked audio', () => {
    expect(normalizeGain([new Float32Array([0, 0])])).toBe(1);
    expect(normalizeGain([new Float32Array([0.9, -1.0])])).toBe(1);
  });
});

describe('similarityPercent', () => {
  it('identical texts score 100', () => {
    expect(similarityPercent('a\nb\nc', 'a\nb\nc')).toBe(100);
  });
  it('disjoint texts score 0', () => {
    expect(similarityPercent('a\nb', 'x\ny')).toBe(0);
  });
  it('partial overlap is proportional', () => {
    // 1 shared line out of 4 total → 50%
    expect(similarityPercent('shared\nonly-a', 'shared\nonly-b')).toBe(50);
  });
  it('both empty is a perfect match', () => {
    expect(similarityPercent('', '')).toBe(100);
  });
});
