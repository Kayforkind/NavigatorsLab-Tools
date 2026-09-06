/* Text Stats page — live-updating stats cards + keyword list, file drop to fill. */
import { $, onDrop } from '../lib/dom';
import { analyze, type TextStats } from '../lib/textstats';

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
