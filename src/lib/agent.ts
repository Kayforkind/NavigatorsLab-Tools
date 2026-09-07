/* Shared "agent mode" plumbing — lets AI agents (and power users) drive tools
 * via URL query parameters instead of clicks. Every tool calls applyQuery()
 * after wiring its handlers; params are strict allow-lists, values are size-
 * capped, and everything stays local. The ?url= loader is same-origin ONLY —
 * a cross-origin file URL is rejected, so an agent can pre-stage files on this
 * site (or use a data: URL) but cannot make the page pull from arbitrary hosts.
 * Mirrored by the docs on /agents.html and by the MCP endpoint at /tools/mcp. */

export interface QuerySpec {
  [key: string]: {
    /** validate + normalize the raw string; return null to reject */
    parse: (v: string) => unknown;
    /** apply the parsed value (set input, click button, …) */
    apply: (v: unknown) => void;
  };
}

const MAX_PARAM = 4000;

/** Validate + apply URL query params against a strict spec. Returns applied keys. */
export function applyQuery(spec: QuerySpec, opts: { clear?: boolean } = {}): string[] {
  const qs = new URLSearchParams(location.search);
  const applied: string[] = [];
  for (const [key, rule] of Object.entries(spec)) {
    const raw = qs.get(key);
    if (raw === null) continue;
    if (raw.length > MAX_PARAM) continue;
    let v: unknown;
    try { v = rule.parse(raw); } catch { continue; }
    if (v === null || v === undefined) continue;
    try { rule.apply(v); applied.push(key); } catch { /* handler failed — never break the page */ }
  }
  if (opts.clear && applied.length) {
    try {
      const clean = new URL(location.pathname + location.hash);
      history.replaceState(null, '', clean.toString());
    } catch { /* sandboxed */ }
  }
  return applied;
}

/** spec entry: string select (validated against allowed values) */
export function bindSelect(el: HTMLSelectElement, allowed?: string[]): QuerySpec[string] {
  return {
    parse: (v) => {
      const val = String(v).toLowerCase();
      const opts = [...el.options].map((o) => o.value.toLowerCase());
      const list = allowed?.map((x) => x.toLowerCase()) ?? opts;
      if (!list.includes(val)) return null;
      const match = [...el.options].find((o) => o.value.toLowerCase() === val);
      return match ? match.value : null;
    },
    apply: (v) => { el.value = String(v); el.dispatchEvent(new Event('change')); },
  };
}

/** spec entry: checkbox */
export function bindCheck(el: HTMLInputElement): QuerySpec[string] {
  return {
    parse: (v) => (['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()) ? true : ['0', 'false', 'no', 'off'].includes(String(v).toLowerCase()) ? false : null),
    apply: (v) => { el.checked = v as boolean; el.dispatchEvent(new Event('change')); },
  };
}

/** spec entry: bounded number (clamped) */
export function bindNumber(el: HTMLInputElement, min: number, max: number): QuerySpec[string] {
  return {
    parse: (v) => {
      const n = Number(String(v).replace(/[^\d.-]/g, ''));
      if (!isFinite(n)) return null;
      return Math.min(max, Math.max(min, n));
    },
    apply: (v) => { el.value = String(v); el.dispatchEvent(new Event('input')); },
  };
}

/** spec entry: text (trimmed, hard-capped at 4000 chars) */
export function bindText(el: HTMLInputElement | HTMLTextAreaElement): QuerySpec[string] {
  return {
    parse: (v) => (String(v).trim() ? String(v).trim().slice(0, MAX_PARAM) : null),
    apply: (v) => { el.value = String(v); el.dispatchEvent(new Event('input')); },
  };
}

/** Resolve a ?url= (or ?a= / ?b=) parameter to a File — same-origin only.
 *  Accepts: same-origin paths (pre-staged files, e.g. /tools/samples/x.jpg),
 *  and data: URLs (agents can inline small files). Cross-origin is rejected. */
export async function fetchFileParam(rawUrl: string, fallbackName = 'input'): Promise<File | null> {
  const u = rawUrl.trim();
  if (!u || u.length > 4000) return null;
  try {
    let res: Response;
    let name = fallbackName;
    if (/^data:/i.test(u)) {
      res = await fetch(u);
      const mime = /^data:([^;,]+)/.exec(u)?.[1] ?? 'application/octet-stream';
      name = 'inline.' + (mime.split('/')[1] ?? 'bin');
    } else {
      const target = new URL(u, location.href);
      if (target.origin !== location.origin) return null; // same-origin ONLY
      res = await fetch(target.pathname + target.search, { redirect: 'error' });
      name = decodeURIComponent(target.pathname.split('/').pop() ?? fallbackName);
    }
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0 || blob.size > 512 * 1024 * 1024) return null;
    return new File([blob], name, { type: blob.type || 'application/octet-stream' });
  } catch {
    return null;
  }
}

/** True when the page was opened with agent params (used for the banner). */
export function hasAgentParams(): boolean {
  return new URLSearchParams(location.search).toString().length > 0;
}

/** Floating "agent mode" chip — shows what the URL applied, dismiss on click. */
export function agentBanner(summary: string): void {
  if (!summary) return;
  const el = document.createElement('div');
  el.className = 'agent-chip';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="ac-dot"></span> Agent mode · ${summary} <button aria-label="Dismiss">×</button>`;
  el.querySelector('button')!.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 60);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 15000);
}

/** One-call convenience: applies spec, shows the banner, returns applied keys. */
export function agentInit(spec: QuerySpec, describe: (applied: string[]) => string): string[] {
  const applied = applyQuery(spec);
  if (applied.length) agentBanner(describe(applied));
  return applied;
}
