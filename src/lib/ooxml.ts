/* Office hidden-data reader + cleaner for OOXML (.docx/.xlsx/.pptx) and ODF
 * (.odt). Reports and strips: core.xml (authors, dates, title, revision),
 * app.xml (company, manager, editing time), custom properties, embedded
 * thumbnails, and comment authors (word/comments.xml + people.xml).
 * Everything stays inside the zip structure; nothing is uploaded. */
import JSZip from 'jszip';

export interface OoxmlInfo {
  kind: 'docx' | 'xlsx' | 'pptx' | 'odt' | 'ooxml';
  fields: [string, string][];
  /** raw core.xml + app.xml blobs for display */
  coreXml?: string;
  appXml?: string;
}

const CORE_MAP: [RegExp, string][] = [
  [/<dc:creator>([\s\S]*?)<\/dc:creator>/i, 'Author (creator)'],
  [/<cp:lastModifiedBy>([\s\S]*?)<\/cp:lastModifiedBy>/i, 'Last modified by'],
  [/<dc:title>([\s\S]*?)<\/dc:title>/i, 'Title'],
  [/<dc:subject>([\s\S]*?)<\/dc:subject>/i, 'Subject'],
  [/<dc:description>([\s\S]*?)<\/dc:description>/i, 'Comments'],
  [/<cp:revision>([\s\S]*?)<\/cp:revision>/i, 'Revision'],
  [/<dcterms:created[^>]*>([\s\S]*?)<\/dcterms:created>/i, 'Created'],
  [/<dcterms:modified[^>]*>([\s\S]*?)<\/dcterms:modified>/i, 'Modified'],
  [/<cp:lastPrinted[^>]*>([\s\S]*?)<\/cp:lastPrinted>/i, 'Last printed'],
];

const APP_MAP: [RegExp, string][] = [
  [/<Company>([\s\S]*?)<\/Company>/i, 'Company'],
  [/<Manager>([\s\S]*?)<\/Manager>/i, 'Manager'],
  [/<TotalTime>([\s\S]*?)<\/TotalTime>/i, 'Total editing time (min)'],
  [/<Words>([\s\S]*?)<\/Words>/i, 'Words'],
  [/<Application>([\s\S]*?)<\/Application>/i, 'Application'],
];

/* ODF meta.xml (LibreOffice / OpenOffice .odt) */
const ODT_MAP: [RegExp, string][] = [
  [/<meta:generator>([\s\S]*?)<\/meta:generator>/i, 'Generator'],
  [/<dc:title>([\s\S]*?)<\/dc:title>/i, 'Title'],
  [/<dc:subject>([\s\S]*?)<\/dc:subject>/i, 'Subject'],
  [/<dc:creator>([\s\S]*?)<\/dc:creator>/i, 'Author (creator)'],
  [/<meta:initial-creator>([\s\S]*?)<\/meta:initial-creator>/i, 'Initial creator'],
  [/<dc:description>([\s\S]*?)<\/dc:description>/i, 'Comments'],
  [/<meta:keyword[^>]*>([\s\S]*?)<\/meta:keyword>/i, 'Keyword'],
  [/<dc:date>([\s\S]*?)<\/dc:date>/i, 'Modified'],
  [/<meta:creation-date>([\s\S]*?)<\/meta:creation-date>/i, 'Created'],
  [/<meta:editing-cycles>([\s\S]*?)<\/meta:editing-cycles>/i, 'Revision (edit cycles)'],
  [/<meta:editing-duration>([\s\S]*?)<\/meta:editing-duration>/i, 'Editing duration'],
  [/<meta:template[^>]*xlink:href="([^"]+)"/i, 'Template'],
];

function kindOf(name: string): OoxmlInfo['kind'] {
  if (/\.docx$/i.test(name)) return 'docx';
  if (/\.xlsx$/i.test(name)) return 'xlsx';
  if (/\.pptx$/i.test(name)) return 'pptx';
  if (/\.odt$/i.test(name)) return 'odt';
  return 'ooxml';
}

