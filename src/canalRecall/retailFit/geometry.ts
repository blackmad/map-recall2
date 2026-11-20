// Tenant layers as flat coloured triangles inside one host opening (lane retail-fit-20261120). Every layer is clipped
// to the opening's outline (a flat, segmental or round head) and stands a few centimetres proud of its glass, under the
// archivolt and reveal, so a tenant can colour, letter and furnish the opening but never cover the host's stone.
import { letteringGeometry } from '../buildingRecipe/signage.js';
import type { FitLayer, FitMesh, HostOpening } from './types.js';

/** How far each layer stands proud of the glass (m), in drawing order; all under the Hirschgebouw's 0.07 m archivolt. */
export const FIT_OUT: Readonly<Record<FitLayer['k'], number>> = {
  interior: 0.008, goods: 0.016, lamps: 0.018, vinyl: 0.024, posters: 0.03, panel: 0.024, band: 0.036, 'glass-letters': 0.044, 'head-letters': 0.044, door: 0.05, frame: 0.054,
};
const LETTER_STEP = 0.004;
/** Columns an arched region is cut into (its head is followed column by column). */
const COLS = 16;

const srgb = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function linearOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [srgb(((n >> 16) & 255) / 255), srgb(((n >> 8) & 255) / 255), srgb((n & 255) / 255)];
}

/** Deterministic 0..1 noise from integers (vinyl patterns, goods colours). */
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

export class FitBuilder {
  readonly pos: number[] = []; readonly nrm: number[] = []; readonly col: number[] = [];
  constructor(private readonly op: HostOpening) {}
  get W() { return this.op.widthM; }
  /** Opening height (m above the sill) to the springing and the crown. */
  get S() { return this.op.springM - this.op.sillM; }
  get C() { return this.op.crownM - this.op.sillM; }
  /** The outline's top at `u` (m from the centre, reader's right positive), above the sill. */
  top(u: number): number {
    const { W, S, C } = this;
    if (this.op.head === 'flat') return C;
    const q = 1 - (2 * u / W) ** 2;
    return S + (C - S) * Math.sqrt(Math.max(0, q));
  }
  private p(u: number, v: number, out: number): [number, number, number] {
    const o = this.op;
    return [o.base[0] + o.t[0] * u + o.n[0] * out, o.sillM + v, o.base[2] + o.t[1] * u + o.n[1] * out];
  }
  /** One triangle, counter-clockwise in (u, v) = facing out. */
  tri(a: [number, number], b: [number, number], c: [number, number], out: number, hex: string): void {
    const rgb = linearOf(hex);
    for (const [u, v] of [a, b, c]) { this.pos.push(...this.p(u, v, out)); this.nrm.push(this.op.n[0], 0, this.op.n[1]); this.col.push(...rgb); }
  }
  quad(u0: number, v0: number, u1: number, v1: number, out: number, hex: string): void {
    if (u1 - u0 < 1e-4 || v1 - v0 < 1e-4) return;
    this.tri([u0, v0], [u1, v0], [u1, v1], out, hex); this.tri([u0, v0], [u1, v1], [u0, v1], out, hex);
  }
  /** The opening's region between `v0` and `v1` (above the sill), `inset` inside its outline, clipped to the head. */
  region(v0: number, v1: number, inset: number, out: number, hex: string, u0 = -this.W / 2, u1 = this.W / 2): void {
    const a = Math.max(u0, -this.W / 2 + inset), b = Math.min(u1, this.W / 2 - inset);
    const lo = Math.max(v0, inset * 0.5);
    for (let i = 0; i < COLS; i++) {
      const ua = a + (b - a) * i / COLS, ub = a + (b - a) * (i + 1) / COLS;
      const ha = Math.min(v1, this.top(ua) - inset), hb = Math.min(v1, this.top(ub) - inset);
      if (ha <= lo && hb <= lo) continue;
      const ta = Math.max(ha, lo), tb = Math.max(hb, lo);
      this.tri([ua, lo], [ub, lo], [ub, tb], out, hex);
      if (ta > lo) this.tri([ua, lo], [ub, tb], [ua, ta], out, hex);
    }
  }
  /** A band `w` wide just inside the outline (the frame round the glass), plus the sill bar. */
  ring(w: number, out: number, hex: string): void {
    const { W, S } = this;
    this.quad(-W / 2, 0, -W / 2 + w, S, out, hex);
    this.quad(W / 2 - w, 0, W / 2, S, out, hex);
    this.quad(-W / 2, 0, W / 2, w, out, hex);
    for (let i = 0; i < COLS; i++) {
      const ua = -W / 2 + W * i / COLS, ub = -W / 2 + W * (i + 1) / COLS;
      const ta = this.top(ua), tb = this.top(ub);
      if (this.op.head === 'flat' && i > 0 && i < COLS - 1) { this.quad(ua, ta - w, ub, tb, out, hex); continue; }
      this.tri([ua, ta - w], [ub, tb - w], [ub, tb], out, hex); this.tri([ua, ta - w], [ub, tb], [ua, ta], out, hex);
    }
  }
  /** A regular polygon (lamps, marks). */
  disc(u: number, v: number, r: number, out: number, hex: string, sides = 8): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      this.tri([u, v], [u + r * Math.cos(a0), v + r * Math.sin(a0)], [u + r * Math.cos(a1), v + r * Math.sin(a1)], out, hex);
    }
  }
  /** Stroke-font letters (signage.ts) centred at (u, v), `h` tall, at most `maxW` wide. Returns the width drawn. */
  letters(text: string, u: number, v: number, h: number, maxW: number, out: number, hex: string): number {
    const L = letteringGeometry({ text, heightM: h, maxWidthM: maxW });
    const P = L.positions;
    for (let i = 0; i + 8 < P.length; i += 9) this.tri([u + P[i], v + P[i + 1]], [u + P[i + 3], v + P[i + 4]], [u + P[i + 6], v + P[i + 7]], out, hex);
    return L.widthM;
  }
  mesh(): FitMesh {
    return { positions: Float32Array.from(this.pos), normals: Float32Array.from(this.nrm), colors: Float32Array.from(this.col), triangles: this.pos.length / 9 };
  }
}

