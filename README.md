# 🧭 NavigatorsLab Tools

**Ten free, open-source tools that run 100% in your browser.** No accounts. No uploads. No watermarks. No limits.
We do **not** keep attachments, files, or user information — nothing you drop into a tool is ever sent to a server, stored, or logged. Your files stay on your device, processed by your own browser.

**Live suite → https://navigatorslab.com/tools/**

| | Tool | What it solves |
|---|------|----------------|
| 🛡️ | [Photo Privacy Kit](#-photo-privacy-kit) | Strip GPS, camera model and timestamps before posting |
| 🗜️ | [Image Shrinker](#-image-shrinker) | Hit "this portal only accepts 2 MB" limits without TinyPNG |
| 📄 | [Scan & Screenshot Cleaner](#-scan--screenshot-cleaner) | Phone photos of documents → clean, straight PDFs |
| ✍️ | [Local E-Sign Pad](#-local-e-sign-pad) | Draw or type a signature, stamp it on a PDF, flatten, done |
| 🧾 | [Receipts → One PDF](#-receipts--one-pdf) | Shoebox of receipt photos → one date-sorted PDF |
| 🔍 | [Metadata & Hidden-Data Checker](#-metadata--hidden-data-checker) | See what's really inside a file — then strip it |
| 🎧 | [Audio Trimmer](#-audio-trimmer) | Cut voice notes and clips on a waveform → WAV/MP3 |
| 🧮 | [Invoice / Quote Generator](#-invoice--quote-generator) | One-person shops: hours in, clean PDF invoice out |
| 🗂️ | [Batch Rename & Sort](#-batch-rename--sort) | `IMG_5847.jpg` → `2026-09-05-receipt-home-depot.jpg` |
| 🖨️ | [Print-Shop Prep](#-print-shop-prep) | Exact sizes, bleed, DPI checks, print-ready PDF |

Companion project: **[PDF Studio](https://github.com/Kayforkind/NavigatorsLab-PDF-Studio)** — the full in-browser PDF editor (edit PDF text in place, OCR, forms, AI).

---

## The privacy model is the architecture, not a promise

Every tool is a static page with client-side JavaScript. There is no backend to receive your files. Open your browser's network tab while using any tool and watch it stay silent after load. Concretely:

- ❌ **No attachments kept** — files never leave your machine; nothing is transmitted, retained, or backed up
- ❌ **No user information kept** — no accounts, no emails, no cookies for tracking, no analytics, no fingerprinting
- ❌ No server-side processing, no queues, no "your file was deleted after 1 hour" fine print (there is nothing to delete)
- ✅ Works offline once loaded · ✅ MIT licensed · ✅ free forever, no premium tier

---

## 🛡️ Photo Privacy Kit

**The problem:** your vacation photo contains the GPS coordinates of your hotel — or your home. Phones embed latitude/longitude, the exact camera model, and the precise timestamp into every JPEG.

**How it works:** drop one or a hundred photos. Each is scanned locally with a byte-level EXIF parser that reads the JPEG APP1 segment; GPS coordinates are decoded from degrees-minutes-seconds rationals, camera and dates from the IFD chains. Stripping rewrites the JPEG by removing every APP1 Exif segment while keeping the image data byte-identical — no re-encode, zero quality loss.

**Verified example (this exact run):** a fixture photo tagged at 41.0°N 29.0°E with camera "NavCam Pixel 99" was scanned → GPS leak flagged → stripped → the 67.9 KB output JPEG contains no APP1 segment at all.

![Photo Privacy Kit](docs/shots/01-privacy-kit.png)

- Bulk: drop the whole camera folder, get one ZIP of clean copies
- GPS detected? The file is flagged red before you export anything
- Non-JPEG formats pass through untouched (no wasteful re-compression)

## 🗜️ Image Shrinker

**The problem:** "This portal only accepts files up to 2 MB." Every online compressor wants your photo uploaded to their servers first.

**How it works:** the image is decoded in your browser to canvas pixels, optionally downscaled to your max width, then binary-searched across JPEG/WebP quality levels — 8 iterations of encode-and-measure — until the output lands **under your exact target size**. PNG (lossless, no quality knob) is handled by progressive downscaling until it fits.

**Verified example:** a ~16 MB 4000×3000 PNG was compressed to a **297 KB JPEG under a 300 KB target**, downloaded as `big-photo-shrunk.jpg`.

![Image Shrinker](docs/shots/02-shrinker.png)

- Target-size mode: "make it ≤ 500 KB" — done
- Quality-slider mode when you just want "smaller, same format"
- Converts JPG ↔ PNG ↔ WebP; HEIC works wherever your browser decodes it

## 📄 Scan & Screenshot Cleaner

**The problem:** you photographed a 3-page contract with your phone. It's crooked, grayish, and 8 MB per page.

**How it works:** each photo becomes a canvas page. Auto-straighten estimates skew by correlating column darkness profiles across a ±4° search and rotates to cancel it. Grayscale uses proper luma weights (0.299/0.587/0.114); contrast uses the classic factor formula. Pages stack into a single PDF at ~150 DPI via pdf-lib — text stays selectable-image-free, pages sized to the content.

**Verified example:** two receipt photos → grayscale + contrast 40 applied → exported as a **2-page 33 KB PDF**.

![Scan Cleaner](docs/shots/03-scan-cleaner.png)

- Drag-rectangle crop with live dashed preview
- Per-page editing, thumbnail navigation, rotate ±90°
- Save any page as PNG instead of the whole PDF

## ✍️ Local E-Sign Pad

**The problem:** "just sign this and send it back" — at 11pm, with no printer and no DocuSign account.

**How it works:** draw on the pressure-friendly pointer-capture pad (or type your name in a handwriting font). The signature is trimmed to its ink bounding box, embedded as a transparent PNG, and you click exactly where it lands on any PDF page. pdf-lib burns it into the page content stream — flattened, so no editable signature field remains, it's just ink on the document.

**Verified example:** a drawn squiggle was placed mid-page on a fixture PDF and exported as `signed.pdf` — 6 KB, signature image confirmed inside the page resources.

![E-Sign Pad](docs/shots/04-esign.png)

- Ink color + thickness controls; typed-signature mode with two font styles
- Click again to reposition, size field in PDF points
- Multiple pages: pick the page from the dropdown, the preview follows

## 🧾 Receipts → One PDF

**The problem:** freelancers and landlords photograph receipts all month, then face a folder of `IMG_5847.jpg … IMG_6113.jpg` at tax time.

**How it works:** every dropped photo's capture date is read from EXIF `DateTimeOriginal` (the real date taken — not the copy date), falling back to the file modification date. Rows sort oldest→newest and can be nudged manually. Export builds one PDF with each receipt fitted to the page (A4/Letter), stamped with its date and original filename — auditable without opening the photos again.

**Verified example:** three receipts dropped in shuffled order (3, 1, 2) exported as a **3-page 80 KB PDF, correctly ordered**, each page stamped `9/5/2026 · receipt-N.jpg`.

![Receipts to PDF](docs/shots/05-receipts.png)

## 🔍 Metadata & Hidden-Data Checker

**The problem:** files carry more than you think — Word documents remember every author and revision, spreadsheets remember the company name and total editing time, photos remember where you stood.

**How it works:** three parsers run locally — the JPEG EXIF reader, pdf-lib's info dictionary (Title/Author/Subject/Keywords/Creator/Producer/dates), and an OOXML reader that unzips `.docx/.xlsx/.pptx` in memory and reads `docProps/core.xml` + `app.xml`. Stripping rewrites what's safe: PDF info fields are blanked via pdf-lib re-save; OOXML core/app properties are emptied and re-zipped, leaving document content byte-faithful.

**Verified example:** a fixture `.docx` authored by "J. Hidden", last modified by "Editor Person", at company "Stealth Co" with 240 editing minutes — all shown in the UI; the GPS fixture photo showed `GPS 41.000000, 29.000000`. Stripped downloads were produced for both.

![Metadata Checker](docs/shots/06-metadata.png)

## 🎧 Audio Trimmer

**The problem:** you need the first 40 seconds of a voice note, and every online cutter wants the upload first.

**How it works:** the file is decoded with the Web Audio API to raw Float32 samples; the waveform is drawn min/max-per-pixel for honest peak display. Drag the region handles (or type exact seconds), optionally add fade-in/out shaped per-sample, then export — WAV as a hand-built canonical 44-byte-header PCM file, MP3 through lamejs encoding at 128–320 kbps.

**Verified example:** a 3 s 440 Hz tone loaded at 48 kHz; a 1.000 s selection (1.0 s→2.0 s) exported as a WAV whose data chunk is **exactly 96000 bytes = 1.0 s × 48000 Hz × 2 bytes**, sample-rate-checked from the output header itself.

![Audio Trimmer](docs/shots/07-audio.png)

## 🧮 Invoice / Quote Generator

**The problem:** invoicing sites charge monthly for what is ultimately "text on a PDF."

**How it works:** a live canvas preview mirrors the PDF renderer exactly — same layout, same right-aligned math. Subtotal → discount → tax → total is computed per keystroke. Export redraws the identical layout with real vector text via pdf-lib (StandardFonts, no font uploads), so the PDF is crisp at any zoom and searchable.

**Verified example:** "Deck repair, 4 × $85" with 20% tax → live preview showed **$408.00** and the exported PDF carried the same total; `INV-2026-001.pdf` produced.

![Invoice Generator](docs/shots/08-invoice.png)

- Invoice/Quote toggle, Clean & Classic templates, 5 currency symbols
- Multiple line items with add/remove, notes field for payment terms

## 🗂️ Batch Rename & Sort

**The problem:** every photographer and every Downloads folder: hundreds of files named by a camera that doesn't know your life.

**How it works:** names are built from a pattern (`{date}-{slug}`, `{date}-{n}`, `{n}-{slug}`…), where **date comes from EXIF `DateTimeOriginal`** — the moment you pressed the shutter, not when the file was copied. Slugs are slugified (lowercase, hyphenated, punctuation-stripped), collisions are auto-deduped (`-1`, `-2`), and the result ships as a ZIP built in-memory with renamed entries.

**Verified example:** two photos (one EXIF-dated 2026-09-05, one from file date) renamed with the fixed slug "home-depot" → `2026-09-05-home-depot.jpg`, `2026-09-06-home-depot.jpg`.

![Batch Rename](docs/shots/09-rename.png)

## 🖨️ Print-Shop Prep

**The problem:** the print shop asks for "4×6 with 0.125in bleed at 300 DPI" and suddenly you're reading a Wikipedia article.

**How it works:** choose an output size (4×6, 5×7, A4, Letter, 8×8 square), orientation, and bleed; the tool renders the print at **exactly 300 DPI** (4×6 + bleed = 1275×1875 px), center-cropping to fill or letterboxing with white bars. The DPI checker warns **before** you pay for a blurry print when the source doesn't have enough pixels. Export produces PNGs and a PDF whose MediaBox is the *exact physical size in points* (4.25 in → 306 pt) — print at "Actual size / 100%" and it comes out true.

**Verified example:** fixture photo → 4×6 in with 0.125 in bleed → **1275×1875 px** canvas at 300 DPI, exported PDF page measured at **306.0 pt wide**, DPI-per-source shown in the UI.

![Print Prep](docs/shots/10-printprep.png)

---

## Works on your phone

The suite is fully responsive — verified at a 390×844 mobile viewport with **zero horizontal overflow**:

![Mobile](docs/shots/11-mobile-hub.png)

---

## Run it yourself

```bash
npm install
npm run dev          # http://localhost:5177 — the hub with all 10 tools
npm test             # unit tests (EXIF byte-level parser, WAV encoder math)
npm run typecheck    # strict TypeScript
npm run build        # static build in dist/ — deployable anywhere
```

The full acceptance suite (`scripts/e2e.cjs`, Playwright) drives every tool in a real browser with real files and validates the downloaded bytes — 13/13 checks green before every release. Screenshots in `docs/shots/` are captured by the same scripts, so the documentation above can be regenerated from the code at any time.

## Stack & structure

- Vite multi-page app — one `dist/` serves the site root, `/tools/`, and GitHub Pages subpaths (relative base)
- Zero UI frameworks; shared CSS design system in `src/styles.css`
- `src/lib/exif.ts` — byte-level JPEG/TIFF EXIF parser + APP1 stripper (unit-tested against synthetic JPEGs)
- pdf-lib for every PDF operation · Web Audio API + lamejs for audio · JSZip for archives
- No PWA/service worker needed — the pages are already static; cache headers do the rest

## License

MIT. Use it, fork it, self-host it. If it saves you a subscription, tell someone where you got it.

**NavigatorsLab** — local-first, private-by-default software. [PDF Studio](https://github.com/Kayforkind/NavigatorsLab-PDF-Studio) · [navigatorslab.com](https://navigatorslab.com/)
