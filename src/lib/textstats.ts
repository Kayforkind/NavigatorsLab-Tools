/* Pure text-statistics engine (no DOM) — unit-testable. */

export interface TextStats {
  chars: number;
  charsNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  /** longest word — fun sanity check */
  longestWord: string;
  /** Flesch Reading Ease, 0–100 (higher = easier). 0 when no sentences. */
  flesch: number;
  /** grade-level interpretation of flesch */
  grade: string;
  /** reading time at 238 wpm (average silent adult) */
  readMinutes: number;
  speakMinutes: number;
  /** top keywords with counts (stopwords removed), at most `limit` */
  keywords: [string, number][];
}

const STOP = new Set(('a,an,and,are,as,at,be,but,by,for,from,has,have,he,her,his,i,if,in,into,is,it,its,of,on,or,she,that,the,their,them,then,there,they,this,to,was,were,will,with,you,your,our,we,us,not,no,do,does,did,can,could,should,would,may,might,must,shall,been,being,am,also,than,too,very,just,about,after,before,between,during,through,under,over,again,further,once,here,when,where,why,how,all,any,both,each,few,more,most,other,some,such,only,own,same,so,t,don,now').split(','));

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // collapse diphthongs & silent e, then count vowel groups
  const s = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '');
  const groups = s.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function analyze(text: string, opts: { keywordLimit?: number } = {}): TextStats {
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const wordsArr = text.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  const words = wordsArr.length;
  const sentences = (text.match(/[.!?]+(?=\s|$)/g) ?? []).length || (words ? 1 : 0);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const lines = text === '' ? 0 : text.split(/\r?\n/).length;

  let longestWord = '';
  let syllables = 0;
  const freq = new Map<string, number>();
  for (const raw of wordsArr) {
    const w = raw.toLowerCase().replace(/^['’-]+|['’-]+$/g, '');
    if (w.length > longestWord.length) longestWord = raw;
    syllables += countSyllables(raw);
    if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }

  // Flesch Reading Ease = 206.835 − 1.015(words/sentences) − 84.6(syllables/words)
  const flesch = words && sentences
    ? Math.max(0, Math.min(100, 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)))
    : 0;
  const grade =
    flesch === 0 ? '—' :
    flesch >= 90 ? 'very easy (5th grade)' :
    flesch >= 80 ? 'easy (6th grade)' :
    flesch >= 70 ? 'fairly easy (7th grade)' :
    flesch >= 60 ? 'plain English (8th–9th grade)' :
    flesch >= 50 ? 'fairly difficult (10th–12th)' :
    flesch >= 30 ? 'difficult (college)' : 'very difficult (graduate)';

  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.keywordLimit ?? 12);

  return {
    chars,
    charsNoSpaces,
    words,
    sentences,
    paragraphs,
    lines,
    longestWord,
    flesch: Math.round(flesch * 10) / 10,
    grade,
    readMinutes: words ? Math.max(1, Math.ceil(words / 238)) : 0,
    speakMinutes: words ? Math.max(1, Math.ceil(words / 140)) : 0,
    keywords,
  };
}
