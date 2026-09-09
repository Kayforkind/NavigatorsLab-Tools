import io, json

# ---------- read ----------
tools = json.load(io.open('public/tools.json', encoding='utf-8'))
by = {t['id']: t for t in tools}

# ---------- long-form content per tool ----------
D = {
'exif': {
 'about': 'Posting vacation photos can leak more than a view. Most phone and camera files carry an invisible EXIF block: the GPS coordinates where you stood, the camera and lens you used, a capture timestamp, sometimes an embedded thumbnail of the <em>original</em> — before you cropped it. Photo Privacy Kit reads that block byte-by-byte, shows you every field it found, and writes a clean copy with the privacy-sensitive segments removed — while a SHA-256 fingerprint and a pixel-level comparison prove the picture itself is untouched.',
 'features': [
  'Full leak report before anything is removed — GPS coordinates, camera & lens, timestamps, software, embedded thumbnails',
  'One-click clean copy: EXIF (incl. GPS), XMP, IPTC and JPEG comments stripped; pixels never re-encoded',
  'SHA-256 fingerprints + pixel comparison prove the clean file is the same picture, minus the data',
  'Paste screenshots directly (Ctrl/Cmd+V) or drop files — batch friendly',
  'Works on JPEG, PNG and WebP, and tells you honestly when a format has no EXIF layer',
  'Embedded-thumbnail check catches the classic leak: cropped screenshots that still contain the original',
 ],
 'howto': [
  'Drop a photo (or paste a screenshot with Ctrl/Cmd+V)',
  'Read the leak report: GPS, camera, timestamps, thumbnails — flagged red before you post',
  'Hit <b>strip &amp; download</b> — the SHA-256 fingerprint proves pixels are unchanged',
 ],
 'tech': 'Hand-written JPEG/PNG/WebP segment parsers operating on raw bytes — no library touches your pixels, nothing re-encodes. Stripping is verified by an automated browser test that plants GPS data and asserts the downloaded file has no EXIF segment at all.',
 'goodFor': 'Anyone posting photos publicly: parents, travelers, marketplace sellers, journalists, developers sharing bug-report screenshots.',
},
'metadata': {
 'about': 'Documents carry more than their content. A PDF quietly records the author\'s name and the software used; a Word file keeps a revision history and the total editing time; a spreadsheet may embed the company name and author of every comment. Metadata &amp; Hidden-Data Checker opens the file structure locally — EXIF, IPTC, XMP for images; the Info dictionary <em>and</em> XMP for PDFs; the full OOXML package for Office files; ODF for .odt — and shows you exactly what an interested party would see, before offering a cleaned copy where the format allows.',
 'features': [
  'Deep PDF inspection: Info dictionary (title, author, producer, dates) <em>and</em> XMP metadata stream',
  'OOXML (docx/xlsx/pptx) and ODF (odt): authors, revision history, editing time, custom properties, thumbnails',
  'Full EXIF / IPTC / XMP dump for images, including embedded thumbnails',
  'Shown first, stripped second — nothing is removed before you have read it',
  'Cleaned copies exported locally where the format allows',
 ],
 'howto': [
  'Drop any file: PDF, Word, Excel, PowerPoint, image, .odt…',
  'Read the hidden-data report, section by section — exactly what a recipient would see',
  'Export a cleaned copy where the format allows',
 ],
 'tech': 'pdf-lib for PDF Info + XMP; zip central-directory parsing plus XML rewriting for OOXML/ODF; hand-written EXIF readers for images. Everything parses locally in the page.',
 'goodFor': 'Lawyers, HR, journalists and consultants sending documents externally; anyone curious what their files say behind their back.',
},
'shrink': {
 'about': '“Attachment exceeds maximum file size.” The portal wants 2&nbsp;MB; your scan is 16. Instead of guessing at a quality slider, Image Shrinker binary-searches the JPEG/WebP/AVIF quality space and lands <em>under your exact target</em> — typically a few hundred KB under, because nobody wants 1.99&nbsp;MB. Batch mode takes a folder of images, shows per-file progress (and survives unreadable files), and hands you one ZIP.',
 'features': [
  'Exact size targets: type “under 300 KB” and get 294 KB — binary-searched quality, not guesswork',
  'JPEG, WebP and AVIF output formats',
  'Batch processing with per-file progress that survives broken images',
  'One-click ZIP download of the whole batch',
  'Live preview so you can see quality before committing',
 ],
 'howto': [
  'Drop a batch of images',
  'Type the target: “under 300 KB” (or 2 MB, or a percentage)',
  'Watch per-file progress; download the results as one ZIP',
 ],
 'tech': 'Canvas re-encode with binary search over encoder quality. The E2E suite feeds a 16&nbsp;MB fixture and asserts the downloaded file is ≤ 300&nbsp;KB — every release, on every push.',
 'goodFor': 'Job portals, visa applications, government forms, email attachments, CMS upload limits — anywhere a hard size limit meets a big file.',
},
'scan': {
 'about': 'A three-page contract photographed on a gray desk, slightly rotated, unevenly lit. Scan &amp; Screenshot Cleaner fixes all of it on-device: content-aware auto-crop, auto-straighten that searches ±4° for the best alignment, automatic levels for even lighting, and an optional photocopy threshold that turns photos into crisp black-and-white text. Stack multiple pages and export one clean 300-DPI PDF.',
 'features': [
  'Auto-crop finds the page edges; drag to fine-tune with fit-to-view magnifier',
  'Auto-straighten searches ±4° content-aware; auto-levels normalizes lighting',
  'Photocopy threshold mode turns photos into crisp black-and-white text',
  'Multi-page: stack, reorder, rotate; export one print-ready 300-DPI PDF',
 ],
 'howto': [
  'Photograph the document with your phone',
  'Auto-straighten, auto-levels, threshold — or adjust the crop yourself',
  'Export PNG or a 300-DPI PDF with all pages',
 ],
 'tech': 'Canvas pixel operations (deskew search, auto-levels, thresholding) plus pdf-lib for the PDF. The crop-drag interaction is regression-tested to land exactly where you drew it.',
 'goodFor': 'Students digitizing notes, tenants scanning leases, anyone feeding printed documents into email or fax portals.',
},
'sign': {
 'about': '“Sign and send back tonight.” No printer, no scanner, no DocuSign subscription — 11pm. Local E-Sign Pad opens your PDF, lets you draw the signature with a finger or mouse (or type it in a handwriting style), click to place it anywhere on the page, optionally caption it with the date, and flatten it into the document. The output is a normal PDF whose pages now simply contain the ink — no editable form fields, no watermark, no third-party service.',
 'features': [
  'Draw (mouse / trackpad / stylus / touch) or type a signature',
  'Click to place anywhere, drag to adjust; optional dated caption under the ink',
  'Flattened into the page — renders identically in every viewer, nothing editable left behind',
  'The PDF never leaves the machine — contracts stay on-device',
 ],
 'howto': [
  'Open the PDF',
  'Draw or type the signature, click to place it on the page',
  'Download the flattened, signed PDF',
 ],
 'tech': 'pdf-lib draws the signature image (and caption) directly into the page resources; the preview is a pdf.js render. An automated test asserts the signature image is present in the PDF\'s resources and that the flattened file has no signature form field.',
 'goodFor': 'Leases, NDAs, permission slips, delivery confirmations, HR forms — anywhere someone says “sign and send back tonight”.',
},
'receipts': {
 'about': 'The shoebox of receipt photos at tax time. Receipts → One PDF takes the whole pile, reads each photo\'s EXIF capture date, orders the pages chronologically, and stamps every page with its date and filename — so the printout reads like a ledger instead of a shuffle. Rotate, re-shoot or remove pages before export; one click produces the PDF.',
 'features': [
  'Stack unlimited receipt photos into one tidy, print-ready PDF',
  'Auto-ordered by EXIF date taken — the shoebox sorts itself',
  'Every page stamped with capture date and filename',
  'Rotate and re-shoot pages before export',
 ],
 'howto': [
  'Drop the shoebox of receipt photos',
  'They sort themselves by EXIF date — rotate anything that needs it',
  'Export one stamped PDF for the accountant',
 ],
 'tech': 'EXIF capture-date extraction per file plus pdf-lib assembly. The E2E run drops three receipts with staggered dates and asserts the stamped page order.',
 'goodFor': 'Freelancers, landlords and small businesses assembling expense documentation; anyone whose accountant asks for “all receipts, one file”.',
},
'ocr': {
 'about': 'Twelve crumpled receipts, one expense spreadsheet, zero motivation. Receipt OCR → CSV reads each receipt photo with a full Tesseract engine compiled to WebAssembly — running entirely on your device, with the ~24&nbsp;MB engine downloaded once from this same site and then cached for offline use. Totals, dates and vendor lines are parsed into editable rows with expense categories, currency, and a confidence flag on anything the engine wasn\'t sure about — fix a misread, then export expenses.csv for Excel or Google Sheets.',
 'features': [
  'Real OCR on-device: Tesseract WASM, self-hosted same-origin — no third party sees your receipts',
  'Totals, dates and vendors parsed into editable rows',
  'Expense categories, currency, and confidence flags on uncertain reads',
  'Per-file recovery: one bad image doesn\'t kill the batch',
  'CSV / TSV export for Excel or Google Sheets',
 ],
 'howto': [
  'Drop receipt photos',
  'The on-device engine reads vendor, date and total into rows',
  'Fix anything misread, export the CSV for your spreadsheet',
 ],
 'tech': 'tesseract.js with a self-hosted WASM core and English model, fetched same-origin and cached by the service worker. The production probe builds a receipt in-browser, OCRs it on the live site, and asserts the parsed total.',
 'goodFor': 'Expense reports, tax preparation, bookkeeping without a scanner app subscription.',
},
'qr': {
 'about': 'A guest asks for the Wi-Fi; a generator site would happily log that password. QR Studio generates QR codes from text, URLs, Wi-Fi credentials (with spec-correct escaping), email, phone and vCard presets — with selectable error correction, custom colors and a spec quiet zone — exporting crisp PNG or true vector SVG. It also decodes: drop any QR image and the bundled jsQR engine reads it locally. Round-trip is proven: encode → export → decode returns the exact payload, character for character.',
 'features': [
  'Generate with Wi-Fi (spec-escaped), URL, email, phone and vCard presets',
  'Selectable error correction (L/M/Q/H), custom foreground/background colors, spec quiet zone',
  'PNG (crisp, nearest-neighbor) and true vector SVG export',
  'Decode QR images locally with bundled jsQR — nothing uploaded',
  'Encode → export → decode round-trip verified in CI and on production',
 ],
 'howto': [
  'Type text or pick the Wi-Fi / URL / vCard preset',
  'Tune colors and error correction',
  'Export PNG or SVG — or decode an existing QR image',
 ],
 'tech': 'qrcode-generator and jsQR, both bundled into the page — zero network calls, even for the decode path.',
 'goodFor': 'Wi-Fi sharing, event posters, business cards, payment links, ticket payloads — anywhere you need a QR without a tracking-riddled generator.',
},
'audio': {
 'about': 'A 40-minute voice note with 30 seconds you actually need. Audio Trimmer decodes the file with the Web Audio API, draws the waveform, and lets you drag a selection with sample-accurate edges — add fade in/out and one-click peak normalize, then export WAV or MP3 (encoded by a self-hosted LAME). Everything happens in the tab: the audio never touches a server.',
 'features': [
  'Waveform editor with sample-accurate drag selection',
  'Fade in / fade out with adjustable lengths',
  'One-click peak normalize',
  'WAV export and MP3 export (self-hosted LAME, LGPL — see NOTICE)',
  'Batch-friendly: process several clips in one session',
 ],
 'howto': [
  'Drop a voice note or audio clip',
  'Drag the selection on the waveform, add fades / normalize',
  'Export WAV or MP3',
 ],
 'tech': 'Web Audio API for decode, trim, fades and normalization; lamejs (self-hosted, LGPL) for MP3 export — its bytes are validated by an E2E check (ID3/frame-sync headers) on every release.',
 'goodFor': 'Voice notes, podcast intros, interview clips, ringtones, language-learning snippets.',
},
'invoice': {
 'about': 'One-person shops don\'t need a SaaS subscription to bill for Tuesday\'s hours. The Invoice / Quote Generator builds a professional invoice or quote with line items, per-item tax handling on the discounted subtotal, global discount, notes and totals — with a live preview that mirrors the PDF exactly, because the preview <em>is</em> the PDF renderer. Two templates, five currencies, no account.',
 'features': [
  'Line items, tax on the discounted subtotal, global discount, notes',
  'Two templates, five currencies',
  'Live preview mirrors the PDF exactly — the preview is the PDF renderer',
  'Print or save the PDF directly',
 ],
 'howto': [
  'Fill in hours, rates and line items',
  'Pick a template, currency, tax and discount',
  'Print or save the PDF',
 ],
 'tech': 'pdf-lib rendering with exact-pt layout; the E2E run fills line items and asserts the exported PDF contains the exact total ($408.00).',
 'goodFor': 'Freelancers, tutors, contractors, small agencies — anyone invoicing without a subscription.',
},
'rename': {
 'about': 'IMG_5847.jpg, IMG_5848.jpg… a camera\'s idea of a filing system. Batch Rename &amp; Sort reads each file\'s EXIF capture date and rewrites names into something meaningful — <code>2026-09-05-receipt-home-depot.jpg</code> — with your prefix, suffix and a sequence number. Everything is previewed live before anything happens, and the renamed files arrive as one ZIP.',
 'features': [
  'EXIF-dated batch renaming: IMG_5847.jpg → 2026-09-05-receipt-home-depot.jpg',
  'Prefix, suffix and sequence start, previewed live',
  'Files that lack EXIF dates fall back to modified time — nothing skipped',
  'Download the organized files as one ZIP',
 ],
 'howto': [
  'Drop the files',
  'Set the EXIF-date pattern, prefix, suffix, sequence',
  'Preview the mapping, then download the ZIP',
 ],
 'tech': 'EXIF capture dates + client-side ZIP (JSZip). The E2E run drops date-staggered files and asserts the renamed entries inside the ZIP.',
 'goodFor': 'Photos from events, receipts for bookkeeping, document scans, download folders with a thousand “final_v2” files.',
},
'printprep': {
 'about': 'You paid for 300 prints; the lab\'s low-DPI warning shows up after. Print-Shop Prep checks <em>before</em> you pay: pick the physical size (4×6, 5×7, Letter, A4…), and the DPI advisor reports the maximum sharp print size for your image — warning you before a blurry print costs money. Export produces a PDF whose MediaBox is the exact physical size, with optional bleed, at true 300 DPI.',
 'features': [
  'DPI advisor: maximum sharp print size for any image, before you pay',
  '4×6, 5×7, Letter, A4 and custom sizes at true 300 DPI',
  'MediaBox at the exact physical size, optional bleed',
  'Print-ready PDF export',
 ],
 'howto': [
  'Drop an image',
  'Pick the physical size: 4×6, A4, Letter…',
  'Read the DPI verdict, export the print-ready PDF',
 ],
 'tech': 'Exact DPI math plus pdf-lib MediaBox at true physical size. The E2E run asserts MediaBox = 306&nbsp;pt (4.25&nbsp;in) on the exported PDF.',
 'goodFor': 'Photo prints, posters, framed gifts, lab submissions — anywhere “300 DPI” meets your camera roll.',
},
'pdfpages': {
 'about': 'A 40-page packet where pages 7–9 are upside down and two pages don\'t belong. PDF Pages shows every page as a thumbnail you can drag to reorder, rotate, or delete; extract a selection into a new PDF, insert blank pages, or merge several documents. The PDF is rebuilt locally with pdf-lib — originals stay untouched, and the download is a fresh, valid PDF.',
 'features': [
  'Visual thumbnails: drag to reorder, rotate, delete',
  'Extract selected pages, insert blank pages',
  'Merge multiple PDFs into one',
  'Rebuilt locally with pdf-lib — originals untouched',
 ],
 'howto': [
  'Drop one or more PDFs',
  'Drag thumbnails: reorder, rotate, delete, merge',
  'Download the rebuilt PDF',
 ],
 'tech': 'pdf.js renders the thumbnails; pdf-lib rebuilds the document. The E2E run reorders pages by drag and asserts the rebuilt page order.',
 'goodFor': 'Assembling scanned packets, deleting blank pages, rotating faxes, merging signed contracts, extracting one section to send.',
},
'textdiff': {
 'about': 'Two versions of an NDA, and the counterparty says “minor changes”. Text Diff compares them line by line with word-level highlights inside changed lines — so you see <em>exactly</em> which words moved, not just which paragraphs. Similarity percentage, whitespace/case sensitivity options, and a unified-diff export for the record.',
 'features': [
  'Word-level highlighting inside changed lines — not just line-level',
  'Similarity percentage',
  'Whitespace and case sensitivity options',
  'Unified-diff export',
 ],
 'howto': [
  'Paste both texts',
  'Read word-level highlights and the similarity %',
  'Export a unified diff',
 ],
 'tech': 'A custom longest-common-subsequence engine with intra-line word diffing — unit-tested directly, and asserted end-to-end with real contract text.',
 'goodFor': 'Contract review, code review snippets, essay drafts, changelog comparisons.',
},
'textstats': {
 'about': 'Is the essay within the word limit? Can the average reader get through it? Text Stats answers instantly: words, characters, sentences, reading and speaking time, Flesch reading-ease with grade level, keyword density, and a sentence-length rhythm histogram that shows whether your prose flows or plods.',
 'features': [
  'Words, characters, sentences, reading and speaking time — live as you type or paste',
  'Flesch reading-ease with grade level',
  'Keyword density table',
  'Sentence-length rhythm histogram',
 ],
 'howto': [
  'Paste the text',
  'Get words, Flesch grade and keyword density',
  'Watch the sentence-rhythm histogram',
 ],
 'tech': 'Pure TypeScript stats engine, unit-tested; no dependencies.',
 'goodFor': 'Students, writers, editors, marketers checking SEO keyword density.',
},
}

