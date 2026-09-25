/* Text Stats page — live-updating stats cards + keyword list, file drop to fill.
 * Plus a word-goal tracker (writers do not count words for fun; they are
 * hitting a limit) and one-click copy of the whole card set as Markdown. */
import { $, onDrop, copyTextToClipboard, toast } from '../lib/dom';
import { analyze, type TextStats } from '../lib/textstats';

/** words per sentence → bucketed rhythm histogram (pure, local) */
function sentenceHistogram(text: string): { buckets: number[]; labels: string[]; avg: number } {
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);
  const labels = ['1-5', '6-10', '11-15', '16-20', '21-25', '26-35', '36+'];
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const s of sentences) {
    const n = (s.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;
    total += n;
    const b = n <= 5 ? 0 : n <= 10 ? 1 : n <= 15 ? 2 : n <= 20 ? 3 : n <= 25 ? 4 : n <= 35 ? 5 : 6;
    buckets[b]++;
  }
  return { buckets, labels, avg: sentences.length ? Math.round((total / sentences.length) * 10) / 10 : 0 };
}

const input = $('#textInput') as HTMLTextAreaElement;
const cards = $('#cards');
const keywordsEl = $('#keywords');

const CARD_DEFS: [keyof TextStats, string, (v: unknown) => string][] = [
  ['words', 'Words', (v) => String(v)],
  ['chars', 'Characters', (v) => String(v)],
  ['charsNoSpaces', 'No spaces', (v) => String(v)],
  ['sentences', 'Sentences', (v) => String(v)],
  ['paragraphs', 'Paragraphs', (v) => String(v)],
  ['lines', 'Lines', (v) => String(v)],
  ['readMinutes', 'Reading time', (v) => `${v} min`],
  ['speakMinutes', 'Speaking time', (v) => `${v} min`],
  ['flesch', 'Reading ease', (v) => `${v} / 100`],
  ['grade', 'Difficulty', (v) => String(v)],
  ['longestWord', 'Longest word', (v) => String(v)],
];

function render(): void {
  const s = analyze(input.value);
  cards.innerHTML = '';
  for (const [key, label, fmt] of CARD_DEFS) {
    const div = document.createElement('div');
    div.className = 'stat-card';
    div.innerHTML = `<b>${fmt(s[key])}</b><span>${label}</span>`;
    cards.appendChild(div);
  }
  // sentence-rhythm histogram — long-sentence monotony is visible at a glance
  const histHost = document.getElementById('hist') as HTMLElement | null;
  if (histHost) {
    const h = sentenceHistogram(input.value);
    histHost.innerHTML = '';
    histHost.style.cssText = 'display:flex;align-items:flex-end;gap:6px;height:74px';
    const peak = Math.max(1, ...h.buckets);
    h.buckets.forEach((n, i) => {
      const bar = document.createElement('div');
      bar.style.cssText = `flex:1;background:var(--acc);opacity:${n ? 0.35 + 0.65 * (n / peak) : 0.12};border-radius:4px 4px 0 0;height:${n ? Math.max(6, (n / peak) * 100) : 4}%;position:relative`;
      bar.title = `${h.labels[i]} words: ${n} sentence${n === 1 ? '' : 's'}`;
      bar.innerHTML = `<span style="position:absolute;bottom:-16px;left:0;right:0;text-align:center;font-size:10px;color:var(--mut)">${h.labels[i]}</span>`;
      histHost.appendChild(bar);
    });
    const cap = document.getElementById('histCap') as HTMLElement | null;
    if (cap) cap.textContent = h.avg ? `avg ${h.avg} words/sentence` : 'type to see rhythm';
  }
  keywordsEl.innerHTML = '';
  const max = s.keywords[0]?.[1] ?? 1;
  for (const [w, n] of s.keywords) {
    const chip = document.createElement('span');
    chip.className = 'kw';
    chip.style.setProperty('--w', String(20 + (n / max) * 80));
    chip.innerHTML = `${w} <i>${n}</i>`;
    keywordsEl.appendChild(chip);
  }
}

