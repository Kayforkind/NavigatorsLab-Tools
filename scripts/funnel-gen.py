# Generates one standalone funnel repo per tool under funnel/<slug>/:
#   index.html  — branded redirector to the tool on navigatorslab.com
#   README.md   — detailed, suite-cross-linked landing for humans + agents
#   LICENSE     — MIT
#   og.png      — the tool's 1200x630 share image
#   .nojekyll   — serve index.html as-is on GitHub Pages
# Run:  python scripts/funnel-gen.py
import io, json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'funnel')
HUB = 'https://navigatorslab.com/tools'
MAIN_REPO = 'https://github.com/Kayforkind/NavigatorsLab-Tools'

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

FEATURES = {
    'exif': [
        'See exactly what leaks — GPS coordinates, camera & lens, timestamps, embedded thumbnails — before you post',
        'One-click clean copy: all metadata stripped, pixels untouched',
        'SHA-256 fingerprints + pixel comparison prove the clean file is the same picture, minus the data',
        'Paste screenshots directly (Ctrl/Cmd+V) or drop files; batch friendly',
    ],
    'metadata': [
        'Inspect any file\u2019s hidden data: EXIF / IPTC / XMP, embedded thumbnails, document history',
        'SHA-256 fingerprints for tamper evidence',
        'Everything is parsed locally — sensitive files never leave the device',
    ],
    'shrink': [
        'Hit an exact size target (e.g. \u201cunder 300 KB\u201d) with smart quality search',
        'JPEG, WebP and AVIF output; batch processing with ZIP download',
        'Live preview and per-file progress that survives unreadable images',
    ],
    'scan': [
        'Auto-crop, auto-levels and photocopy-style threshold for crisp scans',
        'Fix phone photos of whiteboards, documents and screenshots in seconds',
        'Export a clean PNG or a print-ready 300-DPI PDF',
    ],
    'sign': [
        'Draw your signature, place it anywhere on a PDF, optional date stamp',
        'Fully local — contracts never leave your machine',
        'Works with mouse, trackpad, stylus and touch',
    ],
    'receipts': [
        'Stack receipt photos into one tidy, print-ready PDF',
        'Order, rotate and re-shoot pages before export',
        'Perfect for expense reports — and nothing is uploaded',
    ],
    'ocr': [
        'On-device OCR (no cloud): extract vendor, date and totals from receipt photos',
        'Editable rows with expense categories and currency',
        'Export CSV or TSV straight into your spreadsheet',
    ],
    'qr': [
        'Generate QR codes with Wi-Fi / URL / email / phone / vCard presets',
        'Spec-correct escaping, selectable error-correction level, custom colors',
        'PNG + vector SVG export — and decode QRs from images too',
    ],
    'audio': [
        'Trim podcasts and voice notes with sample-accurate precision',
        'Fade in/out and one-click peak normalize',
        'Exports standard WAV; 100% offline',
    ],
    'invoice': [
        'Professional invoices and quotes with tax, totals and notes',
        'Print or save as PDF straight from the browser',
        'No account, no cloud — your numbers stay yours',
    ],
    'rename': [
        'Batch-rename with prefixes, suffixes and numbering',
        'Live preview before anything is written',
        'Sort, organize and download the results',
    ],
    'printprep': [
        'DPI advisor tells you the maximum sharp print size for any image',
        'Resize, rotate and prep images for the print shop',
        'Catch blurry prints before you pay for them',
    ],
    'pdfpages': [
        'Visual page thumbnails: drag to reorder, rotate or delete',
        'Extract selected pages, insert blank pages, merge multiple PDFs',
        'Rebuilt locally — your originals stay untouched',
    ],
    'textdiff': [
        'Compare two texts with word-level highlighting inside changed lines',
        'Similarity percentage and unified-diff export',
        'Handles code, contracts and prose alike',
    ],
    'textstats': [
        'Words, characters, sentences, reading and speaking time',
        'Flesch reading-ease with grade level, plus keyword density',
        'Live sentence-rhythm histogram',
    ],
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

REDIRECT_CSS = '''
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(900px 500px at 15% -10%, rgba(56,189,248,.16), transparent 60%),
                  radial-gradient(800px 500px at 110% 10%, rgba(167,139,250,.14), transparent 55%), #0b0f17;
      color: #e7ecf5; text-align: center; padding: 24px; }
    .tile { width: 76px; height: 76px; margin: 0 auto 18px; display: grid; place-items: center;
      font-size: 38px; border-radius: 20px;
      background: linear-gradient(135deg, rgba(56,189,248,.25), rgba(167,139,250,.25));
      border: 1px solid rgba(148,163,184,.25); }
    h1 { margin: 0 0 6px; font-size: 26px; }
    p { margin: 0 0 14px; color: #9fb0c8; }
    .btn { display: inline-block; margin-top: 8px; padding: 10px 18px; border-radius: 12px;
      text-decoration: none; font-weight: 600; color: #06121f;
      background: linear-gradient(135deg, #67e8f9, #a78bfa); }
    .spin { display: inline-block; width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(231,236,245,.25); border-top-color: #67e8f9;
      animation: s 0.8s linear infinite; vertical-align: -2px; margin-right: 6px; }
    @keyframes s { to { transform: rotate(360deg); } }
    small { color: #64748b; display: block; margin-top: 26px; }
    small a { color: #94a3b8; }
'''


def redirector(t):
    icon = t['icon'].replace('\ufe0f', '')
    url = f"{HUB}/{t['id']}.html"
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t['name']} — NavigatorsLab Tools</title>
<meta name="description" content="{t['tagline']} — free, open-source, 100% in your browser. Part of the NavigatorsLab Tools suite.">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url={url}">
<style>{REDIRECT_CSS}</style>
</head>
<body>
  <main>
    <div class="tile" aria-hidden="true">{icon}</div>
    <h1>{t['name']}</h1>
    <p>{t['tagline']}</p>
    <p><span class="spin" aria-hidden="true"></span>Opening on <strong>navigatorslab.com</strong>&hellip;</p>
    <a class="btn" href="{url}">Open {t['name']} now &rarr;</a>
    <small>Part of the free, open-source <a href="{HUB}/">NavigatorsLab Tools</a> suite &mdash; 15 tools, zero uploads.</small>
  </main>
  <script>location.replace('{url}');</script>
