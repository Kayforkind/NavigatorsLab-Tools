/* OOXML (.docx/.xlsx/.pptx) hidden-data reader + cleaner.
 * Reads docProps/core.xml + docProps/app.xml authors, revision, dates,
 * and rewrites those parts with empty values (keeping zip structure). */
import JSZip from 'jszip';

export interface OoxmlInfo {
  kind: 'docx' | 'xlsx' | 'pptx' | 'ooxml';
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

function kindOf(name: string): OoxmlInfo['kind'] {
  if (/\.docx$/i.test(name)) return 'docx';
  if (/\.xlsx$/i.test(name)) return 'xlsx';
  if (/\.pptx$/i.test(name)) return 'pptx';
  return 'ooxml';
}

export async function readOoxml(file: File): Promise<OoxmlInfo | null> {
  if (!/\.(docx|xlsx|pptx|odt)$/i.test(file.name)) return null;
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const fields: [string, string][] = [];
    let coreXml: string | undefined;
    let appXml: string | undefined;
    const core = zip.file('docProps/core.xml');
    if (core) {
      coreXml = await core.async('string');
      for (const [re, label] of CORE_MAP) {
        const m = re.exec(coreXml);
        if (m && m[1].trim()) fields.push([label, m[1].trim()]);
      }
    }
    const app = zip.file('docProps/app.xml');
    if (app) {
      appXml = await app.async('string');
      for (const [re, label] of APP_MAP) {
        const m = re.exec(appXml);
        if (m && m[1].trim()) fields.push([label, m[1].trim()]);
      }
    }
    if (!fields.length) return null;
    return { kind: kindOf(file.name), fields, coreXml, appXml };
  } catch {
    return null;
  }
}

/** Rewrite core.xml/app.xml with blank author/company/revision fields; keep everything else intact. */
export async function stripOoxml(file: File): Promise<Blob> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const core = zip.file('docProps/core.xml');
  if (core) {
    let xml = await core.async('string');
    xml = xml
      .replace(/<dc:creator>[\s\S]*?<\/dc:creator>/i, '<dc:creator></dc:creator>')
      .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/i, '<cp:lastModifiedBy></cp:lastModifiedBy>')
      .replace(/<dc:title>[\s\S]*?<\/dc:title>/i, '')
      .replace(/<dc:description>[\s\S]*?<\/dc:description>/i, '')
      .replace(/<dc:subject>[\s\S]*?<\/dc:subject>/i, '')
      .replace(/<cp:revision>[\s\S]*?<\/cp:revision>/i, '');
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
  const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return out;
}
