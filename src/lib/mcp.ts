/* Pure MCP (Model Context Protocol) tool implementations for NavigatorsLab Tools.
 * The edge worker (worker.js) exposes them over a Streamable-HTTP-style JSON-RPC
 * endpoint at POST /tools/mcp — but ALL the logic lives here as pure functions
 * with zero dependencies, so it is unit-tested directly in vitest and bundled
 * into the worker by wrangler's esbuild. Nothing here touches the network;
 * "tools" are deterministic local computations: the catalog, QR payload
 * builders (Wi-Fi / vCard / mailto with spec escaping), a text diff, and text
 * statistics. File-processing stays in the browser tools by design — the MCP
 * layer points agents at the deep links that drive them. */

export const PROTOCOL_VERSION = '2025-06-18';

export const AGENT_INFO = {
  name: 'navigatorslab-tools',
  version: '1.4.0',
  title: 'NavigatorsLab Tools',
  description: 'Sixteen private, in-browser tools — fifteen file utilities plus Reimagine, the HTML redesign engine. Zero uploads, zero accounts.',
  instructions:
    'Tools run in two modes. (1) compute: this MCP server computes QR payloads, text diffs and text stats locally at the edge — nothing is stored. (2) drive: for file processing (EXIF strip, image shrink, PDF sign/pages, OCR…), open the tool URL with ?url=<same-origin file URL> plus its agent parameters; the page loads the file and applies the parameters automatically. Reimagine redesigns an HTML page from its own content at /reimagine/ — paste HTML in the browser, or run its CLI locally (npx reimagine-it). All tool URLs are on this same origin. The suite never uploads, retains, or logs any file.',
};

const MAX_TEXT = 400_000; // per-text cap for compute tools

/* ------------------------------------------------------------------ */
/* QR payload builders (mirror qr.html exactly, incl. WIFI escaping)  */
/* ------------------------------------------------------------------ */

