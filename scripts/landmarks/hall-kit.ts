import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {poly, put, slab, type Frame} from './nearbar-kit';
import {TriSink} from './venue-kit';

/**
 * Kit for the Hamerkanaal halls (Noord venues lane, 2026-11-14): industrial sheds turned venues, which the facade kits
 * could not say. Everything is authored on a wall frame (x along the tangent, y up, o out of the wall; the kit's
 * convention n = (-tz, tx)). Nothing here changes an existing model; no builder before this lane imports it.
 *
 *  - `sawtoothHall`: a north-light (saw-tooth) shed: per bay a long solid slope up to an off-centre apex and a short
 *    glazed slope down to the next valley, both gable ends walled, walls below the eaves on the back and the two sides
 *    (the front is optional, for builders that cut openings in it with the front kit).
 *  - `venloGlasshouse`: a multi-ridge glasshouse standing out from a wall (ridges run out from the wall), glass faces
 *    with frame posts, rails and ridge/gutter bars.
 *  - `scallopedRake`: a bargeboard along a gable rake whose lower edge is a row of half-round scallops.
 *  - `spokeLamp`: a pole carrying a wheel of drooping radial spokes with a lamp on every tip.
 *  - `graffitiBand`: deterministic tag pieces and throw-ups over the lower storey, as coloured decal blobs.
 *  - `strokeTiles`: square signboard tiles carrying horizontal/vertical stroke marks, standing in for CJK characters
 *    (the glyph kit has Latin capitals and lower case only).
 */
export type Col = Parameters<BuildingTools['add']>[1];
export type Decal = (g: T.BufferGeometry, hex: string) => void;

const P3 = (f: Frame, s: number, y: number, o: number) => [f.origin[0] + f.tangent[0] * s + f.n[0] * o, y, f.origin[1] + f.tangent[1] * s + f.n[1] * o];
const dir = (f: Frame, s: number, y: number, o: number) => [f.tangent[0] * s + f.n[0] * o, y, f.tangent[1] * s + f.n[1] * o];

/** Saw-tooth bays between consecutive valleys; apex of bay k at `apexes[k]` (absolute s). */
export type SawtoothSpec = {valleys: number[]; apexes: number[]; eaves: number; apex: number; depth: number; wall: Col; roof: Col; glass: Col; front?: boolean; back?: boolean; sides?: boolean};

/** The gable outline over the eaves along s (valley, apex, valley, ...), as (s, y) points. */
export function sawtoothOutline(o: Pick<SawtoothSpec, 'valleys' | 'apexes' | 'eaves' | 'apex'>): [number, number][] {
  if (o.apexes.length !== o.valleys.length - 1) throw Error('sawtooth: one apex per bay');
  const pts: [number, number][] = [[o.valleys[0], o.eaves]];
  o.apexes.forEach((a, k) => {
    if (!(a > o.valleys[k] && a < o.valleys[k + 1])) throw Error(`sawtooth: apex ${a} outside bay ${k}`);
    pts.push([a, o.apex], [o.valleys[k + 1], o.eaves]);
  });
  return pts;
}

/**
 * Closed saw-tooth shed on frame `f`: s from valleys[0] to the last valley, o from -depth (back) to 0 (front). Solid
 * slopes rise from each valley to the bay's apex (roof colour), glazed slopes fall to the next valley (glass). Gable
 * triangles close both ends; walls below the eaves close the front, the back and the two sides unless `front`, `back` or
 * `sides` is false (a builder that cuts openings draws that wall itself). Returns the gable outline.
 */
export function sawtoothHall(b: BuildingTools, f: Frame, o: SawtoothSpec) {
  const M = new TriSink(), {valleys: V, eaves: E, depth: D} = o;
  const pts = sawtoothOutline(o), s0 = V[0], s1 = V[V.length - 1], out = dir(f, 0, 0, 1), back = dir(f, 0, 0, -1);
  for (let k = 0; k + 1 < V.length; k++) {
    const a = o.apexes[k];
    // solid slope (faces up and towards -s) and glazed slope (up and towards +s)
    M.quad(o.roof, P3(f, V[k], E, 0), P3(f, a, o.apex, 0), P3(f, a, o.apex, -D), P3(f, V[k], E, -D), dir(f, -(o.apex - E), a - V[k], 0));
    M.quad(o.glass, P3(f, a, o.apex, 0), P3(f, V[k + 1], E, 0), P3(f, V[k + 1], E, -D), P3(f, a, o.apex, -D), dir(f, o.apex - E, V[k + 1] - a, 0));
    // gable triangles, front and back
    M.tri(o.wall, P3(f, V[k], E, 0), P3(f, a, o.apex, 0), P3(f, V[k + 1], E, 0), out);
    M.tri(o.wall, P3(f, V[k], E, -D), P3(f, a, o.apex, -D), P3(f, V[k + 1], E, -D), back);
  }
  if (o.front !== false) M.quad(o.wall, P3(f, s0, 0, 0), P3(f, s1, 0, 0), P3(f, s1, E, 0), P3(f, s0, E, 0), out);
  if (o.back !== false) M.quad(o.wall, P3(f, s0, 0, -D), P3(f, s1, 0, -D), P3(f, s1, E, -D), P3(f, s0, E, -D), back);
  if (o.sides !== false) {
    M.quad(o.wall, P3(f, s0, 0, 0), P3(f, s0, 0, -D), P3(f, s0, E, -D), P3(f, s0, E, 0), dir(f, -1, 0, 0));
    M.quad(o.wall, P3(f, s1, 0, 0), P3(f, s1, 0, -D), P3(f, s1, E, -D), P3(f, s1, E, 0), dir(f, 1, 0, 0));
  }
  M.flush(b);
  return pts;
}

