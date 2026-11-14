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
 *  - `tagBand`, `tagScribble`: flat tag panels (irregular fill, thin outline ring, letter strokes) and bare scribbled tags.
 *  - `wallIvy`, `raggedOutline`: ivy hugging a wall: ragged leaf sheet with brick gaps and shallow leaf clumps.
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
export function spokeLamp(b: BuildingTools, x: number, z: number, o: {pole: number; r: number; n: number; droop: number; hub: number; c: Col; lamp: Col; phase?: number; poleR?: number; stays?: boolean}) {
  const pr = o.poleR ?? 0.1;
  b.add(new T.CylinderGeometry(pr * 0.8, pr, o.pole, 8).translate(0, o.pole / 2, 0), o.c, x, 0, z);
  for (const [tx, ty, tz] of spokeTips(o.n, o.r, o.hub, o.droop, o.phase ?? 0)) {
    const a = new T.Vector3(0, o.hub, 0), c = new T.Vector3(tx, ty, tz), d = c.clone().sub(a), len = d.length();
    const g = new T.CylinderGeometry(0.025, 0.025, len, 4).translate(0, len / 2, 0);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()));
    b.add(g, o.c, x, o.hub, z);
    b.add(new T.CylinderGeometry(0.07, 0.11, 0.18, 6).translate(0, -0.09, 0), o.lamp, x + tx, ty, z + tz);
    // optional stays: a cable from the pole top to every tip (the spokes rise like an upturned umbrella, droop < 0)
    if (o.stays) {
      const e = new T.Vector3(tx, ty - o.pole, tz), el = e.length();
      const sg = new T.CylinderGeometry(0.008, 0.008, el, 3).translate(0, el / 2, 0);
      sg.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), e.normalize()));
      b.add(sg, o.c, x, o.pole, z);
    }
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
/** Jagged tag-panel outline about the origin: an irregular blob whose radius wanders per vertex (seeded), flatter at the foot. */
export function tagOutline(rx: number, ry: number, seed: number, n = 18): [number, number][] {
  const rnd = seeded(seed), pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = 2 * Math.PI * k / n, j = 0.78 + rnd() * 0.22, c = Math.cos(a), s = Math.sin(a);
    pts.push([rx * Math.sign(c) * Math.abs(c) ** 0.7 * j, ry * Math.sign(s) * Math.abs(s) ** (s < 0 ? 0.45 : 0.8) * (0.82 + rnd() * 0.18)]);
  }
  return pts;
}
/** Letter-like strokes inside a panel of half-sizes rx, ry: per letter a stem and one or two bars or diagonals, as (x0, y0, x1, y1). */
export function tagStrokes(rx: number, ry: number, letters: number, seed: number): [number, number, number, number][] {
  const rnd = seeded(seed), out: [number, number, number, number][] = [], w = 1.5 * rx / letters;
  for (let k = 0; k < letters; k++) {
    const cx = -0.75 * rx + w * (k + 0.5), lean = (rnd() - 0.5) * w * 0.5, top = ry * (0.45 + rnd() * 0.15), bot = -ry * (0.4 + rnd() * 0.15);
    out.push([cx - w * 0.28 + lean, bot, cx - w * 0.28 - lean, top]);
    const kind = Math.floor(rnd() * 3);
    if (kind === 0) out.push([cx - w * 0.28, top * 0.1, cx + w * 0.3, top * (0.2 + rnd() * 0.3)]);
    else if (kind === 1) out.push([cx - w * 0.28, top, cx + w * 0.3, bot * 0.6]);
    else { out.push([cx - w * 0.28, top, cx + w * 0.28, top * 0.8]); out.push([cx + w * 0.28, top * 0.8, cx + w * 0.3, bot]); }
  }
  return out;
}
/** A straight stroke from (x0, y0) to (x1, y1) of width w on frame f, centred at (t, y), as one thin quad solid. */
function strokeQuad(b: BuildingTools, f: Frame, t: number, y: number, s: [number, number, number, number], w: number, d: number, out: number) {
  const [x0, y0, x1, y1] = s, L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L * w / 2, ny = (x1 - x0) / L * w / 2;
  poly(b, f, t, y, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], d, 'white', out);
}
/** Ring between an outline and the same outline grown by m (a flat band, the hole exactly the inner outline). */
function ringSolid(b: BuildingTools, f: Frame, t: number, y: number, inner: [number, number][], m: number, d: number, out: number) {
  const grow = inner.map(([x, yy]) => { const r = Math.hypot(x, yy) || 1; return new T.Vector2(x * (1 + m / r), yy * (1 + m / r)); });
  const shape = new T.Shape(grow), hole = new T.Path(inner.map(([x, yy]) => new T.Vector2(x, yy)).reverse());
  shape.holes.push(hole);
  put(b, f, new T.ExtrudeGeometry(shape, {depth: d + 0.12, bevelEnabled: false}), t, y, out - 0.12, 'white');
}
/**
 * Flat tag panels hugging the wall (Skatecafe round 2: the bubble-letter blobs read as rows of teeth). Per piece one
 * irregular fill patch and a thin outline ring around it, both one layer at `out` (they do not overlap), and letter-like
 * strokes 9 cm in front (thin, small area: stacked faces under 8 cm z-fight, audit zfight-near).
 */
