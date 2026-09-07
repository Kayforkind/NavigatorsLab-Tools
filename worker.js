/* Edge worker for navigatorslab.com/tools — serves the static suite from the
 * ASSETS binding and stamps the security policy onto EVERY response, so the
 * headers we assert in scripts/security.cjs are exactly what production sends. */
const CSP =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' blob: data:; " +
  "worker-src 'self' blob:; child-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

import { handleRpc } from './mcp.ts';

const HEADERS = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-dns-prefetch-control': 'off',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj) + '\n', {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Strict same-origin allow-list for the MCP endpoint (DNS-rebinding defense). */
const MCP_ALLOWED_ORIGINS = new Set([
  'https://navigatorslab.com',
  'https://www.navigatorslab.com',
]);

/** Handle one MCP JSON-RPC POST (stateless; GET/SSE unsupported by design). */
async function handleMcp(request) {
  if (request.method === 'GET') {
    return new Response('Method Not Allowed — POST JSON-RPC 2.0 messages here', {
      status: 405,
      headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  if (request.method !== 'POST') {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request: use POST' } }, 405);
  }
  const origin = request.headers.get('origin');
  if (origin && !MCP_ALLOWED_ORIGINS.has(origin)) {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Origin not allowed' } }, 403);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  }
  const { status, json: out } = handleRpc(body);
  return out === null ? new Response(null, { status: 202 }) : json(out, status);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* ---- MCP endpoint for AI agents (Model Context Protocol) ---- */
    if (url.pathname === '/tools/mcp' || url.pathname === '/tools/mcp/') return handleMcp(request);

    // map pretty paths: /tools/<id> -> /tools/<id>.html (and /tools -> /tools/index.html).
    // assets run with html_handling:none, so this worker owns all URL normalization.
    let assetPath = url.pathname.replace(/\/+$/, ''); // drop trailing slashes
    if (assetPath === '/tools' || assetPath === '') assetPath = '/tools/index.html';
    else if (assetPath === '/llms.txt') assetPath = '/tools/llms.txt'; // site-root alias for agents
    else if (assetPath === '/llms-full.txt') assetPath = '/tools/llms-full.txt';
    else if (!assetPath.startsWith('/tools/')) assetPath = '/tools/' + assetPath.replace(/^\//, '');
    else {
      const tail = assetPath.slice('/tools/'.length);
      if (tail && !tail.includes('.')) assetPath = `/tools/${tail}.html`;
    }

    const asset = await env.ASSETS.fetch(new Request(new URL(assetPath, url.origin), request));
    const res = new Response(asset.body, asset);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
    // text docs (llms.txt, robots, etc.) must declare UTF-8 so agents parse them right
    const ct = headers.get('content-type');
    if (ct && ct.startsWith('text/') && !ct.includes('charset')) headers.set('content-type', ct + '; charset=utf-8');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
