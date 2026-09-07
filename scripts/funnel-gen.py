# Generates one full PRODUCT repo per tool under funnel/<slug>/ — each repo is
# about that tool, end to end:
#   index.html   — branded product landing (hero, features, steps, screenshot)
#   demo.html    — THE TOOL ITSELF, runnable on the repo's own GitHub Pages
#                  (exact asset closure from dist/, meta-CSP preserved)
#   assets/…     — the tool's JS/CSS chunks from the hub build
#   tess/ tessdata/ lamejs/ — same-origin engines for the tools that need them
#   shot.png     — in-action screenshot (docs/shots/tool-<id>.png)
#   og.png       — 1200x630 social image
#   README.md    — in-depth product README with screenshots + steps
#   LICENSE, NOTICE, robots.txt, .nojekyll, topics.txt
#
# Prereqs:  npm run build  (dist/ must be current)
# Run:      python scripts/funnel-gen.py
# Push:     GH_TOKEN=$(gh auth token) python scripts/funnel-sync.py
import io, json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'funnel')
HUB = 'https://navigatorslab.com/tools'
MAIN_REPO = 'https://github.com/Kayforkind/NavigatorsLab-Tools'
# root-level pretty URLs on the hub (edge worker 301s these to the tool page)
PRETTY = {
    'exif': 'Photo-Privacy-Kit', 'metadata': 'Metadata-Checker', 'shrink': 'Image-Shrinker',
    'scan': 'Scan-Cleaner', 'sign': 'E-Sign-Pad', 'receipts': 'Receipts-to-PDF',
    'ocr': 'Receipt-OCR', 'qr': 'QR-Studio', 'audio': 'Audio-Trimmer',
    'invoice': 'Invoice-Generator', 'rename': 'Batch-Rename', 'printprep': 'Print-Shop-Prep',
    'pdfpages': 'PDF-Pages', 'textdiff': 'Text-Diff', 'textstats': 'Text-Stats',
}

SLUGS = {
    'exif': 'photo-privacy-kit',
    'metadata': 'metadata-hidden-data-checker',
    'shrink': 'image-shrinker',
    'scan': 'scan-screenshot-cleaner',
    'sign': 'local-e-sign-pad',
    'receipts': 'receipts-to-pdf',
    'ocr': 'receipt-ocr-to-csv',
    'qr': 'qr-studio',
    'audio': 'audio-trimmer',
    'invoice': 'invoice-quote-generator',
    'rename': 'batch-rename-and-sort',
    'printprep': 'print-shop-prep',
    'pdfpages': 'pdf-pages',
    'textdiff': 'text-diff',
    'textstats': 'text-stats',
}

# Tools listed in tools.json but WITHOUT a funnel landing repo: they live
# outside the hub (their card opens their own URL) and already have a
# full-scale repo of their own.
EXTERNAL = {'reimagine'}

# engines each tool loads same-origin (resolved against document.baseURI at
# runtime, so copying them to the repo root makes the demo fully self-hosted)
ENGINES = {'ocr': ['tess', 'tessdata'], 'audio': ['lamejs']}

