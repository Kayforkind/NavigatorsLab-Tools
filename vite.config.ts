/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' keeps every asset URL relative, so the same dist/ works at a site
// root, under /tools/ on navigatorslab.com, AND on a GitHub Pages project
// subpath (/user.github.io/repo/) — one build, three homes.
const base = process.env.VITE_BASE ?? './';

export default defineConfig({
  base,
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
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
