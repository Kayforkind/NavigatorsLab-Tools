/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

// base './' keeps every asset URL relative, so the same dist/ works at a site
// root, under /tools/ on navigatorslab.com, AND on a GitHub Pages project
// subpath (/user.github.io/repo/) — one build, three homes.
const base = process.env.VITE_BASE ?? './';

export default defineConfig({
  base,
  plugins: [
    /* Meta CSP in every page: GitHub Pages (the mirror host) cannot send HTTP
     * headers, so the policy ships inside the HTML. On navigatorslab.com the
     * worker's header CSP also applies — identical policy, so no change. */
    {
      name: 'meta-csp',
      transformIndexHtml() {
        const csp =
          "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' blob: data:; " +
          "worker-src 'self' blob:; child-src 'self' blob:; form-action 'none'; base-uri 'none'";
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
            injectTo: 'head-prepend' as const,
          },
        ];
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg', 'icon.svg', 'og-image.png', 'robots.txt', 'sitemap.xml',
        'tools.json', 'status.json', 'llms.txt', 'llms-full.txt', 'lamejs/lame.min.js', 'tess/worker.min.js',
        'tess/tesseract-core-lstm.wasm.js', 'tess/tesseract-core-lstm.wasm',
        'tess/tesseract-core-simd-lstm.wasm.js', 'tess/tesseract-core-simd-lstm.wasm',
        'tessdata/eng.traineddata.gz',
      ],
      manifest: {
        name: 'NavigatorsLab Tools — private, in-browser utilities',
        short_name: 'NL Tools',
        description:
          'Sixteen free tools that run entirely in your browser: strip photo GPS, shrink images, clean scans, sign PDFs, organize PDF pages, merge receipts, OCR expenses, make & decode QR codes, diff texts, count words, inspect metadata, trim audio, make invoices, batch rename, prep files for print — and reimagine, which redesigns any HTML page from its own content. No uploads.',
        theme_color: '#0b0f17',
        background_color: '#0b0f17',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: './pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: './pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: './pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // supporting OSes can offer "open with → NavigatorsLab Tools" for images;
        // exif.html consumes them via launchQueue (all processing stays local)
        file_handlers: [
          {
            action: './exif.html',
            accept: {
              'image/jpeg': ['.jpg', '.jpeg'],
              'image/png': ['.png'],
              'image/webp': ['.webp'],
            },
          },
        ],
        // (informational) images can also be routed to the QR decoder the same way
      },
      workbox: {
        // precache every page + asset so all tools work fully offline after first load
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mjs,webmanifest,json,gz,wasm,txt}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'NetworkFirst',
            options: { cacheName: 'nl-tools-runtime' },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        exif: resolve(__dirname, 'exif.html'),
        shrink: resolve(__dirname, 'shrink.html'),
        scan: resolve(__dirname, 'scan.html'),
        sign: resolve(__dirname, 'sign.html'),
        receipts: resolve(__dirname, 'receipts.html'),
        metadata: resolve(__dirname, 'metadata.html'),
        audio: resolve(__dirname, 'audio.html'),
        invoice: resolve(__dirname, 'invoice.html'),
        rename: resolve(__dirname, 'rename.html'),
        printprep: resolve(__dirname, 'printprep.html'),
        ocr: resolve(__dirname, 'ocr.html'),
        qr: resolve(__dirname, 'qr.html'),
        pdfpages: resolve(__dirname, 'pdfpages.html'),
        textdiff: resolve(__dirname, 'textdiff.html'),
        textstats: resolve(__dirname, 'textstats.html'),
        reimagine: resolve(__dirname, 'reimagine.html'),
        agents: resolve(__dirname, 'agents.html'),
        status: resolve(__dirname, 'status.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
