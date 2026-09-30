import { describe, expect, it } from 'vitest';
import {
  HIBP_RANGE_API,
  MalformedApiResponse,
  fmtCount,
  isValidPrefix,
  parseRangeBody,
  rangeUrl,
  sha1Hex,
} from './breachcheck';

// Known vector: SHA-1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PASSWORD_HASH = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';
const PASSWORD_PREFIX = '5BAA6';
const PASSWORD_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

// Tiny but realistically shaped range response (prefix 5BAA6), containing the
// known 'password' vector at its documented count.
const FIXTURE = [
  '003D68EB55068C33ACE5314F120EC4A8119:3',
  '01330C689E5AFA25E2B5A7A147F8B33E16A:2',
  `${PASSWORD_SUFFIX}:52372427`,
  '1F8AC10B93C953E4E4C2267F3910B2B7FFD:7',
  'FFC4A2C1234567890ABCDEF1234567890ABC:1',
].join('\n');

describe('sha1Hex', () => {
  it('hashes the known "password" vector', async () => {
    expect(await sha1Hex('password')).toBe(PASSWORD_HASH);
  });
  it('returns 40 uppercase hex chars', async () => {
    expect(await sha1Hex('correct horse battery staple')).toMatch(/^[0-9A-F]{40}$/);
  });
  it('is deterministic and input-sensitive', async () => {
    const a = await sha1Hex('abc');
    expect(await sha1Hex('abc')).toBe(a);
    expect(await sha1Hex('abd')).not.toBe(a);
  });
});

describe('rangeUrl', () => {
  it('builds the range URL from exactly the 5-char prefix', () => {
    expect(rangeUrl(PASSWORD_PREFIX)).toBe(`${HIBP_RANGE_API}5BAA6`);
  });
  it('the URL carries no more than 5 hash chars — never the full hash', () => {
    const url = rangeUrl(PASSWORD_PREFIX);
    expect(url).not.toContain(PASSWORD_HASH);
    expect(url.split('/').pop()).toBe('5BAA6');
  });
  it('rejects anything that is not 5 uppercase hex chars', () => {
    for (const bad of ['', '5BAA', '5BAA61', '5baa6', '5BAA6E4C9', 'ZZZZZ', '5BAA ', 'password']) {
      expect(() => rangeUrl(bad)).toThrow();
    }
  });
  it('isValidPrefix mirrors the same rule', () => {
    expect(isValidPrefix('5BAA6')).toBe(true);
    expect(isValidPrefix('5baa6')).toBe(false);
    expect(isValidPrefix('5BAA61')).toBe(false);
  });
});

describe('parseRangeBody', () => {
  it('finds the known breached suffix and its count', () => {
    expect(parseRangeBody(FIXTURE, PASSWORD_SUFFIX)).toBe(52372427);
  });
  it('returns 0 when the suffix is absent from a well-formed body', () => {
    expect(parseRangeBody(FIXTURE, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe(0);
  });
  it('is case-tolerant on the body lines', () => {
    const lower = FIXTURE.toLowerCase();
    expect(parseRangeBody(lower, PASSWORD_SUFFIX)).toBe(52372427);
  });
  it('throws MalformedApiResponse on an empty body', () => {
    expect(() => parseRangeBody('', PASSWORD_SUFFIX)).toThrow(MalformedApiResponse);
    expect(() => parseRangeBody('   \n  ', PASSWORD_SUFFIX)).toThrow(MalformedApiResponse);
  });
  it('throws MalformedApiResponse when no line is shaped like SUFFIX:COUNT', () => {
    expect(() => parseRangeBody('<html>oops</html>', PASSWORD_SUFFIX)).toThrow(MalformedApiResponse);
    expect(() => parseRangeBody('not-a-hash:nope\nstill bad', PASSWORD_SUFFIX)).toThrow(MalformedApiResponse);
  });
  it('tolerates a few stray lines as long as valid ones exist', () => {
    const body = `stray line here\n${FIXTURE}\n`;
    expect(parseRangeBody(body, PASSWORD_SUFFIX)).toBe(52372427);
  });
  it('rejects a malformed suffix argument', () => {
    expect(() => parseRangeBody(FIXTURE, 'short')).toThrow();
  });
});

describe('fmtCount', () => {
  it('formats with thousands separators', () => {
    expect(fmtCount(52372427)).toBe('52,372,427');
    expect(fmtCount(0)).toBe('0');
  });
});