FEATURES = {
    'exif': [
        'See exactly what leaks — GPS coordinates, camera & lens, timestamps, embedded thumbnails — before you post',
        'One-click clean copy: Exif, XMP, IPTC and comments removed, pixels untouched',
        'SHA-256 fingerprints + pixel comparison prove the clean file is the same picture, minus the data',
        'Paste screenshots directly (Ctrl/Cmd+V) or drop files; batch friendly',
    ],
    'metadata': [
        'See what is really inside any file: EXIF / IPTC / XMP, embedded thumbnails, document history',
        'Deep PDF inspection: Info dictionary *and* XMP metadata, shown before anything is stripped',
        'OOXML (docx/xlsx/pptx) and ODF (odt): authors, revisions, editing time, custom properties, thumbnails',
        'Export a cleaned copy where the format allows — all parsed locally',
    ],
    'shrink': [
        'Hit an exact size target (e.g. "under 300 KB") with smart binary-searched quality',
        'JPEG, WebP and AVIF output; batch processing with ZIP download',
        'Live preview and per-file progress that survives unreadable images',
    ],
    'scan': [
        'Auto-crop, auto-levels and photocopy-style threshold for crisp scans',
        'Fix phone photos of whiteboards, documents and screenshots in seconds',
        'Export a clean PNG or a print-ready 300-DPI PDF',
    ],
    'sign': [
        'Draw or type a signature, place it anywhere on a PDF, optional dated caption',
        'Fully local — contracts never leave your machine',
        'Works with mouse, trackpad, stylus and touch',
    ],
    'receipts': [
        'Stack receipt photos into one tidy, print-ready PDF',
        'Ordered by EXIF date taken; rotate and re-shoot pages before export',
        'Every page stamped with date and filename — expense reports, done',
    ],
    'ocr': [
        'On-device OCR (no cloud): totals, dates and vendors parsed from receipt photos',
        'Editable rows with expense categories, currency and confidence flags',
        'Export CSV or TSV straight into Excel or Sheets',
    ],
    'qr': [
        'Generate QR codes with Wi-Fi (spec-escaped), URL, email, phone and vCard presets',
        'Selectable error-correction, custom colors, spec quiet zone; PNG + vector SVG export',
        'Decode QRs from images too — nothing is sent anywhere',
    ],
    'audio': [
        'Trim voice notes and clips with sample-accurate precision on a waveform',
        'Fade in/out and one-click peak normalize',
        'Export WAV or MP3 (self-hosted LAME) — 100% offline',
    ],
    'invoice': [
        'Professional invoices and quotes: line items, tax on the discounted subtotal, discounts, notes',
        'Two templates, five currencies, live preview that mirrors the PDF exactly',
        'No account, no cloud — your numbers stay yours',
    ],
    'rename': [
        'EXIF-dated batch renaming: IMG_5847.jpg → 2026-09-05-receipt-home-depot.jpg',
        'Prefix, suffix and sequence start — previewed live before anything happens',
        'Download the organized files as a ZIP',
    ],
    'printprep': [
        'DPI advisor tells you the maximum sharp print size for any image',
        '4×6 to A4 at true 300 DPI; warns before you pay for a blurry print',
        'MediaBox at the exact physical size, optional bleed',
    ],
    'pdfpages': [
        'Visual page thumbnails: drag to reorder, rotate or delete',
        'Extract selected pages, insert blank pages, merge multiple PDFs',
        'Rebuilt locally with pdf-lib — your originals stay untouched',
    ],
    'textdiff': [
        'Compare two texts with word-level highlighting inside changed lines',
        'Similarity percentage, whitespace/case options, unified-diff export',
        'Handles code, contracts and prose alike',
    ],
    'textstats': [
        'Words, characters, sentences, reading and speaking time',
        'Flesch reading-ease with grade level, plus keyword density',
        'Live sentence-rhythm histogram',
    ],
}

HOWTO = {
    'exif': ['Drop a photo (or paste a screenshot with Ctrl/Cmd+V)', 'Read the leak report: GPS, camera, timestamps, thumbnails', 'Hit strip &amp; download — the SHA-256 proves pixels are unchanged'],
    'metadata': ['Drop any file: PDF, Word, Excel, image…', 'Read the hidden-data report, section by section', 'Export a cleaned copy where the format allows'],
    'shrink': ['Drop a batch of images', 'Type the target: "under 300 KB"', 'Download the results as one ZIP'],
    'scan': ['Photograph the document with your phone', 'Auto-straighten, auto-levels, threshold', 'Export PNG or a 300-DPI PDF'],
    'sign': ['Open the PDF', 'Draw or type your signature, click to place it', 'Download the flattened, signed PDF'],
    'receipts': ['Drop the shoebox of receipt photos', 'They sort themselves by EXIF date — rotate if needed', 'Export one stamped PDF'],
    'ocr': ['Drop receipt photos', 'On-device OCR fills vendor, date and total rows', 'Export the CSV for your spreadsheet'],
    'qr': ['Type text or pick the Wi-Fi / URL / vCard preset', 'Tune colors and error correction', 'Export PNG or SVG — or decode an existing QR image'],
    'audio': ['Drop a voice note', 'Drag the selection on the waveform, add fades', 'Export WAV or MP3'],
    'invoice': ['Fill in hours, rates and line items', 'Pick a template, currency, tax and discount', 'Print or save the PDF'],
    'rename': ['Drop the files', 'Set the EXIF-date pattern, prefix, suffix, sequence', 'Preview, then download the ZIP'],
    'printprep': ['Drop an image', 'Pick the physical size: 4×6, A4, Letter…', 'Read the DPI verdict, export the print-ready PDF'],
    'pdfpages': ['Drop one or more PDFs', 'Drag thumbnails: reorder, rotate, delete, merge', 'Download the rebuilt PDF'],
    'textdiff': ['Paste both texts', 'Read word-level highlights and the similarity %', 'Export a unified diff'],
    'textstats': ['Paste the text', 'Get words, Flesch grade and keyword density', 'Watch the sentence-rhythm histogram'],
}

