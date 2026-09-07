# Profile README update — inserts the per-tool funnel-repo section into
# Kayforkind/Kayforkind README.md. Idempotent: replaces the block between
# BEGIN/END markers if present, otherwise inserts after the "What I build"
# table's closing line (the "Also in the lab:" paragraph).
import io, json, os, sys, urllib.request

REPOS = {
  'exif': ('Photo Privacy Kit', 'NavigatorsLab-Photo-Privacy-Kit'),
  'metadata': ('Metadata & Hidden-Data Checker', 'NavigatorsLab-Metadata-Checker'),
  'shrink': ('Image Shrinker', 'NavigatorsLab-Image-Shrinker'),
  'scan': ('Scan & Screenshot Cleaner', 'NavigatorsLab-Scan-Cleaner'),
  'sign': ('Local E-Sign Pad', 'NavigatorsLab-E-Sign-Pad'),
  'receipts': ('Receipts → One PDF', 'NavigatorsLab-Receipts-to-PDF'),
  'ocr': ('Receipt OCR → CSV', 'NavigatorsLab-Receipt-OCR'),
  'qr': ('QR Studio', 'NavigatorsLab-QR-Studio'),
  'audio': ('Audio Trimmer', 'NavigatorsLab-Audio-Trimmer'),
  'invoice': ('Invoice / Quote Generator', 'NavigatorsLab-Invoice-Generator'),
  'rename': ('Batch Rename & Sort', 'NavigatorsLab-Batch-Rename'),
  'printprep': ('Print-Shop Prep', 'NavigatorsLab-Print-Shop-Prep'),
  'pdfpages': ('PDF Pages', 'NavigatorsLab-PDF-Pages'),
  'textdiff': ('Text Diff', 'NavigatorsLab-Text-Diff'),
  'textstats': ('Text Stats', 'NavigatorsLab-Text-Stats'),
}

BEGIN = '<!-- BEGIN:NAVIGATORSLAB-TOOL-REPOS -->'
END = '<!-- END:NAVIGATORSLAB-TOOL-REPOS -->'

