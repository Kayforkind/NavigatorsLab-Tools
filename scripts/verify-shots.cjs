/* Verify screenshots are non-blank by decoding PNGs and measuring variance. */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join('C:/Users/kazim/AppData/Roaming/npm/node_modules/@playwright/test/node_modules', 'playwright'));

const SHOTS = path.resolve(__dirname, '..', 'docs', 'shots');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];
  for (const f of fs.readdirSync(SHOTS).filter((x) => x.endsWith('.png')).sort()) {
    const b64 = fs.readFileSync(path.join(SHOTS, f)).toString('base64');
    const stat = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      // downscale for speed
      c.width = 200; c.height = Math.max(1, Math.round(img.naturalHeight * 200 / img.naturalWidth));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0, sum2 = 0, n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        sum += y; sum2 += y * y;
      }
      const mean = sum / n;
      const std = Math.sqrt(sum2 / n - mean * mean);
      return { w: img.naturalWidth, h: img.naturalHeight, std: Math.round(std * 10) / 10 };
    }, b64);
    const ok = stat.std > 8; // blank pages have ~0 std
    results.push(ok);
    console.log(`${ok ? 'OK  ' : 'BLANK'} ${f}  ${stat.w}x${stat.h}  std=${stat.std}`);
  }
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} screenshots have real content`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
