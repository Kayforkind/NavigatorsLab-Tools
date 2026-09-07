import io

def edit(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        assert old in s, f'{path}: NOT FOUND: {old[:80]!r}'
        s = s.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print(path, 'ok')

# ============ 9. Audio: peak normalize ============
edit('audio.html', [
    ('        <label>Fade in <input type="number" id="fin" value="0" min="0" step="0.05" style="width:70px" /> s</label>\n        <label>Fade out <input type="number" id="fout" value="0" min="0" step="0.05" style="width:70px" /> s</label>',
     '        <label>Fade in <input type="number" id="fin" value="0" min="0" step="0.05" style="width:70px" /> s</label>\n        <label>Fade out <input type="number" id="fout" value="0" min="0" step="0.05" style="width:70px" /> s</label>\n        <label><input type="checkbox" id="norm" /> normalize to −0.1 dB</label>'),
])
edit('src/pages/audio.ts', [
    ("      if (i < fadeN0) v *= i / fadeN0;\n      if (i > n - fadeN1) v *= (n - i) / fadeN1;\n      out[i] = v;",
     "      if (i < fadeN0) v *= i / fadeN0;\n      if (i > n - fadeN1) v *= (n - i) / fadeN1;\n      out[i] = v;"),
    ("  if (fmt.value === 'wav') {",
     "  if (($('#norm') as HTMLInputElement).checked) {\n    const { normalizeGain } = await import('../lib/enhance');\n    const gain = normalizeGain(chans);\n    if (gain !== 1) {\n      for (const ch of chans) for (let i = 0; i < ch.length; i++) ch[i] = Math.min(0.9988, ch[i] * gain);\n    }\n    status(stat, `Normalize gain applied: ×${gain.toFixed(2)}.`, 'info');\n  }\n  if (fmt.value === 'wav') {"),
])

# ============ 10. Text Diff: similarity % + swap button ============
edit('textdiff.html', [
    ('        <button id="btnDiff" class="primary">Compare</button>',
     '        <button id="btnSwap" type="button">⇄ Swap</button>\n        <button id="btnDiff" class="primary">Compare</button>'),
])
edit('src/pages/textdiff.ts', [
    ("import { diffLines, summarize, unifiedDiff, type DiffLine } from '../lib/diff';",
     "import { diffLines, summarize, unifiedDiff, type DiffLine } from '../lib/diff';\nimport { similarityPercent } from '../lib/enhance';"),
    ("  const lines = diffLines(ta.value, tb.value, { ignoreWs: ignoreWs.checked, caseSensitive: caseSense.checked });\n  render(lines);",
     "  const lines = diffLines(ta.value, tb.value, { ignoreWs: ignoreWs.checked, caseSensitive: caseSense.checked });\n  const sim = similarityPercent(ta.value, tb.value);\n  diffSummary.textContent = `${summarize(lines)} · ${sim}% similar`;\n  render(lines, true);"),
    ("function render(lines: DiffLine[]): void {\n  outPanel.hidden = false;\n  diffSummary.textContent = summarize(lines);",
     "function render(lines: DiffLine[], keepSummary = false): void {\n  outPanel.hidden = false;\n  if (!keepSummary) diffSummary.textContent = summarize(lines);"),
    ("$('#btnDl').addEventListener('click', () => {",
     "$('#btnSwap').addEventListener('click', () => { const tmp = ta.value; ta.value = tb.value; tb.value = tmp; });\n\n$('#btnDl').addEventListener('click', () => {"),
])

# ============ 11. Text Stats: sentence-length rhythm histogram ============
edit('textstats.ts', [
    ("import { analyze, type TextStats } from '../lib/textstats';",
     "import { analyze, type TextStats } from '../lib/textstats';\n\n/** words per sentence → bucketed rhythm histogram (pure, local) */\nfunction sentenceHistogram(text: string): { buckets: number[]; labels: string[]; avg: number } {\n  const sentences = text.split(/[.!?]+(?:\\s|$)/).map((s) => s.trim()).filter(Boolean);\n  const labels = ['1-5', '6-10', '11-15', '16-20', '21-25', '26-35', '36+'];\n  const buckets = [0, 0, 0, 0, 0, 0, 0];\n  let total = 0;\n  for (const s of sentences) {\n    const n = (s.match(/[\\p{L}\\p{N}'’-]+/gu) ?? []).length;\n    total += n;\n    const b = n <= 5 ? 0 : n <= 10 ? 1 : n <= 15 ? 2 : n <= 20 ? 3 : n <= 25 ? 4 : n <= 35 ? 5 : 6;\n    buckets[b]++;\n  }\n  return { buckets, labels, avg: sentences.length ? Math.round((total / sentences.length) * 10) / 10 : 0 };\n}"),
    ("  keywordsEl.innerHTML = '';\n  const max = s.keywords[0]?.[1] ?? 1;",
     "  // sentence-rhythm histogram — long-sentence monotony is visible at a glance\n  const histHost = document.getElementById('hist') as HTMLElement | null;\n  if (histHost) {\n    const h = sentenceHistogram(input.value);\n    histHost.innerHTML = '';\n    histHost.style.display = 'flex';\n    histHost.style.alignItems = 'flex-end';\n    histHost.style.gap = '6px';\n    histHost.style.height = '74px';\n    const peak = Math.max(1, ...h.buckets);\n    h.buckets.forEach((n, i) => {\n      const bar = document.createElement('div');\n      bar.style.cssText = `flex:1;background:var(--acc);opacity:${n ? 0.35 + 0.65 * (n / peak) : 0.12};border-radius:4px 4px 0 0;height:${n ? Math.max(6, (n / peak) * 100) : 4}%;position:relative`;\n      bar.title = `${h.labels[i]} words: ${n} sentence${n === 1 ? '' : 's'}`;\n      bar.innerHTML = `<span style=\"position:absolute;bottom:-16px;left:0;right:0;text-align:center;font-size:10px;color:var(--mut)\">${h.labels[i]}</span>`;\n      histHost.appendChild(bar);\n    });\n    const cap = document.getElementById('histCap') as HTMLElement | null;\n    if (cap) cap.textContent = h.avg ? `avg ${h.avg} words/sentence` : 'type to see rhythm';\n  }\n  keywordsEl.innerHTML = '';\n  const max = s.keywords[0]?.[1] ?? 1;"),
])
edit('textstats.html', [
    ('      <h2 style="margin:18px 0 8px; font-size:16px">Top keywords</h2>\n      <div id="keywords" class="kw-row"></div>',
     '      <h2 style="margin:18px 0 8px; font-size:16px">Sentence rhythm <span class="meta" id="histCap"></span></h2>\n      <div id="hist" aria-label="Sentence length distribution"></div>\n      <h2 style="margin:26px 0 8px; font-size:16px">Top keywords</h2>\n      <div id="keywords" class="kw-row"></div>'),
])

print('SCRIPT B DONE')
