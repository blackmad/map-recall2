// What a rectified bridge face shows (lane bridge-fidelity 2026-10-14): the
// openings under the deck (count, position, shape), the spandrel material
// family and the parapet class. Pure; the crop comes from select.ts.
//
// Method, all in face metres (x along the deck axis, z NAP):
//   edge       the deck edge in the photo: the measured deck top shifted by dz
//              (−1.4 … +0.6 m) where the band above it (rail, sky, trees) is
//              busiest and the band under it (coping, spandrel) quietest. The
//              boat's published camera height and the profile's crown-vs-edge
//              (camber, kerb) each move the edge by decimetres.
//   solid      the median colour 0.3–1.0 m under the edge: spandrel or fascia.
//   openings   a luminance threshold (Otsu over the face under the edge); per
//              column the dark share from 0.3 m over the water to 0.4 m under
//              the edge (the shadowed vault; the canal seen through an arch
//              is a bright hole inside it); columns over 0.3 are open,
//              median-smoothed over 0.5 m; runs ≥ 1.0 m are openings.
//   shape      per opening column the intrados: scanning down from the edge,
//              past the lit spandrel, to the first 0.2 m of dark; the rise
//              over half the span: under 0.12 flat (a girder span), over 0.7
//              round, else segmental.
//   family     the solid colour's HSL.
//   parapet    the band 0.15–0.95 m over the edge: light low-saturation pixels
//              (stone balusters), the solid colour (brick parapet), thin dark
//              bars (iron rail), else none.
import type { BridgeFace } from './geometry.ts';
import { topAt } from './geometry.ts';
import type { FaceCrop } from './select.ts';

export type ArchShape = 'segmental' | 'round' | 'flat';
export type Family = 'brick-red' | 'brick-dark' | 'stone' | 'render-white' | 'concrete' | 'steel';
export type Parapet = 'stone-balustrade' | 'iron-rail' | 'brick-parapet' | 'none';
export const FAMILIES: readonly Family[] = ['brick-red', 'brick-dark', 'stone', 'render-white', 'concrete', 'steel'];
export const PARAPETS: readonly Parapet[] = ['stone-balustrade', 'iron-rail', 'brick-parapet', 'none'];
export const SHAPES: readonly ArchShape[] = ['segmental', 'round', 'flat'];

export interface Opening { a0: number; a1: number; crownNAP: number; riseRatio: number; shape: ArchShape }
export interface FaceReading {
  openings: Opening[];
  shape: ArchShape | null;
  family: Family;
  solid: [number, number, number];
  solidHsl: [number, number, number];
  parapet: Parapet;
  parapetStats: { light: number; solid: number; dark: number; meanL: number };
  /** Deck-edge shift found in the photo, metres (photo edge = measured top + dz). */
  dz: number;
  darkThreshold: number;
  /** Share of the face's sample area usable (in the image, not foliage, not a privacy blur). */
  coverage: number;
  /** Per column (ascending along): opening share after smoothing, and the intrados found. */
  trace: { along: number; open: number; intrados: number | null }[];
}

export const rgbHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};

export function familyOf([h, s, l]: [number, number, number]): Family {
  const warm = h < 40 || h > 330;
  if (l > 0.66 && s < 0.25) return 'render-white';
  if (warm && s >= 0.18 && l < 0.3) return 'brick-dark';
  if (warm && s >= 0.18) return 'brick-red';
  if (!warm && h > 70 && h < 220 && l < 0.38) return 'steel';
  if (l < 0.24) return s >= 0.1 && warm ? 'brick-dark' : 'steel';
  if (s < 0.14 && l < 0.52) return 'concrete';
  return 'stone';
}

const med = (v: number[]) => { const s = [...v].sort((p, q) => p - q); return s[s.length >> 1] ?? 0; };
function otsu(values: number[]): number {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = values.length; let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sumB = 0, best = 0, thr = 80;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = t; }
  }
  return thr;
}