TECH = {
    'exif': 'Hand-written JPEG/PNG/WebP segment parsers — no library touches your pixels',
    'metadata': 'pdf-lib (PDF Info + XMP) plus zip central-directory parsing for OOXML/ODF',
    'shrink': 'Canvas re-encode with binary-searched quality targeting',
    'scan': 'Canvas pixel ops (deskew, auto-levels, threshold); pdf-lib for the 300-DPI PDF',
    'sign': 'pdf-lib flattening; pointer events for mouse, touch and stylus',
    'receipts': 'EXIF capture-date extraction + pdf-lib, one stamped page per receipt',
    'ocr': 'tesseract.js WASM engine, self-hosted same-origin — zero third-party requests',
    'qr': 'qrcode-generator + jsQR, both bundled — no network at all',
    'audio': 'Web Audio API for decode/trim/fades; self-hosted lamejs for MP3 export',
    'invoice': 'pdf-lib rendering; the live preview is pixel-identical to the PDF',
    'rename': 'EXIF capture dates + client-side ZIP, nothing touches a server',
    'printprep': 'Exact DPI math + pdf-lib MediaBox at the true physical size',
    'pdfpages': 'pdf-lib page ops with live thumbnail drag-and-drop',
    'textdiff': 'Custom LCS diff with word-level intra-line highlighting',
    'textstats': 'Pure TypeScript: Flesch reading-ease, keyword density, rhythm histogram',
}

TOPICS = {
    'exif': ['exif', 'gps', 'photo-privacy', 'metadata'],
    'metadata': ['metadata', 'hidden-data', 'file-inspection', 'forensics'],
    'shrink': ['image-compression', 'jpeg', 'webp', 'avif', 'batch'],
    'scan': ['scanner', 'document', 'image-processing', 'pdf'],
    'sign': ['pdf', 'signature', 'e-signature', 'esign'],
    'receipts': ['receipts', 'pdf', 'expenses'],
    'ocr': ['ocr', 'tesseract', 'csv', 'expense-tracking'],
    'qr': ['qr-code', 'qrcode', 'wifi', 'vcard'],
    'audio': ['audio', 'wav', 'trimmer', 'podcast'],
    'invoice': ['invoice', 'billing', 'quotes', 'freelancer'],
    'rename': ['batch-rename', 'file-organizer', 'rename'],
    'printprep': ['printing', 'dpi', 'prepress'],
    'pdfpages': ['pdf', 'pdf-manipulation', 'merge'],
    'textdiff': ['diff', 'text-comparison', 'lcs'],
    'textstats': ['text-analysis', 'readability', 'flesch', 'word-count'],
}
COMMON_TOPICS = ['navigatorslab-tools', 'browser', 'client-side', 'offline-first',
                 'privacy-tools', 'no-upload', 'mit-license', 'javascript']

LICENSE = '''MIT License

Copyright (c) 2026 NavigatorsLab

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
'''

