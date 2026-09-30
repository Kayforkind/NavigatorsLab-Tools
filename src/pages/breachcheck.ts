/* Password Breach Checker — Have I Been Pwned Pwned Passwords range API.
 * Pure logic lives in ../lib/breachcheck (unit-tested); this module is the
 * DOM wiring. See the lib for the privacy design notes. */
import { $, status, announce } from '../lib/dom';
import {
  MalformedApiResponse,
  fmtCount,
  parseRangeBody,
  rangeUrl,
  sha1Hex,
} from '../lib/breachcheck';

const CHECK_TIMEOUT_MS = 15000;

const pwInput = $('#pwInput') as HTMLInputElement;
const btnCheck = $('#btnCheck') as HTMLButtonElement;
const btnClear = $('#btnClear') as HTMLButtonElement;
const btnShow = $('#btnShow') as HTMLButtonElement;
const resultPanel = $('#resultPanel');
const verdict = $('#verdict');
const resultDetail = $('#resultDetail');
const resultHash = $('#resultHash');
const live = $('#live');

function setVerdict(kind: 'bad' | 'good' | 'idle', html: string): void {
  verdict.innerHTML = html;
  verdict.style.color = kind === 'bad' ? '#ff7a7a' : kind === 'good' ? '#5eeaa8' : '';
}

let inFlight = false;

async function check(): Promise<void> {
  const pw = pwInput.value;
  if (!pw) {
    status(live, 'Type a password first.', 'warn');
    pwInput.focus();
    return;
  }
  if (inFlight) return; // no duplicate concurrent checks
  inFlight = true;
  btnCheck.disabled = true;
  resultPanel.hidden = false;
  setVerdict('idle', '⏳ Checking…');
  resultDetail.textContent = 'Hashing locally, then asking the breach corpus…';
  resultHash.textContent = '';
  announce('Checking the password against the breach corpus.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
  try {
    const hash = await sha1Hex(pw);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(rangeUrl(prefix), {
      headers: { 'Add-Padding': 'true' },
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      throw new Error('rate-limited (HTTP 429) — the free API asks for a short pause between bursts. Wait a minute and try again.');
    }
    if (!res.ok) throw new Error(`the breach API answered HTTP ${res.status}. Try again in a moment.`);

    const count = parseRangeBody(await res.text(), suffix);

    // Show only the 5-char prefix that actually left the browser — the
    // remaining hash characters add no product value and stay local.
    resultHash.textContent = `Only “${prefix}” (5 of 40 hash characters) left this browser — the rest was compared locally.`;

    if (count > 0) {
      setVerdict('bad', `⚠️ Found in <span style="font-variant-numeric:tabular-nums">${fmtCount(count)}</span> data breaches`);
      const plural = count === 1 ? 'time' : 'times';
      resultDetail.textContent =
        `This exact password has appeared ${fmtCount(count)} ${plural} in public breaches. ` +
        `Attackers try breached passwords first — change it everywhere you used it, and switch to a unique, manager-generated password.`;
      announce(`Breached. This password appeared ${fmtCount(count)} times in known data breaches. Change it everywhere.`);
      status(live, `Breached — seen ${fmtCount(count)} times.`, 'err');
    } else {
      setVerdict('good', '✅ Not found in any known breach');
      resultDetail.textContent =
        'This password does not appear in the public breach corpus. That is necessary, not sufficient — ' +
        'a short or guessable password can still fall to brute force. Prefer long, unique, manager-generated passwords.';
      announce('Good news: this password was not found in any known data breach.');
      status(live, 'Not found in any known breach.', 'ok');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setVerdict('idle', '❌ Check failed');
    if (err instanceof MalformedApiResponse) {
      resultDetail.textContent = msg;
    } else if (msg.startsWith('rate-limited') || msg.startsWith('the breach API')) {
      resultDetail.textContent = msg;
    } else if (err instanceof DOMException && err.name === 'AbortError') {
      resultDetail.textContent =
        `The breach API did not answer within ${CHECK_TIMEOUT_MS / 1000} seconds. Try again — your password never left this tab.`;
    } else {
      resultDetail.textContent =
        `Could not reach the breach API (${msg}). Check your connection and try again — your password never left this tab.`;
    }
    resultHash.textContent = '';
    status(live, 'Check failed: ' + resultDetail.textContent, 'err');
  } finally {
    clearTimeout(timer);
    inFlight = false;
    btnCheck.disabled = false;
  }
}

btnCheck.addEventListener('click', () => { void check(); });
pwInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); void check(); }
});

btnClear.addEventListener('click', () => {
  pwInput.value = '';
  resultPanel.hidden = true;
  verdict.textContent = '';
  resultDetail.textContent = '';
  resultHash.textContent = '';
  status(live, 'Cleared.', 'info');
  pwInput.focus();
});

btnShow.addEventListener('click', () => {
  const show = pwInput.type === 'password';
  pwInput.type = show ? 'text' : 'password';
  btnShow.textContent = show ? '🙈 Hide' : '👁 Show';
  btnShow.setAttribute('aria-pressed', String(show));
  pwInput.focus();
});

// Keep the password out of the page title / history state and never echo it.
pwInput.addEventListener('input', () => { resultPanel.hidden = true; });