export function readFace(face: BridgeFace, crop: FaceCrop): FaceReading {
  const { width: W, height: H, ppm, data } = crop;
  const a0f = face.deck[0] - 3, a1f = face.deck[1] + 3;
  const alongOf = (x: number) => (crop.flipped ? a1f - (x + 0.5) / ppm : a0f + (x + 0.5) / ppm);
  const rowOf = (z: number) => Math.round((crop.topZ - z) * ppm);
  const rgb = (x: number, y: number): [number, number, number] => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const lum = (x: number, y: number) => { const i = (y * W + x) * 4; return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; };
  const usable = (r: number, g: number, b: number) => !(r === 128 && g === 128 && b === 128) && !(g > r + 8 && g > b + 15 && g > 60);
  const inDeck = (a: number) => a > face.deck[0] + 0.8 && a < face.deck[1] - 0.8;
  const cols: number[] = [];
  for (let x = 0; x < W; x++) if (inDeck(alongOf(x))) cols.push(x);

  // Deck edge: busiest band above, quietest band under.
  const band = (dz: number, from: number, to: number) => {
    const v: number[] = [];
    for (const x of cols) { const t = topAt(face, alongOf(x)) + dz; for (let y = rowOf(t + to); y <= rowOf(t + from); y++) if (y >= 0 && y < H) v.push(lum(x, y)); }
    if (v.length < 10) return NaN;
    const m = v.reduce((s, q) => s + q, 0) / v.length;
    return Math.sqrt(v.reduce((s, q) => s + (q - m) ** 2, 0) / v.length);
  };
  let dz = 0, bestScore = -Infinity;
  for (let d = -1.4; d <= 0.6001; d += 0.05) {
    const above = band(d, 0.05, 0.6), below = band(d, -0.45, -0.05);
    if (!Number.isFinite(above) || !Number.isFinite(below)) continue;
    const score = above - below;
    if (score > bestScore) { bestScore = score; dz = +d.toFixed(2); }
  }
  const edgeAt = (a: number) => topAt(face, a) + dz;

  // Solid colour.
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  let tried = 0;
  for (let k = 0; k < cols.length; k += 2) {
    const x = cols[k], e = edgeAt(alongOf(x));
    for (let y = rowOf(e - 0.3); y <= rowOf(e - 1.0); y += 2) {
      if (y < 0 || y >= H) continue;
      tried++;
      const [r, g, b] = rgb(x, y); if (!usable(r, g, b)) continue;
      rs.push(r); gs.push(g); bs.push(b);
    }
  }
  const solid: [number, number, number] = [med(rs), med(gs), med(bs)];
  const solidHsl = rgbHsl(...solid);
  const coverage = tried ? rs.length / tried : 0;

  // Dark threshold over the face under the edge.
  const zW = face.waterNAP + 0.3, lums: number[] = [];
  for (let x = 0; x < W; x += 2) {
    const a = alongOf(x); if (a < face.deck[0] - 1 || a > face.deck[1] + 1) continue;
    for (let y = rowOf(edgeAt(a) - 0.3); y <= rowOf(zW); y += 2) if (y >= 0 && y < H) lums.push(lum(x, y));
  }
  const thr = Math.min(otsu(lums), 0.7 * (0.2126 * solid[0] + 0.7152 * solid[1] + 0.0722 * solid[2]));

  const k2 = Math.max(2, Math.round(0.1 * ppm));
  const raw: { along: number; dark: number; intrados: number | null }[] = [];
  for (let x = 0; x < W; x++) {
    const a = alongOf(x), e = edgeAt(a), yE = Math.max(0, rowOf(e - 0.4)), yW = Math.min(H - 1, rowOf(zW));
    let n = 0, d = 0;
    for (let y = yE; y <= yW; y++) { n++; if (lum(x, y) < thr) d++; }
    // Intrados: from 0.3 m under the edge, down past lit pixels to the first 0.2 m dark run.
    let intrados: number | null = null, run = 0;
    for (let y = Math.max(0, rowOf(e - 0.3)); y <= yW; y++) {
      if (lum(x, y) < thr) { if (++run >= k2) { intrados = crop.topZ - (y - run + 1) / ppm; break; } } else run = 0;
    }
    raw.push({ along: a, dark: n > 3 ? d / n : 0, intrados });
  }
  if (crop.flipped) raw.reverse();
  const win = Math.max(1, Math.round(0.25 * ppm));
  const trace = raw.map((c, i) => ({ along: c.along, open: med(raw.slice(Math.max(0, i - win), i + win + 1).map(q => (q.dark > 0.3 || q.intrados !== null ? 1 : 0))), intrados: c.intrados }));
  const runs: [number, number][] = [];
  for (const c of trace) {
    if (c.open < 0.5 || c.along < face.deck[0] - 1 || c.along > face.deck[1] + 1) continue;
    const last = runs[runs.length - 1];
    if (last && c.along - last[1] < 0.4) last[1] = c.along; else runs.push([c.along, c.along]);
  }
  const openings: Opening[] = [];
  for (const [a0, a1] of runs) {
    if (a1 - a0 < 1.0) continue;
    const tops = raw.filter(c => c.along >= a0 && c.along <= a1 && c.intrados !== null).map(c => ({ a: c.along, z: c.intrados! }));
    if (tops.length < 4) continue;
    const zs = tops.map((_, i) => med(tops.slice(Math.max(0, i - win), i + win + 1).map(q => q.z)));
    const n = zs.length, mid = zs.slice(Math.floor(n / 3), Math.ceil(2 * n / 3));
    const crown = med(mid), ends = (med(zs.slice(0, Math.max(1, Math.floor(n * 0.08)))) + med(zs.slice(Math.floor(n * 0.92)))) / 2;
    const riseRatio = Math.max(0, crown - ends) / ((a1 - a0) / 2);
    openings.push({ a0, a1, crownNAP: crown, riseRatio, shape: riseRatio < 0.12 ? 'flat' : riseRatio > 0.7 ? 'round' : 'segmental' });
  }
  const votes = new Map<ArchShape, number>();
  for (const o of openings) votes.set(o.shape, (votes.get(o.shape) ?? 0) + (o.a1 - o.a0));
  const shape = [...votes.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? null;

  // Parapet band.
  const sl = 0.2126 * solid[0] + 0.7152 * solid[1] + 0.0722 * solid[2];
  let n = 0, light = 0, sol = 0, dark = 0, sumL = 0;
  for (let k = 0; k < cols.length; k += 2) {
    const x = cols[k], e = edgeAt(alongOf(x));
    for (let y = rowOf(e + 0.95); y <= rowOf(e + 0.15); y++) {
      if (y < 0 || y >= H) continue;
      const [r, g, b] = rgb(x, y); if (!usable(r, g, b)) continue;
      const [, s, l] = rgbHsl(r, g, b), L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n++; sumL += l;
      if (l > 0.55 && s < 0.22) light++;
      if (Math.abs(L - sl) < 22 && Math.hypot(r - solid[0], g - solid[1], b - solid[2]) < 40) sol++;
      if (l < 0.2) dark++;
    }
  }
  const st = { light: n ? light / n : 0, solid: n ? sol / n : 0, dark: n ? dark / n : 0, meanL: n ? sumL / n : 0 };
  const family = familyOf(solidHsl);
  const parapet: Parapet = st.solid > 0.6 && family.startsWith('brick') ? 'brick-parapet' : st.light > 0.45 && st.dark < 0.15 ? 'stone-balustrade' : st.dark > 0.06 ? 'iron-rail' : 'none';
  return { openings, shape, family, solid, solidHsl, parapet, parapetStats: st, dz, darkThreshold: thr, coverage, trace };
}

/** Draw the reading on a copy of the crop (debug and the sheet's photo panel): the edge (cyan), openings (yellow), intrados (magenta). */
export function annotate(face: BridgeFace, crop: FaceCrop, r: FaceReading): Uint8ClampedArray {
  const out = new Uint8ClampedArray(crop.data), { width: W, height: H, ppm } = crop;
  const a0f = face.deck[0] - 3, a1f = face.deck[1] + 3;
  const xOf = (a: number) => Math.round(crop.flipped ? (a1f - a) * ppm - 0.5 : (a - a0f) * ppm - 0.5);
  const rowOf = (z: number) => Math.round((crop.topZ - z) * ppm);
  const put = (x: number, y: number, c: [number, number, number]) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; };
  for (const t of r.trace) {
    const x = xOf(t.along);
    put(x, rowOf(topAt(face, t.along) + r.dz), [0, 230, 255]);
    if (t.open >= 0.5 && t.intrados !== null) put(x, rowOf(t.intrados), [255, 0, 200]);
  }
  for (const o of r.openings) for (let a = o.a0; a <= o.a1; a += 1 / ppm) { put(xOf(a), H - 2, [255, 220, 0]); put(xOf(a), H - 1, [255, 220, 0]); }
  return out;
}
