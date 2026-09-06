import { describe, it, expect } from 'vitest';
import { analyze } from './textstats';

describe('analyze', () => {
  it('empty text → zeroed stats, no crash', () => {
    const s = analyze('');
    expect(s.words).toBe(0);
    expect(s.sentences).toBe(0);
    expect(s.lines).toBe(0);
    expect(s.readMinutes).toBe(0);
    expect(s.grade).toBe('—');
  });

  it('counts words, sentences, paragraphs, lines', () => {
    const s = analyze('One two three.\n\nFour five!\nLine A\nLine B');
    expect(s.words).toBe(9);
    expect(s.sentences).toBe(2);
    expect(s.paragraphs).toBe(2);
    expect(s.lines).toBe(5); // ['One two three.', '', 'Four five!', 'Line A', 'Line B']
  });

  it('charsNoSpaces excludes whitespace only', () => {
    const s = analyze('ab  cd\n');
    expect(s.chars).toBe(7);
    expect(s.charsNoSpaces).toBe(4);
  });

  it('reading time is ceil(words/238) with a 1-minute floor for short text', () => {
    expect(analyze('one two three').readMinutes).toBe(1);
    const long = analyze(Array.from({ length: 238 * 2 + 50 }, () => 'word').join(' '));
    expect(long.readMinutes).toBe(3); // 526 words → ceil(526/238)=3
  });

  it('simple text scores easy, dense text scores hard', () => {
    const easy = analyze('I see the cat. The cat is big. We run fast. It was fun!');
    const hard = analyze(
      'Notwithstanding the aforementioned considerations, the implementation necessitates a comprehensive multidisciplinary characterization of anthropogenic phenomena.',
    );
    expect(easy.flesch).toBeGreaterThan(hard.flesch);
    expect(hard.flesch).toBeLessThan(50);
  });

  it('keywords exclude stopwords and short/numeric tokens, sorted desc', () => {
    const s = analyze('navigator lab navigator lab tools tools tools a the 42 tools');
    expect(s.keywords[0]).toEqual(['tools', 4]);
    expect(s.keywords.some(([w]) => w === 'the' || w === 'a' || w === '42')).toBe(false);
  });

  it('syllable counter is sane on known words', () => {
    // "cat"=1, "hello"=2, "beautiful"=3 → flesch math stays positive & bounded
    const s = analyze('cat hello beautiful.');
    expect(s.flesch).toBeGreaterThan(0);
    expect(s.flesch).toBeLessThanOrEqual(100);
  });

  it('unicode words are counted (Turkish/German)', () => {
    const s = analyze('İstanbul sokaklarında güzel bir gün. Übermäßige Wörter zählen mit.');
    expect(s.words).toBe(9);
    expect(s.keywords.some(([w]) => w === 'sokaklarında' || w === 'übermäßige')).toBe(true);
  });
});
