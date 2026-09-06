/* Minimal i18n for the suite chrome: dictionaries for EN/TR/DE, localStorage
 * persistence, and a t() lookup with English fallback. Tool-internal labels
 * stay English; the hub, shared header/footer, and card taglines localize. */
export type Lang = 'en' | 'tr' | 'de';

export const LANGS: [Lang, string][] = [
  ['en', 'EN'],
  ['tr', 'TR'],
  ['de', 'DE'],
];

const DICT: Record<string, Record<Lang, string>> = {
  'brand.tagline': {
    en: 'free · open source · everything stays on your device',
    tr: 'ücretsiz · açık kaynak · her şey cihazınızda kalır',
    de: 'kostenlos · open source · alles bleibt auf Ihrem Gerät',
  },
  'hero.kicker': {
    en: '🔒 No uploads · No accounts · Nothing retained',
    tr: '🔒 Yükleme yok · Hesap yok · Hiçbir şey saklanmaz',
    de: '🔒 Keine Uploads · Keine Konten · Nichts wird gespeichert',
  },
  'hero.title1': { en: 'Fifteen tools that', tr: 'On beş araç —', de: 'Fünfzehn Tools, die' },
  'hero.title2': { en: 'never phone home.', tr: 'nach Hause telefonieren nie.', de: 'niemals nach Hause telefonieren.' },
  'hero.cta.browse': { en: 'Browse the tools ↓', tr: 'Araçlara göz at ↓', de: 'Tools ansehen ↓' },
  'hero.cta.github': { en: '★ Source on GitHub', tr: '★ Kaynak: GitHub', de: '★ Quelle auf GitHub' },
  'hero.cta.install': { en: '📲 Install as app', tr: '📲 Uygulama olarak yükle', de: '📲 Als App installieren' },
  'hero.proof.offline': { en: '✓ Works offline (PWA)', tr: '✓ Çevrimdışı çalışır (PWA)', de: '✓ Funktioniert offline (PWA)' },
  'hero.proof.tests': { en: '✓ Verified by 20 automated browser tests', tr: '✓ 20 otomatik tarayıcı testiyle doğrulandı', de: '✓ Mit 20 automatisierten Browser-Tests verifiziert' },
  'hero.proof.security': { en: '✓ Security-audited: zero network calls after load', tr: '✓ Güvenlik denetimli: yükleme sonrası sıfır ağ çağrısı', de: '✓ Sicherheitsgeprüft: null Netzwerkaufrufe nach dem Laden' },
  'tools.head': { en: 'The toolbox', tr: 'Araç kutusu', de: 'Die Werkzeugkiste' },
  'tools.search': { en: 'Search — try “gps”, “2 mb”, “invoice”…', tr: 'Ara — “gps”, “2 mb”, “fatura” deneyin…', de: 'Suchen — „gps“, „2 mb“, „rechnung“…' },
  'search.none': { en: 'Nothing matches — try a different word.', tr: 'Sonuç yok — başka bir kelime deneyin.', de: 'Keine Treffer — anderes Wort versuchen.' },
  'cat.all': { en: 'All 15', tr: 'Hepsi 15', de: 'Alle 15' },
  'cat.privacy': { en: '🛡️ Privacy', tr: '🛡️ Gizlilik', de: '🛡️ Datenschutz' },
  'cat.documents': { en: '📄 Documents', tr: '📄 Belgeler', de: '📄 Dokumente' },
  'cat.money': { en: '🧾 Money', tr: '🧾 Para', de: '🧾 Geld' },
  'cat.images': { en: '🖼️ Images', tr: '🖼️ Görseller', de: '🖼️ Bilder' },
  'cat.media': { en: '🎧 Media', tr: '🎧 Medya', de: '🎧 Medien' },
  'cat.files': { en: '🗂️ Files', tr: '🗂️ Dosyalar', de: '🗂️ Dateien' },
  'card.open': { en: 'Open →', tr: 'Aç →', de: 'Öffnen →' },
  'card.recent': { en: 'recent', tr: 'son', de: 'kürzlich' },
  'verify.title': { en: 'Same files in, same files out — verified', tr: 'Aynı dosya giriş, aynı dosya çıkış — doğrulanmış', de: 'Gleiche Dateien rein, gleiche raus — verifiziert' },
  'verify.sub': {
    en: 'Every release is gated by a browser automation suite that drops real files into each tool and checks the downloaded bytes.',
    tr: 'Her sürüm, gerçek dosyaları araçlara bırakan ve indirilen baytları kontrol eden bir otomasyon paketiyle sınanır.',
    de: 'Jede Veröffentlichung wird von einer Browser-Automatisierung geprüft, die echte Dateien in jedes Tool legt und die heruntergeladenen Bytes kontrolliert.',
  },
  'verify.col.tool': { en: 'Tool', tr: 'Araç', de: 'Tool' },
  'verify.col.runs': { en: 'Runs on', tr: 'Çalıştırır', de: 'Läuft mit' },
  'verify.col.net': { en: 'Network after load', tr: 'Yükleme sonrası ağ', de: 'Netzwerk nach dem Laden' },
  'verify.col.verified': { en: 'Output verified by', tr: 'Çıktıyı doğrulayan', de: 'Ausgabe verifiziert durch' },
  'verify.nothing': { en: 'nothing', tr: 'yok', de: 'nichts' },
  'privacy.title': { en: "Privacy isn't a promise here. It's the architecture.", tr: 'Gizlilik burada bir söz değil. Mimarinin ta kendisi.', de: 'Datenschutz ist hier kein Versprechen. Es ist die Architektur.' },
  'privacy.body': {
    en: "These are static pages. There is no server that could receive your files — no upload endpoint, no queue, no storage bucket, no analytics, no cookies, no accounts. We keep no attachments and no user information, ever. Open devtools → Network, load any tool, and watch it stay silent after the initial load.",
    tr: 'Bunlar statik sayfalardır. Dosyalarınızı alabilecek bir sunucu yok — yükleme noktası, kuyruk, depolama, analitik, çerez, hesap yok. Ek ve kullanıcı bilgisi asla saklamayız. Devtools → Network açın, herhangi bir aracı yükleyin ve ilk yüklemeden sonra sessiz kaldığını görün.',
    de: 'Dies sind statische Seiten. Es gibt keinen Server, der Ihre Dateien empfangen könnte — kein Upload-Endpunkt, keine Queue, kein Storage, keine Analyse, keine Cookies, keine Konten. Wir behalten niemals Anhänge oder Nutzerinformationen. Öffnen Sie Devtools → Netzwerk, laden Sie ein Tool und sehen Sie zu, wie es nach dem Laden schweigt.',
  },
  'footer.privacy': { en: '🔒 100% client-side — nothing is uploaded, stored, or logged', tr: '🔒 %100 istemci tarafı — hiçbir şey yüklenmez, saklanmaz, günlüklenmez', de: '🔒 100 % client-seitig — nichts wird hochgeladen, gespeichert oder protokolliert' },
  'footer.github': { en: 'GitHub', tr: 'GitHub', de: 'GitHub' },
  'footer.studio': { en: 'PDF Studio', tr: 'PDF Studio', de: 'PDF Studio' },
  'footer.sitemap': { en: 'Sitemap', tr: 'Site haritası', de: 'Sitemap' },
  'lang.label': { en: 'Language', tr: 'Dil', de: 'Sprache' },
  'brag.title': {
    en: 'Real examples, real numbers — from the actual verification runs',
    tr: 'Gerçek örnekler, gerçek sayılar — doğrulama çalıştırmalarından',
    de: 'Echte Beispiele, echte Zahlen — aus den Verifizierungsläufen',
  },
  'brag.sub': {
    en: "Every claim below is asserted by an automated browser test on every push. These aren't marketing numbers; they're test results.",
    tr: 'Aşağıdaki her iddia her gönderide otomatik bir tarayıcı testiyle sınanır. Bunlar pazarlama rakamı değil; test sonuçları.',
    de: 'Jede Aussage wird bei jedem Push durch einen automatisierten Browser-Test geprüft. Keine Marketingzahlen — Testergebnisse.',
  },
  'vs.title': { en: "Same tools you'd pay for — without the catch", tr: 'Para ödediğiniz araçlar — aynıları, sürprizsiz', de: 'Tools, für die Sie zahlen — ohne den Haken' },
  'vs.sub': {
    en: "The tools you know, minus the uploads, accounts, watermarks, and monthly fees. And unlike them, this suite is verified — every release runs a 92+ check gate that drops real files in and validates the downloaded bytes.",
    tr: 'Bildiğiniz araçlar; yükleme, hesap, filigran ve abonelik olmadan. Üstelik doğrulanmış: her sürüm, gerçek dosyalarla 92+ kontrolü olan bir kapıdan geçer.',
    de: 'Die bekannten Tools ohne Uploads, Konten, Wasserzeichen und Abo-Gebühren. Und verifiziert: Jede Version durchläuft eine Prüfung mit 92+ Checks und echten Dateien.',
  },
};

