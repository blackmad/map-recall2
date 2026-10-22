// An original General-MIDI / FM-synth style soundtrack for the teaser,
// synthesised from scratch (no samples): 2-operator FM lead and bass, a pulse
// arpeggio, noise drums, a PC-speaker boot beep, a CD spin-up, FM "correct"
// chimes and transition whooshes. Writes a 16-bit stereo WAV.
//
//   import { renderMusic } from './music.mjs';
//   renderMusic({ out, duration, musicStart, dings: [s…], whooshes: [s…] });
import { writeFileSync } from 'node:fs';

const SR = 44100;
const TAU = Math.PI * 2;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const parse = (s) => { const m = /^([A-G])(#|b)?(\d)$/.exec(s); return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };

// Eighth-note melody: note, '-' holds, '.' rests.
const A = [
  'E5 G5 C6 - G5 E5 G5 A5', 'G5 - E5 C5 E5 - A4 -', 'F5 A5 C6 - A5 F5 A5 C6', 'D6 - B5 G5 D5 - . .',
  'E5 G5 C6 - D6 C6 B5 C6', 'A5 - E5 - C6 - A5 -', 'F5 G5 A5 C6 B5 A5 G5 F5', 'G5 - - - B5 - D6 -',
];
const B = [
  'A5 - C6 A5 F5 - A5 -', 'B5 - D6 B5 G5 - B5 -', 'G5 E5 G5 B5 E6 - D6 B5', 'C6 - A5 - E5 - . .',
  'F5 A5 C6 F6 E6 C6 A5 C6', 'D6 - B5 - G5 B5 D6 G6', 'E6 - C6 - G5 - E5 G5', 'C6 - - - - - . .',
];
const CHORDS = { C: [48, 52, 55], Am: [45, 48, 52], F: [41, 45, 48], G: [43, 47, 50], Em: [40, 43, 47] };
const PROG_A = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'];
const PROG_B = ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'];

function adsr(t, dur, a, d, s, r) {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * (t - a) / d;
  if (t < dur) return s;
  return Math.max(0, s * (1 - (t - dur) / r));
}

export function renderMusic({ out, duration = 47, musicStart = 3.5, bpm = 128, endAt = null, dings = [], whooshes = [], bootBeep = 0.25, discAt = [2.0, 3.4] }) {
  const n = Math.ceil(duration * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const add = (i, v, pan = 0) => { if (i >= 0 && i < n) { L[i] += v * (1 - pan) ; R[i] += v * (1 + pan); } };
  const beat = 60 / bpm, eighth = beat / 2, bar = beat * 4;

  // ---- voices ----
  const fmNote = (t0, f, dur, { ratio = 1, index = 2.5, indexDecay = 6, amp = 0.2, a = 0.005, d = 0.12, s = 0.6, r = 0.12, pan = 0, vib = 0 } = {}) => {
    const i0 = Math.floor(t0 * SR), len = Math.floor((dur + r) * SR);
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      const env = adsr(t, dur, a, d, s, r);
      const ix = index * Math.exp(-indexDecay * t) + index * 0.15;
      const fv = f * (1 + vib * Math.sin(TAU * 5.5 * t) * Math.min(1, t * 3));
      const v = Math.sin(TAU * fv * t + ix * Math.sin(TAU * fv * ratio * t));
      add(i0 + k, v * env * amp, pan);
    }
  };
  const pulse = (t0, f, dur, amp = 0.05, pan = 0, duty = 0.25) => {
    const i0 = Math.floor(t0 * SR), len = Math.floor((dur + 0.03) * SR);
    for (let k = 0; k < len; k++) {
      const t = k / SR, ph = (f * t) % 1;
      const env = adsr(t, dur, 0.002, 0.05, 0.5, 0.03);
      add(i0 + k, (ph < duty ? 1 : -1) * env * amp, pan);
    }
  };
  let seed = 1; const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
  const kick = (t0, amp = 0.55) => { const i0 = Math.floor(t0 * SR); let ph = 0; for (let k = 0; k < 0.28 * SR; k++) { const t = k / SR; const f = 48 + 110 * Math.exp(-t * 28); ph += f / SR; add(i0 + k, Math.sin(TAU * ph) * Math.exp(-t * 11) * amp); } };
  const snare = (t0, amp = 0.22) => { const i0 = Math.floor(t0 * SR); let lp = 0; for (let k = 0; k < 0.2 * SR; k++) { const t = k / SR; const nz = noise(); lp += (nz - lp) * 0.5; add(i0 + k, (lp * 0.8 * Math.exp(-t * 18) + Math.sin(TAU * 185 * t) * 0.5 * Math.exp(-t * 30)) * amp); } };
  const hat = (t0, amp = 0.06, open = false) => { const i0 = Math.floor(t0 * SR); let prev = 0; const len = (open ? 0.18 : 0.04) * SR; for (let k = 0; k < len; k++) { const t = k / SR; const nz = noise(); const hp = nz - prev; prev = nz; add(i0 + k, hp * Math.exp(-t * (open ? 18 : 90)) * amp, 0.25); } };
  const chime = (t0, amp = 0.16) => { [84, 91, 96].forEach((m, j) => fmNote(t0 + j * 0.07, midi(m), 0.25, { ratio: 3.5, index: 1.6, indexDecay: 4, amp: amp * (1 - j * 0.15), a: 0.002, d: 0.3, s: 0.25, r: 0.5, pan: (j - 1) * 0.3 })); };
  const whoosh = (t0, dur = 0.45, amp = 0.12) => { const i0 = Math.floor(t0 * SR); let lp = 0; for (let k = 0; k < dur * SR; k++) { const t = k / SR, u = t / dur; const cut = 0.02 + 0.5 * Math.sin(Math.PI * u); lp += (noise() - lp) * cut; add(i0 + k, lp * Math.sin(Math.PI * u) * amp, Math.sin(TAU * u) * 0.5); } };

  // ---- boot: PC-speaker beep, then the CD spinning up ----
  if (bootBeep != null) { const i0 = Math.floor(bootBeep * SR); for (let k = 0; k < 0.16 * SR; k++) add(i0 + k, ((k * 1000 / SR) % 1 < 0.5 ? 1 : -1) * 0.07); }
  // drive seek clicks while the text types
  for (let t = 0.5; t < discAt[0]; t += 0.11 + ((t * 7) % 0.13)) { const i0 = Math.floor(t * SR); for (let k = 0; k < 0.012 * SR; k++) add(i0 + k, noise() * 0.05 * Math.exp(-k / (0.003 * SR))); }
  { const [a, b] = discAt; const i0 = Math.floor(a * SR); let ph = 0, lp = 0; for (let k = 0; k < (b - a) * SR; k++) { const u = k / ((b - a) * SR); const f = 90 + 900 * u * u; ph += f / SR; lp += (noise() - lp) * 0.08; add(i0 + k, (Math.sin(TAU * ph) * 0.05 + lp * 0.12) * Math.min(1, u * 4) * (1 - Math.max(0, (u - 0.85) / 0.15))); } }

  // ---- music ----
  const stop = endAt ?? duration;
  const bars = [];
  // two-bar intro on the logo: stabs + drum fill
  bars.push({ kind: 'intro', chord: 'C' }, { kind: 'intro2', chord: 'G' });
  A.forEach((m, i) => bars.push({ kind: 'main', mel: m, chord: PROG_A[i] }));
  B.forEach((m, i) => bars.push({ kind: 'main', mel: m, chord: PROG_B[i] }));
  A.forEach((m, i) => bars.push({ kind: 'main', mel: m, chord: PROG_A[i] }));
  let finalAt = null;
  for (let b = 0; b < bars.length; b++) {
    const t0 = musicStart + b * bar;
    if (t0 + bar > stop - 0.01) { finalAt = t0; break; }
    const { kind, mel, chord } = bars[b];
    const ch = CHORDS[chord];
    if (kind === 'intro' || kind === 'intro2') {
      // brass-ish stabs
      const hits = kind === 'intro' ? [0, 1.5, 3] : [0, 1.5, 2.5, 3, 3.5];
      for (const h of hits) for (const m of ch) fmNote(t0 + h * beat, midi(m + 12), beat * 0.4, { ratio: 1, index: 3, amp: 0.07, d: 0.1, s: 0.5 });
      kick(t0); if (kind === 'intro2') { [2, 2.5, 3, 3.25, 3.5, 3.75].forEach(x => snare(t0 + x * beat, 0.16 + x * 0.02)); }
      fmNote(t0, midi(ch[0] - 12), bar * 0.95, { ratio: 0.5, index: 1.5, amp: 0.16, s: 0.7 });
      continue;
    }
    // drums: four-on-the-floor-ish 90s groove
    for (let q = 0; q < 4; q++) {
      if (q === 0 || q === 2) kick(t0 + q * beat);
      if (q === 1 || q === 3) snare(t0 + q * beat);
      hat(t0 + q * beat + eighth, 0.07, q === 3 && b % 2 === 1);
      hat(t0 + q * beat, 0.035);
    }
    if (b % 4 === 3) kick(t0 + 3.5 * beat, 0.4);
    // bass: octave-bouncing eighths
    for (let e = 0; e < 8; e++) {
      const m = ch[0] - 12 + (e % 2 ? 12 : 0) + (e === 6 ? 7 : 0);
      fmNote(t0 + e * eighth, midi(m), eighth * 0.8, { ratio: 0.5, index: 2.2, indexDecay: 14, amp: 0.15, d: 0.08, s: 0.55, r: 0.04 });
    }
    // arpeggio: sixteenths through the chord
    for (let s = 0; s < 16; s++) {
      const m = ch[s % 3] + 24 + (s % 6 >= 3 ? 12 : 0);
      pulse(t0 + s * eighth / 2, midi(m), eighth / 2 * 0.7, 0.022, s % 2 ? 0.35 : -0.35, 0.125);
    }
    // pad
    for (const m of ch) fmNote(t0, midi(m + 12), bar * 0.98, { ratio: 2, index: 0.6, indexDecay: 0.5, amp: 0.025, a: 0.15, d: 0.3, s: 0.8, r: 0.2, pan: (m % 3 - 1) * 0.4 });
    // lead
    const toks = mel.split(/\s+/);
    for (let e = 0; e < toks.length; e++) {
      const tok = toks[e];
      if (tok === '-' || tok === '.') continue;
      let len = 1; while (toks[e + len] === '-') len++;
      fmNote(t0 + e * eighth, midi(parse(tok)), eighth * len * 0.92, { ratio: 1, index: 2.4, indexDecay: 5, amp: 0.13, d: 0.15, s: 0.65, r: 0.1, vib: len > 1 ? 0.006 : 0, pan: -0.1 });
      // echo
      fmNote(t0 + e * eighth + eighth * 1.5, midi(parse(tok)), eighth * len * 0.8, { ratio: 1, index: 1.2, indexDecay: 5, amp: 0.04, d: 0.15, s: 0.5, r: 0.1, pan: 0.5 });
    }
  }
  if (finalAt != null) {
    // closing chord: C major with a little cymbal swell
    const dur = Math.max(0.5, duration - finalAt - 0.4);
    for (const m of [48, 52, 55, 60, 64, 67, 72]) fmNote(finalAt, midi(m + 12), dur, { ratio: 1, index: 2, indexDecay: 2, amp: 0.05, a: 0.01, d: 0.4, s: 0.6, r: 0.4 });
    fmNote(finalAt, midi(36), dur, { ratio: 0.5, index: 1.5, amp: 0.2, s: 0.7, r: 0.4 });
    fmNote(finalAt, midi(84), dur * 0.6, { ratio: 1, index: 2.4, amp: 0.12, d: 0.3, s: 0.5, r: 0.4, vib: 0.008 });
    kick(finalAt); snare(finalAt, 0.18);
    const i0 = Math.floor(finalAt * SR); for (let k = 0; k < 1.6 * SR; k++) { const t = k / SR; add(i0 + k, noise() * 0.05 * Math.exp(-t * 2.2), 0.2); }
  }
  for (const t of dings) chime(t);
  for (const t of whooshes) whoosh(t - 0.15);

  // ---- master: soft clip, fade out, write ----
  let peak = 0;
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * 1.1); R[i] = Math.tanh(R[i] * 1.1); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const gain = 0.89 / (peak || 1);
  const fade = Math.floor(0.6 * SR);
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const f = i > n - fade ? (n - i) / fade : 1;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain * f)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain * f)) * 32767), 46 + i * 4);
  }
  writeFileSync(out, buf);
  return { finalAt };
}