LAND_CSS = '''
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(900px 500px at 15% -10%, rgba(56,189,248,.16), transparent 60%),
                        radial-gradient(800px 500px at 110% 10%, rgba(167,139,250,.14), transparent 55%), #0b0f17;
      color: #e7ecf5; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      line-height: 1.55; }
    main { max-width: 960px; margin: 0 auto; padding: 48px 20px 64px; }
    .tile { width: 76px; height: 76px; display: grid; place-items: center; font-size: 38px;
      border-radius: 20px; background: linear-gradient(135deg, rgba(56,189,248,.25), rgba(167,139,250,.25));
      border: 1px solid rgba(148,163,184,.25); }
    h1 { margin: 18px 0 6px; font-size: 34px; letter-spacing: -0.5px; }
    .tag { color: #9fb0c8; font-size: 18px; margin: 0 0 18px; }
    .badges span { display: inline-block; margin: 0 8px 8px 0; padding: 4px 12px; border-radius: 999px;
      font-size: 13px; color: #cbd5e1; border: 1px solid rgba(148,163,184,.3); background: rgba(148,163,184,.08); }
    .cta { display: flex; gap: 12px; flex-wrap: wrap; margin: 22px 0 8px; }
    .btn { display: inline-block; padding: 12px 22px; border-radius: 12px; text-decoration: none; font-weight: 700; }
    .primary { color: #06121f; background: linear-gradient(135deg, #67e8f9, #a78bfa); }
    .ghost { color: #e7ecf5; border: 1px solid rgba(148,163,184,.4); }
    .shot { width: 100%; border-radius: 14px; border: 1px solid rgba(148,163,184,.25); margin: 26px 0 6px; }
    .cap { color: #64748b; font-size: 13px; text-align: center; margin: 0 0 30px; }
    h2 { font-size: 22px; margin: 40px 0 12px; }
    .feats { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; padding: 0; margin: 0; list-style: none; }
    .feats li { padding: 14px 16px; border-radius: 12px; background: rgba(148,163,184,.07);
      border: 1px solid rgba(148,163,184,.18); font-size: 15px; }
    ol.steps { padding-left: 20px; color: #cdd8e6; }
    ol.steps li { margin: 10px 0; }
    ol.steps b { color: #e7ecf5; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
    .grid a { display: block; padding: 12px 14px; border-radius: 12px; text-decoration: none;
      color: #cdd8e6; background: rgba(148,163,184,.06); border: 1px solid rgba(148,163,184,.16); font-size: 14px; }
    .grid a:hover { border-color: rgba(103,232,249,.5); color: #e7ecf5; }
    .grid a b { display: block; color: #e7ecf5; font-size: 15px; margin-bottom: 2px; }
    .note { border-left: 3px solid #67e8f9; padding: 10px 16px; background: rgba(56,189,248,.07);
      border-radius: 0 10px 10px 0; color: #cdd8e6; }
    footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid rgba(148,163,184,.18);
      color: #64748b; font-size: 14px; }
    footer a { color: #94a3b8; }
    a { color: #7dd3fc; }
'''

LAND_JS = ''  # landing is static; no script, no CSP exemptions needed


def landing(t, all_tools):
    icon = t['icon'].replace('\ufe0f', '')
    tool_url = f"{HUB}/{t['id']}.html"
    pretty = f"https://navigatorslab.com/{PRETTY[t['id']]}"
    feats = '\n'.join(f'      <li>{f}</li>' for f in FEATURES[t['id']])
    steps = '\n'.join(f'      <li><b>Step {i + 1}.</b> {s}</li>' for i, s in enumerate(HOWTO[t['id']]))
    others = []
    for x in all_tools:
        if x['id'] == t['id']:
            continue
        xi = x['icon'].replace('\ufe0f', '')
        others.append(f'      <a href="{x.get("url") or HUB + "/" + x["id"] + ".html"}"><b>{xi} {x["name"]}</b>{x["tagline"]}</a>')
    others = '\n'.join(others)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t['name']} — free, in your browser — NavigatorsLab</title>