const isOdt = (name: string): boolean => /\.odt$/i.test(name);

/** Pull "w:author" style attribute values out of a comments/people part. */
function commentAuthors(xml: string): string[] {
  const out = new Set<string>();
  for (const m of xml.matchAll(/\bw:author="([^"]*)"/g)) if (m[1].trim()) out.add(m[1].trim());
  for (const m of xml.matchAll(/\bw:initials="([^"]*)"/g)) if (m[1].trim()) out.add(m[1].trim());
  return [...out];
}

export async function readOoxml(file: File): Promise<OoxmlInfo | null> {
  if (!/\.(docx|xlsx|pptx|odt)$/i.test(file.name)) return null;
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const fields: [string, string][] = [];

    if (isOdt(file.name)) {
      const meta = zip.file('meta.xml');
      if (!meta) return null;
      const xml = await meta.async('string');
      for (const [re, label] of ODT_MAP) {
        const m = re.exec(xml);
        if (m && m[1].trim()) fields.push([label, m[1].trim()]);
      }
      // embedded thumbnail (Thumbnails/thumbnail.png) is PII-adjacent too
      if (zip.file('Thumbnails/thumbnail.png')) fields.push(['Embedded thumbnail', 'present (removed on strip)']);
      return fields.length ? { kind: 'odt', fields } : null;
    }

    const core = zip.file('docProps/core.xml');
    if (core) {
      const coreXml = await core.async('string');
      for (const [re, label] of CORE_MAP) {
        const m = re.exec(coreXml);
        if (m && m[1].trim()) fields.push([label, m[1].trim()]);
      }
    }
    const app = zip.file('docProps/app.xml');
    if (app) {
      const appXml = await app.async('string');
      for (const [re, label] of APP_MAP) {
        const m = re.exec(appXml);
        if (m && m[1].trim()) fields.push([label, m[1].trim()]);
      }
    }
    // custom properties (arbitrary key/value pairs — often reviewer names, client codes)
    const custom = zip.file('docProps/custom.xml');
    if (custom) {
      const xml = await custom.async('string');
      for (const m of xml.matchAll(/<cp:contentStatus>|<vt:lpstr>([\s\S]*?)<\/vt:lpstr>/g)) { void m; }
      let n = 0;
      for (const m of xml.matchAll(/name="([^"]+)"[^>]*>(?:\s*<vt:[a-z0-9]+>([\s\S]*?)<\/vt:[a-z0-9]+>)?/gi)) {
        if (m[1]) { fields.push([`Custom: ${m[1]}`, (m[2] ?? '').trim()]); n++; }
      }
      if (n === 0 && xml.includes('<Properties')) fields.push(['Custom properties', 'present (removed on strip)']);
    }
    // embedded thumbnail
    if (zip.file('docProps/thumbnail.jpeg')) fields.push(['Embedded thumbnail', 'present (removed on strip)']);
    // comment authors (Word)
    const comments = zip.file('word/comments.xml');
    if (comments) {
      const authors = commentAuthors(await comments.async('string'));
      if (authors.length) fields.push(['Comment authors', authors.slice(0, 5).join(', ') + (authors.length > 5 ? ` (+${authors.length - 5} more)` : '')]);
    }
    if (!fields.length) return null;
    return { kind: kindOf(file.name), fields };
  } catch {
    return null;
  }
}

/** Rewrite the metadata parts with blank values; drop thumbnails + custom props;
 *  anonymize comment authors. Keeps the zip structure and all content intact. */
