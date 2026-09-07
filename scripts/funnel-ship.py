# One-shot: create repos, push funnel/<slug> contents, set topics.
# qr-studio is already shipped — skipped via SHIPPED.
import io, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNNEL = os.path.join(ROOT, 'funnel')
OWNER = 'Kayforkind'

REPO = {
    'photo-privacy-kit': 'NavigatorsLab-Photo-Privacy-Kit',
    'metadata-hidden-data-checker': 'NavigatorsLab-Metadata-Checker',
    'image-shrinker': 'NavigatorsLab-Image-Shrinker',
    'scan-screenshot-cleaner': 'NavigatorsLab-Scan-Cleaner',
    'local-e-sign-pad': 'NavigatorsLab-E-Sign-Pad',
    'receipts-to-pdf': 'NavigatorsLab-Receipts-to-PDF',
    'receipt-ocr-to-csv': 'NavigatorsLab-Receipt-OCR',
    'qr-studio': 'NavigatorsLab-QR-Studio',
    'audio-trimmer': 'NavigatorsLab-Audio-Trimmer',
    'invoice-quote-generator': 'NavigatorsLab-Invoice-Generator',
    'batch-rename-and-sort': 'NavigatorsLab-Batch-Rename',
    'print-shop-prep': 'NavigatorsLab-Print-Shop-Prep',
    'pdf-pages': 'NavigatorsLab-PDF-Pages',
    'text-diff': 'NavigatorsLab-Text-Diff',
    'text-stats': 'NavigatorsLab-Text-Stats',
}
SHIPPED = {'qr-studio'}

tools = json.load(io.open(os.path.join(ROOT, 'public', 'tools.json'), encoding='utf-8'))
by_slug = {REPO[s]: t for s, t in ((k, v) for k, v in
           {'photo-privacy-kit': 'exif', 'metadata-hidden-data-checker': 'metadata',
            'image-shrinker': 'shrink', 'scan-screenshot-cleaner': 'scan',
            'local-e-sign-pad': 'sign', 'receipts-to-pdf': 'receipts',
            'receipt-ocr-to-csv': 'ocr', 'qr-studio': 'qr', 'audio-trimmer': 'audio',
            'invoice-quote-generator': 'invoice', 'batch-rename-and-sort': 'rename',
            'print-shop-prep': 'printprep', 'pdf-pages': 'pdfpages',
            'text-diff': 'textdiff', 'text-stats': 'textstats'}.items())}

def run(args, cwd=None, check=True):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print('FAIL:', ' '.join(args), '\nSTDOUT:', r.stdout, '\nSTDERR:', r.stderr)
        sys.exit(1)
    return (r.stdout + r.stderr).strip()

for slug, name in REPO.items():
    if slug in SHIPPED:
        print('skip (shipped):', name)
        continue
    d = os.path.join(FUNNEL, slug)
    t = tools[[x['id'] for x in tools].index(by_slug[name])]
    desc = (f"NavigatorsLab - {t['name']}: {t['tagline']} \u2014 free, open-source, "
            f"100% in your browser. Part of the 15-tool NavigatorsLab Tools suite.")
    home = f"https://navigatorslab.com/tools/{t['id']}.html"
    url = f'https://github.com/{OWNER}/{name}'

    out = run(['gh', 'repo', 'create', name, '--public', '--description', desc,
               '--homepage', home], check=False)
    print('create:', name, '->', out.splitlines()[-1] if out else '?')

    run(['git', 'init', '-b', 'main'], cwd=d)
    run(['git', 'add', '-A'], cwd=d)
    run(['git', '-c', 'user.name=Kazim', '-c', 'user.email=kazim.r.merchant@gmail.com',
         'commit', '-m',
         'NavigatorsLab - ' + t['name'] + ': funnel repo — tool lives on navigatorslab.com\n'
         '\nFree, open-source (MIT). The tool itself runs at ' + home +
         ' alongside the other 14 suite tools. Nothing here processes files: the hub does, entirely on-device.\n'
         '\n\U0001F916 Generated with Codebuff'
         '\nCo-Authored-By: Codebuff <noreply@codebuff.com>'], cwd=d)
    run(['git', 'remote', 'add', 'origin', url + '.git'], cwd=d)
    run(['git', 'push', '-u', 'origin', 'main'], cwd=d)
    topics = io.open(os.path.join(d, 'topics.txt'), encoding='utf-8').read().split()
    run(['gh', 'repo', 'edit', f'{OWNER}/{name}', '--add-topic', ','.join(topics)])
    print('pushed + topics:', name, f'({len(topics)} topics)')

print('ALL DONE')
