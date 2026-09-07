import { $, pickFiles, onDrop, download, status, fmtBytes, toast } from '../lib/dom';

const dz = $('#dz');
const panel = $('#panel');
const wave = $('#wave') as HTMLCanvasElement;
const stat = $('#stat');
const info = $('#info');
const t0 = $('#t0') as HTMLInputElement;
const t1 = $('#t1') as HTMLInputElement;
const fin = $('#fin') as HTMLInputElement;
const fout = $('#fout') as HTMLInputElement;
const fmt = $('#fmt') as HTMLSelectElement;
const bitrate = $('#bitrate') as HTMLSelectElement;
const brWrap = $('#brWrap');
const playBtn = $('#play') as HTMLButtonElement;
const stopBtn = $('#stop') as HTMLButtonElement;

let buf: AudioBuffer | null = null;
let fileName = 'clip';
let audioCtx: AudioContext | null = null;
let curSrc: AudioBufferSourceNode | null = null;
let sel = { a: 0, b: 0 };
let dragging: 'a' | 'b' | null = null;

dz.addEventListener('click', () => void pick());
onDrop(dz, (files) => { const f = files[0]; if (f) void load(f); });
fmt.addEventListener('change', () => { brWrap.hidden = fmt.value !== 'mp3'; });
playBtn.addEventListener('click', () => void playSel());
stopBtn.addEventListener('click', stop);
$('#exp').addEventListener('click', () => void exportSel());
t0.addEventListener('change', () => { sel.a = clampT(parseFloat(t0.value) || 0); draw(); });
t1.addEventListener('change', () => { sel.b = clampT(parseFloat(t1.value) || 0); draw(); });

async function pick(): Promise<void> {
  const [f] = await pickFiles('audio/*', { multiple: false });
  if (f) await load(f);
}

async function load(f: File): Promise<void> {
  try {
    status(stat, 'Decoding…', 'info');
    audioCtx = audioCtx || new AudioContext();
    const ab = await f.arrayBuffer();
    buf = await audioCtx.decodeAudioData(ab);
    fileName = f.name.replace(/\.[^.]+$/, '');
    sel = { a: 0, b: buf.duration };
    t0.value = '0'; t1.value = buf.duration.toFixed(2);
    info.textContent = `${f.name} · ${fmtBytes(f.size)} · ${buf.duration.toFixed(1)}s · ${buf.sampleRate}Hz · ${buf.numberOfChannels}ch`;
    panel.hidden = false;
    draw();
    status(stat, 'Loaded. Drag the handles on the waveform to pick a region.', 'ok');
  } catch (e) {
    status(stat, `Could not decode: ${(e as Error).message}`, 'err');
  }
}

function clampT(v: number): number {
  const d = buf?.duration ?? 0;
  return Math.max(0, Math.min(d, v));
}

function tToX(t: number): number {
  return (t / (buf?.duration || 1)) * wave.width;
}
function xToT(x: number): number {
  return (x / wave.width) * (buf?.duration || 1);
}

function draw(): void {
  if (!buf) return;
  const ctx = wave.getContext('2d')!;
  const { width: W, height: H } = wave;
  ctx.clearRect(0, 0, W, H);
  // background
  ctx.fillStyle = '#0d1320';
  ctx.fillRect(0, 0, W, H);
  // waveform (min/max per column)
  const ch = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(ch.length / W));
  ctx.strokeStyle = '#4f8cff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    let min = 1, max = -1;
    const start = x * step;
    for (let i = 0; i < step; i += 4) {
      const v = ch[start + i] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y0 = ((1 - max) / 2) * H;
    const y1 = ((1 - min) / 2) * H;
    ctx.moveTo(x + 0.5, y0);
    ctx.lineTo(x + 0.5, Math.max(y1, y0 + 1));
  }
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // selection overlay
  const a = tToX(Math.min(sel.a, sel.b));
  const b = tToX(Math.max(sel.a, sel.b));
  ctx.fillStyle = 'rgba(79,140,255,0.18)';
  ctx.fillRect(a, 0, b - a, H);
  // handles
  ctx.fillStyle = '#4f8cff';
  ctx.fillRect(a - 2, 0, 4, H);
  ctx.fillRect(b - 2, 0, 4, H);
  // time ruler
  ctx.fillStyle = '#9aa7bd';
  ctx.font = '11px monospace';
  for (let t = 0; t < (buf?.duration || 0); t += Math.max(1, Math.round((buf?.duration || 10) / 10))) {
    const x = tToX(t);
    ctx.fillRect(x, H - 6, 1, 6);
    ctx.fillText(`${t}s`, x + 3, H - 8);
  }
}

wave.addEventListener('pointerdown', (e) => {
  if (!buf) return;
  const r = wave.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * wave.width;
  const da = Math.abs(x - tToX(sel.a));
  const db = Math.abs(x - tToX(sel.b));
  dragging = da < db ? 'a' : 'b';
  wave.setPointerCapture(e.pointerId);
  drag(e);
});
wave.addEventListener('pointermove', (e) => { if (dragging) drag(e); });
wave.addEventListener('pointerup', () => { dragging = null; });