section = f"""{BEGIN}
### 🧭 NavigatorsLab Tools — one repo per tool

Fifteen free, open-source (MIT) utilities that run **100% in your browser** — and now each has its own standalone repo. Every repo's README and GitHub Pages site funnel straight back to the hub at **[navigatorslab.com/tools](https://navigatorslab.com/tools/)**, where all fifteen live (plus an MCP endpoint for agents).

| Tool | Standalone repo | Try it |
|---|---|---|
| 🛡️ Photo Privacy Kit | [NavigatorsLab-Photo-Privacy-Kit](https://github.com/Kayforkind/NavigatorsLab-Photo-Privacy-Kit) | [Open](https://navigatorslab.com/tools/exif.html) |
| 🔍 Metadata & Hidden-Data Checker | [NavigatorsLab-Metadata-Checker](https://github.com/Kayforkind/NavigatorsLab-Metadata-Checker) | [Open](https://navigatorslab.com/tools/metadata.html) |
| 🗜️ Image Shrinker | [NavigatorsLab-Image-Shrinker](https://github.com/Kayforkind/NavigatorsLab-Image-Shrinker) | [Open](https://navigatorslab.com/tools/shrink.html) |
| 📄 Scan & Screenshot Cleaner | [NavigatorsLab-Scan-Cleaner](https://github.com/Kayforkind/NavigatorsLab-Scan-Cleaner) | [Open](https://navigatorslab.com/tools/scan.html) |
| ✍️ Local E-Sign Pad | [NavigatorsLab-E-Sign-Pad](https://github.com/Kayforkind/NavigatorsLab-E-Sign-Pad) | [Open](https://navigatorslab.com/tools/sign.html) |
| 🧾 Receipts → One PDF | [NavigatorsLab-Receipts-to-PDF](https://github.com/Kayforkind/NavigatorsLab-Receipts-to-PDF) | [Open](https://navigatorslab.com/tools/receipts.html) |
| 🔢 Receipt OCR → CSV | [NavigatorsLab-Receipt-OCR](https://github.com/Kayforkind/NavigatorsLab-Receipt-OCR) | [Open](https://navigatorslab.com/tools/ocr.html) |
| 🔳 QR Studio | [NavigatorsLab-QR-Studio](https://github.com/Kayforkind/NavigatorsLab-QR-Studio) | [Open](https://navigatorslab.com/tools/qr.html) |
| 🎧 Audio Trimmer | [NavigatorsLab-Audio-Trimmer](https://github.com/Kayforkind/NavigatorsLab-Audio-Trimmer) | [Open](https://navigatorslab.com/tools/audio.html) |
| 🧮 Invoice / Quote Generator | [NavigatorsLab-Invoice-Generator](https://github.com/Kayforkind/NavigatorsLab-Invoice-Generator) | [Open](https://navigatorslab.com/tools/invoice.html) |
| 🗂️ Batch Rename & Sort | [NavigatorsLab-Batch-Rename](https://github.com/Kayforkind/NavigatorsLab-Batch-Rename) | [Open](https://navigatorslab.com/tools/rename.html) |
| 🖨️ Print-Shop Prep | [NavigatorsLab-Print-Shop-Prep](https://github.com/Kayforkind/NavigatorsLab-Print-Shop-Prep) | [Open](https://navigatorslab.com/tools/printprep.html) |
| 📑 PDF Pages | [NavigatorsLab-PDF-Pages](https://github.com/Kayforkind/NavigatorsLab-PDF-Pages) | [Open](https://navigatorslab.com/tools/pdfpages.html) |
| 🔬 Text Diff | [NavigatorsLab-Text-Diff](https://github.com/Kayforkind/NavigatorsLab-Text-Diff) | [Open](https://navigatorslab.com/tools/textdiff.html) |
| 📊 Text Stats | [NavigatorsLab-Text-Stats](https://github.com/Kayforkind/NavigatorsLab-Text-Stats) | [Open](https://navigatorslab.com/tools/textstats.html) |

*The hub is the product: **[navigatorslab.com/tools](https://navigatorslab.com/tools/)** — zero uploads, zero accounts, nothing retained, and it speaks agent (MCP + deep links).*
{END}"""

def fetch_profile():
    req = urllib.request.Request(
        'https://api.github.com/repos/Kayforkind/Kayforkind/contents/README.md',
        headers={'Authorization': f"token {TOKEN}", 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    meta = fetch_profile()
    content = base64.b64decode(meta['content']).decode('utf-8')
    if BEGIN in content:
        pre = content.split(BEGIN)[0]
        post = content.split(END, 1)[1]
        content = pre + section + post
        print('replaced existing section')
    else:
        anchor = 'Also in the lab:'
        idx = content.find(anchor)
        assert idx != -1, 'anchor paragraph not found'
        # insert before the paragraph containing the anchor
        para_start = content.rfind('\n\n', 0, idx) + 2
        content = content[:para_start] + section + '\n\n' + content[para_start:]
        print('inserted new section')
    body = json.dumps({'message': 'Profile: add the 15 per-tool NavigatorsLab repos (funnel to navigatorslab.com)',
                       'content': base64.b64encode(content.encode('utf-8')).decode('ascii'),
                       'sha': meta['sha']})
    req = urllib.request.Request(
        'https://api.github.com/repos/Kayforkind/Kayforkind/contents/README.md',
        data=body.encode('utf-8'), method='PUT',
        headers={'Authorization': f"token {TOKEN}", 'Accept': 'application/vnd.github+json',
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        print('commit:', json.load(r)['commit']['sha'][:12])

if __name__ == '__main__':
    import base64
    TOKEN = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN') or ''
    if not TOKEN:
        sys.exit('GH_TOKEN not set')
    main()
