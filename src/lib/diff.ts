/* Line diff via LCS dynamic programming with word-level inner highlights.
 * Pure functions, no DOM — unit-testable. O(n·m) time/space; fine for the
 * document-size texts this tool targets (thousands of lines). */

export interface DiffLine {
  type: 'same' | 'add' | 'del';
  /** for 'same': text; for add/del: the line text */
  text: string;
  /** word-level spans for changed line pairs: [word, kind][] where kind = same|add|del */
  spans?: [string, 'same' | 'add' | 'del'][];
  /** 1-based line numbers in A / B (0 when N/A) */
  a?: number;
  b?: number;
}

/** split into words while keeping whitespace attached, for inner diffs */
function words(s: string): string[] {
  return s.split(/(\s+)/).filter((w) => w.length > 0);
}

/** LCS-based word diff between two strings' word lists */
function wordSpans(a: string, b: string): [string, 'same' | 'add' | 'del'][] {
  const wa = words(a);
  const wb = words(b);
  const n = wa.length;
  const m = wb.length;
  // dp[i][j] = LCS length of wa[i..], wb[j..]
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = wa[i] === wb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: [string, 'same' | 'add' | 'del'][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (wa[i] === wb[j]) { out.push([wa[i], 'same']); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push([wa[i], 'del']); i++; }
    else { out.push([wb[j], 'add']); j++; }
  }
  while (i < n) { out.push([wa[i++], 'del']); }
  while (j < m) { out.push([wb[j++], 'add']); }
  return out;
}

export function diffLines(aText: string, bText: string, opts: { ignoreWs?: boolean; caseSensitive?: boolean } = {}): DiffLine[] {
  const caseSensitive = opts.caseSensitive ?? true; // default: case matters
  const norm = (s: string) => {
    let t = s;
    if (opts.ignoreWs) t = t.trim();
    if (!caseSensitive) t = t.toLowerCase();
    return t;
  };
  const A = aText.split(/\r?\n/);
  const B = bText.split(/\r?\n/);
  const NA = A.map(norm);
  const NB = B.map(norm);
  const n = A.length;
  const m = B.length;

  // dp table on normalized lines
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = NA[i] === NB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (NA[i] === NB[j]) {
      out.push({ type: 'same', text: B[j], a: i + 1, b: j + 1 });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: A[i], a: i + 1 });
      i++;
    } else {
      out.push({ type: 'add', text: B[j], b: j + 1 });
      j++;
    }
  }
  while (i < n) { out.push({ type: 'del', text: A[i], a: ++i }); }
  while (j < m) { out.push({ type: 'add', text: B[j], b: ++j }); }

  // pair adjacent del/add runs for word-level inner highlights
  for (let k = 0; k < out.length; k++) {
    if (out[k].type === 'del') {
      const delRun: DiffLine[] = [];
      let e = k;
      while (e < out.length && out[e].type === 'del') delRun.push(out[e++]);
      const addRun: DiffLine[] = [];
      let f = e;
      while (f < out.length && out[f].type === 'add') addRun.push(out[f++]);
      // pair each removed line with the replacement added line (1:1 up to the shorter run)
      const pairs = Math.min(delRun.length, addRun.length);
      for (let p = 0; p < pairs; p++) {
        delRun[p].spans = wordSpans(delRun[p].text, addRun[p].text);
        addRun[p].spans = delRun[p].spans;
      }
      k = f - 1;
    }
  }
  return out;
}

export function summarize(lines: DiffLine[]): string {
  const add = lines.filter((l) => l.type === 'add').length;
  const del = lines.filter((l) => l.type === 'del').length;
  const same = lines.filter((l) => l.type === 'same').length;
  return `${add} added · ${del} removed · ${same} unchanged`;
}

/** classic unified diff (no headers) — good enough for review + copy/paste */
export function unifiedDiff(lines: DiffLine[]): string {
  const out: string[] = [];
  for (const l of lines) {
    if (l.type === 'same') out.push(`   ${l.text}`);
    else if (l.type === 'add') out.push(`+ ${l.a ? '' : ''}${l.text}`);
    else out.push(`- ${l.text}`);
  }
  return out.join('\n');
}