input.addEventListener('input', render);
render();

/* ---- word goal: set a target, watch the ring fill ---- */
const GOAL_KEY = 'textstats-goal';
const goalPanel = document.createElement('div');
goalPanel.className = 'panel';
goalPanel.innerHTML = `
  <label for="goalInput"><b>Word goal</b> <span class="meta">— essays, applications, posts have limits; type yours</span></label>
  <div style="display:flex;gap:10px;align-items:center;margin-top:8px">
    <input id="goalInput" type="number" min="0" step="50" placeholder="e.g. 650"
      style="width:120px" aria-label="Word count goal" />
    <div id="goalBar" role="progressbar" aria-valuemin="0" style="flex:1;height:10px;border-radius:6px;background:rgba(148,163,184,.15);overflow:hidden">
      <div id="goalFill" style="height:100%;width:0%;background:var(--acc);transition:width .25s ease"></div>
    </div>
    <b id="goalPct" class="meta" style="min-width:90px;text-align:right"></b>
  </div>`;
input.closest('.panel')?.after(goalPanel);
const goalInput = $('#goalInput') as HTMLInputElement;
const goalFill = $('#goalFill') as HTMLElement;
const goalBar = $('#goalBar') as HTMLElement;
const goalPct = $('#goalPct') as HTMLElement;
goalInput.value = localStorage.getItem(GOAL_KEY) ?? '';

function renderGoal(): void {
  const goal = parseInt(goalInput.value, 10);
  if (!goal || goal <= 0) {
    goalFill.style.width = '0%';
    goalBar.removeAttribute('aria-valuenow');
    goalPct.textContent = '';
    localStorage.removeItem(GOAL_KEY);
    return;
  }
  localStorage.setItem(GOAL_KEY, goalInput.value);
  const words = analyze(input.value).words;
  const pct = Math.min(100, Math.round((words / goal) * 100));
  goalFill.style.width = `${pct}%`;
  goalFill.style.background = pct >= 100 ? '#7ce0ae' : 'var(--acc)';
  goalBar.setAttribute('aria-valuenow', String(pct));
  goalBar.setAttribute('aria-label', `Word goal progress: ${words} of ${goal} words`);
  goalPct.textContent = `${words} / ${goal} · ${pct}%`;
}
goalInput.addEventListener('input', renderGoal);
input.addEventListener('input', renderGoal);
renderGoal();

/* ---- copy the whole card set as Markdown — numbers go where the writing goes ---- */
const btnCopyStats = document.createElement('button');
btnCopyStats.className = 'btn';
btnCopyStats.textContent = '⧉ Copy stats as Markdown';
btnCopyStats.style.marginTop = '10px';
$('#keywords').closest('.panel')?.querySelector('h2')?.before(btnCopyStats);
btnCopyStats.addEventListener('click', async () => {
  const s = analyze(input.value);
  const lines = [
    '| Metric | Value |', '|---|---|',
    ...CARD_DEFS.map(([k, label, fmt]) => `| ${label} | ${fmt(s[k])} |`),
  ];
  const ok = await copyTextToClipboard(lines.join('\n'));
  toast(ok ? 'Stats table copied — paste into any doc' : 'Copy blocked by the browser');
});

onDrop($('#dz'), async (files) => {
  const f = files[0];
  if (!f) return;
  try {
    input.value = await f.text();
    render();
  } catch { /* unreadable */ }
}, { accept: 'text/plain,.txt,.md', multiple: false });

/* ---- agent mode: ?url=<same-origin text URL> analyzes the file ---- */
import { fetchFileParam, agentBanner } from '../lib/agent';
{
  const u = new URLSearchParams(location.search).get('url');
  if (u) void fetchFileParam(u, 'text.txt').then(async (f) => {
    if (!f) return;
    input.value = await f.text();
    agentBanner('loaded text from <code>url</code> param');
    render();
  });
}
