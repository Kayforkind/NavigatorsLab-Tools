import { describe, it, expect } from 'vitest';
import { diffLines, summarize, unifiedDiff } from './diff';

describe('diffLines', () => {
  it('identical texts → all same lines', () => {
    const d = diffLines('a\nb\nc', 'a\nb\nc');
    expect(d.every((l) => l.type === 'same')).toBe(true);
    expect(summarize(d)).toBe('0 added · 0 removed · 3 unchanged');
  });

  it('pure addition', () => {
    const d = diffLines('a\nb', 'a\nb\nc');
    expect(d.filter((l) => l.type === 'add')).toHaveLength(1);
    expect(d.filter((l) => l.type === 'add')[0].text).toBe('c');
  });

  it('pure removal', () => {
    const d = diffLines('a\nb\nc', 'a\nc');
    expect(d.filter((l) => l.type === 'del')).toHaveLength(1);
    expect(d.filter((l) => l.type === 'del')[0].text).toBe('b');
  });

  it('modified line gets word-level spans on both sides', () => {
    const d = diffLines('The quick fox', 'The quick brown fox');
    const del = d.find((l) => l.type === 'del')!;
    const add = d.find((l) => l.type === 'add')!;
    expect(del.spans).toBeTruthy();
    expect(add.spans).toBeTruthy();
    // the word "brown" must be marked as an addition in both spans
    expect(del.spans!.some(([w, k]) => w === 'brown' && k === 'add')).toBe(true);
    expect(add.spans!.some(([w, k]) => w === 'brown' && k === 'add')).toBe(true);
    // unchanged words stay 'same'
    expect(del.spans!.filter(([_, k]) => k === 'same').length).toBeGreaterThan(2);
  });

  it('reordered block detected as del+add, not mass-same', () => {
    const d = diffLines('a\nb\nc', 'c\nb\na');
    expect(d.filter((l) => l.type !== 'same').length).toBeGreaterThan(0);
  });

  it('ignoreWs treats padding-only changes as same', () => {
    const strict = diffLines('hello', '   hello   ');
    const loose = diffLines('hello', '   hello   ', { ignoreWs: true });
    expect(strict.some((l) => l.type !== 'same')).toBe(true);
    expect(loose.every((l) => l.type === 'same')).toBe(true);
  });

  it('caseSensitive=false folds case-only changes', () => {
    const strict = diffLines('Hello', 'hello');
    const loose = diffLines('Hello', 'hello', { caseSensitive: false });
    expect(strict.some((l) => l.type !== 'same')).toBe(true);
    expect(loose.every((l) => l.type === 'same')).toBe(true);
  });

  it('handles CRLF input and empty strings', () => {
    expect(diffLines('', '')).toHaveLength(1); // one empty "same" line
    const d = diffLines('a\r\nb', 'a\nb');
    expect(d.every((l) => l.type === 'same')).toBe(true);
  });

  it('handles large inputs without crashing', () => {
    const a = Array.from({ length: 2000 }, (_, i) => `line ${i}`).join('\n');
    const b = Array.from({ length: 2000 }, (_, i) => (i === 999 ? 'changed' : `line ${i}`)).join('\n');
    const d = diffLines(a, b);
    expect(d.filter((l) => l.type === 'del')).toHaveLength(1);
    expect(d.filter((l) => l.type === 'add')).toHaveLength(1);
  });

  it('unified diff prefixes +, -, and spaces', () => {
    const d = diffLines('keep\nremove', 'keep\naddition');
    const u = unifiedDiff(d);
    expect(u).toContain('- remove');
    expect(u).toContain('+ addition');
    expect(u).toContain('  keep');
  });
});