export function getLang(): Lang {
  try {
    const v = localStorage.getItem('nl-lang');
    if (v === 'tr' || v === 'de' || v === 'en') return v;
  } catch { /* private mode */ }
  const nav = (navigator.language || 'en').slice(0, 2);
  return nav === 'tr' || nav === 'de' ? (nav as Lang) : 'en';
}

export function setLang(l: Lang): void {
  try { localStorage.setItem('nl-lang', l); } catch { /* private mode */ }
}

/** translate a key; falls back to English, then to the key itself */
export function t(key: string, lang: Lang = getLang()): string {
  return DICT[key]?.[lang] ?? DICT[key]?.en ?? key;
}

/** localized tool tagline: keyed by tool id, EN fallback is tools.json content */
const TAGLINES: Record<string, Partial<Record<Lang, string>>> = {
  exif: { tr: 'Paylaşmadan önce GPS, kamera modeli ve zaman damgalarını silin', de: 'GPS, Kameramodell und Zeitstempel vor dem Posten entfernen' },
  metadata: { tr: 'Bir dosyanın içindeki her şeyi görün — sonra silin', de: 'Sehen Sie, was wirklich in einer Datei steckt — dann entfernen Sie es' },
  shrink: { tr: '“En fazla 2 MB” portal limitlerini TinyPNG olmadan karşılayın', de: '„max. 2 MB“-Portal-Limits ohne TinyPNG treffen' },
  scan: { tr: 'Telefonla çekilen belge fotoğrafları → temiz, düz PDF\'ler', de: 'Dokumentfotos vom Handy → saubere, gerade PDFs' },
  sign: { tr: 'Bu sözleşmeyi bu gece imzalayın — DocuSign\'e gerek yok', de: 'Unterschreiben Sie heute Nacht — nicht DocuSign' },
  receipts: { tr: 'Fiş kutusu → tek, tarihe göre sıralı PDF', de: 'Belegkarton → ein nach Datum sortiertes PDF' },
  ocr: { tr: 'Fiş fotoğraflarından tutarları okuyun, gider olarak dışa aktarın', de: 'Belegfotos auslesen und als Ausgaben exportieren' },
  qr: { tr: 'QR kodu oluşturun ve çözün — hiçbir site görmez', de: 'QR-Codes erstellen und dekodieren — keine Seite sieht sie' },
  audio: { tr: 'Ses notlarını dalga formunda kesin', de: 'Sprachnotizen und Clips am Wellenform schneiden' },
  invoice: { tr: 'Tek kişilik işletmeler: saat girin, temiz PDF alın', de: 'Ein-Personen-Betriebe: Stunden rein, sauberes PDF raus' },
  rename: { tr: 'IMG_5847.jpg → 2026-09-05-fis-home-depot.jpg', de: 'IMG_5847.jpg → 2026-09-05-beleg-home-depot.jpg' },
  printprep: { tr: 'Tam boyutlar, taşma payı, DPI kontrolleri, baskıya hazır PDF', de: 'Exakte Größen, Anschnitt, DPI-Prüfung, druckfertiges PDF' },
  pdfpages: { tr: 'PDF sayfalarını yeniden sıralayın, döndürün, silin ve ayıklayın', de: 'PDF-Seiten neu anordnen, drehen, löschen und extrahieren' },
  textdiff: { tr: 'İki metni kelime seviyesinde vurgularla karşılaştırın', de: 'Zwei Texte mit Wortebene-Hervorhebung vergleichen' },
  textstats: { tr: 'Kelime, okuma süresi, okunabilirlik, anahtar kelime yoğunluğu', de: 'Wörter, Lesezeit, Lesbarkeit, Keyword-Dichte' },
};

export function toolTagline(id: string, fallback: string, lang: Lang = getLang()): string {
  return TAGLINES[id]?.[lang] ?? fallback;
}
