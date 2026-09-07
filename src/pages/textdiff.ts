/* Text Diff page — wire the pure diff engine to the UI: file drops fill the
 * textareas, Compare renders line rows with word-level highlights, and the
 * unified diff can be copied or downloaded. All local. */
import { $, download, status, onDrop } from '../lib/dom';
import { diffLines, summarize, unifiedDiff, type DiffLine } from '../lib/diff';
import { similarityPercent } from '../lib/enhance';

const ta = $('#textA') as HTMLTextAreaElement;
const tb = $('#textB') as HTMLTextAreaElement;
const ignoreWs = $('#ignoreWs') as HTMLInputElement;
const caseSense = $('#caseSense') as HTMLInputElement;
const btnDiff = $('#btnDiff');
const stat = $('#stat');
const outPanel = $('#outPanel');
const diffOut = $('#diffOut');
const diffSummary = $('#diffSummary');

/* drop a text file onto a textarea to fill it */
for (const [el, ta2] of [[ta, ta], [tb, tb]] as const) {
  onDrop(el, async (files) => {
    const f = files[0];
    if (!f) return;
    try { ta2.value = await f.text(); } catch { /* binary or unreadable */ }
  });
}

btnDiff.addEventListener('click', () => {
  if (!ta.value && !tb.value) return status(stat, 'Paste or drop two texts first.', 'warn');
  const lines = diffLines(ta.value, tb.value, { ignoreWs: ignoreWs.checked, caseSensitive: caseSense.checked });
  const sim = similarityPercent(ta.value, tb.value);
  diffSummary.textContent = `${summarize(lines)} · ${sim}% similar`;
  render(lines, true);
});

function render(lines: DiffLine[], keepSummary = false): void {
  outPanel.hidden = false;
  if (!keepSummary) diffSummary.textContent = summarize(lines);
  diffOut.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (const l of lines) {
    const row = document.createElement('div');
    row.className = 'dl ' + l.type;
    const num = document.createElement('span');
    num.className = 'dl-num';
    num.textContent = `${l.a ?? ''} ${l.b ?? ''}`.trim().padEnd(7);
    row.appendChild(num);
    if (l.spans) {
      for (const [w, kind] of l.spans) {
        const s = document.createElement('span');
        s.className = 'w-' + kind;
        s.textContent = w;
        row.appendChild(s);
      }
    } else {
      row.appendChild(document.createTextNode(l.text));
    }
    fragment.appendChild(row);
  }
  diffOut.appendChild(fragment);
  status(stat, lines.length ? '' : '', 'info');
  stat.hidden = true;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

$('#btnCopy').addEventListener('click', async () => {
  await copyText(unifiedDiff(diffLines(ta.value, tb.value, { ignoreWs: ignoreWs.checked, caseSensitive: caseSense.checked })));
  $('#btnCopy').textContent = 'Copied ✓';
  setTimeout(() => { ($('#btnCopy') as HTMLButtonElement).textContent = 'Copy unified diff'; }, 1500);
});

$('#btnSwap').addEventListener('click', () => { const tmp = ta.value; ta.value = tb.value; tb.value = tmp; });

$('#btnDl').addEventListener('click', () => {
  const text = unifiedDiff(diffLines(ta.value, tb.value, { ignoreWs: ignoreWs.checked, caseSensitive: caseSense.checked }));
  download(new Blob([text], { type: 'text/x-diff' }), 'changes.diff');
});
