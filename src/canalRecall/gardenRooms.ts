/**
 * Garden rooms: the contemporary Dutch back-garden building (lane #169, user 2026-11-01: "we should probably build
 * a generator for better outbuildings inside residential courts, specifically in the nice canal house
 * neighbourhoods").
 *
 * A garden shed (gardenSheds.ts) is a muted bare box. A garden room is a shed pand that was built (or rebuilt) as
 * the prefab garden studio the canal-house gardens are full of: a flat-roofed box with a glass front toward the
 * house, timber-slat or matte-black walls, a thin dark fascia with a small overhang. Which shed is one:
 *   - at least 6 m2 (smaller is a bike or bin box; the survey's < 6 m2 2005+ pands were mostly 3 m2 boxes on the
 *     water's edge and on house roofs, `staging/outbuildings/ortho-year-lt6-sample.png`), and
 *   - `year`: BAG construction year >= 2005, or
 *   - `roof`: an older (or undated) pand whose orthophoto roof reads as a crisp white membrane or glass
 *     (roof-facts slot white-membrane / glass) at confidence >= 0.6: rebuilt on the old footprint.
 * Sedum was in the brief's rule and is not here: every pre-1990 shed the survey read as sedum (264 of 272 roof-rule
 * hits) sits under tree canopy in the orthophoto (`ortho-roof-rule-pre1990.png`); the green is the tree.
 * Everything else stays a shed. Counts per rule for the centre box: `scripts/survey-garden-rooms.ts`.
 *
 * Orientation: the glass faces the main house of the parcel, the nearest larger pand that stands nearer a street
 * than the shed. Never on a party wall (an edge within 0.3 m of another pand). With no house, the longest free edge.
 *
 * Pure and deterministic per pand id: the chunk worker runs it. Geometry is flat-colour triangles on the flat
 * layer (every look variant has one), at most `GARDEN_ROOM_TRI_BUDGET` beyond the plain box, near tier only.
 */
import earcut from 'earcut';
import { hash01, type FlatTri, type V3 } from './facadeExtraCore.js';
import { GARDEN_ROOM_TONES, cellSetOf, hexToRgb, lookHex, rgbToHex, type BuildingLook } from './look/palette.js';
import type { SegmentGrid } from './streetFronts.js';

export const GARDEN_ROOM_FROM_YEAR = 2005;
/** Roof slots that read as a recent rebuild on a small flat roof. */
export const GARDEN_ROOM_ROOF_SLOTS: ReadonlySet<string> = new Set(['white-membrane', 'glass']);
export const GARDEN_ROOM_ROOF_CONFIDENCE = 0.6;
export const GARDEN_ROOM_MIN_AREA_M2 = 6;
/** Triangles a garden room may add beyond its plain box. */
export const GARDEN_ROOM_TRI_BUDGET = 60;
/** An edge this close to another pand is a party wall: no glass, no overhang. */
export const PARTY_WALL_M = 0.3;
/** Roof overhang past a free wall, and the fascia's depth. */
export const OVERHANG_M = 0.25, FASCIA_M = 0.15;
/** The lid's top sits this far above the box lid (it hides it without z-fighting). */
export const LID_RAISE_M = 0.04;
/** Share of the slat family (the rest are matte black). */
export const SLAT_SHARE = 0.6;
/** Main-house search radius from the shed's footprint, and how much larger the house must be. */
export const HOUSE_REACH_M = 30, HOUSE_MIN_AREA_M2 = 40;

export type GardenRoomRule = 'year' | 'roof';

const yearOf = (p: Record<string, unknown>): number | null => p.constructionYear === null || p.constructionYear === undefined || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);

/** Which rule makes this shed a garden room; null keeps it a shed. Call only for pands already classed as sheds. */
export function gardenRoomRule(p: Record<string, unknown>, areaM2: number): GardenRoomRule | null {
  if (!(areaM2 >= GARDEN_ROOM_MIN_AREA_M2)) return null;
  const year = yearOf(p);
  if (year !== null && year >= GARDEN_ROOM_FROM_YEAR) return 'year';
  const conf = Number(p.roofConfidence);
  if (typeof p.roofSlot === 'string' && GARDEN_ROOM_ROOF_SLOTS.has(p.roofSlot) && Number.isFinite(conf) && conf >= GARDEN_ROOM_ROOF_CONFIDENCE) return 'roof';
  return null;
}