</body>
</html>
'''


def readme(t, all_tools):
    icon = t['icon'].replace('\ufe0f', '')
    tool_url = f"{HUB}/{t['id']}.html"
    feats = '\n'.join(f'- {f}' for f in FEATURES[t['id']])
    rows = []
    for x in all_tools:
        xi = x['icon'].replace('\ufe0f', '')
        name = f"**{xi} {x['name']}**" if x['id'] == t['id'] else f"{xi} {x['name']}"
        rows.append(f"| {name} | {x['tagline']} | [Open]({HUB}/{x['id']}.html) |")
    suite = '\n'.join(rows)
    return f'''# {icon} {t['name']}

> {t['tagline']}

<h4 align="center">
  &#9654; <a href="{tool_url}">Open {t['name']} &mdash; free, no sign-up, nothing uploaded</a><br>
  <a href="{HUB}/">Browse all 15 NavigatorsLab Tools</a>
</h4>

![{t['name']}](og.png)

{t['detail']}

## \u2705 What it does

{feats}

## \U0001f512 Private by design

- **100% on-device** \u2014 files are processed in your browser and **never uploaded** to any server
- **No accounts, no tracking, no cookies** \u2014 open the page and work
- **Works offline** once loaded; fully mobile-friendly
- **Free & open source (MIT)** \u2014 use it at home, at work, anywhere

## \U0001f916 Built for humans *and* AI agents

- Every tool is deep-linkable via URL parameters \u2014 see the [Agent Mode guide]({HUB}/agents.html)
- Machine-readable catalog: [{HUB}/llms.txt]({HUB}/llms.txt) \u00b7 MCP endpoint: `{HUB}/mcp` (see the [main repo]({MAIN_REPO}))
- No build step required to *use* any tool \u2014 just the URL

## \U0001f5c2 The NavigatorsLab Tools suite

Fifteen free tools, one hub \u2014 all with the same zero-upload promise:

| Tool | What it does | |
|---|---|---|
{suite}

---

<p align="center">
  <b>One hub, fifteen tools:</b> <a href="{HUB}/">{HUB}</a><br>
  <b>Source &amp; the whole suite:</b> <a href="{MAIN_REPO}">{MAIN_REPO}</a>
</p>
'''


def main():
    tools = json.load(io.open(os.path.join(ROOT, 'public', 'tools.json'), encoding='utf-8'))
    assert len(tools) == 15, f'expected 15 tools, got {len(tools)}'
    for t in tools:
        slug = SLUGS[t['id']]
        d = os.path.join(OUT, slug)
        os.makedirs(d, exist_ok=True)
        io.open(os.path.join(d, 'index.html'), 'w', encoding='utf-8', newline='\n').write(redirector(t))
        io.open(os.path.join(d, 'README.md'), 'w', encoding='utf-8', newline='\n').write(readme(t, tools))
        io.open(os.path.join(d, 'LICENSE'), 'w', encoding='utf-8', newline='\n').write(LICENSE)
        io.open(os.path.join(d, '.nojekyll'), 'w', encoding='utf-8', newline='\n').write('')
        og = os.path.join(ROOT, 'public', f"og-{t['id']}.png")
        shutil.copyfile(og, os.path.join(d, 'og.png'))
        io.open(os.path.join(d, 'topics.txt'), 'w', encoding='utf-8', newline='\n').write(
            ' '.join([t['id']] + TOPICS[t['id']] + COMMON_TOPICS) + '\n')
        print(f"gen {slug:32s} <- {t['icon']} {t['name']}")
    print('done:', OUT)


if __name__ == '__main__':
    main()
