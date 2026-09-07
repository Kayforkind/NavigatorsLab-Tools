/* Pure engines added in the v1.3 enhancement pass — no DOM, unit-testable. */

/** Apply black/white threshold to a canvas ImageData in place.
 * Pixel luminance ≤ t stays dark (scaled), > t becomes pure white — the classic
 * "make a scan look photocopied" op that crushes shadows and gray noise. */
export function thresholdData(img: ImageData, t: number): void {
  const d = img.data;
  const hi = Math.max(1, Math.min(254, Math.round(t)));
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum <= hi ? 0 : 255;
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }
}

/** Stretch levels so the darkest content pixel → 0 and brightest → 255.
 * Auto-contrast for washed-out phone photos of documents. Returns the applied
 * black/white points (or null when the histogram is a single value). */
export function autoLevelsData(img: ImageData): { black: number; white: number } | null {
  const d = img.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue; // transparent — not content
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  const lo = Math.round(min), hi = Math.round(max);
  if (hi - lo < 4) return null; // flat image — stretching would just amplify noise
  const scale = 255 / (hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = (d[i + c] - lo) * scale;
      d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v | 0;
    }
  }
  return { black: lo, white: hi };
}

/** Peak normalize: scale a Float32 channel so its peak hits full scale
 * without clipping. Returns the applied gain (1 = nothing to do). */
export function normalizeGain(chans: Float32Array[]): number {
  let peak = 0;
  for (const ch of chans) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
  }
  if (peak === 0 || peak >= 1) return 1;
  return 1 / peak;
}

/** Git-style similarity between two texts: 2·LCS / (lenA + lenB) as percent.
 * Reuses the caller's LCS length — computed here on lines to keep it cheap. */
export function similarityPercent(aText: string, bText: string): number {
  const A = aText.split(/\r?\n/);
  const B = bText.split(/\r?\n/);
  const n = A.length, m = B.length;
  if (n === 0 && m === 0) return 100;
  let prev = new Uint32Array(m + 1);
  let cur = new Uint32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    cur = new Uint32Array(m + 1);
    for (let j = 1; j <= m; j++) {
      cur[j] = A[i - 1] === B[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  const lcs = prev[m];
  return Math.round((2 * lcs) / (n + m) * 100);
}
