# NavigatorsLab Tools — Hands-On Examples

Step-by-step walkthroughs for the fifteen file tools, with the exact clicks and the verified result of each. (Reimagine — the sixteenth — has its own walkthroughs in the [reimagine-it repo](https://github.com/Kayforkind/reimagine-it#readme).)
Everything below works at **https://navigatorslab.com/tools/** (or `npm run dev` locally) — every step happens **inside your browser**: no uploads, no accounts, nothing retained. Free and open source (MIT).

> Every example ends with a **Verified** line — the same flow is asserted automatically by the CI gate (20 E2E + 24 security checks) on every push.

---

## 1 · 🛡️ Photo Privacy Kit — strip GPS before posting

**Scenario:** you shot photos at a rental and don't want the listing (or your home) coordinates embedded when you post them.

1. Open **Photo Privacy Kit** (`/tools/exif`).
2. Drop a folder of JPEGs (or click the zone and pick them — bulk works, 100+ files fine).
3. Read the scan results: each row shows camera, timestamp, and a red **GPS LEAK** flag when coordinates are embedded. Try it with any phone photo — most carry GPS by default.
4. Click **Strip EXIF & download**. Multi-file drops arrive as one `clean-photos.zip`.

**What happens under the hood:** a byte-level parser reads the JPEG APP1 segment (GPS degrees-minutes-seconds rationals, IFD chains). Stripping removes those segments while keeping image data **byte-identical** — zero quality loss, no re-encode.

**Verified:** the CI fixture is tagged 41.0°N 29.0°E "NavCam Pixel 99"; after stripping, the output JPEG contains no APP1 segment at all.

**Bonus:** install the suite as an app (install button on the hub) and your OS "Open with → NavigatorsLab Tools" sends images straight into the kit.

---

## 2 · 🔍 Metadata & Hidden-Data Checker — see what files remember

**Scenario:** before sending a `.docx` to a client, check what it leaks: authors, revision editors, company names, total editing time.

1. Open **Metadata Checker** (`/tools/metadata`).
2. Drop a mix: `.docx`, `.xlsx`, `.pdf`, photos — all together.
3. Each file's row lists what was found: OOXML core/app properties (creator, last modified by, company, editing minutes), PDF info dictionary (title, author, producer, dates), photo GPS.
4. Click **Strip & download** — PDF info fields are blanked; OOXML properties are emptied and re-zipped with document content untouched.

**Verified:** a fixture docx authored by "J. Hidden" at "Stealth Co" with 240 editing minutes shows every field, then strips clean.

---

## 3 · 🗜️ Image Shrinker — hit "max 2 MB" portal limits

**Scenario:** a government portal rejects anything over 2 MB; your scan is 14 MB.

1. Open **Image Shrinker** (`/tools/shrink`).
2. Drop the image. Pick mode **Target file size**, enter `2000` KB.
3. Optionally set max width (e.g. `2000` px) and format (JPG is usually right; WebP goes smaller).
4. Click **Shrink**. A binary search across quality levels encodes repeatedly until the output fits — download and done.

**Verified:** a ~16 MB 4000×3000 PNG landed at **294 KB** under a 300 KB target.

**Tip:** PNG "target size" mode works by progressive downscaling (PNG has no quality knob).

---

## 4 · 📄 Scan & Screenshot Cleaner — phone photo → crisp PDF page

**Scenario:** three pages of a contract photographed with your phone: crooked, grayish, 8 MB each.

1. Open **Scan Cleaner** (`/tools/scan`).
2. Drop the photos — each becomes a page; thumbnails appear at the bottom (click to switch).
3. Per page: **🧮 Auto-straighten** (content-aware ±4° skew search), **↺/↻ rotate**, **Grayscale + Contrast** (contrast 30–50 is the sweet spot for text), then **✨ Apply to page**.
4. **✂️ Crop mode**: drag a rectangle directly on the image (the image is scaled to fit your screen — drags map through the display size), then **✔ Apply crop**. Works with touch too — the browser's scroll-hijack is disabled on the canvas.
5. Repeat per page, then **📄 Export PDF** — one multi-page PDF, pages sized to content (~150 DPI).

**Verified:** CI drags a 50% rectangle and asserts the page becomes exactly half size; two enhanced pages export as a 2-page PDF.

---

## 5 · ✍️ Local E-Sign Pad — sign a PDF at 11pm

**Scenario:** "just sign and send it back" — no printer, no DocuSign account, no time.

1. Open **E-Sign Pad** (`/tools/sign`).
2. **Draw** your signature on the pad (pressure-friendly pointer capture) — or switch to **Type** and pick a handwriting style.
3. Click **Use signature** — it's trimmed to the ink bounding box as a transparent PNG.
4. Drop the PDF. A live preview renders the current page; pick the page from the dropdown if needed.
5. **Click exactly where the signature should land** (click again to reposition; set width in PDF points).
6. **✅ Flatten & download** — the signature is burned into the page content stream. No editable field remains.

**Verified:** a drawn squiggle placed mid-page; the output PDF's resources contain the signature image.

---

## 6 · 🧾 Receipts → One PDF — the shoebox, tamed

**Scenario:** a month of receipt photos for the accountant, filenames `IMG_5847.jpg…IMG_6113.jpg`.

1. Open **Receipts → One PDF** (`/tools/receipts`).
2. Drop the whole folder. Rows sort by **EXIF `DateTimeOriginal`** — the moment you pressed the shutter — falling back to file date.
3. Nudge order with the arrows if a photo was re-shot later.
4. Choose A4 or Letter, keep **Stamp date + filename** on, click **Export PDF**.

**Verified:** three receipts dropped in shuffled order (3, 1, 2) export as a 3-page PDF in correct date order, each page stamped.

---

## 7 · 🔢 Receipt OCR → CSV — expense entries without typing

**Scenario:** twelve receipts to enter into the expenses spreadsheet.

1. Open **Receipt OCR → CSV** (`/tools/ocr`). First use downloads the OCR engine **from this same site** (~11 MB, then precached — fully offline afterwards).
2. Drop receipt photos. Each is recognized on-device by Tesseract WASM.
3. Review the table: merchant (first meaningful line), **total** (best candidate from lines like `TOTAL $23.98`), date from EXIF, and a **confidence badge** — green ≥80%, amber ≥55%. Fix any total by typing over it.
4. Uncheck rows you don't want, click **Export CSV** — opens directly in Excel/Numbers/Sheets.

**Verified:** a receipt recognized fully locally → `date,merchant,amount,file,ocr_confidence` CSV out; on production a generated receipt decoded as `"GREEN GROCER",23.98` at 95% confidence.

---

## 8 · 🔳 QR Studio — generate & decode without the sketchy sites

**Scenario A — generate:** your Wi-Fi password as a QR for guests. Generator sites log what you encode; this runs on your device.

1. Open **QR Studio** (`/tools/qr`) → **Generate** tab.
2. Type `WIFI:T:WPA;S:YourNet;P:yourpassword;;` (or any text/URL).
3. Pick size, colors, keep the quiet zone on. **Generate QR** → **Download PNG** (or **SVG** for print).

**Scenario B — decode:** a QR arrives as a screenshot; you want the link *before* opening your camera.

1. **Decode an image** tab → drop the screenshot.
2. The payload appears as text — copy it, or open it if it's a URL you trust. jsQR reads both dark-on-light and light-on-dark codes.

**Verified:** a unique payload encoded → PNG exported → the same PNG decoded → character-for-character match (in CI and on production).

---

## 9 · 🎧 Audio Trimmer — cut clips without uploading them

**Scenario:** a 40-minute voice note; you need minutes 12:00–14:30 with a soft ending.

1. Open **Audio Trimmer** (`/tools/audio`) and drop the file (WAV/MP3/anything your browser decodes).
2. Drag the region handles on the waveform, or type exact seconds in the `t0`/`t1` boxes.
3. Optionally set fade-in/out (per-sample shaped).
4. **Export** — WAV (canonical 44-byte-header PCM) or MP3 (lamejs, 128–320 kbps).

**Verified:** a 1.000 s selection exports as a WAV whose data chunk is exactly `96000 = 1.0 s × 48000 Hz × 2 bytes`, checked against the header's own sample rate.

---

## 10 · 🧮 Invoice / Quote Generator — hours in, PDF out

**Scenario:** you're a one-person shop and invoicing sites want $15/month.

1. Open **Invoice Generator** (`/tools/invoice`).
2. Fill your business/client, doc number, and line items (add rows freely: description, qty, rate).
3. Watch the **live preview** — it mirrors the PDF renderer exactly. Tax and discount update the total per keystroke.
4. Pick template (Clean/Classic) and currency. **Export PDF** — real vector text via pdf-lib, crisp at any zoom.

**Verified:** "Deck repair, 4 × $85" + 20% tax → $408.00 in both the preview and the exported PDF.

---

## 11 · 🗂️ Batch Rename & Sort — IMG_5847.jpg, but meaningful

**Scenario:** hundreds of camera-named photos to organize by day.

1. Open **Batch Rename** (`/tools/rename`) and drop the folder.
2. Pick a pattern (`{date}-{slug}`, `{date}-{n}`, `{n}-{slug}`), a slug source (fixed text or original name), and date format.
3. Click **Apply** — dates come from EXIF shutter time; collisions auto-dedupe (`-1`, `-2`).
4. **Download ZIP** with all renamed files.

**Verified:** two photos → `2026-09-05-home-depot.jpg`, `2026-09-06-home-depot.jpg` inside the ZIP.

---

## 12 · 🖨️ Print-Shop Prep — bleed, DPI, exact sizes

**Scenario:** the shop asks for "4×6 with 0.125 in bleed at 300 DPI."

1. Open **Print-Shop Prep** (`/tools/printprep`).
2. Drop your image(s). Pick **Output size** (4×6, 5×7, A4, Letter, 8×8), orientation, **bleed** (`0.125` in).
3. The tool renders at **exactly 300 DPI** (4×6 + bleed = 1275×1875 px), center-crop or letterbox. If the source lacks pixels, the **DPI checker warns before you pay for a blurry print**.
4. **Export PDF** — the MediaBox is the exact physical size in points (4.25 in → 306 pt). Print at "Actual size / 100%".

**Verified:** page width measured at 306.0 pt, canvas 1275×1875 px.

---

## 13 · 📑 PDF Pages — reorder, rotate, delete, extract & merge

**Scenario:** a 40-page scanned packet where pages 7–9 are upside down and two pages must go — or two PDFs that must become one, in your order.

1. Open **PDF Pages** (`/tools/pdfpages`). Drop one or several PDFs — every page appears as a live thumbnail (rendered locally by pdf.js).
2. **Reorder:** drag thumbnails into place. **Rotate:** the ↻ button per page, or select several and rotate all. **Delete:** the ✕ per page, or select and delete.
3. **Extract:** uncheck everything except the pages you need, then **Rebuild & download**.
4. **Merge:** drop two files together and arrange pages across both into one output.

**Verified:** a 2-page fixture → delete page 1 → rebuilt PDF contains exactly the remaining page; the thumbnail count always equals the source page count.

---

## 14 · 🔬 Text Diff — what exactly changed in this contract?

**Scenario:** the other side sent a "final" redline as plain text. You want the changes without uploading the draft to a random diff website.

1. Open **Text Diff** (`/tools/textdiff`). Paste the original on the left, the changed version on the right — or drop two `.txt` files onto the boxes.
2. Click **Compare**. Changed lines get word-level highlights (strike-through red = removed, green = added), so "30 days → 45 days" is visible at a glance.
3. Toggle **ignore whitespace** to skip formatting-only churn; **case-sensitive** off folds "Hello"/"hello".
4. **Copy unified diff** or **Download .diff** for your records.

**Verified:** two changed lines produce exactly `2 added · 2 removed` with word highlights asserted; the exported `.diff` carries `-`/`+` lines.

---

## 15 · 📊 Text Stats — words, reading time, readability

**Scenario:** a 650-word application essay with a 500-word limit, or a blog post you want readable by everyone.

1. Open **Text Stats** (`/tools/textstats`). Type or paste — stats update live as you write. Drop a `.txt`/`.md` file to fill the box.
2. Cards show words, characters (with/without spaces), sentences, paragraphs, lines, **reading time** (238 wpm) and **speaking time** (140 wpm).
3. **Reading ease** is the Flesch score (0–100) with a grade interpretation — aim above 60 for general audiences.
4. **Top keywords** show what the text is actually about (stopwords removed) — great for spotting accidental repetition.

**Verified:** a 62-word fixture counts exactly 62 words with "tools" as top keyword and a bounded 0–100 reading-ease score; the engine is unit-tested (48 tests total in CI).

---

## Agent Mode — drive the suite from an AI agent

**Scenario:** you are an AI agent (or a power user) and want results without clicking.

1. **Compute at the edge** — `POST https://navigatorslab.com/tools/mcp` with JSON-RPC: `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"qr_payload","arguments":{"kind":"wifi","ssid":"Guest","password":"s3cret-pw"}}}` → returns the escaped `WIFI:T:WPA;…` payload and a ready `qr.html?text=…` deep link.
2. **Render in the browser** — open that deep link (or `shrink.html?url=…&targetKB=300`, `textdiff.html?a=…&b=…`): the page shows an "Agent mode" chip describing what the URL applied, and the file — loaded **from this origin only** — flows through the same local pipeline a dropped file would.
3. **Discover everything** — `tools/list`, [`llms.txt`](https://navigatorslab.com/llms.txt), [`llms-full.txt`](https://navigatorslab.com/tools/llms-full.txt), and the full reference on the [Agent Mode page](https://navigatorslab.com/tools/agents.html).

**Verified:** `agents-page`, `deep-qr`, `deep-url` and `deep-params` in the automated E2E gate — `?text=` renders without clicks, `?url=` (data:) analyzes 12 words with the chip shown, and params pre-set the UI. The MCP handlers themselves are unit-tested (17 tests: initialize, tools/list, tools/call, error codes, Wi-Fi escaping).

## Everything works offline after the first visit

The suite is a PWA: every page, script, engine (including the 11 MB compressed OCR model) is precached. Turn off Wi-Fi and keep working — verified by a CI test that disables the network and runs a tool.

## Works on your phone

Every tool is responsive, verified at 390×844 with zero horizontal overflow — including crop-dragging in Scan Cleaner, which now explicitly opts out of browser gesture hijacking.

---

**We keep no attachments and no user information.** There is no server that could receive your files. Open devtools → Network and watch every tool stay silent after load — the CI security gate asserts it on every release.

*[NavigatorsLab](https://navigatorslab.com/) · [PDF Studio](https://github.com/Kayforkind/NavigatorsLab-PDF-Studio) · [Source (MIT)](https://github.com/Kayforkind/NavigatorsLab-Tools)*

---

## New in v1.3 — upgrades across the suite

### Paste anywhere (all tools)
Ctrl/Cmd+V a screenshot or copied file on any tool page — it lands in the drop zone. Try it: copy a screenshot, open **Photo Privacy Kit**, press Ctrl+V, strip it, download.

### Photo Privacy Kit — SHA-256 fingerprints
Scan photos → **Strip metadata & download all** → click **🔬 Show SHA-256 fingerprints**. You get the hash of the original and the cleaned copy; decode both images anywhere and compare pixels — the picture is identical, only the metadata is gone.

### Image Shrinker — AVIF + batch zip
Pick **AVIF (smallest, slow)** for a ~30–50% further reduction over WebP. Multi-image batches now also produce a single `shrunk-images.zip`.

### Scan & Screenshot Cleaner — auto-levels and threshold
Load a washed-out phone photo → **🌗 Auto-levels** (stretches black/white points; reports them) → **⚫ Threshold** (pure black-on-white photocopy look) → Export PDF. Page images are now embedded at quality 0.92, so 300 DPI text stays crisp.

### Local E-Sign Pad — dated signatures
Check **stamp date** before flattening: today's date is drawn under the ink (Helvetica 9pt, grey). The E2E gate decodes the signed PDF and asserts the year is present.

### PDF Pages — extract and blank pages
Deselect pages you don't want → **📤 Extract selected** → `extract-Np.pdf`. **➕ Insert blank** adds a blank page sized like its neighbor (A4 if first) — handy for "this page intentionally left blank" scans.

### Receipt OCR → CSV — categories and currency
Each row gets a **category** dropdown (food, transport, office, travel, software…). Choose a currency symbol before export; the CSV v2 header is `date,merchant,category,amount,currency,file,ocr_confidence`.

### QR Studio — Wi-Fi & contact presets
**📶 Wi-Fi** opens SSID/password/security fields; special characters are escaped per the `WIFI:` spec (`;`, `,`, `:`, `\`) — the E2E round-trips a password containing `;` and `\` through the decoder. Error-correction level is selectable (L/M/Q/H).

### Audio Trimmer — normalize
Check **normalize to −0.1 dB** to scale the selection's peak to full scale — quiet voice memos become uniformly loud. Gain is computed locally and applied before WAV/MP3 export.

### Text Diff — similarity score
After Compare, the summary shows **N% similar** (2·LCS/total lines). **⇄ Swap** exchanges the two panes.

### Text Stats — sentence rhythm
A live histogram of sentence lengths (1–5, 6–10, … words) with the average — spot monotone long-sentence paragraphs at a glance.
