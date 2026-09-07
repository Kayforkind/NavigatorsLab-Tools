import { describe, it, expect } from 'vitest';
import {
  qesc, wifiPayload, vcardPayload, mailtoPayload,
  diffLinesPure, textStatsPure, listTools, callTool, handleRpc, PROTOCOL_VERSION,
} from './mcp';

describe('qesc / wifiPayload', () => {
  it('escapes the WIFI spec special characters', () => {
    expect(qesc('pa;ssword')).toBe('pa\\;ssword');
    expect(qesc('a,b:c\\d')).toBe('a\\,b\\:c\\\\d');
  });

  it('builds a WPA payload with escaped password', () => {
    expect(wifiPayload({ ssid: 'Cafe', password: 'pa;ssword' })).toBe('WIFI:T:WPA;S:Cafe;P:pa\\;ssword;;');
  });

  it('defaults to nopass when no password is given and supports hidden', () => {
    expect(wifiPayload({ ssid: 'Open' })).toBe('WIFI:T:nopass;S:Open;;');
    expect(wifiPayload({ ssid: 'H', hidden: true })).toBe('WIFI:T:nopass;S:H;H:true;;');
  });

  it('rejects empty ssid, bad types and short WPA passwords', () => {
    expect(() => wifiPayload({ ssid: '  ' })).toThrow(/ssid is required/);
    expect(() => wifiPayload({ ssid: 'x', type: 'WPA2' as never })).toThrow(/WPA, WEP or nopass/);
    expect(() => wifiPayload({ ssid: 'x', password: 'short' })).toThrow(/at least 8/);
  });
});

describe('vcard / mailto', () => {
  it('builds a minimal vCard', () => {
    expect(vcardPayload({ name: 'Ada' })).toBe('BEGIN:VCARD\nVERSION:3.0\nFN:Ada\nEND:VCARD');
  });
  it('requires a name and a valid email', () => {
    expect(() => vcardPayload({ name: '' })).toThrow(/name is required/);
    expect(() => mailtoPayload({ to: 'nope' })).toThrow(/valid "to"/);
  });
  it('encodes subject/body into mailto', () => {
    expect(mailtoPayload({ to: 'a@b.co', subject: 'Hi' })).toBe('mailto:a@b.co?subject=Hi');
  });
});

describe('diffLinesPure', () => {
  it('counts adds/removes and marks them', () => {
    const r = diffLinesPure('one\ntwo', 'one\nTWO\nthree', { caseSensitive: true });
    expect(r.added).toBe(2);
    expect(r.removed).toBe(1);
    expect(r.lines.map((l) => l.type)).toEqual(['same', 'del', 'add', 'add']);
  });
  it('ignores whitespace when asked', () => {
    const r = diffLinesPure('a  b', 'a b', { ignoreWhitespace: true });
    expect(r.added + r.removed).toBe(0);
  });
});

describe('textStatsPure', () => {
  it('counts words, sentences and produces read time', () => {
    const s = textStatsPure('Hello world. This is fine.');
    expect(s.words).toBe(5);
    expect(s.sentences).toBe(2);
    expect(s.readMinutes).toBe(1);
  });
});

describe('JSON-RPC dispatch', () => {
  it('initialize returns the negotiated protocol version', () => {
    const r = handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(r.status).toBe(200);
    expect((r.json as { result: { protocolVersion: string } }).result.protocolVersion).toBe(PROTOCOL_VERSION);
  });

  it('tools/list exposes the four tools with input schemas', () => {
    const r = handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = (r.json as { result: { tools: { name: string }[] } }).result.tools;
    expect(tools.map((t) => t.name)).toEqual(['nl_catalog', 'qr_payload', 'text_diff', 'text_stats']);
    expect(listTools().length).toBe(4);
  });

  it('tools/call wifi builds a payload and a deep link', () => {
    const r = handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'qr_payload', arguments: { kind: 'wifi', ssid: 'N', password: 'p;8chars' } } });
    const parsed = JSON.parse((r.json as { result: { content: { text: string }[] } }).result.content[0].text);
    expect(parsed.payload).toBe('WIFI:T:WPA;S:N;P:p\\;8chars;;');
    expect(parsed.deep_link).toContain('qr.html?text=');
  });

  it('tools/call with a bad argument returns isError content', () => {
    const r = handleRpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'qr_payload', arguments: { kind: 'wifi', ssid: '' } } });
    const res = (r.json as { result: { isError?: boolean } }).result;
    expect(res.isError).toBe(true);
  });

  it('unknown method → -32601; malformed body → 400', () => {
    const r1 = handleRpc({ jsonrpc: '2.0', id: 5, method: 'nope' });
    expect((r1.json as { error: { code: number } }).error.code).toBe(-32601);
    const r2 = handleRpc('not json' as unknown);
    expect(r2.status).toBe(400);
  });

  it('notifications get 202 with no body', () => {
    const r = handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(r.status).toBe(202);
    expect(r.json).toBeNull();
  });

  it('text_diff computes through the RPC layer', () => {
    const r = handleRpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'text_diff', arguments: { text_a: 'a\nb', text_b: 'a\nc' } } });
    const text = (r.json as { result: { content: { text: string }[] } }).result.content[0].text;
    expect(text).toContain('"added": 1');
    expect(text).toContain('"removed": 1');
  });
});

describe('text_diff DoS guard', () => {
  it('truncates giant inputs instead of allocating a huge LCS table', () => {
    // 3000 x 3000 lines = 9M cells > 4M cap -> truncation path, no OOM
    const a = Array.from({ length: 3000 }, (_, i) => `alpha line ${i}`).join('\n');
    const b = Array.from({ length: 3000 }, (_, i) => `beta line ${i}`).join('\n');
    const res = callTool('text_diff', { text_a: a, text_b: b });
    const parsed = JSON.parse(res.content[0].text) as { truncated: boolean; note?: string };
    expect(parsed.truncated).toBe(true);
    expect(parsed.note).toContain('truncated');
  });
  it('still diffs normal documents without truncation', () => {
    const res = callTool('text_diff', { text_a: 'one\ntwo', text_b: 'one\nthree' });
    const parsed = JSON.parse(res.content[0].text) as { truncated: boolean; added: number; removed: number };
    expect(parsed.truncated).toBe(false);
    expect(parsed.added).toBe(1);
    expect(parsed.removed).toBe(1);
  });
});

describe('resolveToolAlias (pretty URLs)', () => {
  it('maps repo-style names, display names and ids to tool ids', async () => {
    const { resolveToolAlias } = await import('./mcp');
    expect(resolveToolAlias('QR-Studio')).toBe('qr');
    expect(resolveToolAlias('photo-privacy-kit')).toBe('exif');
    expect(resolveToolAlias('Photo%20Privacy%20Kit')).toBe('exif');
    expect(resolveToolAlias('PDF-Pages')).toBe('pdfpages');
    expect(resolveToolAlias('e-sign-pad')).toBe('sign');
    expect(resolveToolAlias('receipt-ocr')).toBe('ocr');
  });
  it('rejects unknown paths so real files still resolve', async () => {
    const { resolveToolAlias } = await import('./mcp');
    expect(resolveToolAlias('favicon.svg')).toBe(null);
    expect(resolveToolAlias('llms.txt')).toBe(null);
    expect(resolveToolAlias('totally-unknown-page')).toBe(null);
  });
});
