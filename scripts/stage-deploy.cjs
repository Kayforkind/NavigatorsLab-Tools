#!/usr/bin/env node
/**
 * Stage the Cloudflare deploy tree — the one safe way to build deploy/.
 *
 * Why this exists: the sequence that was written down (`mkdir -p deploy &&
 * cp -r dist deploy/tools`) is a trap. `cp -r src dst` copies src *into* dst
 * whenever dst already exists, so on a machine that has staged a deploy
 * before, that command writes deploy/tools/dist and leaves the previous
 * build's files sitting in deploy/tools — and wrangler then deploys the stale
 * build. "I deployed and nothing changed" is exactly that bug. It never shows
 * up in CI, where the workspace is fresh and deploy/ does not exist yet.
 *
 * This script deletes and recreates deploy/tools from dist/ every time, then
 * checks its own output, so what wrangler uploads is always what vite built.
 *
 *   npm run build && npm run deploy:stage
 *   cd deploy && npx wrangler deploy
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEPLOY = path.join(ROOT, 'deploy');
const STAGED = path.join(DEPLOY, 'tools');

function die(msg) {
  console.error(`\nstage-deploy: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  die(
    'dist/index.html is missing — this stages an existing build, it does not\n' +
      '  create one. Run `npm run build` first.'
  );
}

fs.mkdirSync(DEPLOY, { recursive: true });

// The app itself. Remove first: a stale deploy/tools is how a deploy silently
// ships last week's build.
const stale = fs.existsSync(STAGED);
const nested = fs.existsSync(path.join(STAGED, 'dist'));
fs.rmSync(STAGED, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'dist'), STAGED, { recursive: true });

// The worker's own inputs (wrangler.jsonc + the MCP catalog it serves).
const FILES = [
  ['wrangler.tools.jsonc', 'wrangler.jsonc'],
  ['worker.js', 'worker.js'],
  ['src/lib/mcp.ts', 'mcp.ts'],
];
for (const [from, to] of FILES) {
  const src = path.join(ROOT, from);
  if (!fs.existsSync(src)) die(`${from} is missing — cannot stage ${to}`);
  fs.copyFileSync(src, path.join(DEPLOY, to));
}

// Check our own work: the classic failure modes are a nested copy and a stale
// index.html, so assert against both rather than trusting the copy call.
if (fs.existsSync(path.join(STAGED, 'dist'))) {
  die('staged a nested deploy/tools/dist — the app must land directly in deploy/tools');
}
const stagedIndex = fs.readFileSync(path.join(STAGED, 'index.html'));
const builtIndex = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'));
if (!stagedIndex.equals(builtIndex)) {
  die('deploy/tools/index.html does not match dist/index.html — the staging is not the build');
}

const count = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    if (e.name === 'node_modules' || e.name === '.git') return n;
    return n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1);
  }, 0);

console.log(`stage-deploy: ${count(STAGED)} files staged into deploy/tools`);
if (stale) {
  console.log(
    `  (replaced a previous staging${nested ? ' that had a nested dist/ — the cp -r trap' : ''})`
  );
}
for (const [, to] of FILES) console.log(`  deploy/${to}`);
console.log('  deploy/tools/index.html matches dist/index.html byte-for-byte');
console.log('\nnext: cd deploy && npx wrangler deploy');