export type GardenRoomDesign = {
  family: 'slat' | 'black';
  /** Horizontal slats (the minority of the slat family) instead of vertical. */
  horizontal: boolean;
  wallHex: string;
  jointHex: string;
  /** Black rooms only: one slatted ochre wall beside the glass. */
  accent: { wallHex: string; jointHex: string } | null;
};

const mixHex = (a: string, b: string, t: number): string => { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t) as [number, number, number]); };
const scaleHex = (a: string, k: number): string => rgbToHex(hexToRgb(a).map(v => v * k) as [number, number, number]);

/** The larch tone: fresh ochre inside the photos' band, greyed by age (undated: a middle weathering). */
export function slatHex(id: string, year: number | null): string {
  const T = GARDEN_ROOM_TONES, fresh = mixHex(T.slatFresh[0], T.slatFresh[1], hash01(`${id}:slat-tone`));
  const age = year === null ? 6 + hash01(`${id}:slat-age`) * 6 : Math.max(0, 2026 - year);
  // Untreated larch silvers over roughly a decade; thermo-wood and oiled boards keep some ochre (cap 0.7).
  const weather = Math.min(0.7, age / 14) * (0.75 + 0.5 * hash01(`${id}:slat-weather`));
  return mixHex(fresh, T.slatWeathered, Math.min(0.7, weather));
}

/** Deterministic per pand id: 60 % timber slat, 40 % matte black. */
export function gardenRoomDesign(id: string, year: number | null): GardenRoomDesign {
  const T = GARDEN_ROOM_TONES;
  if (hash01(`${id}:garden-room`) < SLAT_SHARE) {
    const wallHex = slatHex(id, year);
    return { family: 'slat', horizontal: hash01(`${id}:slat-dir`) < 0.2, wallHex, jointHex: scaleHex(wallHex, T.slatJointMul), accent: null };
  }
  const wallHex = mixHex(T.black[0], T.black[1], hash01(`${id}:black-tone`));
  const ochre = slatHex(id, year);
  return { family: 'black', horizontal: false, wallHex, jointHex: T.blackJoint, accent: hash01(`${id}:black-accent`) < 0.5 ? { wallHex: ochre, jointHex: scaleHex(ochre, T.slatJointMul) } : null };
}

/** The design's colours as a look draws them (storybook/cartoon tone; photo and procedural keep the prior). */
export function designInLook(d: GardenRoomDesign, look: BuildingLook): GardenRoomDesign {
  if (cellSetOf(look) === 'procedural') return d;
  return { ...d, wallHex: lookHex(d.wallHex, look), jointHex: lookHex(d.jointHex, look), accent: d.accent && { wallHex: lookHex(d.accent.wallHex, look), jointHex: lookHex(d.accent.jointHex, look) } };
}

/** The lid: the measured roof (its hex, already in the look) when the slot was read; dark EPDM otherwise. */
export function gardenRoomLidHex(p: Record<string, unknown>, measuredHex: string | null, look: BuildingLook): string {
  if (measuredHex) return measuredHex;
  return cellSetOf(look) === 'procedural' ? GARDEN_ROOM_TONES.lidEpdm : lookHex(GARDEN_ROOM_TONES.lidEpdm, look);
}

// ---------------------------------------------------------------------------
// Orientation
// ---------------------------------------------------------------------------

export type Pt = [number, number];

const segDist = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
};
const nearestOn = (p: Pt, a: Pt, b: Pt): Pt => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return [a[0] + u * dx, a[1] + u * dy];
};
const signedArea = (r: readonly Pt[]) => r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;

/** The ring as a counter-clockwise open ring (no repeated closing point), so the outward normal is right of travel. */
export function ccwRing(ring: readonly Pt[]): Pt[] {
  let r = ring.slice();
  if (r.length > 1 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 1e-6) r.pop();
  if (signedArea(r) < 0) r = r.reverse();
  return r;
}

/** Another pand near the shed, in local metres (CCW open ring), with its area. */
export type Neighbour = { ring: Pt[]; areaM2: number };