export async function stripOoxml(file: File): Promise<Blob> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  if (isOdt(file.name)) {
    const meta = zip.file('meta.xml');
    if (meta) {
      let xml = await meta.async('string');
      xml = xml
        .replace(/<meta:generator>[\s\S]*?<\/meta:generator>/i, '<meta:generator></meta:generator>')
        .replace(/<dc:title>[\s\S]*?<\/dc:title>/i, '')
        .replace(/<dc:subject>[\s\S]*?<\/dc:subject>/i, '')
        .replace(/<dc:description>[\s\S]*?<\/dc:description>/i, '')
        .replace(/<dc:creator>[\s\S]*?<\/dc:creator>/i, '<dc:creator></dc:creator>')
        .replace(/<meta:initial-creator>[\s\S]*?<\/meta:initial-creator>/i, '<meta:initial-creator></meta:initial-creator>')
        .replace(/<meta:keyword[^>]*>[\s\S]*?<\/meta:keyword>/gi, '')
        .replace(/<dc:date>[\s\S]*?<\/dc:date>/i, '')
        .replace(/<meta:creation-date>[\s\S]*?<\/meta:creation-date>/i, '')
        .replace(/<meta:editing-cycles>[\s\S]*?<\/meta:editing-cycles>/i, '')
        .replace(/<meta:editing-duration>[\s\S]*?<\/meta:editing-duration>/i, '')
        .replace(/<meta:template[^>]*\/?>/gi, '');
      zip.file('meta.xml', xml);
    }
    zip.remove('Thumbnails/thumbnail.png');
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  const core = zip.file('docProps/core.xml');
  if (core) {
    let xml = await core.async('string');
    xml = xml
      .replace(/<dc:creator>[\s\S]*?<\/dc:creator>/i, '<dc:creator></dc:creator>')
      .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/i, '<cp:lastModifiedBy></cp:lastModifiedBy>')
      .replace(/<dc:title>[\s\S]*?<\/dc:title>/i, '')
      .replace(/<dc:description>[\s\S]*?<\/dc:description>/i, '')
      .replace(/<dc:subject>[\s\S]*?<\/dc:subject>/i, '')
      .replace(/<cp:revision>[\s\S]*?<\/cp:revision>/i, '')
      // dates: remove entirely (schema-valid absence, nothing to fingerprint)
      .replace(/<dcterms:created[^>]*>[\s\S]*?<\/dcterms:created>/i, '')
      .replace(/<dcterms:modified[^>]*>[\s\S]*?<\/dcterms:modified>/i, '')
      .replace(/<cp:lastPrinted[^>]*>[\s\S]*?<\/cp:lastPrinted>/i, '');
    zip.file('docProps/core.xml', xml);
  }
  const app = zip.file('docProps/app.xml');
  if (app) {
    let xml = await app.async('string');
    xml = xml
      .replace(/<Company>[\s\S]*?<\/Company>/i, '<Company></Company>')
      .replace(/<Manager>[\s\S]*?<\/Manager>/i, '')
      .replace(/<TotalTime>[\s\S]*?<\/TotalTime>/i, '');
    zip.file('docProps/app.xml', xml);
  }
  // custom properties: blank every value, keep the part (safest for strict readers)
  const custom = zip.file('docProps/custom.xml');
  if (custom) {
    let xml = await custom.async('string');
    xml = xml.replace(/(<vt:lpwstr|<vt:lpstr|<vt:i4|<vt:r4|<vt:bool|<vt:filetime)[^>]*>[\s\S]*?<\/vt:\w+>/gi, '$1></vt:x>');
    zip.file('docProps/custom.xml', xml);
  }
  // thumbnails: drop the part AND the relationship pointing at it
  if (zip.file('docProps/thumbnail.jpeg')) {
    zip.remove('docProps/thumbnail.jpeg');
    const rels = zip.file('_rels/.rels');
    if (rels) {
      const xml = (await rels.async('string'))
        .replace(/<Relationship[^>]*Target="docProps\/thumbnail\.jpeg"[^>]*\/>/gi, '');
      zip.file('_rels/.rels', xml);
    }
  }
  // comment authors: anonymize in comments.xml + people.xml
  for (const part of ['word/comments.xml', 'word/people.xml']) {
    const f = zip.file(part);
    if (!f) continue;
    let xml = await f.async('string');
    xml = xml
      .replace(/\bw:author="[^"]*"/g, 'w:author=""')
      .replace(/\bw:initials="[^"]*"/g, 'w:initials=""')
      .replace(/\bw:date="[^"]*"/g, 'w:date=""');
    zip.file(part, xml);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