/** Draw one tenant's layers in its opening. `seed` varies goods and patterns between openings. */
export function drawLayers(b: FitBuilder, layers: readonly FitLayer[], seed = 0): void {
  const { W, S, C } = b;
  layers.forEach((L, li) => {
    const out = FIT_OUT[L.k] + li * 0.0005;
    switch (L.k) {
      case 'interior': b.region(L.v0 ?? 0, L.v1 ?? C, 0.02, out, L.hex); break;
      case 'goods': {
        const hx = (i: number) => L.hexes[i % L.hexes.length];
        if (L.kind === 'tables') {
          const n = Math.max(1, Math.floor(W / 1.5));
          for (let i = 0; i < n; i++) {
            const uc = -W / 2 + W * (i + 0.5) / n, half = Math.min(0.55, W / n * 0.38);
            b.quad(uc - half, 0.78, uc + half, 0.86, out, hx(0));
            b.quad(uc - half + 0.05, 0.05, uc - half + 0.1, 0.78, out, hx(1));
            b.quad(uc + half - 0.1, 0.05, uc + half - 0.05, 0.78, out, hx(1));
            // a few lit screens on the table
            for (let k = 0; k < 2; k++) b.quad(uc - half * 0.7 + k * half * 0.9, 0.86, uc - half * 0.7 + k * half * 0.9 + 0.22, 0.98, out + 0.001, hx(2));
          }
        } else if (L.kind === 'shelves') {
          const top = Math.min(S - 0.2, 2.1);
          for (let r = 0, v = 0.25; v + 0.2 < top; v += 0.34, r++) {
            const cells = Math.max(3, Math.round(W / 0.22));
            for (let c = 0; c < cells; c++) {
              const ua = -W / 2 + 0.1 + (W - 0.2) * c / cells, ub = ua + (W - 0.2) / cells - 0.03;
              b.quad(ua, v, ub, v + 0.16, out, hx(Math.floor(hash(seed + r, c) * L.hexes.length)));
            }
          }
        } else if (L.kind === 'rails') {
          b.quad(-W * 0.4, 1.6, W * 0.4, 1.64, out, hx(0));
          const n = Math.max(4, Math.round(W / 0.12));
          for (let i = 0; i < n; i++) { const ua = -W * 0.38 + W * 0.76 * i / n; b.quad(ua, 0.75 + hash(seed, i) * 0.2, ua + 0.08, 1.6, out, hx(1 + (i % (L.hexes.length - 1 || 1)))); }
        } else if (L.kind === 'sleeves') {
          // Record sleeves faced out in the display (Concerto, Utrechtsestraat): rows of 0.3 m squares on low racks, a few
          // gaps, up to 1.7 m or under the head.
          const top = Math.min(1.75, S - 0.25), cell = 0.3, gap = 0.04;
          for (let v = 0.12, r = 0; v + cell < top; v += cell + gap, r++) for (let u = -W / 2 + 0.1, c = 0; u + cell < W / 2 - 0.1; u += cell + gap, c++) {
            const h0 = hash(seed + r * 13, c);
            if (h0 < 0.12) continue;
            b.quad(u, v, u + cell, v + cell, out, hx(Math.floor(hash(c + 7, seed + r) * L.hexes.length)));
          }
        } else if (L.kind === 'curtains') {
          // Drawn-back curtains at both jambs (a hotel or café window: the American Hotel's Leidsekade front), folds as
          // alternating tones, from just under the head to the sill; hexes = [cloth, fold].
          const cw = Math.min(0.42, W * 0.24), folds = 4;
          for (const side of [-1, 1]) for (let f = 0; f < folds; f++) {
            const ua = side < 0 ? -W / 2 + 0.05 + cw * f / folds : W / 2 - 0.05 - cw * (f + 1) / folds, ub = ua + cw / folds;
            b.region(0.04, C - 0.12, 0, out, hx(f % 2), ua, ub);
          }
        } else {
          const n = Math.max(2, Math.floor(W / 0.9));
          for (let i = 0; i < n; i++) { const uc = -W / 2 + W * (i + 0.5) / n; b.quad(uc - 0.3, 0.4, uc + 0.3, 0.7, out, hx(i)); b.quad(uc - 0.3, 0.7, uc - 0.22, 1.1, out, hx(i)); }
        }
        break;
      }
      case 'lamps': {
        const n = L.n ?? Math.max(1, Math.round(W / 1.6)), v = Math.min(S, C - 0.6);
        for (let i = 0; i < n; i++) { const uc = -W / 2 + W * (i + 0.5) / n; b.quad(uc - 0.01, v, uc + 0.01, Math.min(b.top(uc) - 0.05, v + 0.9), out, '#3a3a3a'); b.disc(uc, v, 0.16, out + 0.001, L.hex); }
        break;
      }
      case 'vinyl': {
        b.region(0, C, 0.03, out, L.base);
        if (L.pattern === 'delft' && L.ink) {
          // Delft-blue print: leafy blots and trunks over the white, denser low down (the Rijksmuseum shop's arch).
          const step = 0.26;
          for (let v = 0.2, r = 0; v < C - 0.1; v += step, r++) for (let u = -W / 2 + 0.12 + (r % 2) * step / 2, c = 0; u < W / 2 - 0.1; u += step, c++) {
            const h0 = hash(seed + r * 31, c);
            if (v > b.top(u) - 0.18 || Math.abs(u) > W / 2 - 0.18 || h0 < 0.35) continue;
            b.disc(u + (hash(c, r) - 0.5) * 0.08, v, 0.06 + h0 * 0.1, out + 0.001, h0 > 0.75 ? '#7d97c9' : L.ink, 6);
          }
        }
        if (L.pattern === 'landscape' && L.ink) {
          // A printed Delft-blue landscape poster (the Rijksmuseum shop's arch, 2025): pale sky, a rolling blue hill line,
          // a dark foreground and two big tree crowns; one picture, not a repeat.
          const N = 24, hill = (u: number) => 1.15 + 0.28 * Math.sin(u * 2.3 + seed) + 0.12 * Math.sin(u * 5.1 + 1.7);
          for (let i = 0; i < N; i++) {
            const ua = -W / 2 + 0.03 + (W - 0.06) * i / N, ub = -W / 2 + 0.03 + (W - 0.06) * (i + 1) / N, um = (ua + ub) / 2;
            b.quad(ua, 0.03, ub, Math.min(hill(um), b.top(um) - 0.05), out + 0.001, L.light ?? '#6f8cc4');
            b.quad(ua, 0.03, ub, Math.min(0.45 + 0.1 * Math.sin(um * 3 + seed), b.top(um) - 0.05), out + 0.0015, L.ink);
          }
          for (const [cu, cv, cr] of [[0.22, 0.62, 0.2], [-0.3, 0.5, 0.16]] as const) {
            const uc = cu * W, vc = Math.min(cv * C, C - 0.9), rc = cr * W;
            b.quad(uc - 0.04, 0.3, uc + 0.04, vc, out + 0.002, L.ink);
            for (let k = 0; k < 14; k++) {
              const a = hash(seed + k, 7) * Math.PI * 2, d = Math.sqrt(hash(k, seed + 3)) * rc, r = 0.12 + hash(k, 11) * 0.16;
              const u = uc + Math.cos(a) * d, v = vc + Math.sin(a) * d * 0.8;
              if (Math.abs(u) + r > W / 2 - 0.05 || v + r > b.top(u) - 0.05 || v - r < 0.05) continue;
              b.disc(u, v, r, out + 0.0025 + k * 0.00001, k % 3 ? L.ink : (L.light ?? '#4a6aa8'), 7);
            }
          }
        }
        if (L.window) {
          const [f0, f1, v0, v1] = L.window, u0 = -W / 2 + f0 * W, u1 = -W / 2 + f1 * W;
          b.region(v0, v1, 0, out + 0.003, L.windowHex ?? '#556066', u0, u1);
          // A lit display in the cut-out: flowers and goods.
          if (L.windowGoods) for (let k = 0; k < 10; k++) b.disc(u0 + 0.12 + (u1 - u0 - 0.24) * hash(k, seed), v0 + 0.12 + 0.45 * hash(seed, k), 0.06 + 0.05 * hash(k, k), out + 0.0035, L.windowGoods[k % L.windowGoods.length], 6);
        }
        break;
      }
      case 'posters': {
        for (let i = 0; i < L.n; i++) { const uc = (i % 2 ? 1 : -1) * (W / 2 - 0.45 - Math.floor(i / 2) * 0.75); b.quad(uc - 0.28, 0.7, uc + 0.28, 1.5, out, L.hex); }
        break;
      }
      case 'panel': {
        b.region(0, C, 0.03, out, L.hex);
        const n = L.atms ?? 0;
        for (let i = 0; i < n; i++) {
          const uc = -W * 0.3 + (n > 1 ? W * 0.6 * i / (n - 1) : W * 0.3);
          b.quad(uc - 0.3, 0.95, uc + 0.3, 1.6, out + 0.002, '#cfd2d2'); b.quad(uc - 0.18, 1.2, uc + 0.18, 1.48, out + 0.004, '#2f3d48');
        }
        if (L.text) b.letters(L.text, 0, Math.min(S + (C - S) * 0.3, C - 0.5), 0.22, W * 0.5, out + 0.004, L.ink ?? '#58606a');
        break;
      }
      case 'band': {
        b.region(L.v0, L.v1, L.inset ?? 0.04, out, L.hex);
        if (L.text) b.letters(L.text, 0, (L.v0 + L.v1) / 2, (L.v1 - L.v0) * 0.6, W * 0.82, out + LETTER_STEP, L.ink ?? '#ffffff');
        break;
      }
      case 'head-letters': {
        const v = S + (C - S) * 0.3, h = Math.min(0.3, Math.max(0.16, (C - S) * 0.22));
        const half = W / 2 * Math.sqrt(Math.max(0, 1 - ((v + h / 2 - S) / Math.max(C - S, 1e-3)) ** 2));
        if (L.bg) b.region(S + 0.05, C, 0.08, out, L.bg);
        b.letters(L.text, 0, v, h, Math.max(0.5, half * 2 * 0.86), out + LETTER_STEP, L.ink);
        break;
      }
      case 'glass-letters': {
        const h = L.heightM ?? 0.26, markW = L.mark ? h * 1.5 : 0;
        const w = b.letters(L.text, markW / 2 + (L.mark ? 0.06 : 0), L.v, h, W * 0.72 - markW, out + LETTER_STEP, L.ink);
        if (L.mark) b.quad(-w / 2 - markW / 2 - 0.06, L.v - markW / 2, -w / 2 + markW / 2 - 0.06, L.v + markW / 2, out, L.mark);
        break;
      }
      case 'door': {
        const dw = Math.min(W * 0.66, L.leaves === 2 ? 2.1 : 1.1), dh = Math.min(S - 0.15, 2.7), fw = 0.07;
        b.quad(-dw / 2, 0, -dw / 2 + fw, dh, out, L.hex); b.quad(dw / 2 - fw, 0, dw / 2, dh, out, L.hex); b.quad(-dw / 2, dh - fw, dw / 2, dh, out, L.hex);
        b.quad(-dw / 2, 0, dw / 2, 0.08, out, L.hex);
        if (L.leaves === 2) { b.quad(-0.035, 0, 0.035, dh, out, L.hex); for (const s of [-1, 1]) b.quad(s * 0.08 - 0.015, 0.9, s * 0.08 + 0.015, 1.5, out + 0.002, '#c9cbc8'); }
        else b.quad(dw / 2 - 0.16, 0.9, dw / 2 - 0.13, 1.5, out + 0.002, '#c9cbc8');
        break;
      }
      case 'frame': {
        b.ring(0.07, out, L.hex);
        if (L.transom && b.S < b.C - 0.1) b.quad(-W / 2 + 0.07, S - 0.04, W / 2 - 0.07, S + 0.04, out, L.hex);
        const m = L.mullions ?? 0;
        for (let i = 1; i <= m; i++) { const uc = -W / 2 + W * i / (m + 1); b.quad(uc - 0.03, 0, uc + 0.03, L.transom ? S : b.top(uc), out, L.hex); }
        break;
      }
    }
  });
}
