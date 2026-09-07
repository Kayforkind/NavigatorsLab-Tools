/* Text Stats page — live-updating stats cards + keyword list, file drop to fill. */
import { $, onDrop } from '../lib/dom';
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

onDrop($('#dz'), async (files) => {
  const f = files[0];
  if (!f) return;
  try {
    input.value = await f.text();
    render();
  } catch { /* unreadable */ }
});