export type GlasshouseSpec = {s0: number; s1: number; depth: number; eaves: number; ridge: number; bays: number; glass: Col; frame: Col; plinth?: {h: number; c: Col}; post?: number; postPitch?: number};

/** Ridge positions (s) of a glasshouse with `bays` equal bays over s0..s1. */
export function glasshouseRidges(s0: number, s1: number, bays: number): number[] {
  const w = (s1 - s0) / bays;
  return Array.from({length: bays}, (_, k) => s0 + w * (k + 0.5));
}

/**
 * Venlo-type glasshouse standing out from the wall of frame f: o from 0 (against the wall) to depth, s from s0 to s1,
 * `bays` ridges running out from the wall. Glass skin (front, two sides, roof slopes; no face on the wall side), a plinth,
 * frame posts on the front and sides at about `postPitch`, an eaves rail all round, and ridge and gutter bars.
 */
export function venloGlasshouse(b: BuildingTools, f: Frame, o: GlasshouseSpec) {
  const M = new TriSink(), {s0, s1, depth: D, eaves: E, ridge: R} = o, w = (s1 - s0) / o.bays;
  const pl = o.plinth?.h ?? 0, post = o.post ?? 0.1, pitch = o.postPitch ?? 1.6;
  const ridges = glasshouseRidges(s0, s1, o.bays);
  const front = dir(f, 0, 0, 1);
  // glass: front face (rectangle + one gable triangle per bay), the two sides, the roof slopes
  M.quad(o.glass, P3(f, s0, pl, D), P3(f, s1, pl, D), P3(f, s1, E, D), P3(f, s0, E, D), front);
  ridges.forEach((r, k) => {
    const a = s0 + w * k, c = a + w;
    M.tri(o.glass, P3(f, a, E, D), P3(f, r, R, D), P3(f, c, E, D), front);
    M.quad(o.glass, P3(f, a, E, 0), P3(f, r, R, 0), P3(f, r, R, D), P3(f, a, E, D), dir(f, -(R - E), r - a, 0));
    M.quad(o.glass, P3(f, r, R, 0), P3(f, c, E, 0), P3(f, c, E, D), P3(f, r, R, D), dir(f, R - E, c - r, 0));
  });
  M.quad(o.glass, P3(f, s0, pl, 0), P3(f, s0, pl, D), P3(f, s0, E, D), P3(f, s0, E, 0), dir(f, -1, 0, 0));
  M.quad(o.glass, P3(f, s1, pl, 0), P3(f, s1, pl, D), P3(f, s1, E, D), P3(f, s1, E, 0), dir(f, 1, 0, 0));
  M.flush(b);
  // the plinth under the glass
  if (o.plinth) {
    put(b, f, new T.BoxGeometry(s1 - s0 + 0.12, pl, 0.12).translate(0, pl / 2, 0), (s0 + s1) / 2, 0, D, o.plinth.c);
    for (const s of [s0, s1]) put(b, f, new T.BoxGeometry(0.12, pl, D).translate(0, pl / 2, D / 2), s, 0, 0, o.plinth.c);
  }
  // frame: posts on the front at bay lines and between, posts on the sides, eaves rail, ridge and gutter bars
  const fr: Frame = {origin: P2(f, 0, D), tangent: f.tangent, n: f.n};
  const nFront = Math.max(1, Math.round((s1 - s0) / pitch));
  for (let k = 0; k <= nFront; k++) slab(b, fr, s0 + (s1 - s0) * k / nFront, 0, post, E, post, o.frame, -post / 2);
  slab(b, fr, (s0 + s1) / 2, E - post, s1 - s0 + post, post, post, o.frame, -post / 2);
  if (pl > 0) slab(b, fr, (s0 + s1) / 2, pl, s1 - s0 + post, post * 0.8, post, o.frame, -post / 2);
  ridges.forEach((r, k) => {
    const a = s0 + w * k, c = a + w;
    // raking bars on the front gable
    for (const [x0, x1] of [[a, r], [r, c]] as const) {
      const len = Math.hypot(x1 - x0, R - E), ang = Math.atan2(R - E, x1 - x0);
      const g = new T.BoxGeometry(len, post * 0.8, post).translate(0, 0, post / 2);
      g.rotateZ(x1 === r ? ang : -ang);
      put(b, fr, g, (x0 + x1) / 2, (E + R) / 2, -post / 2, o.frame);
    }
    // ridge bar running out from the wall
    const rg = new T.BoxGeometry(post * 0.8, post * 0.8, D).translate(0, 0, -D / 2);
    put(b, fr, rg, r, R - post * 0.4, post * 0.4, o.frame);
    if (k > 0) put(b, fr, new T.BoxGeometry(post, post * 0.8, D).translate(0, 0, -D / 2), a, E - post * 0.4, post * 0.4, o.frame);
  });
  for (const [s, sg] of [[s0, -1], [s1, 1]] as const) {
    const n = Math.max(1, Math.round(D / pitch));
    for (let k = 1; k <= n; k++) put(b, f, new T.BoxGeometry(post, E, post).translate(0, E / 2, 0), s + sg * post / 2, 0, D * k / n - post / 2, o.frame);
    put(b, f, new T.BoxGeometry(post, post, D).translate(0, E - post / 2, D / 2), s + sg * post / 2, 0, 0, o.frame);
  }
  return ridges;
}
const P2 = (f: Frame, s: number, o: number): [number, number] => [f.origin[0] + f.tangent[0] * s + f.n[0] * o, f.origin[1] + f.tangent[1] * s + f.n[1] * o];

