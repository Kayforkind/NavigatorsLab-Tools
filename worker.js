/* Edge worker for navigatorslab.com/tools — serves the static suite from the
 * ASSETS binding and stamps the security policy onto EVERY response, so the
 * headers we assert in scripts/security.cjs are exactly what production sends. */
const CSP =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' blob: data:; " +
  "worker-src 'self' blob:; child-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // map pretty paths: /tools/<id> -> /tools/<id>.html (and /tools -> /tools/index.html).
    // assets run with html_handling:none, so this worker owns all URL normalization.
    let assetPath = url.pathname.replace(/\/+$/, ''); // drop trailing slashes
    if (assetPath === '/tools' || assetPath === '') assetPath = '/tools/index.html';
    else if (!assetPath.startsWith('/tools/')) assetPath = '/tools/' + assetPath.replace(/^\//, '');
    else {
      const tail = assetPath.slice('/tools/'.length);
      if (tail && !tail.includes('.')) assetPath = `/tools/${tail}.html`;
    }

    const asset = await env.ASSETS.fetch(new Request(new URL(assetPath, url.origin), request));
    const res = new Response(asset.body, asset);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