/** Edge i (from ring[i] to ring[i+1]) is a party wall when most of it lies within 0.3 m of another pand's outline. */
export function partyWalls(ring: readonly Pt[], neighbours: readonly Neighbour[]): boolean[] {
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length];
    let near = 0;
    for (const t of [0.2, 0.5, 0.8]) {
      const p: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (neighbours.some(n => n.ring.some((c, k) => segDist(p, c, n.ring[(k + 1) % n.ring.length]) <= PARTY_WALL_M))) near++;
    }
    return near >= 2;
  });
}

/** Distance from any vertex of a ring to the nearest street segment within `reach`; Infinity when none. */
export function streetDistanceOf(ring: readonly Pt[], streets: SegmentGrid | null, reach = 80): number {
  if (!streets) return Infinity;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let best = Infinity;
  for (const s of streets.near(x0 - reach, y0 - reach, x1 + reach, y1 + reach)) {
    const a: Pt = [streets.segs[s * 4], streets.segs[s * 4 + 1]], b: Pt = [streets.segs[s * 4 + 2], streets.segs[s * 4 + 3]];
    for (const p of ring) best = Math.min(best, segDist(p, a, b));
  }
  return best <= reach ? best : Infinity;
}

const ringGap = (a: readonly Pt[], b: readonly Pt[]): number => {
  let best = Infinity;
  for (const p of a) for (let k = 0; k < b.length; k++) best = Math.min(best, segDist(p, b[k], b[(k + 1) % b.length]));
  for (const p of b) for (let k = 0; k < a.length; k++) best = Math.min(best, segDist(p, a[k], a[(k + 1) % a.length]));
  return best;
};

/** The main house: the nearest pand within reach, at least 40 m2 and twice the shed, that stands nearer a street. */
export function mainHouse(ring: readonly Pt[], areaM2: number, neighbours: readonly Neighbour[], streets: SegmentGrid | null): Neighbour | null {
  const own = streetDistanceOf(ring, streets);
  let best: Neighbour | null = null, bestGap = HOUSE_REACH_M;
  for (const n of neighbours) {
    if (n.areaM2 < Math.max(HOUSE_MIN_AREA_M2, 2 * areaM2)) continue;
    const gap = ringGap(ring, n.ring);
    if (gap >= bestGap) continue;
    if (!(streetDistanceOf(n.ring, streets) < own)) continue;
    best = n; bestGap = gap;
  }
  return best;
}

/** Minimum wall length for the glass front. */
export const GLASS_MIN_EDGE_M = 1.0;

/**
 * The glass edge: of the free edges at least 1 m long, the one whose outward normal looks most directly at the
 * house (cosine > 0.2); else, with no house or no edge facing it, the longest free edge; -1 when every edge is
 * a party wall.
 */
