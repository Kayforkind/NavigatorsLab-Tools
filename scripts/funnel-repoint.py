# One-shot: re-push regenerated funnel content to the 15 existing per-tool
# repos (redirector now shows the pretty URL, README links it too).
import io, os, subprocess, sys

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

def run(args, cwd=None, check=True):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print('FAIL:', ' '.join(args), '\nSTDOUT:', r.stdout, '\nSTDERR:', r.stderr)
        sys.exit(1)
    return (r.stdout + r.stderr).strip()

failed = []
for slug, name in REPO.items():
    d = os.path.join(FUNNEL, slug)
    try:
        run(['git', 'add', '-A'], cwd=d)
        dirty = run(['git', 'status', '--porcelain'], cwd=d)
        if not dirty:
            print('clean (skip):', name)
            continue
        run(['git', '-c', 'user.name=Kazim', '-c', 'user.email=noreply@navigatorslab.com',
             'commit', '-m',
             'Point to the pretty URL: navigatorslab.com/<Tool-Name>\n\n'
             'The hub now serves root-level 301s for every tool, so the redirector\n'
             'and README advertise the short link (which lands on the same tool).\n'
             '\n\U0001F916 Generated with Codebuff'
             '\nCo-Authored-By: Codebuff <noreply@codebuff.com>'], cwd=d)
        run(['git', 'push', 'origin', 'main'], cwd=d)
        print('pushed:', name)
    except SystemExit:
        failed.append(name)

if failed:
    print('FAILED:', failed)
    sys.exit(1)
print('ALL DONE')
