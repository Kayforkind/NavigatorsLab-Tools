/* Pure receipt-text parsing engine — no DOM, unit-testable. */

/** Pull candidate amounts from a line: $12.34, 12,34, 12.34, 1 234.56 */
export function amountsIn(line: string): number[] {
  const out: number[] = [];
  const re = /(?:[$€£¥]\s*)?(\d{1,6}(?:[ \u00a0,]\d{3})*(?:[.,]\d{2}))(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    let raw = m[1].replace(/[ \u00a0]/g, '');
    // if both separators exist, the last one is the decimal
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    if (lastComma > lastDot) raw = raw.replace(/\./g, '').replace(',', '.');
    else raw = raw.replace(/,/g, '');
    const v = parseFloat(raw);
    if (isFinite(v) && v > 0) out.push(v);
  }
  return out;
}

const TOTAL_HINTS = /^(grand\s*total|total|amount\s*due|balance\s*due|sum|summe|total\s*amount|to\s*pay)\b[:\s]*/i;
const SUBTOTAL_RE = /^sub\s*-?\s*total\b/i;
const TAX_RE = /^tax\b|^mwst\b|^vat\b/i;

/** Choose the best "total" for a receipt from its text lines. */
export function pickTotal(lines: string[]): { total: number | null; hint: string } {
  // 1. explicit total lines (skip subtotals/tax), scanning bottom-up
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (SUBTOTAL_RE.test(l) || TAX_RE.test(l)) continue;
    const m = TOTAL_HINTS.exec(l);
    if (m) {
      const amts = amountsIn(l.slice(m[0].length));
      if (amts.length) return { total: amts[amts.length - 1], hint: l.trim().slice(0, 40) };
    }
  }
  // 2. fall back to the largest amount anywhere (still skipping tax lines)
  let best: number | null = null;
  let hint = '';
  for (const l of lines) {
    if (TAX_RE.test(l)) continue;
    for (const a of amountsIn(l)) if (best == null || a > best) { best = a; hint = l.trim().slice(0, 40); }
  }
  return { total: best, hint };
}

/** First plausible merchant line: alphabetic, not a bare number/date. */
export function firstMerchantLine(lines: string[]): string {
  for (const l of lines) {
    const t = l.trim();
    if (t.length >= 3 && /[A-Za-z]{3}/.test(t) && !/^\d+([.,]\d+)?$/.test(t) && !/^\d{1,4}[/.-]\d{1,4}[/.-]\d{2,4}$/.test(t)) return t.slice(0, 60);
  }
  return '(unreadable)';
}
