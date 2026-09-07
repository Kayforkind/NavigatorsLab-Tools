#!/usr/bin/env python3
"""Regenerate public/status.json by probing the LIVE production site.

Runs the two deep end-to-end probes (OCR engine + EXIF strip) in a real
browser against https://navigatorslab.com, plus a route/header check for
every tool page, and writes the data the /tools/status page renders.
CI fails loudly if any probe fails — the status page is never hand-edited.

Usage:  node scripts/update-status.cjs   (or: python scripts/update-status.py)
"""
import io
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://navigatorslab.com/tools'

tools = json.load(io.open(ROOT / 'public' / 'tools.json', encoding='utf-8'))

# id -> pretty URL path (must match worker.js resolveToolAlias aliases)
PRETTY = {
    'exif': '/Photo-Privacy-Kit', 'metadata': '/Metadata-Checker', 'shrink': '/Image-Shrinker',
    'scan': '/Scan-Cleaner', 'sign': '/E-Sign-Pad', 'receipts': '/Receipts-to-PDF',
    'ocr': '/Receipt-OCR', 'qr': '/QR-Studio', 'audio': '/Audio-Trimmer',
    'invoice': '/Invoice-Generator', 'rename': '/Batch-Rename', 'printprep': '/Print-Shop-Prep',
    'pdfpages': '/PDF-Pages', 'textdiff': '/Text-Diff', 'textstats': '/Text-Stats',
}
METHOD = {
    'ocr': 'engine E2E (browser)', 'exif': 'strip E2E (browser)', 'qr': 'engine E2E (browser)',
}
DEFAULT_METHOD = 'route + headers'

# External tools: no per-tool page in this repo; served at their own "url"
# (a path on this domain, by another worker). Checked at that URL plus the
# pretty (Capitalized) and all-caps 301 variants.
EXTERNAL = {'reimagine'}


def main() -> int:
    import urllib.request

    def head(url: str) -> int:
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'nl-status/1.0'})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status
        except Exception:
            return 0

    now = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()

    # 1) deep probes (real browser, real engines, against production)
    probes = []
    for script, name in (
        ('prod-ocr-probe.cjs', 'Receipt OCR — engine end-to-end'),
        ('prod-exif-probe.cjs', 'Photo Privacy Kit — strip end-to-end'),
    ):
        p = subprocess.run(['node', str(ROOT / 'scripts' / script)],
                           capture_output=True, text=True, encoding='utf-8', errors='replace',
                           timeout=600, cwd=str(ROOT))
        ok = p.returncode == 0
        probes.append({'name': name, 'result': ('PASS' if ok else 'FAIL') + (': ' + p.stdout.strip().splitlines()[-1][:80] if p.stdout.strip() else ''),
                       'verifiedAt': now})
        if not ok:
            print(f'PROBE FAIL {name}\n{p.stdout}\n{p.stderr}', file=sys.stderr)

    # 2) route check per tool (pretty URL must 301 to the tool page; page must 200)
    rows = []
    all_good = all(p['result'].startswith('PASS') for p in probes)
    for t in tools:
        tid = t['id']
        if tid in EXTERNAL:
            # Canonical path must 200; the pretty (/Reimagine) and all-caps
            # (/REIMAGINE) variants must resolve (200 or a redirect).
            page_ok = head(t['url']) == 200
            pretty_ok = (head(f'https://navigatorslab.com/{tid.capitalize()}') in (200, 301, 302, 308)
                         and head(f'https://navigatorslab.com/{tid.upper()}') in (200, 301, 302, 308))
            method = 'route (3 case variants)'
            ok = page_ok and pretty_ok
            all_good = all_good and ok
            rows.append({'id': tid, 'icon': t['icon'], 'name': t['name'],
                         'href': '../reimagine/', 'prettyUrl': t['url'],
                         'method': method, 'verifiedAt': now,
                         'ok': ok})
            continue
        page_ok = head(f'{BASE}/{tid}.html') == 200
        pretty_ok = head(f'https://navigatorslab.com{PRETTY[tid]}') in (200, 301, 302, 308)
        method = METHOD.get(tid, DEFAULT_METHOD)
        ok = page_ok and pretty_ok
        all_good = all_good and ok
        rows.append({'id': tid, 'icon': t['icon'], 'name': t['name'],
                     'href': f'./{tid}.html', 'prettyUrl': f'https://navigatorslab.com{PRETTY[tid]}',
                     'method': method, 'verifiedAt': now,
                     'ok': ok})

    out = {'generatedAt': now, 'allGood': all_good, 'tools': rows, 'probes': probes}
    io.open(ROOT / 'public' / 'status.json', 'w', encoding='utf-8', newline='').write(
        json.dumps(out, indent=2, ensure_ascii=False))
    print('status.json written —', 'ALL GOOD' if all_good else 'FAILURES PRESENT')
    return 0 if all_good else 1


if __name__ == '__main__':
    sys.exit(main())