<meta name="description" content="{t['tagline']} Free, open-source (MIT), 100% on-device. No uploads, no accounts. Runs right here and on navigatorslab.com.">
<meta property="og:title" content="{t['name']} — NavigatorsLab Tools">
<meta property="og:description" content="{t['tagline']}">
<meta property="og:image" content="./og.png">
<meta name="theme-color" content="#0b0f17">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>{icon}</text></svg>">
<style>{LAND_CSS}</style>
</head>
<body>
<main>
  <div class="tile" aria-hidden="true">{icon}</div>
  <h1>{t['name']}</h1>
  <p class="tag">{t['tagline']}</p>
  <div class="badges"><span>🆓 free &amp; open source (MIT)</span><span>🔒 nothing is uploaded</span><span>📶 works offline</span><span>📱 mobile friendly</span></div>
  <div class="cta">
    <a class="btn primary" href="./demo.html">Run it right here &rarr;</a>
    <a class="btn ghost" href="{pretty}">navigatorslab.com/{PRETTY[t['id']]}</a>
  </div>
  <img class="shot" src="./shot.png" alt="{t['name']} in action">
  <p class="cap">{t['name']} mid-task — this demo runs entirely on this page's own GitHub Pages site.</p>

  <h2>What it does</h2>
  <ul class="feats">
{feats}
  </ul>

  <h2>How it works</h2>
  <ol class="steps">
{steps}
  </ol>

  <div class="note"><b>Private by design.</b> Files are processed on <em>your</em> device and never
  sent to any server. No accounts, no tracking, no cookies, nothing retained. Prefer the hub?
  The same tool lives at <a href="{tool_url}">{tool_url}</a>.</div>

  <h2>The suite: 16 tools, one zero-upload promise</h2>
  <div class="grid">
{others}
  </div>

  <footer>
    <b>NavigatorsLab Tools</b> — free &amp; open source (MIT).
    <a href="{HUB}/">Hub</a> · <a href="{MAIN_REPO}">Source</a> ·
    <a href="{HUB}/agents.html">Agent mode</a> · <a href="{HUB}/llms.txt">llms.txt</a> ·
    MCP: <code>POST {HUB}/mcp</code>
  </footer>
</main>
</body>
</html>
'''


def tool_link(x):
    # external tools get their real URL; hub tools get ./<id>.html
    return x.get('url') or f"{HUB}/{x['id']}.html"


def readme(t, all_tools):
    icon = t['icon'].replace('\ufe0f', '')
    tool_url = f"{HUB}/{t['id']}.html"
    pretty = f"https://navigatorslab.com/{PRETTY[t['id']]}"
    feats = '\n'.join(f'- {f}' for f in FEATURES[t['id']])
    steps = '\n'.join(f'{i + 1}. {s}' for i, s in enumerate(HOWTO[t['id']]))
    rows = []
    for x in all_tools:
        xi = x['icon'].replace('\ufe0f', '')
        name = f"**{xi} {x['name']}**" if x['id'] == t['id'] else f"{xi} {x['name']}"
        rows.append(f"| {name} | {x['tagline']} | [Open]({tool_link(x)}) |")
    suite = '\n'.join(rows)
    return f'''# {icon} {t['name']}

> {t['tagline']}