function drag(e: PointerEvent): void {
  const r = wave.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * wave.width;
  const t = clampT(xToT(x));
  sel[dragging!] = t;
  t0.value = Math.min(sel.a, sel.b).toFixed(2);
  t1.value = Math.max(sel.a, sel.b).toFixed(2);
  draw();
}

function stop(): void {
  if (curSrc) { try { curSrc.stop(); } catch { /* already stopped */ } curSrc = null; }
}

async function playSel(): Promise<void> {
  if (!buf) return;
  stop();
  audioCtx = audioCtx || new AudioContext();
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  const a = Math.min(sel.a, sel.b);
  const b = Math.max(sel.a, sel.b);
  src.start(0, a, Math.max(0.01, b - a));
  curSrc = src;
  src.onended = () => { curSrc = null; };
}

/* ---------- export ---------- */
async function exportSel(): Promise<void> {
  if (!buf) return;
  const a = Math.min(sel.a, sel.b);
  const b = Math.max(sel.a, sel.b);
  const sr = buf.sampleRate;
  const i0 = Math.floor(a * sr);
  const i1 = Math.min(buf.length, Math.ceil(b * sr));
  const n = Math.max(1, i1 - i0);
  const fadeN0 = Math.floor((parseFloat(fin.value) || 0) * sr);
  const fadeN1 = Math.floor((parseFloat(fout.value) || 0) * sr);
  // build Float32 channels for selection with fades
  const chans: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) {
    const src = buf.getChannelData(c);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = src[i0 + i] || 0;
      if (i < fadeN0) v *= i / fadeN0;
      if (i > n - fadeN1) v *= (n - i) / fadeN1;
      out[i] = v;
    }
    chans.push(out);
  }
  if (($('#norm') as HTMLInputElement).checked) {
    const { normalizeGain } = await import('../lib/enhance');
    const gain = normalizeGain(chans);
    if (gain !== 1) {
      for (const ch of chans) for (let i = 0; i < ch.length; i++) ch[i] = Math.min(0.9988, ch[i] * gain);
    }
    status(stat, `Normalize gain applied: ×${gain.toFixed(2)}.`, 'info');
  }
  if (fmt.value === 'wav') {
    const blob = encodeWav(chans, sr);
    download(blob, `${fileName}-trim.wav`);
    status(stat, `WAV exported (${fmtBytes(blob.size)}).`, 'ok');
  } else {
    status(stat, 'Encoding MP3…', 'info');
    const blob = await encodeMp3(chans, sr, parseInt(bitrate.value, 10));
    download(blob, `${fileName}-trim.mp3`);
    status(stat, `MP3 exported (${fmtBytes(blob.size)}).`, 'ok');
  }
  toast('Exported 🎧');
}

function encodeWav(chans: Float32Array[], sampleRate: number): Blob {
  const nCh = chans.length;
  const n = chans[0].length;
  const bytesPerSample = 2;
  const dataSize = n * nCh * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  wstr(8, 'WAVE');
  wstr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, nCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * nCh * bytesPerSample, true);
  view.setUint16(32, nCh * bytesPerSample, true);
  view.setUint16(34, 16, true);
  wstr(36, 'data');
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

let lameMod: unknown = null;
async function encodeMp3(chans: Float32Array[], sampleRate: number, kbps: number): Promise<Blob> {
  if (!lameMod) {
    // lamejs 1.2.1 ships as a classic script; copied to /lamejs/ at build time
    const url = new URL('/lamejs/lame.min.js', import.meta.url).toString();
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url; s.onload = () => resolve(); s.onerror = () => reject(new Error('lamejs load failed'));
      document.head.appendChild(s);
    });
    lameMod = (window as unknown as { lamejs?: unknown }).lamejs;
    if (!lameMod) throw new Error('lamejs not available');
  }
  const lamejsCtor = lameMod as { Mp3Encoder: new (ch: number, sr: number, kbps: number) => {
    encodeBuffer: (l: Int16Array, r?: Int16Array) => Int8Array;
    flush: () => Int8Array;
  } };
  const enc = new lamejsCtor.Mp3Encoder(chans.length, sampleRate, kbps);
  const l = floatTo16(chans[0]);
  const r = chans[1] ? floatTo16(chans[1]) : undefined;
  const chunks: Uint8Array[] = [];
  const block = 1152 * 20;
  for (let i = 0; i < l.length; i += block) {
    const lc = l.subarray(i, i + block);
    const rc = r ? r.subarray(i, i + block) : undefined;
    const out = rc ? enc.encodeBuffer(lc, rc) : enc.encodeBuffer(lc);
    if (out.length) chunks.push(new Uint8Array(out));
  }
  const end = enc.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}

function floatTo16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}