# reimagine keeps hub-style detail (it lives at its own URL)
by['reimagine']['about'] = ('Paste any HTML page and the engine rebuilds it in 17 directions — infographic, 3D, cinematic, '
 'dashboard, editorial and more — derived from the nouns, dates, numbers and colors already in your content. '
 'Nothing invented, nothing uploaded: the redesign runs entirely in your browser tab.')
by['reimagine']['features'] = [
  '17 redesign directions: infographic, 3D, cinematic, dashboard, editorial, magazine and more',
  'Content-derived: works from the words, dates, numbers and colors already in your page',
  'Nothing uploaded — the engine runs in your browser tab',
  'One-click copy of the rebuilt page',
]
by['reimagine']['howto'] = [
  'Open the Reimagine page',
  'Paste any HTML page',
  'Pick a direction and watch it rebuild',
]
by['reimagine']['tech'] = 'A content-extraction + layout engine in pure TypeScript with an optional Three.js path for 3D — no AI API, no upload.'
by['reimagine']['goodFor'] = 'Turning dense reports into visuals, restyling landing pages, exploring information design.'

CATLABEL = {
 'privacy': 'Privacy', 'documents': 'Documents', 'money': 'Money',
 'images': 'Images', 'media': 'Media', 'files': 'Files', 'design': 'Design',
}
ENGINE = {
 'exif': 'Byte-level EXIF / XMP / IPTC parsers', 'metadata': 'PDF + OOXML + ODF + EXIF readers',
 'shrink': 'Canvas + binary-search quality', 'scan': 'Canvas pixel ops + pdf-lib',
 'sign': 'pdf-lib flattening', 'receipts': 'EXIF dates + pdf-lib',
 'ocr': 'Tesseract WASM (self-hosted)', 'qr': 'qrcode-generator + jsQR',
 'audio': 'Web Audio + self-hosted LAME', 'invoice': 'pdf-lib',
 'rename': 'EXIF + JSZip', 'printprep': 'DPI math + pdf-lib',
 'pdfpages': 'pdf.js render + pdf-lib rebuild', 'textdiff': 'LCS diff engine',
 'textstats': 'Pure TypeScript stats', 'reimagine': 'Content-extraction layout engine',
}
VERIFY = {
 'exif': 'Stripped JPEG has no EXIF segment; pixels byte-identical',
 'metadata': 'Cleaned files re-inspected and shown clean',
 'shrink': '16 MB → ≤ 300 KB in downloaded bytes',
 'scan': 'Page count + crop size in output PDF',
 'sign': 'Ink present in PDF resources; no editable field left',
 'receipts': '3 stamped pages, EXIF-date order',
 'ocr': 'Parsed total matches a real receipt (prod probe)',
 'qr': 'Encode → decode round-trip, exact payload',
 'audio': 'WAV data chunk = exact selection; MP3 frame sync',
 'invoice': '$408.00 total in exported PDF',
 'rename': 'Renamed entries asserted inside the ZIP',
 'printprep': 'MediaBox = 306 pt (4.25 in)',
 'pdfpages': 'Page order & rotations in rebuilt PDF',
 'textdiff': 'Word-level spans asserted',
 'textstats': 'Counts & keyword table asserted',
 'reimagine': 'Redesign renders from content-derived data',
}