![License](https://img.shields.io/badge/license-MIT-blue) ![Privacy](https://img.shields.io/badge/privacy-no%20uploads-black) ![Offline](https://img.shields.io/badge/offline-first-8b5cf6) ![PRs](https://img.shields.io/badge/PRs-welcome-green)

<h4 align="center">
  &#9654; <a href="{tool_url}">Open it on navigatorslab.com</a> &mdash; free, no sign-up, nothing uploaded<br>
  <a href="https://navigatorslab.com/{PRETTY[t['id']]}">navigatorslab.com/{PRETTY[t['id']]}</a> &middot; same tool, shorter URL<br>
  This repo's Pages site runs the <em>actual tool</em>: <code>demo.html</code>
</h4>

![{t['name']} banner](og.png)

{t['detail']}

## ✅ What it does

{feats}

## 🚀 Try it in 30 seconds

{steps}

## 📸 See it in action

![{t['name']} in action](shot.png)

## 🔒 Private by design

- **100% on-device** — files are processed in your browser and **never uploaded** to any server
- **No accounts, no tracking, no cookies, nothing retained** — open the page and work
- **Works offline** once loaded; fully mobile-friendly
- **Free & open source (MIT)** — use it at home, at work, anywhere

## 🤖 Built for humans *and* AI agents

- Deep-linkable via URL parameters — see the [Agent Mode guide]({HUB}/agents.html)
- Machine-readable catalog: [llms.txt]({HUB}/llms.txt) · [llms-full.txt]({HUB}/llms-full.txt)
- MCP endpoint: `POST {HUB}/mcp` (tool catalog + deterministic text tools — see the [main repo]({MAIN_REPO}))
- No build step required to *use* any tool — just the URL

## 🛠 Under the hood

{TECH[t['id']]}

Third-party components are catalogued in [NOTICE](NOTICE); this repo is MIT-licensed ([LICENSE](LICENSE)).

## 🗂 The NavigatorsLab Tools suite

Fifteen free tools, one hub — all with the same zero-upload promise — plus Reimagine, the design engine at /reimagine/:

| Tool | What it does | |
|---|---|---|
{suite}

---

<p align="center">
  <b>One hub, fifteen tools:</b> <a href="{HUB}/">{HUB}</a><br>
  <b>Source &amp; the whole suite:</b> <a href="{MAIN_REPO}">{MAIN_REPO}</a>
</p>
'''


ASSET_REF = re.compile(r'[A-Za-z0-9_$.\-]+\.(?:js|css)')


def collect_assets(page_html):
    """Exact transitive closure of dist/assets files the page needs."""
    assets_dir = os.path.join(ROOT, 'dist', 'assets')
    all_files = set(os.listdir(assets_dir))
    want = set()
    for m in re.finditer(r'\./assets/([A-Za-z0-9_$.\-]+\.(?:js|css))', page_html):
        if m.group(1) in all_files:
            want.add(m.group(1))
    queue = list(want)
    while queue:
        name = queue.pop()
        text = io.open(os.path.join(assets_dir, name), encoding='utf-8', errors='replace').read()
        for m in ASSET_REF.finditer(text):
            f = m.group(0)
            if f in all_files and f not in want:
                want.add(f)
                queue.append(f)
    return want


def build_demo(t):
    """dist/<id>.html, minus the PWA manifest link — the exact tool, runnable anywhere."""
    html = io.open(os.path.join(ROOT, 'dist', t['id'] + '.html'), encoding='utf-8').read()
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html, count=1)
    assert 'manifest' not in html.split('</head>')[0], 'manifest link still present'
    return html


def main():
    tools = json.load(io.open(os.path.join(ROOT, 'public', 'tools.json'), encoding='utf-8'))
    assert len(tools) == 16, f'expected 16 tools, got {len(tools)}'
    dist = os.path.join(ROOT, 'dist')
    for t in tools:
        if t['id'] in EXTERNAL:
            print(f'skip {t["id"]:32s} (external — no funnel repo)')
            continue
        slug = SLUGS[t['id']]
        d = os.path.join(OUT, slug)
        if os.path.isdir(os.path.join(d, '.git')):
            for name in os.listdir(d):
                if name != '.git':
                    p = os.path.join(d, name)
                    shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
        else:
            os.makedirs(d, exist_ok=True)

        # 1) the runnable tool + its exact asset closure
        demo = build_demo(t)
        io.open(os.path.join(d, 'demo.html'), 'w', encoding='utf-8', newline='\n').write(demo)
        for name in sorted(collect_assets(demo)):
            os.makedirs(os.path.join(d, 'assets'), exist_ok=True)
            shutil.copyfile(os.path.join(dist, 'assets', name), os.path.join(d, 'assets', name))
        for eng in ENGINES.get(t['id'], []):
            shutil.copytree(os.path.join(dist, eng), os.path.join(d, eng))

        # 2) landing + README + images + boilerplate
        io.open(os.path.join(d, 'index.html'), 'w', encoding='utf-8', newline='\n').write(landing(t, tools))
        io.open(os.path.join(d, 'README.md'), 'w', encoding='utf-8', newline='\n').write(readme(t, tools))
        shutil.copyfile(os.path.join(ROOT, 'docs', 'shots', f"tool-{t['id']}.png"), os.path.join(d, 'shot.png'))
        shutil.copyfile(os.path.join(dist, f"og-{t['id']}.png"), os.path.join(d, 'og.png'))
        io.open(os.path.join(d, 'LICENSE'), 'w', encoding='utf-8', newline='\n').write(LICENSE)
        shutil.copyfile(os.path.join(ROOT, 'NOTICE'), os.path.join(d, 'NOTICE'))
        io.open(os.path.join(d, '.nojekyll'), 'w', encoding='utf-8', newline='\n').write('')
        io.open(os.path.join(d, 'robots.txt'), 'w', encoding='utf-8', newline='\n').write(
            'User-agent: *\nAllow: /\n')
        io.open(os.path.join(d, 'topics.txt'), 'w', encoding='utf-8', newline='\n').write(
            ' '.join([t['id']] + TOPICS[t['id']] + COMMON_TOPICS) + '\n')
        size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(d) for f in fs)
        print(f"gen {slug:32s} <- {t['icon']} {t['name']:36s} {size / 1024:8.0f} KB")
    print('done:', OUT)


if __name__ == '__main__':
    main()
