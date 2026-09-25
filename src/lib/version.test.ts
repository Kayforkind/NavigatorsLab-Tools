import { describe, it, expect } from 'vitest';
import { VERSION, CHANGELOG } from './changelog';
import { AGENT_INFO } from './mcp';

/* The suite ships under ONE version number. It is easy to bump the changelog
 * and forget the MCP banner (that is exactly how AGENT_INFO drifted to 1.4.0
 * while the app was at 1.7.0), so the agreement is asserted here instead of
 * being left to reviewer memory. */

describe('suite version coherence', () => {
  it('VERSION is a three-part semver', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('the MCP banner reports the same version as the app', () => {
    expect(AGENT_INFO.version).toBe(VERSION);
  });

  it('the newest changelog entry is the shipped version', () => {
    expect(CHANGELOG[0].version).toBe(VERSION);
  });

  it('changelog is strictly newest-first with no duplicates', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const prev = CHANGELOG[i - 1].version.split('.').map(Number);
      const cur = CHANGELOG[i].version.split('.').map(Number);
      const prevNum = prev[0] * 1e6 + prev[1] * 1e3 + prev[2];
      const curNum = cur[0] * 1e6 + cur[1] * 1e3 + cur[2];
      expect(curNum, `${CHANGELOG[i].version} must sort below ${CHANGELOG[i - 1].version}`).toBeLessThan(prevNum);
    }
  });

  it('every entry carries at least one line of user-facing news', () => {
    for (const entry of CHANGELOG) {
      expect(entry.items.length, `${entry.version} has no items`).toBeGreaterThan(0);
      expect(entry.date.length).toBeGreaterThan(0);
    }
  });
});