for t in tools:
    tid = t['id']
    d = D.get(tid)
    if d:
        t['about'] = d['about']
        t['features'] = d['features']
        t['howto'] = d['howto']
        t['tech'] = d['tech']
        t['goodFor'] = d['goodFor']
    t['catLabel'] = CATLABEL[t['category']]
    t['engine'] = ENGINE[tid]
    t['verified'] = VERIFY[tid]
    t['page'] = f"https://navigatorslab.com/tools/{tid}.html"
    t['prettyUrl'] = f"https://navigatorslab.com/{t['id']}" if False else t.get('prettyUrl')
    t.pop('prettyUrl', None)
    if tid != 'reimagine':
        # derive pretty slug from the PRETTY map used elsewhere (id → Pretty-Name)
        pretty = {
            'exif': 'Photo-Privacy-Kit', 'metadata': 'Metadata-Checker', 'shrink': 'Image-Shrinker',
            'scan': 'Scan-Cleaner', 'sign': 'E-Sign-Pad', 'receipts': 'Receipts-to-PDF',
            'ocr': 'Receipt-OCR', 'qr': 'QR-Studio', 'audio': 'Audio-Trimmer',
            'invoice': 'Invoice-Generator', 'rename': 'Batch-Rename', 'printprep': 'Print-Shop-Prep',
            'pdfpages': 'PDF-Pages', 'textdiff': 'Text-Diff', 'textstats': 'Text-Stats',
        }[tid]
        t['pretty'] = pretty

io.open('public/tools.json', 'w', encoding='utf-8', newline='').write(json.dumps(tools, indent=2, ensure_ascii=False))
print('enriched', len(tools), 'tools')
for t in tools:
    assert 'about' in t and 'features' in t, t['id']
print('all fields present')
