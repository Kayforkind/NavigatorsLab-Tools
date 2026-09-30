/* Password Breach Checker — pure, testable logic (no DOM).
 *
 * Privacy design (k-anonymity, the HIBP Pwned Passwords range API's own model):
 *  1. SHA-1(password) is computed locally with crypto.subtle.
 *  2. Only the first 5 hex chars of the hash leave the browser, as the
 *     range-API path segment: GET https://api.pwnedpasswords.com/range/5BAA6
 *  3. The API returns every breached suffix sharing that prefix (hundreds to
 *     a few thousand lines of SUFFIX:COUNT); the match against the remaining
 *     35 chars happens locally. The password — and even the full hash —
 *     never hits the wire.
 *
 * K-anonymity reduces disclosure; it is not zero-information. A 5-char hex
 * prefix narrows the candidate set to every breached password sharing those
 * 20 bits — on the order of 1 in 500 of the corpus — so the prefix alone
 * cannot identify the password, but it does disclose that the user's hash
 * starts with those characters to whoever observes the request. */

export const HIBP_RANGE_API = 'https://api.pwnedpasswords.com/range/';
export const PREFIX_LEN = 5;

/** Uppercase hex SHA-1 of the input, computed locally. */
export async function sha1Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function isValidPrefix(prefix: string): boolean {
  return /^[0-9A-F]{5}$/.test(prefix);
}

/** Build the range-API URL. Only a validated 5-char prefix may form the URL —
 *  anything else throws, so a programming slip can never smuggle more of the
 *  hash (or the password) onto the wire. */
export function rangeUrl(prefix: string): string {
  if (!isValidPrefix(prefix)) {
    throw new Error(`refusing to build a range URL from an invalid prefix: ${JSON.stringify(prefix)}`);
  }
  return HIBP_RANGE_API + prefix;
}

export class MalformedApiResponse extends Error {
  constructor(detail: string) {
    super(`the breach API returned an unrecognised response (${detail}). Try again in a moment.`);
    this.name = 'MalformedApiResponse';
  }
}

const SUFFIX_RE = /^[0-9A-F]{35}:\d+$/;

/**
 * Parse a Pwned Passwords range response and find the breach count for
 * `suffix` (the remaining 35 hash chars, uppercase). Returns the count, or 0
 * when the suffix is absent from a well-formed response.
 *
 * Throws MalformedApiResponse when the body is empty or contains no
 * well-formed SUFFIX:COUNT lines — a fully malformed HTTP-200 body must never
 * be misreported as "not found".
 */
export function parseRangeBody(body: string, suffix: string): number {
  if (!/^[0-9A-F]{35}$/.test(suffix)) {
    throw new Error('suffix must be 35 uppercase hex chars');
  }
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new MalformedApiResponse('empty body');
  let wellFormed = 0;
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (!SUFFIX_RE.test(upper)) continue; // tolerate stray lines, but require some valid ones
    wellFormed++;
    const [sfx, n] = upper.split(':');
    if (sfx === suffix) return parseInt(n, 10) || 0;
  }
  if (wellFormed === 0) throw new MalformedApiResponse(`${lines.length} lines, none shaped like SUFFIX:COUNT`);
  return 0;
}

export function fmtCount(n: number): string {
  return n.toLocaleString('en-US');
}