export function glassEdge(ring: readonly Pt[], party: readonly boolean[], house: Neighbour | null): number {
  const len = (i: number) => { const a = ring[i], b = ring[(i + 1) % ring.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); };
  const free = ring.map((_, i) => i).filter(i => !party[i] && len(i) >= GLASS_MIN_EDGE_M);
  if (!free.length) return -1;
  if (house) {
    let best = -1, bestScore = 0.2;
    for (const i of free) {
      const a = ring[i], b = ring[(i + 1) % ring.length], l = len(i), n: Pt = [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
      const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let target: Pt = m, d = Infinity;
      for (let k = 0; k < house.ring.length; k++) { const q = nearestOn(m, house.ring[k], house.ring[(k + 1) % house.ring.length]), dd = Math.hypot(q[0] - m[0], q[1] - m[1]); if (dd < d) { d = dd; target = q; } }
      if (!(d > 1e-6)) continue;
      // Weight by a little length so a 1 m return does not beat the long wall facing the same way.
      const score = ((target[0] - m[0]) * n[0] + (target[1] - m[1]) * n[1]) / d + Math.min(0.1, l / 40);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) return best;
  }
  return free.reduce((a, i) => len(i) > len(a) ? i : a, free[0]);
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export type GardenRoomInput = {
  /** CCW open ring, local metres. */
  ring: Pt[];
  heightM: number;
  /** Glass edge index, -1 for none. */
  glass: number;
  party: readonly boolean[];
  design: GardenRoomDesign;
  lidHex: string;
  frameHex: string;
  fasciaHex: string;
  glassHex: string;
};

/** Joint spacing never tighter than this (a finer stripe aliases from the chase camera). */
export const MIN_JOINT_PITCH_M = 0.22;
/** Out from the wall plane: overlay panels, then joints and glass on top. */
const OUT_PANEL = 0.015, OUT_FRAME = 0.02, OUT_TOP = 0.035;

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function quad(out: FlatTri[], q: [V3, V3, V3, V3], n: V3, hex: string) {
  const [A, B, C, D] = q, c = cross([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]);
  if (Math.hypot(...c) < 1e-9) return;
  const flip = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0;
  out.push({ p: flip ? [A, C, B] : [A, B, C], hex, n }, { p: flip ? [A, D, C] : [A, C, D], hex, n });
}

/** The roof outline offset outward by 0.25 m past free walls (0.02 m past party walls), mitred, miter capped. */
export function overhangRing(ring: readonly Pt[], party: readonly boolean[]): Pt[] {
  const m = ring.length, off = party.map(p => p ? 0.02 : OVERHANG_M);
  const nrm = ring.map((a, i) => { const b = ring[(i + 1) % m], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l] as Pt; });
  return ring.map((v, i) => {
    const j = (i + m - 1) % m, n0 = nrm[j], n1 = nrm[i], d0 = off[j], d1 = off[i];
    // Intersect the two offset lines: x . n0 = v . n0 + d0, x . n1 = v . n1 + d1.
    const det = n0[0] * n1[1] - n0[1] * n1[0];
    if (Math.abs(det) < 1e-6) return [v[0] + n1[0] * Math.max(d0, d1), v[1] + n1[1] * Math.max(d0, d1)];
    const r0 = d0, r1 = d1;
    const x: Pt = [v[0] + (r0 * n1[1] - r1 * n0[1]) / det, v[1] + (n0[0] * r1 - n1[0] * r0) / det];
    if (Math.hypot(x[0] - v[0], x[1] - v[1]) > 3 * OVERHANG_M) { const bx = n0[0] + n1[0], by = n0[1] + n1[1], bl = Math.hypot(bx, by) || 1; return [v[0] + bx / bl * OVERHANG_M, v[1] + by / bl * OVERHANG_M]; }
    return x;
  });
}

/**
 * The garden room's triangles beyond the plain box: glass front in a dark frame with a door leaf, slat or board
 * joints on the free walls (an ochre slat panel beside the glass on half the black rooms), and a lid slab with a
 * small overhang and a thin dark fascia. Never more than `GARDEN_ROOM_TRI_BUDGET`.
 */
export function gardenRoomTriangles(input: GardenRoomInput): FlatTri[] {
  const { ring, heightM: h, glass, party, design } = input;
  const m = ring.length, out: FlatTri[] = [];
  if (m < 3 || !(h > 0.5)) return out;
  const top = h + LID_RAISE_M, fasciaBottom = top - FASCIA_M;
  const edge = (i: number) => {
    const a = ring[i], b = ring[(i + 1) % m], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, nx = uy, ny = -ux;
    const at = (s: number, z: number, o: number): V3 => [a[0] + ux * s + nx * o, a[1] + uy * s + ny * o, z];
    return { len, n: [nx, ny, 0] as V3, at };
  };
  const panel = (i: number, s0: number, s1: number, z0: number, z1: number, o: number, hex: string) => {
    if (s1 - s0 < 0.01 || z1 - z0 < 0.01) return;
    const e = edge(i);
    quad(out, [e.at(s0, z0, o), e.at(s1, z0, o), e.at(s1, z1, o), e.at(s0, z1, o)], e.n, hex);
  };

  // 1. Lid slab: top face and fascia. Skipped on a ring too complex for the budget.
  const lidTris = m - 2 + 2 * m;
  if (lidTris <= 28) {
    const lid = overhangRing(ring, party);
    const idx = earcut(lid.flat());
    for (let k = 0; k < idx.length; k += 3) {
      const tri = [idx[k], idx[k + 1], idx[k + 2]].map(j => [lid[j][0], lid[j][1], top] as V3);
      const c = cross([tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], 0], [tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], 0]);
      out.push({ p: c[2] < 0 ? [tri[0], tri[2], tri[1]] : tri, hex: input.lidHex, n: [0, 0, 1] });
    }
    for (let i = 0; i < m; i++) {
      const a = lid[i], b = lid[(i + 1) % m], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 0.01) continue;
      const n: V3 = [(b[1] - a[1]) / l, -(b[0] - a[0]) / l, 0];
      quad(out, [[a[0], a[1], fasciaBottom], [b[0], b[1], fasciaBottom], [b[0], b[1], top], [a[0], a[1], top]], n, input.fasciaHex);
    }
  }
  const wallTop = lidTris <= 28 ? fasciaBottom : h;

  // 2. Glass front: a dark frame panel, a fixed pane and a door leaf (one pane on a narrow wall).
  if (glass >= 0) {
    const e = edge(glass), s0 = 0.05, s1 = e.len - 0.05, fz = wallTop;
    panel(glass, s0, s1, 0, fz, OUT_FRAME, input.frameHex);
    const p0 = s0 + 0.07, p1 = s1 - 0.07, z0 = 0.08, z1 = fz - 0.07;
    if (p1 - p0 >= 1.9) {
      const door = Math.min(1.0, (p1 - p0) * 0.42);
      panel(glass, p0, p0 + door, z0, z1, OUT_TOP, input.glassHex);
      panel(glass, p0 + door + 0.06, p1, z0, z1, OUT_TOP, input.glassHex);
    } else panel(glass, p0, p1, z0, z1, OUT_TOP, input.glassHex);
  }

  // 3. The accent: on half the black rooms, a slatted ochre wall beside the glass (the free edge next to it).
  const walls = ring.map((_, i) => i).filter(i => i !== glass && !party[i] && edge(i).len >= 0.6);
  let accentWall = -1;
  if (design.accent && glass >= 0) {
    accentWall = [(glass + 1) % m, (glass + m - 1) % m].find(i => walls.includes(i) && edge(i).len >= 1.2) ?? -1;
    if (accentWall >= 0) panel(accentWall, 0.02, edge(accentWall).len - 0.02, 0, wallTop, OUT_PANEL, design.accent.wallHex);
  }

  // 4. Joints: the shadow lines between boards, spread evenly over the free walls with what the budget leaves.
  const quadsLeft = Math.max(0, Math.floor((GARDEN_ROOM_TRI_BUDGET - out.length) / 2));
  if (quadsLeft && walls.length) {
    const wallH = wallTop - 0.02;
    // Black boards show fewer, fainter lines; slats the most the budget allows.
    const want = design.family === 'black' ? Math.ceil(quadsLeft * 0.5) : quadsLeft;
    if (design.horizontal) {
      // Horizontal slats: one joint per course per wall.
      const courses = Math.max(1, Math.min(Math.floor(want / walls.length), Math.floor(wallH / MIN_JOINT_PITCH_M) - 1));
      const pitch = wallH / (courses + 1), gap = Math.max(0.03, Math.min(0.07, pitch * 0.2));
      for (const i of walls) for (let c = 1; c <= courses; c++) panel(i, 0.01, edge(i).len - 0.01, c * pitch - gap / 2, c * pitch + gap / 2, OUT_TOP, design.jointHex);
    } else {
      const total = walls.reduce((s, i) => s + edge(i).len, 0);
      const pitch = Math.max(MIN_JOINT_PITCH_M, total / want), gap = Math.max(0.035, Math.min(0.09, pitch * 0.22));
      // Uniform along the free walls laid end to end, so short walls still get their share; none on a corner.
      let start = 0;
      for (const i of walls) {
        const len = edge(i).len, hex = i === accentWall && design.accent ? design.accent.jointHex : design.jointHex;
        for (let k = Math.ceil((start - pitch / 2) / pitch); (k + 0.5) * pitch < start + len; k++) {
          const s = (k + 0.5) * pitch - start;
          if (s - gap / 2 < 0.06 || s + gap / 2 > len - 0.06) continue;
          panel(i, s - gap / 2, s + gap / 2, 0.02, wallH, OUT_TOP, hex);
        }
        start += len;
      }
    }
  }
  return out.length > GARDEN_ROOM_TRI_BUDGET ? out.slice(0, GARDEN_ROOM_TRI_BUDGET - (GARDEN_ROOM_TRI_BUDGET % 2)) : out;
}

/** The look's glazing tint for the glass front (the street crowns' own pane colour). */
export const gardenRoomGlassHex = (look: BuildingLook): string => look === 'cartoon' ? GARDEN_ROOM_TONES.glassCartoon : GARDEN_ROOM_TONES.glass;