/** escape a value for the WIFI: URI per the Android spec (also quotes, harmless) */
export function qesc(s: string): string {
  return s.replace(/([\\;,:\"'])/g, '\\$1');
}

export interface WifiArgs {
  ssid: string;
  password?: string;
  type?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

export function wifiPayload(a: WifiArgs): string {
  const ssid = String(a?.ssid ?? '').trim();
  if (!ssid) throw new Error('ssid is required');
  if (ssid.length > 32) throw new Error('ssid exceeds 32 bytes (spec limit)');
  const t = a.type ?? (a.password ? 'WPA' : 'nopass');
  if (!['WPA', 'WEP', 'nopass'].includes(t)) throw new Error('type must be WPA, WEP or nopass');
  const pw = t === 'nopass' ? '' : String(a.password ?? '');
  if (t === 'WEP' && pw && pw.length !== 5 && pw.length !== 13) {
    throw new Error('WEP keys are 5 or 13 characters — use WPA for modern networks');
  }
  if (t === 'WPA' && pw.length < 8) throw new Error('WPA passwords are at least 8 characters');
  const hidden = a.hidden ? 'H:true;' : '';
  return `WIFI:T:${t};S:${qesc(ssid)};${pw ? `P:${qesc(pw)};` : ''}${hidden};`;
}

export function vcardPayload(a: { name: string; org?: string; tel?: string; email?: string; url?: string }): string {
  const name = String(a?.name ?? '').trim();
  if (!name) throw new Error('name is required');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`];
  if (a.org) lines.push(`ORG:${String(a.org).slice(0, 120)}`);
  if (a.tel) lines.push(`TEL;TYPE=CELL:${String(a.tel).slice(0, 40)}`);
  if (a.email) lines.push(`EMAIL:${String(a.email).slice(0, 160)}`);
  if (a.url) lines.push(`URL:${String(a.url).slice(0, 300)}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

export function mailtoPayload(a: { to: string; subject?: string; body?: string }): string {
  const to = String(a?.to ?? '').trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('a valid "to" email is required');
  const qs: string[] = [];
  if (a.subject) qs.push('subject=' + encodeURIComponent(String(a.subject).slice(0, 300)));
  if (a.body) qs.push('body=' + encodeURIComponent(String(a.body).slice(0, 4000)));
  return `mailto:${to}${qs.length ? '?' + qs.join('&') : ''}`;
}

/* ------------------------------------------------------------------ */
/* Text diff (line-level LCS) and text stats — standalone & pure       */
/* ------------------------------------------------------------------ */

function splitLines(text: string): string[] {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
}

export function diffLinesPure(aText: string, bText: string, opts?: { ignoreWhitespace?: boolean; caseSensitive?: boolean }): {
  added: number; removed: number; unchanged: number; lines: { type: 'add' | 'del' | 'same'; text: string }[];
} {
  const norm = (s: string): string => {
    let out = s;
    if (opts?.ignoreWhitespace !== false) out = out.replace(/\s+/g, ' ').trim();
    if (opts?.caseSensitive === false) out = out.toLowerCase();
    return out;
  };
  const a = splitLines(aText);
  const b = splitLines(bText);
  // LCS table (cap size to keep the worker invocation cheap)
  if (a.length * b.length > 4_000_000) throw new Error('inputs too large for inline diff (try the textdiff page)');
  const n = a.length, m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lines: { type: 'add' | 'del' | 'same'; text: string }[] = [];
  let added = 0, removed = 0, unchanged = 0;
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (norm(a[i]) === norm(b[j])) { lines.push({ type: 'same', text: a[i] }); unchanged++; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { lines.push({ type: 'del', text: a[i] }); removed++; i++; }
    else { lines.push({ type: 'add', text: b[j] }); added++; j++; }
  }
  while (i < n) { lines.push({ type: 'del', text: a[i] }); removed++; i++; }
  while (j < m) { lines.push({ type: 'add', text: b[j] }); added++; j++; }
  return { added, removed, unchanged, lines };
}

export function textStatsPure(text: string): {
  words: number; characters: number; sentences: number; paragraphs: number;
  readMinutes: number; speakMinutes: number; topKeywords: [string, number][];
} {
  const t = String(text ?? '');
  const words = t.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  const sentences = t.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);
  const paragraphs = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const STOP = new Set(('the a an and or but of to in on for with at by from as is are was were be been it its this that these those you your we our they their he she his her not no yes do does did can will would should could have has had if then than so such about into over under out up down'.split(' ')));
  const freq = new Map<string, number>();
  for (const w of words) {
    const k = w.toLowerCase();
    if (k.length < 3 || STOP.has(k)) continue;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const topKeywords = [...freq.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 5);
  return {
    words: words.length,
    characters: t.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    readMinutes: Math.max(1, Math.round(words.length / 200)),
    speakMinutes: Math.max(1, Math.round(words.length / 130)),
    topKeywords,
  };
}

/* ------------------------------------------------------------------ */
/* Catalog: the suite, with agent parameters + deep-link recipes       */
/* ------------------------------------------------------------------ */

const TOOLS: unknown[] = [
  {
    name: 'nl_catalog',
    description: 'List every NavigatorsLab tool with its URL, agent parameters and a ready-made deep-link recipe. Call this first.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'qr_payload',
    description: 'Build a QR payload string locally — WIFI (with spec-correct escaping of \\ ; , :), vCard 3.0, mailto, or a plain URL/text. Returns the payload and a qr.html deep link that renders it as PNG/SVG. No image is uploaded anywhere.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['wifi', 'vcard', 'mailto', 'text'], description: 'payload type' },
        ssid: { type: 'string' }, password: { type: 'string' }, hidden: { type: 'boolean' },
        name: { type: 'string' }, org: { type: 'string' }, tel: { type: 'string' }, email: { type: 'string' }, url: { type: 'string' },
        to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['kind'],
      additionalProperties: false,
    },
  },
  {
    name: 'text_diff',
    description: 'Diff two texts line-by-line (LCS) at the edge. Returns added/removed counts and per-line results. For word-level highlights use the textdiff.html deep link.',
    inputSchema: {
      type: 'object',
      properties: {
        text_a: { type: 'string' }, text_b: { type: 'string' },
        ignoreWhitespace: { type: 'boolean', default: true }, caseSensitive: { type: 'boolean', default: true },
      },
      required: ['text_a', 'text_b'],
      additionalProperties: false,
    },
  },
  {
    name: 'text_stats',
    description: 'Word/character/sentence/paragraph counts, reading & speaking time and top keywords for a text. For Flesch readability + keyword density use textstats.html.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
      additionalProperties: false,
    },
  },
];

export function listTools(): unknown[] {
  return TOOLS;
}

export function callTool(name: string, args: Record<string, unknown>): { content: { type: 'text'; text: string }[]; isError?: boolean } {
  try {
    let out: unknown;
    switch (name) {
      case 'nl_catalog':
        out = {
          suite: 'NavigatorsLab Tools', version: AGENT_INFO.version, license: 'MIT',
          privacy: 'every tool processes files on the user device; nothing is uploaded or retained',
          agent_docs: 'https://navigatorslab.com/tools/agents.html',
          tools_url: 'https://navigatorslab.com/tools/',
          tools: CATALOG,
        };
        break;
      case 'qr_payload': {
        const kind = String(args.kind ?? 'text');
        let payload: string;
        if (kind === 'wifi') payload = wifiPayload(args as unknown as WifiArgs);
        else if (kind === 'vcard') payload = vcardPayload(args as Parameters<typeof vcardPayload>[0]);
        else if (kind === 'mailto') payload = mailtoPayload(args as Parameters<typeof mailtoPayload>[0]);
        else {
          payload = String(args.text ?? '');
          if (!payload.trim()) throw new Error('text is required for kind=text');
          if (payload.length > 2000) throw new Error('text exceeds 2000 characters');
        }
        out = {
          payload,
          deep_link: 'https://navigatorslab.com/tools/qr.html?text=' + encodeURIComponent(payload),
          note: 'open the deep link to render a PNG/SVG — rendering happens on the user device',
        };
        break;
      }
      case 'text_diff': {
        let ta = String(args.text_a ?? '');
        let tb = String(args.text_b ?? '');
        if (ta.length > MAX_TEXT || tb.length > MAX_TEXT) throw new Error('text_a/text_b exceed the 400k character cap');
        // Bound the DP table: diffLinesPure allocates (n+1)*(m+1) Uint32 cells.
        // A 400k×400k input would OOM the isolate — cap the matrix and say so.
        const linesA = ta.split('\n').length;
        const linesB = tb.split('\n').length;
        let inputTruncated = false;
        if (linesA * linesB > 4_000_000) {
          ta = ta.split('\n').slice(0, 2000).join('\n');
          tb = tb.split('\n').slice(0, 2000).join('\n');
          inputTruncated = true;
        }
        const r = diffLinesPure(ta, tb, {
          ignoreWhitespace: args.ignoreWhitespace !== false,
          caseSensitive: args.caseSensitive !== false,
        });
        out = { added: r.added, removed: r.removed, unchanged: r.unchanged, lines: r.lines.slice(0, 2000), truncated: r.lines.length > 2000 || inputTruncated, ...(inputTruncated ? { note: 'inputs truncated to the first 2000 lines each to bound memory' } : {}) };
        break;
      }
      case 'text_stats': {
        const tx = String(args.text ?? '');
        if (tx.length > MAX_TEXT) throw new Error('text exceeds the 400k character cap');
        out = textStatsPure(tx);
        break;
      }
      default:
        throw new Error(`unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
  }
}

export function handleRpc(body: unknown): { status: number; json: unknown } {
  if (typeof body !== 'object' || body === null) {
    return { status: 400, json: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request: body must be a JSON-RPC object' } } };
  }
  const req = body as { jsonrpc?: string; id?: unknown; method?: unknown; params?: unknown };
  if (typeof req.method !== 'string') {
    return { status: 400, json: { jsonrpc: '2.0', id: req.id ?? null, error: { code: -32600, message: 'Invalid Request: method must be a string' } } };
  }
  const isNotification = req.id === undefined || req.id === null;
  const respond = (result: unknown): { status: number; json: unknown } =>
    isNotification ? { status: 202, json: null } : { status: 200, json: { jsonrpc: '2.0', id: req.id, result } };
  const err = (code: number, message: string): { status: number; json: unknown } =>
    isNotification ? { status: 202, json: null } : { status: 200, json: { jsonrpc: '2.0', id: req.id ?? null, error: { code, message } } };

  switch (req.method) {
    case 'initialize':
      return respond({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: AGENT_INFO,
      });
    case 'notifications/initialized':
      return respond(null);
    case 'ping':
      return respond({});
    case 'tools/list':
      return respond({ tools: TOOLS });
    case 'tools/call': {
      const p = (req.params ?? {}) as { name?: unknown; arguments?: unknown };
      if (typeof p.name !== 'string') return err(-32602, 'params.name must be a string');
      const args = (p.arguments ?? {}) as Record<string, unknown>;
      if (typeof args !== 'object' || args === null) return err(-32602, 'params.arguments must be an object');
      const result = callTool(p.name, args);
      return respond(result);
    }
    default:
      return err(-32601, `Method not found: ${req.method}`);
  }
}

/* plain catalog for nl_catalog (kept as data, no imports) */
const CATALOG = [
  { id: 'exif', name: 'Photo Privacy Kit', url: 'https://navigatorslab.com/tools/exif.html', agent_params: '?url=<file-url>', files: 'jpg, jpeg, png, webp, heic*', what: 'strip GPS/camera/timestamp EXIF, show SHA-256 before/after', repo: 'https://github.com/Kayforkind/NavigatorsLab-Photo-Privacy-Kit' },
  { id: 'metadata', name: 'Metadata & Hidden-Data Checker', url: 'https://navigatorslab.com/tools/metadata.html', agent_params: '?url=<file-url>', files: 'jpg, png, pdf, docx, xlsx, pptx', what: 'inspect + strip hidden metadata', repo: 'https://github.com/Kayforkind/NavigatorsLab-Metadata-Checker' },
  { id: 'shrink', name: 'Image Shrinker', url: 'https://navigatorslab.com/tools/shrink.html', agent_params: '?url=<image-url>&format=webp&targetKB=300', files: 'jpg, png, webp', what: 'binary-search quality to hit an exact KB target; AVIF supported via UI', repo: 'https://github.com/Kayforkind/NavigatorsLab-Image-Shrinker' },
  { id: 'scan', name: 'Scan & Screenshot Cleaner', url: 'https://navigatorslab.com/tools/scan.html', agent_params: '?url=<image-url>', files: 'jpg, png', what: 'auto-straighten, auto-levels, threshold, crop → clean PDF', repo: 'https://github.com/Kayforkind/NavigatorsLab-Scan-Cleaner' },
  { id: 'sign', name: 'Local E-Sign Pad', url: 'https://navigatorslab.com/tools/sign.html', agent_params: '?url=<pdf-url>&date=1', files: 'pdf', what: 'draw/type a signature, place it, optional date stamp, flatten', repo: 'https://github.com/Kayforkind/NavigatorsLab-E-Sign-Pad' },
  { id: 'receipts', name: 'Receipts → One PDF', url: 'https://navigatorslab.com/tools/receipts.html', agent_params: '?url=<image-url>', files: 'jpg, png', what: 'EXIF date-sorted receipt book PDF', repo: 'https://github.com/Kayforkind/NavigatorsLab-Receipts-to-PDF' },
  { id: 'ocr', name: 'Receipt OCR → CSV', url: 'https://navigatorslab.com/tools/ocr.html', agent_params: '?url=<image-url>&autostart=1', files: 'jpg, png', what: 'on-device Tesseract OCR of receipt totals → CSV', repo: 'https://github.com/Kayforkind/NavigatorsLab-Receipt-OCR' },
  { id: 'qr', name: 'QR Studio', url: 'https://navigatorslab.com/tools/qr.html', agent_params: '?text=<payload>', files: '—', what: 'generate PNG/SVG or decode any QR image locally', repo: 'https://github.com/Kayforkind/NavigatorsLab-QR-Studio' },
  { id: 'audio', name: 'Audio Trimmer', url: 'https://navigatorslab.com/tools/audio.html', agent_params: '?url=<audio-url>', files: 'wav, mp3, m4a, ogg', what: 'trim on the waveform, fades, normalize, WAV/MP3 out', repo: 'https://github.com/Kayforkind/NavigatorsLab-Audio-Trimmer' },
  { id: 'invoice', name: 'Invoice / Quote Generator', url: 'https://navigatorslab.com/tools/invoice.html', agent_params: '— (UI-driven)', files: '—', what: 'line items → PDF invoice, live preview', repo: 'https://github.com/Kayforkind/NavigatorsLab-Invoice-Generator' },
  { id: 'rename', name: 'Batch Rename & Sort', url: 'https://navigatorslab.com/tools/rename.html', agent_params: '?url=<image-url>&prefix=receipt-&suffix=&start=1', files: 'jpg, png (zip ok)', what: 'EXIF-dated renaming, prefix/suffix/sequence, zip out', repo: 'https://github.com/Kayforkind/NavigatorsLab-Batch-Rename' },
  { id: 'printprep', name: 'Print-Shop Prep', url: 'https://navigatorslab.com/tools/printprep.html', agent_params: '?url=<image-url>&size=4x6', files: 'jpg, png', what: 'exact print sizes, bleed, 300 DPI checks, PDF out', repo: 'https://github.com/Kayforkind/NavigatorsLab-Print-Shop-Prep' },
  { id: 'pdfpages', name: 'PDF Pages', url: 'https://navigatorslab.com/tools/pdfpages.html', agent_params: '?url=<pdf-url>', files: 'pdf', what: 'reorder/rotate/delete/extract/blank/merge pages', repo: 'https://github.com/Kayforkind/NavigatorsLab-PDF-Pages' },
  { id: 'textdiff', name: 'Text Diff', url: 'https://navigatorslab.com/tools/textdiff.html', agent_params: '?a=<text-url>&b=<text-url>', files: 'any text', what: 'line diff, word-level highlights, similarity %, unified diff', repo: 'https://github.com/Kayforkind/NavigatorsLab-Text-Diff' },
  { id: 'reimagine', name: 'Reimagine', url: 'https://navigatorslab.com/reimagine/', agent_params: '— (paste HTML in the page; CLI: npx reimagine-it)', files: 'html', what: 'redesign an HTML page in 17 directions from its own content — palette, motif, motion derived from the source; nothing invented', repo: 'https://github.com/Kayforkind/reimagine-it' },
  { id: 'textstats', name: 'Text Stats', url: 'https://navigatorslab.com/tools/textstats.html', agent_params: '?url=<text-url>', files: 'any text', what: 'counts, reading time, Flesch, keyword density, rhythm', repo: 'https://github.com/Kayforkind/NavigatorsLab-Text-Stats' },
];

/* Pretty URL aliases for the site root: /QR-Studio, /qr, /Photo-Privacy-Kit…
 * The edge worker 301s these to the canonical /tools/<id>.html. Accepts the
 * tool id, the tool name, and the funnel-repo suffix.
 * EXTERNAL_ALIASES are tools that live outside /tools/ — their pretty URL
 * 301s to the tool's own origin path instead. */
const EXTERNAL_ALIASES: Record<string, string> = {
  'reimagine': 'https://navigatorslab.com/reimagine/',
};

const TOOL_ALIASES: Record<string, string> = {
  'photo-privacy-kit': 'exif', 'photo privacy kit': 'exif',
  'metadata hidden data checker': 'metadata', 'metadata checker': 'metadata',
  'image-shrinker': 'shrink', 'image shrinker': 'shrink',
  'scan-screenshot-cleaner': 'scan', 'scan cleaner': 'scan', 'scan screenshot cleaner': 'scan',
  'local-e-sign-pad': 'sign', 'e-sign-pad': 'sign', 'e sign pad': 'sign', 'esign': 'sign',
  'receipts-to-pdf': 'receipts', 'receipts to pdf': 'receipts',
  'receipt-ocr-to-csv': 'ocr', 'receipt-ocr': 'ocr', 'receipt ocr': 'ocr',
  'qr-studio': 'qr', 'qr studio': 'qr',
  'audio-trimmer': 'audio', 'audio trimmer': 'audio',
  'invoice-quote-generator': 'invoice', 'invoice generator': 'invoice', 'invoice quote generator': 'invoice',
  'batch-rename-and-sort': 'rename', 'batch-rename': 'rename', 'batch rename': 'rename',
  'print-shop-prep': 'printprep', 'print shop prep': 'printprep',
  'pdf-pages': 'pdfpages', 'pdf pages': 'pdfpages',
  'text-diff': 'textdiff', 'text diff': 'textdiff',
  'text-stats': 'textstats', 'text stats': 'textstats',
};

export function resolveToolAlias(raw: string): string | null {
  const key = decodeURIComponent(raw).trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
  if (TOOL_ALIASES[key]) return TOOL_ALIASES[key];
  return null;
}

/** pretty URL → full redirect target; external tools map to their own URL */
export function resolvePrettyTarget(raw: string): string | null {
  const key = decodeURIComponent(raw).trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
  if (EXTERNAL_ALIASES[key]) return EXTERNAL_ALIASES[key];
  const toolId = resolveToolAlias(key);
  return toolId ? `https://navigatorslab.com/tools/${toolId}.html` : null;
}