/**
 * Bargeboard along a rake from (t0, y0) to (t1, y1) on frame f: a band `w` tall whose top edge is the rake line and whose
 * lower edge is `n` half-round scallops. Extruded `d` out from `out`. Returns the scallop count.
 */
export function scallopOutline(t0: number, y0: number, t1: number, y1: number, w: number, n: number, steps = 6): [number, number][] {
  const len = Math.hypot(t1 - t0, y1 - y0), ux = (t1 - t0) / len, uy = (y1 - y0) / len;
  // lower normal: perpendicular pointing down
  let nx = uy, ny = -ux;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const band = w * 0.45, r = len / n / 2;
  const top: [number, number][] = [[t0, y0], [t1, y1]];
  const bottom: [number, number][] = [];
  for (let k = n - 1; k >= 0; k--) {
    const c = (k + 0.5) * 2 * r;
    for (let j = 0; j <= steps; j++) {
      const a = Math.PI * j / steps, along = c + r * Math.cos(a), down = band + Math.min(r, w - band) * Math.sin(a);
      bottom.push([t0 + ux * along + nx * down, y0 + uy * along + ny * down]);
    }
  }
  return [...top, ...bottom];
}
export function scallopedRake(b: BuildingTools, f: Frame, t0: number, y0: number, t1: number, y1: number, o: {w: number; n: number; d: number; c: Col; out?: number}) {
  poly(b, f, 0, 0, scallopOutline(t0, y0, t1, y1, o.w, o.n), o.d, o.c, o.out ?? 0);
  return o.n;
}

/** Tip positions (x, y, z relative to the pole foot) of a spoke wheel: radius r at height h, drooping `droop` at the tips. */
export function spokeTips(n: number, r: number, h: number, droop: number, phase = 0): number[][] {
  return Array.from({length: n}, (_, k) => { const a = phase + 2 * Math.PI * k / n; return [r * Math.cos(a), h - droop, r * Math.sin(a)]; });
}
/** A pole at native (x, z) with a wheel of `n` drooping spokes and a small lamp head at every tip. */
export function spokeLamp(b: BuildingTools, x: number, z: number, o: {pole: number; r: number; n: number; droop: number; hub: number; c: Col; lamp: Col; phase?: number; poleR?: number}) {
  const pr = o.poleR ?? 0.1;
  b.add(new T.CylinderGeometry(pr * 0.8, pr, o.pole, 8).translate(0, o.pole / 2, 0), o.c, x, 0, z);
  for (const [tx, ty, tz] of spokeTips(o.n, o.r, o.hub, o.droop, o.phase ?? 0)) {
    const a = new T.Vector3(0, o.hub, 0), c = new T.Vector3(tx, ty, tz), d = c.clone().sub(a), len = d.length();
    const g = new T.CylinderGeometry(0.025, 0.025, len, 4).translate(0, len / 2, 0);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()));
    b.add(g, o.c, x, o.hub, z);
    b.add(new T.CylinderGeometry(0.07, 0.11, 0.18, 6).translate(0, -0.09, 0), o.lamp, x + tx, ty, z + tz);
  }
}