export function tagBand(decal: Decal, f: Frame, pieces: GraffitiPiece[], seed: number, out = 0.05, stroke = '#2c2c30', ring = 0.06) {
  const on = (hex: string) => ({add: (g: T.BufferGeometry) => decal(g, hex)}) as unknown as BuildingTools;
  pieces.forEach((p, i) => {
    const pts = tagOutline(p.rx, p.ry, seed + i * 31), cy = p.y + p.ry;
    poly(on(p.fill), f, p.t, cy, pts, 0.01, 'white', out);
    ringSolid(on(p.outline), f, p.t, cy, pts, ring, 0.01, out);
    for (const s of tagStrokes(p.rx, p.ry, p.letters, seed + i * 31 + 7)) strokeQuad(on(stroke), f, p.t, cy, s, Math.min(0.08, p.ry * 0.09), 0.01, out + 0.09);
  });
}
/** A bare tag: a scribbled polyline of `n` points over w x h centred at (t, y + h/2), strokes of width `sw`. */
export function tagScribble(decal: Decal, f: Frame, t: number, y: number, w: number, h: number, seed: number, hex: string, out = 0.05, n = 7, sw = 0.035) {
  const rnd = seeded(seed), on = {add: (g: T.BufferGeometry) => decal(g, hex)} as unknown as BuildingTools;
  let prev: [number, number] = [-w / 2, (rnd() - 0.5) * h];
  for (let k = 1; k < n; k++) {
    const next: [number, number] = [-w / 2 + w * k / (n - 1) + (rnd() - 0.5) * w * 0.12, (rnd() - 0.5) * h];
    strokeQuad(on, f, t, y + h / 2, [prev[0], prev[1], next[0], next[1]], sw, 0.01, out);
    prev = next;
  }
}

/** Seeded bump centres (t, y, r) inside a polygon outline (local coords), for `wallIvy`. */
export function ivyBumps(outline: [number, number][], count: number, seed: number, r0: number, r1: number): [number, number, number][] {
  const rnd = seeded(seed), xs = outline.map(p => p[0]), ys = outline.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], out: [number, number, number][] = [];
  const inside = (x: number, y: number) => { let c = false; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) { const [xi, yi] = outline[i], [xj, yj] = outline[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    if (inside(x, y)) out.push([x, y, r0 + rnd() * (r1 - r0)]);
  }
  return out;
}
/**
 * Ragged version of a polygon (local coords): every edge cut into pieces of about `step` m and the new points pushed in
 * or out by up to `amp` (seeded), so a plant's edge reads as leaf clumps rather than a cut sheet. Corners are kept.
 */
export function raggedOutline(pts: [number, number][], step: number, amp: number, seed: number): [number, number][] {
  const rnd = seeded(seed), out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
    const nx = (y1 - y0) / (L || 1), ny = -(x1 - x0) / (L || 1);
    out.push([x0, y0]);
    for (let k = 1; k < n; k++) { const f = k / n, e = (rnd() - 0.5) * 2 * amp; out.push([x0 + (x1 - x0) * f + nx * e, y0 + (y1 - y0) * f + ny * e]); }
  }
  return out;
}
/**
 * Ivy hugging a wall (Skatecafe round 3: the lumpy mass read as "a big green blob"). A ragged leaf sheet in `base` (the
 * shadowed depth of the leaves) standing `out + 0.06` proud, with holes where brick shows, and small leaf clumps in `leaf`
 * no more than `proud` off the wall, kept inside the outline and out of the holes. No free-standing volume. Outline and
 * holes are in wall coordinates (t, y) of frame f.
 */
export function wallIvy(b: BuildingTools, f: Frame, outline: [number, number][], holes: [number, number][][], o: {base: Col; leaf: Col; clumps: number; seed: number; out?: number; proud?: number}) {
  const out = o.out ?? 0.04, proud = o.proud ?? 0.22, ragged = raggedOutline(outline, 0.35, 0.16, o.seed);
  const shape = new T.Shape(ragged.map(([x, y]) => new T.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new T.Path(raggedOutline(h, 0.15, 0.05, o.seed + 1).map(([x, y]) => new T.Vector2(x, y)).reverse()));
  put(b, f, new T.ExtrudeGeometry(shape, {depth: 0.06 + 0.12, bevelEnabled: false}), 0, 0, out - 0.12, o.base);
  const inHole = (x: number, y: number) => holes.some(h => { const xs = h.map(p => p[0]), ys = h.map(p => p[1]); return x > Math.min(...xs) - 0.3 && x < Math.max(...xs) + 0.3 && y > Math.min(...ys) - 0.3 && y < Math.max(...ys) + 0.3; });
  const rnd = seeded(o.seed + 2), half = (proud - out) / 2;
  for (const [x, y, r] of ivyBumps(outline, o.clumps * 2, o.seed, 0.12, 0.26).filter(([x, y]) => !inHole(x, y)).slice(0, o.clumps)) {
    const g = new T.IcosahedronGeometry(1, 0).rotateZ(rnd() * Math.PI).scale(r * (0.9 + rnd() * 0.4), r * (0.6 + rnd() * 0.3), half);
    put(b, f, g, x, y, out + half, o.leaf);
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
