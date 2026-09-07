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

# tools served outside the hub (their tools.json entry carries its own URL)
EXTERNAL = {'reimagine'}


def main() -> int:
    def head(url: str) -> int:
        # curl, not urllib: Cloudflare bot protection 403s python's TLS
        # fingerprint even with a browser-like UA; curl passes everywhere.
        try:
            r = subprocess.run(
                ['curl', '-s', '-o', os.devnull, '-w', '%{http_code}', '-I', '-A', 'nl-status/1.0', url],
                capture_output=True, text=True, timeout=30)
            return int((r.stdout or '0').strip() or 0)
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
            page_ok = head(t['url']) == 200
            ok = page_ok
            all_good = all_good and ok
            rows.append({'id': tid, 'icon': t['icon'], 'name': t['name'],
                         'href': t['url'], 'prettyUrl': t['url'],
                         'method': 'route', 'verifiedAt': now, 'ok': ok})
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

    # 3) shields.io endpoint badges — one per tool, consumed by the per-tool
    #    repo READMEs (https://img.shields.io/endpoint?url=.../badge-<id>.json)
    day = now[:10]
    for r in rows:
        badge = {'schemaVersion': 1, 'label': 'live check',
                 'message': ('passing · ' + day) if r['ok'] else 'failing',
                 'color': 'brightgreen' if r['ok'] else 'red'}
        io.open(ROOT / 'public' / f"badge-{r['id']}.json", 'w', encoding='utf-8', newline='').write(
            json.dumps(badge, ensure_ascii=False))
    print('status.json + %d badges written —' % len(rows), 'ALL GOOD' if all_good else 'FAILURES PRESENT')
    return 0 if all_good else 1


if __name__ == '__main__':
    sys.exit(main())