/** Small seeded generator (mulberry32) so decorations are byte-stable. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Rounded blob outline (a superellipse) of half-sizes rx, ry about the origin. */
export function blobOutline(rx: number, ry: number, steps = 14, p = 3): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k < steps; k++) {
    const a = 2 * Math.PI * k / steps, c = Math.cos(a), s = Math.sin(a);
    pts.push([rx * Math.sign(c) * Math.abs(c) ** (2 / p), ry * Math.sign(s) * Math.abs(s) ** (2 / p)]);
  }
  return pts;
}
export type GraffitiPiece = {t: number; y: number; rx: number; ry: number; fill: string; outline: string; letters: number};
/** Layout of tag pieces over s0..s1, y0..y1: wide bubble-letter pieces in a fill colour with a dark outline. */
export function graffitiLayout(s0: number, s1: number, y0: number, y1: number, seed: number, fills: string[], outline = '#1d1d22'): GraffitiPiece[] {
  const rnd = seeded(seed), out: GraffitiPiece[] = [];
  let s = s0 + 0.2;
  while (s < s1 - 1) {
    const w = Math.min(1.2 + rnd() * 3.2, s1 - s - 0.2), h = Math.min((y1 - y0) * (0.45 + rnd() * 0.45), w * 0.8);
    out.push({t: s + w / 2, y: y0 + 0.1 + rnd() * (y1 - y0 - h - 0.1), rx: w / 2, ry: h / 2, fill: fills[Math.floor(rnd() * fills.length)], outline, letters: Math.max(2, Math.round(w / 0.7))});
    s += w + 0.1 + rnd() * 0.9;
  }
  return out;
}
/** Paint the pieces as decals on frame f, `out` off the wall: an outline blob, then bubble letters in the fill colour 9 cm
 *  in front of it (stacked decal faces closer than 8 cm z-fight at range: audit zfight-tight/near). */
export function graffitiBand(decal: Decal, f: Frame, pieces: GraffitiPiece[], out = 0.03) {
  for (const p of pieces) {
    poly({add: (g: T.BufferGeometry) => decal(g, p.outline)} as unknown as BuildingTools, f, p.t, p.y + p.ry, blobOutline(p.rx, p.ry), 0.01, 'white', out);
    const lw = (2 * p.rx - 0.2) / p.letters;
    for (let k = 0; k < p.letters; k++) {
      const t = p.t - p.rx + 0.1 + lw * (k + 0.5), ry = p.ry * (0.62 + 0.25 * ((k * 7919) % 3) / 2);
      poly({add: (g: T.BufferGeometry) => decal(g, p.fill)} as unknown as BuildingTools, f, t, p.y + p.ry, blobOutline(lw * 0.46, ry, 12, 2.6), 0.01, 'white', out + 0.09);
    }
  }
}

/** Stroke pattern of tile k: horizontal and vertical bars in a unit square (x, y, w, h), deterministic per k. */
export function strokePattern(k: number): [number, number, number, number][] {
  const rnd = seeded(1000 + k), bars: [number, number, number, number][] = [];
  const nh = 2 + Math.floor(rnd() * 3), nv = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < nh; i++) { const y = 0.1 + 0.8 * (i + 0.5) / nh, x0 = 0.08 + rnd() * 0.2, x1 = 0.72 + rnd() * 0.2; bars.push([x0, y - 0.05, x1 - x0, 0.1]); }
  for (let i = 0; i < nv; i++) { const x = 0.2 + 0.6 * (i + 0.5) / nv + (rnd() - 0.5) * 0.15, y0 = 0.06 + rnd() * 0.2; bars.push([x - 0.05, y0, 0.1, 0.9 - y0]); }
  return bars;
}
/** `n` square tiles of side `size` centred on t at y (bottom), strokes standing `d` proud, as decals of colour hex. */
export function strokeTiles(decal: Decal, f: Frame, n: number, t: number, y: number, size: number, gap: number, hex: string, out = 0.02, first = 0) {
  const b = {add: (g: T.BufferGeometry) => decal(g, hex)} as unknown as BuildingTools, w = n * size + (n - 1) * gap;
  for (let k = 0; k < n; k++) {
    const t0 = t - w / 2 + k * (size + gap);
    for (const [x, yy, bw, bh] of strokePattern(first + k)) slab(b, f, t0 + (x + bw / 2) * size, y + yy * size, bw * size, bh * size, 0.01, 'white', out);
  }
  return w;
}
